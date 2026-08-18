# Next.js Rendering Strategies & Isomorphic Rendering
### Senior Frontend Interview Reference Guide

---

## Table of Contents

1. [The Core Mental Model](#1-the-core-mental-model)
2. [SSG — Static Site Generation](#2-ssg--static-site-generation)
3. [SSR — Server-Side Rendering](#3-ssr--server-side-rendering)
4. [ISR — Incremental Static Regeneration](#4-isr--incremental-static-regeneration)
5. [ISG — Incremental Static Generation](#5-isg--incremental-static-generation)
6. [Comparison Table](#6-comparison-table)
7. [Senior Interview Q&A](#7-senior-interview-qa)
8. [Isomorphic Rendering](#8-isomorphic-rendering)
9. [Hydration — The Critical Bridge](#9-hydration--the-critical-bridge)
10. [Hydration Mismatch — The Subtle Bug](#10-hydration-mismatch--the-subtle-bug)
11. [React 18 — Streaming & Selective Hydration](#11-react-18--streaming--selective-hydration)
12. [React Server Components — The Modern Twist](#12-react-server-components--the-modern-twist)

---

## 1. The Core Mental Model

Before definitions, understand **when HTML is generated** — that is the real question these strategies answer.

```
Request comes in → Where does the HTML come from?
├── Already built at deploy time?        → SSG
├── Built on first request, cached?      → ISR / ISG
├── Built fresh on every request?        → SSR
└── Built in browser by JS?             → CSR (React default)
```

> **Key insight for interviews:** These are not React features — they are Next.js features. React itself has no opinion on rendering strategy. If an interviewer frames it as "React SSR," they mean the ecosystem around it (Next.js, Remix, etc.).

---

## 2. SSG — Static Site Generation

HTML is generated **at build time**, once. The same file is served to every user.

### App Router (Next.js 13+)
```jsx
// Any async component that doesn't use dynamic data = SSG by default
async function BlogPage() {
  const res = await fetch('https://api.example.com/posts', {
    cache: 'force-cache' // This is the default
  });
  return <PostList posts={await res.json()} />;
}
```

### Pages Router
```jsx
export async function getStaticProps() {
  const posts = await fetchPosts();
  return { props: { posts } };
}

// For dynamic routes, you MUST declare which paths to pre-build
export async function getStaticPaths() {
  return {
    paths: [
      { params: { id: '1' } },
      { params: { id: '2' } }
    ],
    fallback: false // 404 for any unknown path
  };
}
```

### When to Use
- Blogs, documentation, marketing pages
- Product listings that don't change per user
- Any content where staleness until next deploy is acceptable

### Trade-offs
| Pro | Con |
|-----|-----|
| Fastest possible TTFB | Data is stale until next deploy |
| Fully CDN-cacheable | Build time grows with page count |
| Zero server load at runtime | Can't personalize per user |

---

## 3. SSR — Server-Side Rendering

HTML is generated **fresh on every request**, on the server.

### App Router (Next.js 13+)
```jsx
async function UserDashboard({ params }) {
  // Using cookies(), headers(), or searchParams opts into SSR automatically
  const res = await fetch(`/api/user/${params.id}`, {
    cache: 'no-store' // Explicitly forces SSR — no caching
  });
  return <Dashboard data={await res.json()} />;
}
```

### Pages Router
```jsx
export async function getServerSideProps(context) {
  const { req, res, params, query } = context;
  const session = getSession(req); // Auth cookies are available here

  const data = await fetchUserData(session.userId);
  return { props: { data } };
}
```

### When to Use
- User dashboards and auth-gated pages
- Real-time data (live prices, scores)
- Personalized content per user/session

### Trade-offs
| Pro | Con |
|-----|-----|
| Always fresh data | Every request hits your server |
| Auth context available | Higher TTFB vs static |
| Full personalization | Cannot be CDN-cached without extra work |

---

## 4. ISR — Incremental Static Regeneration

**This is the interview differentiator.** SSG with a TTL (time-to-live). Pages are static, but regenerate in the background after a set interval.

### App Router (Next.js 13+)
```jsx
async function ProductPage({ params }) {
  const res = await fetch(`/api/products/${params.id}`, {
    next: { revalidate: 60 } // Regenerate at most once every 60 seconds
  });
  return <Product data={await res.json()} />;
}
```

### Pages Router
```jsx
export async function getStaticProps() {
  const products = await fetchProducts();
  return {
    props: { products },
    revalidate: 60, // This single field is what makes it ISR, not SSG
  };
}
```

### The Stale-While-Revalidate Behavior

This is what experienced developers know — and most candidates don't explain precisely:

```
t = 0s   → User A hits page  → Served from cache (instant) ✅
t = 65s  → User B hits page  → Served STALE HTML, background rebuild triggered ⚠️
t = 67s  → User C hits page  → Served NEW HTML (rebuild complete) ✅
```

> User B (who triggered the rebuild) still gets stale data.
> User C gets the fresh version. This is intentional — it keeps the response fast.

### On-Demand ISR (Next.js 12.2+)

More powerful than time-based — trigger revalidation from a webhook (e.g., CMS publish event):

```jsx
// pages/api/revalidate.js
export default async function handler(req, res) {
  // Your CMS calls this endpoint on content publish
  if (req.query.secret !== process.env.REVALIDATION_SECRET) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  await res.revalidate('/blog/my-post-slug');
  return res.json({ revalidated: true });
}
```

### When to Use
- E-commerce (prices, stock levels)
- News and editorial sites
- Any content that changes but doesn't need to be real-time

---

## 5. ISG — Incremental Static Generation

**Important clarification:** ISG is **not a separate Next.js API.** It describes a feature *within* ISR/SSG — generating static pages on-demand for paths not pre-built at build time.

The mechanism is the `fallback` option in `getStaticPaths`:

```jsx
export async function getStaticPaths() {
  // Only pre-build your top 100 most-visited pages
  const topPosts = await fetchTop100Posts();

  return {
    paths: topPosts.map(p => ({ params: { slug: p.slug } })),
    fallback: 'blocking', // ← This is ISG
  };
}
```

### The Three `fallback` Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `false` | 404 for unknown paths | Small, fixed set of pages |
| `true` | Serve fallback UI immediately, hydrate when data arrives | Large sets, UX-first |
| `'blocking'` | SSR the first request, cache statically after | Large sets, SEO-first |

### `fallback: 'blocking'` Flow (the ISG pattern)
```
Deploy → Pre-build top 100 pages (fast build ✅)

User hits /blog/post-101 (not pre-built):
  → Server renders it fresh (like SSR, ~300ms)
  → Caches the result as a static file
  → All future requests → static file served instantly ✅
```

### When to Use
- Wikipedia-scale content sites
- User-generated content pages
- Large product catalogs where pre-building all paths is impractical

---

## 6. Comparison Table

| Strategy | HTML Generated | CDN Cacheable | Data Freshness | TTFB |
|----------|---------------|--------------|----------------|------|
| **SSG** | Build time | ✅ Always | Stale until redeploy | Fastest |
| **ISR** | Build + background | ✅ Always | Stale up to TTL | Fast |
| **ISG** | Build + first request | ✅ After first hit | Stale up to TTL | Slow first, fast after |
| **SSR** | Every request | ⚠️ With extra headers | Always fresh | Slowest |

---

## 7. Senior Interview Q&A

**"When would you pick SSR over ISR?"**
> When data is user-specific or session-dependent. ISR serves the same cached HTML to everyone — you cannot cache a page that says "Hello, John" for a million different users.

**"What is the risk with ISR?"**
> The stale-while-revalidate window. If a product's price changes, some users may see the old price for up to N seconds. For financial or inventory-critical data, SSR or client-side fetching after a static shell loads is safer.

**"How do you handle ISR with authentication?"**
> You don't. ISR is for public, cacheable content. Authenticated sections should use SSR, or a static shell with client-side data fetching after session validation.

**"How do React Server Components change this?"**
> RSC blurs the line — components can fetch data server-side without being "SSR" in the traditional sense. Rendering strategy is now per-component, not per-page.

---

## 8. Isomorphic Rendering

### The Problem It Solves

**Pure CSR problem:**
```
Browser requests page
  → Server sends: <div id="root"></div>  ← empty shell
  → Browser downloads JS bundle (200kb+)
  → React runs, fetches data, renders DOM
  → User finally sees content  ← 3-5 seconds later
```
Problems: Bad SEO (crawler sees empty div), slow FCP, poor experience on slow networks.

**Pure server-rendered (non-JS) problem:**
```
User clicks a link
  → Full round-trip to server
  → Server renders entire new HTML page
  → Browser discards current page, loads new one
  → Page feels like a 1990s website
```
Problem: No SPA feel, no smooth transitions, full reload on every navigation.

**Isomorphic rendering — best of both worlds:**
```
First request  → Server renders full HTML (fast paint ✅)
               → React JS loads in background
               → React hydrates the existing HTML (takes control)
Subsequent nav → React handles routing client-side (SPA feel ✅)
```

### The One-Line Definition
> "The same JavaScript code runs on **both the server and the browser** to produce HTML."

The word *isomorphic* comes from mathematics — *"same shape in different contexts."* Same component code, different runtime environments.

### Full Data Flow

```
┌─────────────────────────────────────────────────────┐
│                    FIRST LOAD                       │
│                                                     │
│  Browser → GET /products                            │
│      ↓                                              │
│  Next.js Server (Node.js)                           │
│    ├─ Runs React components                         │
│    ├─ Fetches data from DB / API                    │
│    ├─ ReactDOMServer.renderToString()               │
│    └─ Sends complete HTML + serialized JSON data    │
│      ↓                                              │
│  Browser receives HTML                              │
│    ├─ Paints immediately (fast FCP ✅)              │
│    ├─ Downloads React JS bundle                     │
│    └─ hydrateRoot() — attaches interactivity       │
│                                                     │
│                 SUBSEQUENT NAVIGATION               │
│                                                     │
│  User clicks link → React Router intercepts         │
│    ├─ No full page reload                           │
│    ├─ Fetches JSON data only (not full HTML)        │
│    └─ React renders new page client-side            │
└─────────────────────────────────────────────────────┘
```

---

## 9. Hydration — The Critical Bridge

Hydration is the mechanism that makes isomorphic rendering work. It is **not re-rendering** — it is React reconciling its virtual DOM against existing server HTML and attaching event listeners.

```jsx
// Server does this:
const html = ReactDOMServer.renderToString(<App />);
// Produces: <div id="root"><h1>Hello</h1><button>Click me</button></div>

// Client receives that HTML → user sees it immediately

// Then React does this:
ReactDOM.hydrateRoot(
  document.getElementById('root'),
  <App />
);
// React walks the DOM, attaches event listeners
// WITHOUT re-rendering — it trusts the server HTML
// If they match → just wire up interactivity ✅
// If they don't → full re-render (hydration mismatch ❌)
```

### The Environment Problem

Your code runs in two runtimes. Many APIs only exist in one:

```javascript
// ❌ These CRASH on the server — window/document don't exist in Node.js
const width = window.innerWidth;
document.querySelector('.hero');
localStorage.getItem('token');

// ❌ These should never reach the browser
const fs = require('fs');
process.env.SECRET_DB_PASSWORD; // Never expose server secrets
```

### How to Guard Against Environment Errors

```javascript
// Pattern 1 — Runtime environment check
if (typeof window !== 'undefined') {
  // browser-only code
}

// Pattern 2 — useEffect (runs only in browser, after hydration)
useEffect(() => {
  const width = window.innerWidth; // always safe inside useEffect
}, []);

// Pattern 3 — Dynamic import with ssr: false (Next.js)
const HeavyBrowserChart = dynamic(
  () => import('../components/D3Chart'),
  { ssr: false } // component is never executed on the server
);
```

---

## 10. Hydration Mismatch — The Subtle Bug

The most common isomorphic bug. The server and client render different HTML, causing React to throw a warning and potentially re-render the entire tree.

```jsx
// ❌ Causes a hydration mismatch
function Timestamp() {
  return <p>Rendered at: {new Date().toString()}</p>;
  // Server:  "Rendered at: Mon Jun 12 2026 08:00:00"
  // Client:  "Rendered at: Mon Jun 12 2026 08:00:03" ← different!
  // React:   ⚠️ "Hydration failed because server HTML didn't match"
}

// ✅ Fix — defer dynamic content to the client
function Timestamp() {
  const [time, setTime] = useState(null); // null on first render (server + client)

  useEffect(() => {
    setTime(new Date().toString()); // only runs in browser
  }, []);

  return <p>Rendered at: {time ?? 'Loading...'}</p>;
  // Server renders:  "Rendered at: Loading..." ✅
  // Client renders:  "Rendered at: Loading..." ✅ (match — no mismatch)
  // useEffect fires: updates to real timestamp ✅
}
```

### Common Causes of Hydration Mismatch
- `Math.random()` or `Date.now()` called during render
- User-agent detection that differs server vs client
- Browser extensions modifying the DOM before hydration
- Timezone differences between server and user
- Conditional rendering based on `typeof window`

---

## 11. React 18 — Streaming & Selective Hydration

Modern isomorphic rendering is per-component, not per-page.

```jsx
import { Suspense } from 'react';

function Page() {
  return (
    <div>
      {/* Renders and hydrates immediately */}
      <Header />

      {/* Server streams this chunk when data is ready */}
      <Suspense fallback={<Spinner />}>
        <SlowDataComponent />
        {/*
          Browser shows <Spinner /> until this chunk arrives.
          Hydration happens per-chunk, not all-or-nothing.
          User can interact with <Header /> while this loads.
        */}
      </Suspense>
    </div>
  );
}
```

This is called **Progressive Hydration** — critical parts become interactive first, expensive parts hydrate later. React 18 also introduced:

- **`renderToPipeableStream`** — streams HTML to the browser in chunks
- **Selective hydration** — React prioritizes hydrating components the user interacts with first (e.g., if you click something while it's still hydrating, React hydrates that component immediately)

---

## 12. React Server Components — The Modern Twist

RSC fundamentally changes the isomorphic model.

| | Traditional Isomorphic | With RSC |
|--|------------------------|----------|
| **Runs on server** | All components (for SSR) | Server Components only |
| **Hydrated on client** | All components | Client Components only (`'use client'`) |
| **JS sent to browser** | Full component tree | Only Client Components |
| **Granularity** | Per-page | Per-component |

```jsx
// Server Component — renders on server, NEVER hydrates
// No JS sent to browser for this component
async function ProductList() {
  const products = await db.query('SELECT * FROM products'); // Direct DB access ✅
  return <ul>{products.map(p => <ProductCard key={p.id} product={p} />)}</ul>;
}

// Client Component — goes through the full isomorphic/hydration cycle
'use client';
function AddToCartButton({ productId }) {
  const [added, setAdded] = useState(false);
  return (
    <button onClick={() => setAdded(true)}>
      {added ? 'Added ✓' : 'Add to Cart'}
    </button>
  );
}
```

> **Senior answer:** With RSC, server components never hydrate. They render to HTML on the server and stay there — no JS is sent to the client for those components. The term "isomorphic" is evolving — it is now more granular, per-component, not per-page. This dramatically reduces bundle size and eliminates hydration cost for the majority of your UI.

---

## Quick Reference — What Separates Senior Answers

| Topic | Mid-Level Answer | Senior Answer |
|-------|-----------------|---------------|
| What is isomorphic rendering? | "Same code on client and server" | Adds: "with hydration being the critical bridge, and the challenge being environment differences" |
| Main benefit? | "SEO and performance" | Adds: "specifically FCP and TTI are decoupled — user sees content before JS is ready" |
| Main risk? | "`window` is undefined" | Adds: "hydration mismatch is a silent bug class that causes full tree re-renders" |
| ISR trade-off? | "Data can be stale" | Adds: "the user who *triggers* revalidation still gets stale data — the *next* user gets fresh" |
| ISR + auth? | "Use getServerSideProps instead" | Adds: "ISR serves identical HTML to all users — you can't cache personalized content" |
| Modern RSC impact? | Doesn't know | "RSC eliminates hydration cost for server components entirely — it's per-component now, not per-page" |

---

*Generated for senior frontend interview preparation — React / Next.js rendering strategies*
