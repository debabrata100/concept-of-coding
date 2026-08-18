# Lazy Loading React Components — Interview Notes

## Frame it correctly first

Before any code, say this out loud — it signals you understand *what problem you're solving*:

> "Lazy loading is code-splitting plus deferred execution. The bundler splits my code into separate chunks at `import()` boundaries, and I defer loading a chunk until it's actually needed — on render, on route change, or on visibility. The goal is reducing the initial JS payload and time-to-interactive, not just 'loading things later.'"

The distinction to land: **code splitting (build-time) vs. lazy loading (runtime trigger)**.

---

## Technique 1: `React.lazy` + `Suspense` (the baseline)

```jsx
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Dashboard />
    </Suspense>
  );
}
```

**Why only default exports?** `React.lazy` expects the promise to resolve to a module with a `.default` that is a component. Named exports break it — re-map in the import:

```jsx
const Chart = lazy(() =>
  import('./Chart').then(module => ({ default: module.Chart }))
);
```

**What actually happens under the hood:** `lazy()` returns a special component. On first render it calls your factory, which returns a promise; React *throws that promise*. The nearest `Suspense` boundary catches it, renders the fallback, and re-renders the subtree when the promise resolves. This "throw a promise" mechanism is the same primitive Suspense-for-data uses.

---

## Technique 2: Route-based splitting

The highest-leverage place to split — route boundaries are natural chunk boundaries, and users only pay for the route they visit.

```jsx
const Home = lazy(() => import('./routes/Home'));
const Settings = lazy(() => import('./routes/Settings'));

<Suspense fallback={<PageSkeleton />}>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/settings" element={<Settings />} />
  </Routes>
</Suspense>
```

---

## Technique 3: Preloading — separates senior from mid

Lazy loading introduces a *waterfall*: the user clicks, *then* the chunk downloads, *then* it renders. Because `import()` returns a cached promise, you can trigger the fetch early — on hover, on idle, or on viewport approach:

```jsx
const factory = () => import('./HeavyModal');
const HeavyModal = lazy(factory);

<button
  onMouseEnter={factory}   // warms the chunk on hover
  onFocus={factory}
  onClick={() => setOpen(true)}
>
  Open
</button>
```

Soundbite: *"Lazy loading trades initial payload for a runtime waterfall; preloading on user intent hides that waterfall."*

---

## Technique 4: Error boundaries (robustness)

`Suspense` handles the *pending* state; it does **not** handle rejection. A chunk fetch can fail — bad network, or a deploy invalidated the old chunk hash. You need an error boundary:

```jsx
<ErrorBoundary fallback={<RetryPrompt />}>
  <Suspense fallback={<Spinner />}>
    <Dashboard />
  </Suspense>
</ErrorBoundary>
```

Mentioning the "stale chunk after deploy" failure mode unprompted signals you've shipped this in production.

---

## Technique 5: Concurrent features — `startTransition`

React 18+. Wrapping a lazy-triggering state update in a transition keeps the current UI interactive and avoids flashing the fallback:

```jsx
const [tab, setTab] = useState('home');
const [isPending, startTransition] = useTransition();

function selectTab(next) {
  startTransition(() => setTab(next)); // lazy tab loads without hard fallback flash
}
```

---

## Technique 6: Visibility-based lazy loading

For below-the-fold heavy widgets, trigger the import from an `IntersectionObserver` rather than on render:

```jsx
function LazyOnVisible({ loader, fallback }) {
  const ref = useRef(null);
  const [Comp, setComp] = useState(null);

  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        loader().then(m => setComp(() => m.default));
        io.disconnect();
      }
    });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return <div ref={ref}>{Comp ? <Comp /> : fallback}</div>;
}
```

---

## Technique 7: `@loadable/component` — and *why* it existed

Before React 18, **`React.lazy` did not work with SSR** — no way to suspend on the server and stream. Teams used `@loadable/component`, which tracked which chunks were used during server render and injected the right `<script>` tags so the client could hydrate without a waterfall.

Post React 18 + streaming SSR (`renderToPipeableStream`), `React.lazy` + `Suspense` works on the server, so loadable is largely legacy. Knowing *why* it existed shows real depth.

---

## Next.js

### `next/dynamic` (Pages Router and Client Components)

Next's wrapper around `React.lazy` + `Suspense`, with SSR handling and a first-class loading state:

```jsx
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('../components/Chart'), {
  loading: () => <Skeleton />,
  ssr: false,   // skip server render — for browser-only libs
});
```

- **`ssr: false`** — renders nothing on the server, mounts only on the client. Use for components that touch `window`, `localStorage`, or SSR-breaking libs. Trade-off: no server HTML, so worse for SEO and can cause layout shift.
- **Named exports** — same re-mapping, but ergonomic: `dynamic(() => import('../components/Chart').then(mod => mod.Chart))`. Next accepts the component directly, no `{ default }` wrapper needed.

Under the hood `next/dynamic` is `React.lazy` plus Next's chunk manifest, so it can preload and inject scripts during SSR — essentially it absorbed what loadable-components did.

### Automatic per-route splitting

**Next already code-splits every page/route automatically.** You don't lazy-load routes manually the way you do in a plain SPA — each `pages/` page or `app/` route segment is its own chunk. Manual `next/dynamic` is for splitting *within* a route (heavy modals, charts, editors below the fold).

### App Router: RSC + streaming Suspense

The modern answer. In the App Router, the primary lazy-loading mechanism is **React Server Components with Suspense-based streaming**:

```jsx
// app/dashboard/page.jsx  (Server Component)
import { Suspense } from 'react';

export default function Page() {
  return (
    <>
      <Header />
      <Suspense fallback={<AnalyticsSkeleton />}>
        <Analytics />   {/* async server component; streams in when ready */}
      </Suspense>
    </>
  );
}
```

The mechanism to articulate: the server **streams HTML in chunks**. The shell flushes immediately, and each `Suspense` boundary's content streams in as its async work completes. Server Component code never ships to the client — so this is lazy loading of *data and rendering*, not just JS. `loading.js` in a route segment is sugar for wrapping that segment in a Suspense boundary.

For **client** components inside App Router, `next/dynamic` and `React.lazy` still apply — but `ssr: false` in `next/dynamic` is only allowed inside Client Components (`'use client'`), not Server Components, in current Next versions.

### `next/image` — lazy loading for free

`next/image` lazy-loads by default (native `loading="lazy"` plus viewport logic), reserves space to avoid layout shift, and you opt out with `priority` for above-the-fold images (LCP).

---

## Importing a named export into `React.lazy`

`React.lazy` only understands **default exports**. Its entire contract:

```js
lazy(() => Promise /* that resolves to */ { default: SomeComponent })
```

A named export gives you `{ Chart: ... }`, not `{ default: ... }`. Re-map it:

```jsx
const Chart = lazy(() =>
  import('./Chart').then(module => ({ default: module.Chart }))
);
```

**Cleaner with destructuring:**

```jsx
const Chart = lazy(() =>
  import('./Chart').then(({ Chart }) => ({ default: Chart }))
);
```

**Reusable helper** — if you do this often:

```jsx
function lazyNamed(factory, name) {
  return lazy(() =>
    factory().then(module => ({ default: module[name] }))
  );
}

const Chart = lazyNamed(() => import('./Chart'), 'Chart');
```

**Gotcha:** the arrow returning `({ default: ... })` needs parentheses around the object literal — otherwise JS reads `{}` as a function body, not an object. Real bug people hit.

---

## Quick reference

| Technique | Trigger | Best for | Key gotcha |
|---|---|---|---|
| `React.lazy` + `Suspense` | On render | Baseline splitting | Default exports only; needs error boundary |
| Route-based | Route change | SPA routes | — |
| Preload on hover/idle | User intent | Hiding the waterfall | — |
| IntersectionObserver | Visibility | Below-fold widgets | Manual wiring |
| `startTransition` | State update | Avoid fallback flash | React 18+ |
| `@loadable/component` | On render | Legacy SSR (pre-18) | Mostly obsolete |
| `next/dynamic` | On render | Splitting within a route | `ssr:false` hurts SEO/CLS |
| RSC + Suspense streaming | Server | App Router default | Server-only; the modern answer |
| `next/image` | Viewport | Images | `priority` for LCP |

**Three sentences to say when it comes up:**

> "I split at route boundaries first, then at heavy in-route components with `React.lazy` or `next/dynamic`. I always pair Suspense with an error boundary for stale-chunk failures, and I preload on user intent to kill the waterfall. In the App Router I lean on RSC plus streaming Suspense so the heavy work never ships to the client at all."
