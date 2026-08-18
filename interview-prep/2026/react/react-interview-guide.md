# React Interview Preparation Guide (2026)

A complete topic map, question bank, and practice plan. Use this as the checklist;
use `react-core-concepts.md` for the deep mechanistic explanations.

---

## How to use this guide

1. Work top-to-bottom. Sections 1–5 are non-negotiable for every React interview.
2. For each topic, aim to **derive** the answer from mechanism, not recall it.
3. Mark each topic: ⬜ not started · 🟡 can recall · ✅ can derive + explain trade-offs
4. Before any specific interview: check the company's stack (Next.js? Redux? RN?) and
   any React release newer than 19. That 30-minute refresh is the only re-prep needed.

---

## 1. Core Fundamentals

| Topic | Status |
|---|---|
| What React is; declarative vs imperative UI | ⬜ |
| JSX → `React.createElement`; why one root element; Fragments | ⬜ |
| Virtual DOM, reconciliation, diffing algorithm | ⬜ |
| Render → diff → commit pipeline | ⬜ |
| Keys in lists; why index-as-key breaks | ⬜ |
| Props vs state; one-way data flow | ⬜ |
| Lifting state up **and pushing state down** | ⬜ |
| Controlled vs uncontrolled components | ⬜ |
| Component composition; `children` as a prop | ⬜ |
| Synthetic events & event delegation | ⬜ |
| Automatic batching (React 18+) and `flushSync` | ⬜ |
| StrictMode double-invocation and why it exists | ⬜ |
| Class lifecycle methods → hook equivalents (legacy codebases) | ⬜ |

**Likely questions**
- What is the virtual DOM and why does it make React fast?
- Walk me through what happens between `setState` and the screen updating.
- Why does React need keys? What breaks with index keys?
- Why does my component render twice in development?
- Controlled vs uncontrolled inputs — when would you pick each?
- What is batching? Did it change in React 18?

---

## 2. Hooks

| Topic | Status |
|---|---|
| `useState` — functional updates, lazy init | ⬜ |
| `useEffect` — deps, cleanup, stale closures, infinite loops | ⬜ |
| `useRef` — DOM refs vs mutable values | ⬜ |
| `useMemo` / `useCallback` / `React.memo` — when they help | ⬜ |
| `useContext` and its re-render implications | ⬜ |
| `useReducer` — when to prefer over `useState` | ⬜ |
| `useLayoutEffect` vs `useEffect` (timing) | ⬜ |
| `useTransition`, `useDeferredValue` | ⬜ |
| `useId`, `useImperativeHandle`, `useSyncExternalStore` | ⬜ |
| `useEffectEvent` (React 19) | ⬜ |
| Rules of hooks and **why** they exist (call order) | ⬜ |
| Custom hooks — write live: `useDebounce`, `useFetch`, `useLocalStorage`, `usePrevious`, `useToggle` | ⬜ |

**Likely questions**
- Why can't hooks be called conditionally?
- What's a stale closure? Show me one and fix it.
- When does the effect cleanup run — on every render or only unmount?
- `useMemo` vs `useCallback` — what's the actual difference?
- When would you use `useRef` over `useState`?
- I removed a `useMemo` and the behavior changed. What does that tell you?
  *(Answer: memoization is a performance tool, not a correctness tool — there's a bug.)*
- `useEffect` vs `useLayoutEffect` — give me a concrete case for each.

---

## 3. React 19 & Modern React ⭐ *the 2026 differentiator*

| Topic | Status |
|---|---|
| Actions — async functions in `form action` / `formAction` | ⬜ |
| `useActionState` | ⬜ |
| `useFormStatus` | ⬜ |
| `useOptimistic` | ⬜ |
| `use()` — reading promises and conditional context | ⬜ |
| Server Components: server vs client, `"use client"` boundary | ⬜ |
| Server Actions (`"use server"`) | ⬜ |
| Serialization constraints across the RSC boundary | ⬜ |
| React Compiler — what it does and doesn't replace | ⬜ |
| `ref` as a prop (no more `forwardRef`) | ⬜ |
| Document metadata support, improved hydration errors | ⬜ |
| Suspense for data fetching; streaming SSR | ⬜ |

**Likely questions**
- Why do Actions exist? What did they replace?
- What can't a Server Component do?
- What kinds of props can cross the server/client boundary?
- How does `useOptimistic` handle rollback on failure?
- Does the React Compiler mean I never write `useMemo` again?
- Where should the promise passed to `use()` be created, and why?

---

## 4. Performance & Rendering

| Topic | Status |
|---|---|
| What causes a re-render; the cascade model | ⬜ |
| Diagnosing with React DevTools Profiler | ⬜ |
| The three bailouts: `memo`, same-element reference, Compiler | ⬜ |
| Composition / children-as-props as a perf technique | ⬜ |
| Context performance pitfalls & mitigations | ⬜ |
| Code splitting: `React.lazy` + Suspense, route-based | ⬜ |
| List virtualization (react-window / react-virtuoso) | ⬜ |
| Debounce / throttle for expensive inputs | ⬜ |
| CSR vs SSR vs SSG vs ISR — trade-offs | ⬜ |
| Web vitals: LCP, INP, CLS | ⬜ |

**Likely questions**
- A parent re-renders. Does the child re-render if its props didn't change?
- Should you wrap every component in `React.memo`?
- This component re-renders on every keystroke — diagnose and fix it.
- How would you make a 10,000-row table performant?
- Why is my `React.memo` not working?

---

## 5. State Management

| Topic | Status |
|---|---|
| When local state is enough | ⬜ |
| Context API — strengths and pitfalls | ⬜ |
| Redux Toolkit — slices, middleware, when it's overkill | ⬜ |
| Zustand — the lightweight alternative | ⬜ |
| **Server state vs client state** | ⬜ |
| TanStack Query — caching, stale-while-revalidate, invalidation | ⬜ |

**Likely questions**
- Context vs Redux — when do you reach for each?
- What is "server state" and why does it need a different tool?
- How does React Query avoid refetching everything?
- How would you share state between two distant components?

---

## 6. Routing

| Topic | Status |
|---|---|
| React Router v7: nested routes, params, loaders/actions | ⬜ |
| Protected routes; `useNavigate`, `useParams`, `useSearchParams` | ⬜ |
| Next.js App Router vs Pages Router | ⬜ |
| Layouts, server actions, middleware, route handlers | ⬜ |

---

## 7. Forms, Data Fetching & Errors

| Topic | Status |
|---|---|
| Controlled forms; React Hook Form + Zod | ⬜ |
| `useEffect` fetching pitfalls: race conditions, `AbortController` | ⬜ |
| Error Boundaries (why still class-based / `react-error-boundary`) | ⬜ |
| Handling async errors, retry, loading states | ⬜ |

---

## 8. Testing

| Topic | Status |
|---|---|
| RTL philosophy: test behavior, not implementation | ⬜ |
| `getBy` vs `queryBy` vs `findBy` | ⬜ |
| `userEvent` over `fireEvent` | ⬜ |
| Mocking APIs with MSW | ⬜ |
| Testing custom hooks | ⬜ |

---

## 9. TypeScript with React

| Topic | Status |
|---|---|
| Typing props, children, events, refs | ⬜ |
| Generic components and hooks | ⬜ |
| `Partial`, `Pick`, `Omit`, `ReturnType` | ⬜ |
| Discriminated unions for state | ⬜ |
| Typing `useState` / `useReducer` | ⬜ |

---

## 10. Patterns, Architecture & Senior Topics

| Topic | Status |
|---|---|
| HOCs, render props — and why hooks replaced them | ⬜ |
| Compound components | ⬜ |
| Container / presentational split | ⬜ |
| Feature-based folder structure | ⬜ |
| Accessibility: semantic HTML, ARIA, keyboard nav | ⬜ |
| Security: XSS, `dangerouslySetInnerHTML` | ⬜ |
| Micro-frontends / module federation (senior roles) | ⬜ |

---

## 11. The JavaScript Layer Underneath

Weak JS answers sink strong React answers. Interviewers pivot here constantly.

- Closures (the root of most React bugs)
- Event loop, macrotasks vs microtasks
- Promises, `async/await`, `Promise.all` vs `allSettled`
- `this`, `call/apply/bind`, prototypes
- ES modules, tree shaking
- Array methods: `map`, `filter`, `reduce`, `flat`
- Implement `debounce` and `throttle` from scratch
- Shallow vs deep copy; `structuredClone`
- Optional chaining, nullish coalescing, destructuring

---

## Machine-Coding Practice List

Build each from scratch, no reference, under 30 minutes:

**Tier 1 — warm-ups**
- Counter with increment/decrement/reset
- Star rating component
- Accordion
- Tabs
- Theme switcher with Context

**Tier 2 — standard**
- Todo app with filters (all/active/completed) + localStorage
- Debounced search with API + loading/error states
- Pagination (client and server-side)
- Modal with Portal + focus trap + Escape to close
- Stopwatch / countdown timer
- Custom `useFetch` hook with cancellation

**Tier 3 — differentiating**
- Infinite scroll feed (IntersectionObserver)
- Nested comments (recursive rendering)
- Drag-and-drop reorderable list
- Data table: sorting + filtering + pagination
- Autocomplete with keyboard navigation + debounce + cancellation
- Multi-step form with validation
- Virtualized list (implement the windowing yourself)

**Tier 4 — React 19 specific**
- Todo app using `useActionState` + `useOptimistic`
- Form with Server Action, pending state via `useFormStatus`
- Product page split into Server + Client Components

---

## Diagnostic Scenarios to Practice

These are "here's broken code, find the bugs" rounds — increasingly common.

1. Component re-rendering on every keystroke (state too high + unstable refs + fat context)
2. WebSocket component with missing cleanup + stale closure + non-functional updater
3. `useEffect` infinite loop (object/array in deps)
4. Memory leak from an uncleaned interval or event listener
5. Race condition in search-as-you-type (responses arriving out of order)
6. `React.memo` that never bails out (inline object/function props)
7. List with index keys losing input state on reorder

---

## Interview-Day Checklist

**The 24 hours before**
- Re-read `react-core-concepts.md` speakable answers
- Check the company's stack: Next.js? Redux or Zustand? TypeScript? React Native?
- Search for React releases newer than 19
- Warm up by building one Tier 2 machine-coding problem

**During the interview**
- **Think out loud.** Silent correct answers score lower than narrated reasoning.
- For diagnostics: *measure first* — "I'd open the Profiler and check why each component rendered."
- For design: state your assumptions and constraints before coding.
- For trade-offs: name the alternative you rejected and why. That's the senior signal.
- If you don't know: say so, then reason toward it from first principles out loud.

**Questions to ask them**
- Which React version, and are you using Server Components?
- Have you adopted the React Compiler?
- How do you handle server state — React Query, SWR, or hand-rolled?
- What does your testing setup look like?

---

## Progress Tracker

| Section | Status | Notes |
|---|---|---|
| 1. Core Fundamentals | | |
| 2. Hooks | | |
| 3. React 19 | | |
| 4. Performance | | |
| 5. State Management | | |
| 6. Routing | | |
| 7. Forms & Data | | |
| 8. Testing | | |
| 9. TypeScript | | |
| 10. Patterns | | |
| 11. JavaScript | | |
| Machine coding | | |
