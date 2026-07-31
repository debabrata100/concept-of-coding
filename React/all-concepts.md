1. Core Fundamentals (asked at every level)
What React is, why it exists, declarative vs imperative UI
JSX — what it compiles to, why you can't return multiple root elements, Fragments
Virtual DOM, reconciliation, and the diffing algorithm — render, diffing, and commit phases, and how React computes the minimal set of DOM changes with batching 
DEV Community
Keys in lists — why index-as-key is a problem
Props vs state, one-way data flow, lifting state up
Controlled vs uncontrolled components
Conditional rendering patterns
Component composition, children prop
Synthetic events and event delegation
React 18+ rendering behavior: automatic batching, StrictMode double-invocation and why it exists
2. Hooks (the heaviest section in most interviews)
useState — functional updates, lazy initialization, batching of setState
useEffect — dependency arrays, cleanup functions, common bugs (stale closures, infinite loops), why effects run twice in StrictMode
useRef — DOM refs vs mutable values, why updating a ref doesn't re-render
useMemo, useCallback, React.memo — when they help, when they're pointless
useContext — and its re-render implications
useReducer — when to prefer it over useState
useLayoutEffect vs useEffect
Custom hooks — be ready to write one live (useDebounce, useFetch, useLocalStorage, usePrevious)
Rules of hooks and why they exist (call order)

A trend worth knowing: interviewers now delete a useMemo wrapper and ask what changes — the correct answer is that memoization is a performance tool, not a correctness tool, and if removing it changes behavior there's a bug hiding under it. Expect "critique this code" questions. 
KORE1

3. React 19 & Modern React (the differentiator in 2026)

Current question banks now include dedicated React 19 sections covering Actions, useActionState, useOptimistic, the use hook, Server Components, the React Compiler, and form actions. Prepare: 
GreatFrontEnd

Actions and form actions — React 19 lets you pass a function directly to form action and button formAction 
GreatFrontEnd
useActionState, useFormStatus, useOptimistic (optimistic UI updates)
The use() hook for reading promises and context
React Server Components (RSC) — server vs client components, the "use client" directive, what can/can't run where, how RSCs drastically reduce the JavaScript sent to the client 
Wordsmithcreations
React Compiler — a build-time tool that auto-memoizes components, bringing hand-optimized performance without manual useMemo/useCallback pollution; be ready to explain what it does and doesn't replace 
DEV Community
ref as a prop (no more forwardRef), improved hydration, document metadata support
Concurrent features: useTransition, useDeferredValue, Suspense for data fetching, streaming SSR
4. Performance & Rendering
What causes re-renders; how to diagnose unnecessary ones (React DevTools Profiler)
Code splitting: React.lazy + Suspense, route-based splitting
List virtualization (react-window / react-virtuoso) for large lists
Debouncing/throttling inputs
Bundle size awareness, tree shaking
CSR vs SSR vs SSG vs ISR — trade-offs and when each fits
Web vitals basics (LCP, INP, CLS) — increasingly asked for frontend roles
5. State Management
When local state is enough vs when you need global state
Context API — strengths and its performance pitfalls
Redux Toolkit — store, slices, middleware, when it's overkill
Zustand (very commonly asked now as the lightweight alternative)
Server state vs client state — TanStack Query (React Query): caching, stale-while-revalidate, invalidation. This distinction comes up a lot in mid/senior interviews.
6. Routing
React Router v7: nested routes, dynamic params, loaders/actions, protected routes, useNavigate/useParams
If the role uses Next.js: App Router vs Pages Router, file-based routing, layouts, server actions, middleware — Next.js questions are near-unavoidable now since interviewers ask about server components, suspense, streaming, edge runtimes, and integration with frameworks like Next.js 
CrackInterviewAI
7. Forms, Data Fetching & Side Effects
Form handling: controlled forms, React Hook Form + Zod validation
Fetching patterns: useEffect fetching pitfalls (race conditions, cleanup with AbortController), why libraries like TanStack Query exist
Error handling: Error Boundaries (why they're still class-based, or react-error-boundary), handling async errors
8. Testing
React Testing Library philosophy (test behavior, not implementation)
Jest/Vitest basics: rendering, querying (getBy vs queryBy vs findBy), userEvent, mocking API calls (MSW)
Testing custom hooks
9. TypeScript with React (assume it's required)
Typing props, children, events, refs
Generics in components and hooks
Utility types you'll actually use: Partial, Pick, Omit, ReturnType
Typing useState/useReducer, discriminated unions for state
10. Patterns, Architecture & Senior-Level Topics
HOCs and render props (legacy but still asked), and why hooks replaced them
Compound components, container/presentational split, feature-based folder structure
Accessibility (semantic HTML, ARIA, keyboard navigation) — increasingly a filter question
Security basics: XSS, why dangerouslySetInnerHTML is named that
Design/system-design round: "build an autocomplete / infinite scroll feed / data table with sorting and pagination" — practice building these live
11. The JavaScript layer underneath (don't skip this)

Interviewers frequently pivot to JS: closures, event loop and microtasks, promises/async-await, this, prototypes, ES modules, array methods, debounce/throttle implementation, shallow vs deep copy. Weak JS answers sink strong React answers.

Machine-coding questions to practice hands-on

Todo app with filters, counter with undo/redo, star rating, tabs, accordion, modal with portal, debounced search with API, pagination, stopwatch/timer, nested comments, drag-and-drop list, theme switcher with Context, custom useFetch hook.