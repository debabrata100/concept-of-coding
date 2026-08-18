# React Core Concepts — Mechanistic Reference

Deep explanations of the topics covered in session, written so you can **derive**
answers rather than recall them. Each section ends with a speakable interview answer.

---

## Table of Contents

1. [The Update Pipeline: Render → Diff → Commit](#1-the-update-pipeline)
2. [Reconciliation and the Diffing Algorithm](#2-reconciliation-and-the-diffing-algorithm)
3. [Batching](#3-batching)
4. [The Commit Phase and Effect Timing](#4-the-commit-phase-and-effect-timing)
5. [The Re-Render Cascade](#5-the-re-render-cascade)
6. [Context and Re-Renders](#6-context-and-re-renders)
7. [Diagnosing Over-Rendering](#7-diagnosing-over-rendering)
8. [Stale Closures](#8-stale-closures)
9. [React 19: Actions and the Async Story](#9-react-19-actions-and-the-async-story)
10. [React 19: Server Components](#10-react-19-server-components)

---

## 1. The Update Pipeline

```
setState
   ↓
RENDER PHASE      build new virtual DOM  (pure, interruptible)
   ↓
RECONCILIATION    diff old tree vs new tree → changelist
   ↓
COMMIT PHASE      apply minimal DOM edits  (synchronous, uninterruptible)
```

### Render phase

Calling `setState` does **not** touch the DOM. React schedules a re-render, then calls
your component function again. The JSX it returns compiles to `React.createElement(...)`
calls, producing a fresh tree of plain JS objects — the new virtual DOM.

Two properties that matter:

- **It must be pure.** React may run it, discard the result, and run it again. This is
  exactly why StrictMode double-invokes renders in development — to surface impure renders.
- **It is interruptible.** Since Fiber, rendering is split into units of work, so React
  can pause a low-priority render (filtering a huge list) to handle an urgent one
  (a keystroke), then resume. This is the foundation of `useTransition` and
  `useDeferredValue`.

### Why a virtual DOM at all?

Direct DOM manipulation is expensive and imperative. The VDOM lets you write declarative
code ("here's what the UI should look like") while React figures out the minimal
imperative steps to get there. The VDOM itself is not "fast" — plain JS objects are just
much cheaper to create and compare than DOM nodes.

---

## 2. Reconciliation and the Diffing Algorithm

Comparing two arbitrary trees optimally is **O(n³)** — unusable. React gets it to **O(n)**
with two heuristics:

### Heuristic 1 — Different type ⇒ tear down and rebuild

`<div>` → `<span>`, or `<Counter>` → `<Timer>`: React unmounts the entire subtree
(state destroyed, effects cleaned up) and mounts a fresh one. No attempt to salvage.

### Heuristic 2 — Same type ⇒ keep the node, patch the differences

`<div className="red">` → `<div className="blue">`: React keeps the DOM node and records
"update className". For components of the same type, the instance and its state survive;
React re-renders it with new props and recurses into children.

### Keys — matching siblings across renders

Within a list, position alone can't tell React whether an item was inserted, removed, or
reordered. A stable key says "this is the same item as before, just moved," so React
reuses the node instead of destroying and recreating it.

**Why index-as-key breaks:** the key stays with the *position*, not the *item*. Reorder
the list and React thinks item 0 just changed its text — so DOM state that React doesn't
manage (input values, focus, scroll position, CSS animation state) stays attached to the
wrong row.

Index keys are safe only when the list is static: never reordered, filtered, or
inserted-into.

### Output

Reconciliation produces a **changelist** of effects: "update textContent here," "insert
node there," "remove that one." Nothing has hit the screen yet.

> **Speakable answer**
> "The virtual DOM is a lightweight JS object tree describing the UI. On a state update,
> React re-runs components to build a new tree — the render phase, which is pure and,
> since Fiber, interruptible. It then diffs against the previous tree with an O(n)
> heuristic: different element types mean rebuild the subtree, same types mean patch
> attributes and recurse, and keys let it match list items across reorders. The result is
> a minimal changelist applied to the real DOM in one synchronous commit phase."

---

## 3. Batching

Batching is about the **trigger** side — how many times the pipeline runs.

```js
function handleClick() {
  setCount(c => c + 1);
  setFlag(true);
  setName("Ravi");
}
```

React does **not** run render → diff → commit three times. It collects all updates queued
in the same tick and runs **one** pass.

**The React 18 change:** before 18, batching only happened inside React event handlers.
Updates inside `setTimeout`, promises, or native event handlers each triggered a separate
render. React 18's `createRoot` enables **automatic batching everywhere**.

```js
// React 17: two renders.  React 18: one render.
setTimeout(() => {
  setCount(c => c + 1);
  setFlag(true);
}, 0);
```

**Escape hatch:** `flushSync(() => setCount(1))` forces a synchronous flush. Rare — used
when you must read the updated DOM immediately after.

So minimal DOM work is achieved twice over: **batching** minimizes how many times the
pipeline runs; **diffing** minimizes how much DOM work each run produces.

---

## 4. The Commit Phase and Effect Timing

The commit phase runs in three synchronous sub-passes:

**1. Before mutation** — React reads from the DOM before changing it.
`getSnapshotBeforeUpdate` runs here (class components) — e.g. capturing scroll position.

**2. Mutation** — React applies the changelist: inserts, deletions, attribute and text
updates. It also runs the **previous render's `useLayoutEffect` cleanups** and detaches
refs from removed nodes.

**3. Layout** — DOM is updated but **not yet painted**. React attaches refs (so
`ref.current` points at the new node) and runs **`useLayoutEffect` setup synchronously**.

Then React yields, the **browser paints**, and afterwards — asynchronously —
**`useEffect`** runs (previous cleanup first, then setup).

```
DOM mutations
      ↓
refs attached + useLayoutEffect       ← synchronous, BLOCKS paint
      ↓
━━━━━━━ BROWSER PAINTS ━━━━━━━
      ↓
useEffect                             ← asynchronous, after paint
```

### Why the split exists

- **`useLayoutEffect`** runs before paint, so measuring a node and synchronously
  re-rendering to reposition happens *invisibly*. Cost: it blocks painting.
- **`useEffect`** runs after paint, so it never delays a frame. Cost: if it changes
  something visible based on a measurement, the user sees a flicker.

**Rule of thumb:** default to `useEffect` for everything — data fetching, subscriptions,
logging, timers. Reach for `useLayoutEffect` only when you must *read layout from the DOM
and re-render before paint*: tooltip/popover positioning, measuring text overflow, scroll
restoration.

**Canonical example:** a tooltip that measures its own height to decide whether to flip
above or below its anchor. With `useEffect` → renders in default position, paints,
measures, flips → visible flicker. With `useLayoutEffect` → correct on the first visible
frame.

### Two bonus details

- **Cleanup ordering:** on every re-render the *previous* effect's cleanup runs before the
  new setup. Layout-effect cleanups during mutation; `useEffect` cleanups after paint,
  just before the new setups. On unmount, only cleanups run.
- **SSR caveat:** `useLayoutEffect` does nothing on the server and warns. Standard dodge is
  a `useIsomorphicLayoutEffect` wrapper, or keeping it in client components.

### Interview trap: `fetch` inside `useLayoutEffect`

It *appears* to work — `fetch` is async, so paint isn't blocked while waiting. Why it's
still wrong:

1. The **synchronous portion** of the callback still blocks paint, and every
   `useLayoutEffect` in the tree does. The habit compounds.
2. It **breaks on SSR** (warning + behavioral difference).
3. It **lies about intent** — readers will hunt for a layout dependency that doesn't exist.

Note: the second render when data arrives is *not* a symptom of the misuse — you'd get
that with `useEffect` too. That's just the normal fetch-then-setState pattern.

---

## 5. The Re-Render Cascade

### The default rule

> **React does not compare props to decide whether to re-render.**
> When a parent re-renders, **every child re-renders too** — unconditionally, even if
> props are identical, even with no props at all.

Re-renders **start** at the component that owns the changed state and propagate
**downward only**. Ancestors and sibling branches are untouched.

```
        App                    ← not re-rendered
       /    \
  Sidebar   Page ●             ← setState here: render starts
     |      /    \
  NavLink List  Header         ← both re-render; NavLink does not
```

### Why cascade instead of compare?

1. **React can't know a component's output without running it.** Output may depend on
   props, own state, context, or (if impure) anything else.
2. **Re-running is assumed cheap.** A component function just produces objects; the
   expensive part — real DOM — is protected by the diff. Comparing props everywhere costs
   something and needs your help anyway (reference equality), so it's opt-in.

**Corollary — a design principle:** keep state **as low in the tree as possible**. State
at the root makes every keystroke cascade through everything. "Lifting state up" has a
mirror twin: **pushing state down** is a performance technique.

### Does a wasted re-render touch the DOM?

**No.** The child's function runs, produces a new VDOM subtree, the diff finds nothing
changed, and the changelist for that subtree is empty. This is why unnecessary re-renders
are usually *cheap* — you pay for the function call and diff, not DOM work. They only
matter when the render itself is expensive (huge lists, heavy computation).

### The three ways to stop a cascade

**1. `React.memo`** — opt-in shallow `===` comparison of props; skips the render if all
match. Defeated by unstable references:

```jsx
// ❌ new object + new function every parent render — memo never bails out
<Child style={{ color: "red" }} onClick={() => save(id)} />

// ✅ stable references
const style = useMemo(() => ({ color: "red" }), []);
const onClick = useCallback(() => save(id), [id]);
<Child style={style} onClick={onClick} />
```

That's the entire reason `useCallback`/`useMemo` exist — to make `React.memo` viable.

**2. Same-element-reference bailout** *(the underrated one)* — if React encounters the
**exact same element object** as last render, it skips that component entirely. This makes
composition a performance tool:

```jsx
function Layout({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}>Toggle</button>
      {open && <Drawer />}
      {children}          {/* created by App, not by Layout */}
    </div>
  );
}

// In App:
<Layout>
  <ExpensiveTree />
</Layout>
```

When `open` changes, `Layout` re-renders — but `children` was created by **App**, which
did *not* re-render. The `<ExpensiveTree />` element is the same object reference, so
React bails out. **No memo needed.**

⚠️ **This breaks the moment App re-renders.** If state moves up to App
(`<Layout open={open}><ExpensiveTree /></Layout>`), App re-runs its JSX, creates a *new*
`<ExpensiveTree />` element object, identity check fails, and the cascade proceeds
normally. Same tree, different outcome — purely because of *where state lives*.

**3. React Compiler** — automates #1 at build time with fine-grained memoization, without
manual `memo`/`useCallback` plumbing.

*(Context punches through all three — see next section.)*

> **Speakable answer**
> "By default a parent re-render re-renders all children regardless of props. `React.memo`
> opts a child out via shallow prop comparison, which unstable references defeat — hence
> `useCallback`/`useMemo`. There's also a bailout when React sees the identical element
> object, which is why children-as-props works as a perf technique. But even a wasted
> re-render usually touches zero real DOM, because the diff comes back empty."

---

## 6. Context and Re-Renders

When a component calls `useContext`, it **subscribes directly to that context**. When the
Provider's `value` changes (by `Object.is`), React re-renders every subscribed consumer —
**regardless of whether parents rendered, and straight through `React.memo`.**

**Why memo can't block it:** `memo` compares *props*. Context isn't a prop — it's a
separate channel that bypasses the props pipeline. If memo could block context updates, a
memoized component could display a stale theme forever.

**Non-consumers are unaffected.** A component sitting under a Provider that never calls
`useContext` won't re-render from a context change. *Consumption creates the subscription.*

### The classic pitfall

```jsx
// ❌ new object identity every parent render → all consumers re-render
<ThemeContext.Provider value={{ theme, toggle }}>

// ✅ stable identity
const value = useMemo(() => ({ theme, toggle }), [theme]);
<ThemeContext.Provider value={value}>
```

### Mitigations to name in an interview

- **Split** one fat context into focused ones (`ThemeContext`, `UserContext`) so a change
  to one doesn't wake consumers of the other.
- **Memoize** the provider `value`.
- **Separate state and dispatch** into two contexts — components that only dispatch never
  re-render on state changes.
- **Use a store** (Zustand, Redux, `useSyncExternalStore`) where components subscribe to
  *slices* rather than the whole value.

> **Speakable answer**
> "Context updates propagate directly from Provider to consumers, bypassing both parent
> renders and `React.memo` — memo guards props, and context isn't a prop. Non-consumers
> are unaffected. That's why big, frequently-changing contexts get split or memoized, or
> replaced with a slice-subscribing store."

---

## 7. Diagnosing Over-Rendering

A repeatable procedure for "this re-renders too often — fix it."

### Step 1 — Measure before touching anything

Open **React DevTools Profiler**, record the interaction, read the flame graph. Enable
**"Record why each component rendered"** — it reports, per component: *parent rendered*,
*props changed (and which)*, *state changed*, or *context changed*. Optionally mention
`why-did-you-render` for catching unstable-reference props.

**Never optimize on vibes.** Most re-renders are harmless empty diffs; you're hunting the
expensive ones.

### Step 2 — Map the profiler reason to a cause

| Profiler says | Cause | Fix direction |
|---|---|---|
| "Parent rendered" | Cascade; state lives too high | Push state down / composition |
| "Props changed: onClick" (logically same) | Unstable reference | `useCallback` / `useMemo` |
| "Context changed" | Fat or unmemoized context | Split / memoize value |
| "State changed" + huge subtree | Render is genuinely expensive | Virtualize / transition |

### Step 3 — Fix in priority order

**Structure before memoization** — this ordering *is* the senior answer.

1. **Push state down.** If only the search box cares about `query`, move the state (and
   the input) into a component that owns just that concern.
2. **Use composition / children-as-props** so React's own element-identity bailout applies
   for free.
3. **Then** `React.memo` + stabilized `useCallback`/`useMemo` references.
4. **Fix context**: split, memoize the value, separate state from dispatch.
5. **Virtualize** genuinely huge lists — no amount of skipped renders fixes the one render
   that must happen.
6. **`useTransition` / `useDeferredValue`** to keep input responsive while a heavy tree
   updates at lower priority.
7. Note that the **React Compiler** automates tier 3 — but not 1, 2, 5, or 6.

### Worked example

```jsx
// ❌ BEFORE — every keystroke re-renders TopBar, Footer, and 5,000 rows
function Dashboard() {
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState("light");
  const [orders, setOrders] = useState([]);   // ~5,000 rows

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme(...) }}>
      <TopBar />
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <OrderTable
        orders={orders.filter(o => o.customer.includes(query))}  // new array every render
        onRowClick={(id) => console.log(id)}                     // new function every render
      />
      <Footer />
    </ThemeContext.Provider>
  );
}
```

Four problems: state too high (cascade to TopBar/Footer), unmemoized context value (wakes
every consumer on every keystroke), two unstable props defeating `React.memo` on
`OrderTable`, and 5,000 unvirtualized rows.

```jsx
// ✅ AFTER
function Dashboard() {
  const [theme, setTheme] = useState("light");
  const [orders, setOrders] = useState([]);

  const themeValue = useMemo(
    () => ({ theme, toggle: () => setTheme(t => t === "light" ? "dark" : "light") }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={themeValue}>
      <TopBar />
      <SearchableOrders orders={orders} />   {/* query state moved down with its input */}
      <Footer />
    </ThemeContext.Provider>
  );
}

function SearchableOrders({ orders }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => orders.filter(o => o.customer.includes(query)),
    [orders, query]
  );
  const handleRowClick = useCallback((id) => console.log(id), []);

  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <OrderTable orders={filtered} onRowClick={handleRowClick} />  {/* + virtualize rows */}
    </>
  );
}
```

Keystrokes now re-render only `SearchableOrders` and `OrderTable`. `Dashboard`, `TopBar`,
and `Footer` are outside the blast radius — **not because of memo, but because state moved.**

⚠️ **When moving state down, check the JSX moves with it.** You can't move `query` into
`OrderTable` while the `<input>` stays in `Dashboard` — the input needs `query` and
`setQuery`. Wrap both in a new component instead.

---

## 8. Stale Closures

**The single most-tested concept in senior React interviews.**

A function created inside a render **captures the values of that render**. If a
long-lived callback (WebSocket handler, interval, event listener) isn't recreated when
those values change, it keeps using the frozen version forever.

### The buggy component

```jsx
function PriceTicker({ symbol }) {
  const [price, setPrice] = useState(null);
  const [history, setHistory] = useState([]);
  const [alertThreshold, setAlertThreshold] = useState(100);

  useEffect(() => {
    const socket = new WebSocket(`wss://api.example.com/prices/${symbol}`);

    socket.onmessage = (event) => {
      const newPrice = JSON.parse(event.data).price;
      setPrice(newPrice);
      setHistory([...history, newPrice]);              // 🐛 stale `history`
      if (newPrice > alertThreshold) {                 // 🐛 stale `alertThreshold`
        console.warn(`${symbol} crossed ${alertThreshold}`);
      }
    };
    // 🐛 no cleanup
  }, [symbol]);
  ...
}
```

### Four bugs, two root causes

**Root cause A — missing cleanup** (one bug, two symptoms):
- *Memory leak.* Every symbol switch opens a new socket; old ones stay open forever.
- *Stale price flicker.* The old `AAPL` socket keeps firing `setPrice` even after the UI
  switched to `TSLA`.

**Root cause B — stale closures** (two bugs):
- *Threshold never updates.* `onmessage` was created once with `alertThreshold = 100`.
  The user types `150`; state updates and the UI shows `150`, but the **old** `onmessage`
  still holds `100` in its closure. Comparisons run against 100 until `symbol` changes.
- *History loses entries.* `setHistory([...history, newPrice])` reads `history` from the
  closure. Two rapid messages both see the same stale array, both compute
  `[...old, price]`, and the second overwrites the first.

### The fix

```jsx
const alertThresholdRef = useRef(alertThreshold);
useEffect(() => { alertThresholdRef.current = alertThreshold; }, [alertThreshold]);

useEffect(() => {
  const socket = new WebSocket(`wss://api.example.com/prices/${symbol}`);

  socket.onmessage = (event) => {
    const newPrice = JSON.parse(event.data).price;
    setPrice(newPrice);
    setHistory(prev => [...prev, newPrice]);          // ✅ functional updater
    if (newPrice > alertThresholdRef.current) {       // ✅ live ref read
      console.warn(`${symbol} crossed ${alertThresholdRef.current}`);
    }
  };

  return () => socket.close();                        // ✅ cleanup
}, [symbol]);
```

### Why these fixes, not the alternatives

| Fix | Why not the alternative |
|---|---|
| `setHistory(prev => ...)` | Adding `history` to deps would tear down and reopen the socket on **every price tick**. |
| `alertThresholdRef.current` | Adding `alertThreshold` to deps would reconnect the socket on **every keystroke** in the threshold input. |
| `useEffectEvent` (React 19) | The modern replacement for the ref workaround — purpose-built for "read latest values without re-subscribing." Name it to signal you're current. |

### Two habits to internalize

1. **Any effect that sets up a subscription** (WebSocket, listener, interval, observer):
   audit every variable the callback reads. Anything not in the deps array is **frozen**.
   Either add it to deps (if resubscribing is cheap) or use a ref / `useEffectEvent`.
2. **Any `setThing([...thing, x])` or `setCount(count + 1)` inside an async callback**:
   switch to the functional form. Free upgrade, no downside.

> **Speakable answer**
> "Two root causes. Missing cleanup — the old WebSocket kept firing and leaking memory,
> which showed up as both stale price flicker and growing connection count. And stale
> closures — the `onmessage` handler captured `alertThreshold` and `history` from the
> render that created it, so comparisons used a frozen value and rapid updates overwrote
> each other. Fixes: `socket.close()` in cleanup, a functional updater for history, and a
> ref or `useEffectEvent` for the threshold — never deps, or you'd resubscribe on every
> keystroke."

---

## 9. React 19: Actions and the Async Story

### The problem being solved

Every mutation used to require the same boilerplate:

```jsx
const [isPending, setIsPending] = useState(false);
const [error, setError] = useState(null);

async function handleSubmit(e) {
  e.preventDefault();
  setIsPending(true);
  setError(null);
  try { await updateName(name); }
  catch (err) { setError(err.message); }
  finally { setIsPending(false); }
}
```

Three state variables, manual try/catch, manual `preventDefault`. Add optimistic UI and
you need a fourth state plus rollback logic. **The boilerplate was so uniform that React
absorbed it.**

### Actions

An **Action** is any async function passed to `form action`, `button formAction`, or
`startTransition`. React automatically marks it a transition, tracks pending state,
routes errors to error boundaries, and resets the form on success.

```jsx
function UpdateProfile() {
  async function updateName(formData) {
    await api.updateName(formData.get("name"));
  }
  return (
    <form action={updateName}>
      <input name="name" />
      <SubmitButton />
    </form>
  );
}
```

### `useActionState` — actions with state and errors

**Mental model: `useActionState` is to actions what `useReducer` is to events.**
The reducer receives `(previousState, formData)` and returns the new state.

```jsx
const [state, formAction, isPending] = useActionState(
  async (previousState, formData) => {
    try {
      const user = await api.updateName(formData.get("name"));
      return { success: true, user };
    } catch (err) {
      return { error: err.message };
    }
  },
  { success: false }   // initial state
);

<form action={formAction}>
  <input name="name" />
  <button disabled={isPending}>Save</button>
  {state.error && <p>{state.error}</p>}
</form>
```

Three pieces of state collapse into one hook call.

### `useFormStatus` — pending state without prop-drilling

```jsx
function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "Saving..." : "Save"}</button>;
}
```

Reads from the nearest **parent** `<form>`. **Constraint:** the component must be *inside*
the form — it reads from a parent, not a sibling.

### `useOptimistic` — instant feedback with automatic rollback

```jsx
function Todos({ todos }) {
  const [optimisticTodos, addOptimistic] = useOptimistic(
    todos,
    (current, newTodo) => [...current, { ...newTodo, pending: true }]
  );

  async function addTodo(formData) {
    addOptimistic({ text: formData.get("text") });   // 1. show immediately
    await api.createTodo(formData.get("text"));      // 2. real request
    // 3. no rollback code — React auto-reverts on failure,
    //    and reconciles when `todos` updates on success
  }

  return (
    <>
      <form action={addTodo}><input name="text" /></form>
      <ul>{optimisticTodos.map(t => <li key={t.id}>{t.text}</li>)}</ul>
    </>
  );
}
```

**Key mental model:** the optimistic value is a **presentation overlay** that only lives
inside an active action scope. It reverts to the real state automatically — *discard,
don't merge*. The reducer must be **pure and deterministic** (derive keys from the
payload, never `Date.now()`).

⚠️ `<form action>` creates an action scope automatically. A plain `onClick` handler does
**not** — wrap it in `startTransition` or the optimistic value won't survive.

### `use()` — promises and conditional context

**Reading a promise:**

```jsx
function Comments({ commentsPromise }) {
  const comments = use(commentsPromise);   // suspends until resolved
  return comments.map(c => <p key={c.id}>{c.text}</p>);
}

<Suspense fallback={<Spinner />}>
  <Comments commentsPromise={fetchComments()} />
</Suspense>
```

Mechanism: `use` throws the promise, Suspense catches it and shows the fallback, and on
resolution React re-renders and `use` returns the value. This replaces the
`useEffect` + `useState` + `isLoading` triad for one-shot fetches.

⚠️ **Critical rule:** the promise must be created by a **parent, framework, or Server
Component** — never inside the component that calls `use`. Creating it inline makes a new
promise every render → infinite loop.

**Reading context conditionally** — `use` is the one hook that *can* be called
conditionally:

```jsx
function Message({ showTheme }) {
  if (showTheme) {
    const theme = use(ThemeContext);   // legal — useContext here is not
    return <p style={{ color: theme.color }}>Hi</p>;
  }
  return <p>Hi</p>;
}
```

### Which primitive when

| Need | Reach for |
|---|---|
| Submit a form, no result handling | `<form action={fn}>` |
| Pending + error + result state | `useActionState` |
| Nested button needs parent's pending state | `useFormStatus` |
| Instant UI feedback before server confirms | `useOptimistic` |
| Read a promise / conditional context | `use` |
| Non-form click handler with optimistic UI | `startTransition` + `useOptimistic` |

---

## 10. React 19: Server Components

**Server Components run only on the server, once, at request time. They send rendered
output to the client — their code, dependencies, and data never ship.**

```jsx
// app/products/[id]/page.jsx — Server Component (default in Next.js App Router)
import { db } from "@/lib/db";

export default async function ProductPage({ params }) {
  const product = await db.products.findUnique({ where: { id: params.id } });
  const stock = await db.stock.get(params.id);

  return (
    <div>
      <ProductDetails product={product} />                      {/* Server */}
      <LiveStockCounter productId={params.id} initialStock={stock} />  {/* Client */}
      <AddToCartButton productId={params.id} />                 {/* Client */}
    </div>
  );
}
```

```jsx
// components/AddToCartButton.jsx
"use client";
import { useActionState } from "react";
import { addToCart } from "./actions";

export default function AddToCartButton({ productId }) {
  const [state, formAction, isPending] = useActionState(
    async () => {
      try { await addToCart(productId, 1); return { success: true }; }
      catch (err) { return { error: err.message }; }
    },
    { success: false }
  );

  return (
    <form action={formAction}>
      <button disabled={isPending}>{isPending ? "Adding..." : "Add to Cart"}</button>
      {state.error && <p>{state.error}</p>}
    </form>
  );
}
```

### What changes

- **Components can be `async` and `await` directly.** No `useEffect`, no loading state,
  no client-side fetch waterfall.
- **Direct data access.** The DB driver and query never reach the browser. Bundle shrinks
  by everything not imported into client components.
- **No hooks, no state, no effects, no event handlers** in Server Components. They run
  once, produce output, done.

### The boundary

`"use client"` marks a **boundary**, not a per-component flag. Once you cross it, you're
on the client all the way down the import graph. Files are Server Components by default in
an RSC framework.

- Client Components **can be rendered inside** Server Components.
- A Client Component **cannot `import`** a Server Component — but it *can* receive
  server-rendered content as `children`.

### Serialization constraint ⭐ *common gotcha*

Props crossing Server → Client must be **serializable**:

| ✅ Allowed | ❌ Not allowed |
|---|---|
| numbers, strings, booleans, null | functions (except Server Actions) |
| plain objects, arrays | class instances |
| Promises, JSX | `Date`, `Map`, `Set` |

So `initialStock={42}` is fine; `onStockUpdate={handleUpdate}` is not.

### Server Actions

```jsx
// actions.js
"use server";
export async function addToCart(productId, quantity) {
  await db.cart.add({ productId, quantity });
}
```

A Client Component can import and call this directly — no API route needed. React handles
the RPC. (Server Actions *are* serializable across the boundary — the exception to the
"no functions" rule.)

### Deciding the boundary

Ask what each piece **needs**:

| Piece | Needs | Verdict |
|---|---|---|
| Product details | data at request time only | **Server** |
| Live stock counter | WebSocket subscription + state | **Client** (seeded with `initialStock`) |
| Add to Cart | `onClick`, pending state, optimistic UI | **Client** |

**Heuristic:** anything requiring browser-side reactivity — state, effects, event handlers,
subscriptions, browser APIs — crosses the client boundary. Everything else stays on the
server and disappears from the bundle. Push `"use client"` as **far down the tree** as
possible.

### React Compiler

Auto-memoizes components and values at build time, replacing most manual
`useMemo`/`useCallback`/`React.memo`. It doesn't change *what* React does — it eliminates
the plumbing.

> **Framing for interviews:** "The Compiler solves the tactical memoization problem so you
> can focus on structural decisions — where state lives, what's a Server vs Client
> Component, and how to shape Suspense boundaries. It handles `useMemo`/`useCallback`
> hygiene; it can't decide your architecture."

> **Speakable summary of React 19**
> "React 19 moves async work out of `useEffect`. Actions are async functions passed to
> forms; `useActionState` gives them state and pending tracking; `useFormStatus` lets
> nested buttons read submission state without props; `useOptimistic` handles optimistic
> updates with automatic rollback. The `use` hook reads promises via Suspense and context
> conditionally. Server Components run on the server at request time, can `await`
> directly, and never ship their code or data-layer imports to the client — you compose
> them with Client Components marked `"use client"` for interactivity, and props crossing
> that boundary must be serializable. The Compiler auto-memoizes, so manual `useMemo` and
> `useCallback` are increasingly rare."

---

## Quick Reference — Trap Answers

| Question | Trap answer | Correct answer |
|---|---|---|
| Parent re-renders, child props unchanged — does child re-render? | "No, props are the same" | **Yes** — cascade is unconditional; `memo` is opt-in |
| Does a wasted re-render hit the DOM? | "Yes, that's why it's slow" | **No** — the diff is empty; only the function call costs |
| Does `React.memo` stop context updates? | "Yes" | **No** — context bypasses props entirely |
| Fixing stale state in a rapid callback | Add it to the deps array | Functional updater / ref / `useEffectEvent` |
| Where to fetch data | `useLayoutEffect` works too | `useEffect`, or `use()` / Server Component |
| Fixing over-rendering | Wrap everything in `memo` | Profile → move state down → compose → *then* memo |
| Where to create a promise for `use()` | Inside the component | In a parent / framework / Server Component |
| Optimistic update in an `onClick` | Just call `addOptimistic` | Wrap in `startTransition` — no action scope otherwise |
