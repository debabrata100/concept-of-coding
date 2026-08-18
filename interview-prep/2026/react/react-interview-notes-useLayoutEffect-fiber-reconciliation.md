# React Deep-Dive Interview Notes
### useLayoutEffect, Fiber Architecture & Reconciliation

---

## Q1. Does `useLayoutEffect` run between the browser's layout and paint phase? If you `setState` inside it, does painting get skipped to the next render cycle?

### The precise timing

The common line — "runs between layout and paint" — is slightly imprecise. Accurate sequence:

```
1. React renders (reconciliation — Virtual DOM diffing)
2. React commits — actual DOM mutations applied
3. Browser has NOT painted yet
4. useLayoutEffect callbacks run SYNCHRONOUSLY, blocking the main thread
5. If you read layout (getBoundingClientRect, scrollTop, offsetWidth...) here,
   the browser is forced into a synchronous reflow to give accurate numbers
6. If you setState inside useLayoutEffect, React re-renders and re-commits
   synchronously, right there, before yielding control
7. ONLY AFTER this settles does the browser paint
8. useEffect callbacks run asynchronously AFTER paint (scheduled, not blocking)
```

**Precise definition:** `useLayoutEffect` runs synchronously after DOM mutations are committed, but before the browser paints. It doesn't sit "inside" the browser's native layout/paint pipeline — it's a React-scheduled callback that happens to run in that gap. Reading layout properties inside it triggers a forced synchronous layout (same mechanism as layout thrashing).

**Soundbite:** *"useLayoutEffect fires synchronously after the DOM has been mutated but before paint. Reading layout-dependent properties inside it forces the browser to compute layout early, on my terms."*

### Does painting get skipped?

Not skipped — **deferred and coalesced**.

If you `setState` inside `useLayoutEffect`:
- React does **not** let the browser paint the stale intermediate DOM.
- React re-renders → re-commits → runs layout effects again, synchronously, before yielding the thread.
- The browser paints only once, after this whole loop settles.
- Result: the user sees only the **final** state — zero flicker.

Compare to `useEffect`: commit → paint (state A visible) → effect runs async → setState → paint again (state B). The user can see a visible flash of state A — a flicker.

**This is the canonical reason `useLayoutEffect` exists:** measure-then-mutate synchronously so the user never sees the pre-mutation frame.

```jsx
// Positioning a tooltip based on measured size
function Tooltip({ targetRef, children }) {
  const tooltipRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    const targetRect = targetRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    // Reposition BEFORE paint — no flash of tooltip at (0,0)
    setPosition({
      top: targetRect.top - tooltipRect.height - 8,
      left: targetRect.left + (targetRect.width - tooltipRect.width) / 2,
    });
  }, [targetRef]);

  return (
    <div ref={tooltipRef} style={{ position: 'absolute', ...position }}>
      {children}
    </div>
  );
}
```

### Mid-level vs senior-level framing

| | Mid-level answer | Senior-level answer |
|---|---|---|
| Timing | "Runs before paint" | "Runs synchronously after commit, blocks the main thread, and layout reads force a synchronous reflow" |
| setState inside it | "Updates before paint" | "Causes a synchronous re-render/re-commit loop that blocks painting until settled — trades flicker for a main-thread block" |
| Trade-off awareness | Not mentioned | Overuse blocks the main thread and hurts perceived performance (jank); reserve for measurement-driven DOM mutations |
| SSR | Unaware | Doesn't run on the server, React warns; fix with `useIsomorphicLayoutEffect` (falls back to `useEffect` on server) |

**Rule of thumb to state out loud:** default to `useEffect`; reach for `useLayoutEffect` only when you must read layout and mutate the DOM before the user's eyes see it (measurements, scroll restoration, avoiding flicker on mount).

---

## Q2. What happens if two sibling components both use `useLayoutEffect`, and one measures the other's DOM node?

This is really a question about **commit-phase sub-phases and fiber tree traversal**, not hooks in isolation.

### Step 1: The commit phase has sub-phases, tree-wide

```
1. Before Mutation  — (getSnapshotBeforeUpdate, etc.)
2. Mutation          — ALL DOM changes for the ENTIRE tree applied here
3. Layout             — ALL useLayoutEffect callbacks fire here, for the ENTIRE tree
                          (browser has not painted yet)
```

Each sub-phase completes for the **entire tree** before the next sub-phase starts anywhere. React does not interleave "mutate A → layout-effect A → mutate B → layout-effect B" — it's "mutate everything → layout-effect everything."

**Direct answer:** if sibling B measures sibling A's DOM node inside `useLayoutEffect`, **B always sees A's fully up-to-date, rendered DOM**, regardless of firing order. This part is safe and deterministic.

### Step 2: Firing order still matters — for imperative mutations

Layout effects fire in this order:
- **Children fire before their parent**
- **Siblings fire in render/declaration order** (JSX order, top to bottom)

```jsx
function Parent() {
  return (
    <>
      <A />  {/* fires first */}
      <B />  {/* fires second */}
    </>
  );
}
```

The trap: if A's `useLayoutEffect` does a **manual, imperative DOM mutation** (e.g. `domNode.style.height = '200px'` — not via React `setState`):

- Since A fires before B, B *will* see that manual mutation. ✅ Safe, but order-dependent.
- If order were reversed, B would measure **stale** layout. ❌ A real, subtle bug.

**React-driven DOM (from render/props/state) is always safe to measure across siblings. Imperative/manual DOM mutations inside a layout effect are only safe if render order is guaranteed** — fragile, don't depend on it.

### Step 3: What if the measured setState triggers a re-render?

- It does **not** interrupt B's layout effect from firing.
- React finishes firing **all** layout effects for the current commit first (A's, then B's).
- Only after the batch completes does React check whether `setState` was called — if so, it triggers a new synchronous render + commit + layout-effect pass, before yielding to the browser for paint.
- So in the first pass, B measures A's **pre-setState** DOM. If B needs A's post-update value, lift state up to the parent rather than relying on effect ordering.

### Senior-level takeaway

> "Because DOM mutation is committed tree-wide before any layout effects run, cross-sibling measurement of *rendered* DOM is always safe. The danger is siblings doing imperative DOM writes inside their layout effects and relying on render order for that to propagate — that's a race condition waiting to happen. The correct pattern is to lift the coordination into the parent — measure both children there, or use a shared ref/callback pattern — rather than have siblings implicitly depend on each other's effect order."

Recognizing this as an **architectural smell** (implicit ordering dependency between siblings), not just a mechanics question, is the signal of 15+ years of experience.

---

## Q3. Is a Virtual DOM node created for every single component, and is that essentially a Fiber node?

**React elements** and **fiber nodes** are related but distinct — conflating them is the classic mistake.

### React element ("the virtual DOM")

A plain, immutable JS object created every render by `React.createElement()` / JSX. Cheap, disposable, describes "what should be on screen right now." **A new element object is created on every single render call**, even if nothing changed.

```jsx
// JSX...
<div className="box">Hello</div>

// ...compiles to this object, recreated every render:
{
  type: 'div',
  props: { className: 'box', children: 'Hello' },
  key: null,
  ref: null,
  $$typeof: Symbol(react.element)
}
```

### Fiber node

A persistent, mutable JS object that React creates and **keeps alive across renders**. It's the actual unit of work for reconciliation.

```js
{
  type: 'div',
  key: null,
  stateNode: /* actual DOM node or class instance */,
  child: FiberNode,      // first child
  sibling: FiberNode,    // next sibling
  return: FiberNode,     // parent
  pendingProps: {...},
  memoizedProps: {...},
  memoizedState: {...},  // hooks linked list lives here!
  alternate: FiberNode,  // pointer to the other tree
  flags: ...,            // what needs to happen: Placement, Update, Deletion
}
```

### The distinction

| | React Element | Fiber |
|---|---|---|
| Created | Every render call | Once per instance, then reused |
| Mutable? | No — immutable | Yes — mutated in place |
| Lifetime | Thrown away immediately after render | Persists across the component's life |
| Purpose | Cheap description of desired UI | Actual unit of reconciliation work; holds state/hooks/DOM refs |

**Answer: yes — one fiber per component instance/host node, created once, reused/mutated across re-renders.**

What happens each render: React creates fresh element objects → diffs (`type` + `key`) the new element against the **existing fiber's** `pendingProps`/`type` → match → reuse the same fiber, update props/state in place → mismatch → old fiber torn down, new fiber created (why changing `key` remounts).

### Double-buffering (senior-level detail)

React keeps **two** fiber trees, enabling concurrent rendering:

- **`current` tree** — mirrors what's on screen right now
- **`workInProgress` tree** — being built/updated during render, off-screen

Each fiber has an `alternate` pointer to its counterpart in the other tree. On commit, React just **flips a pointer** — `workInProgress` becomes the new `current` — instead of rebuilding anything. This is why React can pause, abandon, or resume rendering mid-way (concurrent features, `startTransition`, Suspense) without the user seeing an inconsistent screen.

### "Virtual DOM" isn't one uniform tree

- **Host component fibers** (`div`, `span`, `button`...) → correspond to real DOM nodes; `stateNode` points at the actual DOM element.
- **Composite component fibers** (function/class components) → no direct DOM node; `stateNode` is null (function) or the class instance — pure bookkeeping nodes.

The fiber tree also contains nodes with no DOM representation at all: context providers, fragments, suspense boundaries, etc.

### Soundbite

> "React elements are the virtual DOM — cheap, immutable descriptions recreated every render. Fibers are the persistent, mutable data structures — one per component instance — that React actually diffs and mutates across renders, doubling as the scheduler's unit of work. The element is thrown away after render; the fiber is what survives."

---

## Q4. How does the reconciliation algorithm decide "reuse this fiber" vs "tear down and recreate"? Why does array index as `key` break this?

### The core problem

Classic tree-diffing is O(n³) — every old node compared against every new node. Unusable at UI scale. React makes two assumptions to reach **O(n)**:

1. **Two elements of different `type` produce different trees** — no attempt to diff their children; tear down and rebuild the subtree.
2. **`key` is the developer's hint of stable identity across renders** — without it, React falls back to positional comparison.

This is a heuristic-based trade-off, not a "true" diff — right almost all the time, but not always.

### The reuse decision

```js
if (oldFiber.type === newElement.type && oldFiber.key === newElement.key) {
  // SAME identity → reuse the fiber, update pendingProps
  // memoizedState (hooks, refs, etc.) survives untouched
} else {
  // DIFFERENT identity → oldFiber tagged for Deletion,
  // new fiber created — all internal state lost, hooks reset, DOM rebuilt
}
```

A `type` mismatch is the more dramatic case: if `<div>` becomes `<span>`, or `<Foo>` becomes `<Bar>`, React doesn't attempt to reconcile children — it nukes the whole subtree and remounts. Prefer keeping the same type and toggling props/children instead of swapping types at the same JSX position.

### Reconciling children: single child vs list

- **Single child** → straightforward type+key comparison against the existing fiber.
- **List of children** → two-pass approach:
  1. **Pass 1** — walk both lists in order, comparing same-index old/new fibers; as long as `key` matches positionally, keep reusing (fast path — handles the common "nothing changed" case).
  2. **Pass 2** — on the first `key` mismatch, bail out of the fast path, build a **Map of `key → fiber`** from remaining old children, then look up each new child by key to decide reuse / create / move.

### Why array index as `key` breaks this

```jsx
{items.map((item, index) => <Row key={index} item={item} />)}
```

`[A, B, C]` keyed `[0, 1, 2]` → prepend a new item → `[D, A, B, C]`, still keyed `[0, 1, 2, 3]`:

- Key `0` used to point to `A`'s fiber, now points to `D`'s data.
- React sees "key 0 fiber exists, `type` matches → reuse it, update props."
- It never sees this as "a new item was inserted" — it sees "the item at position 0 changed its props."

**Consequences:**
- Every row after the insertion point gets props-diffed / DOM-mutated unnecessarily — the perf benefit keys exist for is lost.
- Worse: **internal state** (uncontrolled input value, animation state, `useState` inside `Row`) stays attached to the *position*, not the *item* — `D`'s row can show `A`'s stale internal state. Classic bug: "text input shows the wrong value after reordering a list."

**Fix:** key by a stable, unique identifier from the data (`item.id`) — never index, never `Math.random()` (defeats keys entirely by guaranteeing a mismatch every render). Index-as-key is only safe for provably static lists (never reordered/filtered/inserted, no per-item internal state) — rare enough that the safe default is "never use index."

### How O(n) actually holds — local, not global comparisons

The key subtlety: **a new element is only ever compared against old fibers that were its siblings under the same parent.** React never searches across the whole tree for a match.

Example tree:

```
Old fiber tree:                New elements (this render):
        A                              A
       / \                            / \
      B   E                          B   E
      |   |                          |   |
      C   F                          C   F
      |   |                          |   |
      D   G                          D   G
```

React does **one depth-first pass** using each fiber's `child` / `sibling` / `return` pointers (an explicit linked-list walk — why fibers are structured this way, so the walk can pause/resume):

1. `beginWork(A)` — new `A` vs old `A` → match → reuse
2. `A.child` — new `B` vs old `B` → match → reuse
3. `B.child` — `C` vs `C` → reuse
4. `C.child` — `D` vs `D` → reuse, leaf → `completeWork(D)`
5. Walk back up via `return` to C → complete → to B → complete → **B has sibling E**
6. `B.sibling` — new `E` vs old `E` → reuse → repeat down `F`, `G`

**Total comparisons: 7 — one per fiber. Not 49, not cubic.** Each node visited exactly once, constant work per node, then move on — the definition of O(n).

Without the "local sibling group" rule (e.g., searching the *entire* old tree for a matching `D` regardless of parent), every comparison could scan the whole tree — back to O(n²) or worse. React deliberately refuses to do this: if a node moves to a different parent/level, React doesn't find it — it tears down and recreates, even if "conceptually the same."

For sibling lists specifically, the `key → fiber` map keeps sub-step cost at O(k) per sibling group (map build) + O(1) per lookup, summing to O(n) across the whole tree.

### Soundbite

> "It's O(n) because every fiber is visited and compared exactly once, via a single iterative depth-first walk using the child/sibling/return pointers — not a recursive search. Comparisons are scoped locally to a node's sibling group under its parent, never globally across the tree, and within a sibling group, `key`-based lookups are O(1) via a map rather than a linear search. Remove either constraint — global search, or O(n) sibling search instead of O(1) — and you lose linear time."

---

## Open thread (not yet covered)
- Why moving a component to a different tree level always causes a full remount, even with matching keys.
- How `React.memo` / bail-out mechanism interacts with Context re-renders.
