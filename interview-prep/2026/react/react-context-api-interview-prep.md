# React Context API — Senior Interview Prep

## What problem does Context API solve?

React's data model is a component tree. Props flow *down*. That's fine until you have data needed by components far apart in the tree — a theme, a logged-in user, a locale setting.

The naive solution is **prop drilling**: pass data through every intermediate component, even ones that don't use it. That creates tight coupling, clutters component signatures, and makes refactoring painful.

Context API solves this with a **publish-subscribe mechanism built into the React tree**. A `Provider` at the top broadcasts a value, and any descendant can subscribe via `useContext` — skipping all layers in between.

> **Key insight for the interview:** Context is not state management. It's dependency injection for the component tree. It answers "how do I get this value anywhere without prop plumbing?" — not "how do I manage complex state mutations?"

---

## Context API vs Redux

### They solve fundamentally different problems

**Context API** solves *data access*. How does a deep component read a value that lives at the top? It's a transport mechanism. No actions, reducers, middleware, or time-travel. When Provider value changes, subscribers re-render. That's the full contract.

**Redux** solves *state governance*. How do you manage state that evolves through discrete, predictable, auditable mutations? Redux enforces: every change goes through a named action, reducers are pure functions, state is a single serializable object. You get a full audit trail, DevTools time-travel, and reproducible bugs via action replay.

---

### The performance trap most candidates miss

Every component subscribed to a Context re-renders when the context value changes — even if the specific piece of data it cares about didn't change.

Redux solves this with `useSelector`. A selector subscribes only to the slice of state it reads, and re-renders only when *that specific value* changes.

```js
// Context — ALL subscribers re-render if ANY part of this object changes
const AppContext = createContext({ user, theme, cart, settings });

// Redux — ONLY re-renders if cart.items changes
const cartCount = useSelector(state => state.cart.items.length);
```

---

### When to use what

| Concern | Context API | Redux |
|---|---|---|
| Static/slow-changing data (theme, locale, auth user) | ✅ Perfect fit | Overkill |
| Complex state with multiple transitions | Too manual | ✅ Purpose-built |
| Async logic (API calls, side effects) | Manual `useEffect` | `redux-thunk` / `redux-saga` |
| Debugging state history | ❌ No tooling | ✅ DevTools time-travel |
| Performance with frequent updates | ❌ Re-renders all subscribers | ✅ Selector-based precision |
| Bundle size matters | ✅ Zero cost (built-in) | Adds ~10KB+ |

---

### The answer that impresses a senior interviewer

> "Context API and Redux aren't really alternatives — they're composable. In most production apps I use both: Context for ambient, app-wide values like authenticated user or theme, and Redux (or Zustand) for domain state that has complex mutation logic and needs traceability. The reason I don't replace Redux with Context is the selector-based re-render optimization — Context has no equivalent, and that matters in real apps."

---

## Optimizing Context API

### The core problem

The naive mistake is putting everything into one context object:

```js
// ❌ Bad — one object means one giant blast radius
const AppContext = createContext();

function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [cart, setCart] = useState([]);

  // New object reference on EVERY render → ALL consumers re-render
  return (
    <AppContext.Provider value={{ user, setUser, theme, setTheme, cart, setCart }}>
      {children}
    </AppContext.Provider>
  );
}
```

If `cart` updates, your `ThemeToggle` component re-renders. Pure waste.

---

### Pattern 1 — Split contexts by update frequency

The most impactful optimization. One context per concern, each with its own blast radius:

```js
const UserContext = createContext();    // changes rarely (login/logout)
const ThemeContext = createContext();   // changes on toggle
const CartContext = createContext();    // changes frequently

function AppProvider({ children }) {
  return (
    <UserContext.Provider value={userValue}>
      <ThemeContext.Provider value={themeValue}>
        <CartContext.Provider value={cartValue}>
          {children}
        </CartContext.Provider>
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}
```

`ThemeToggle` subscribes only to `ThemeContext`. A cart update never touches it.

---

### Pattern 2 — Separate state from dispatch (the reducer pattern)

The most senior-level pattern. State changes, but `dispatch` (the setter) never does. Split them into two contexts so components that only *dispatch* actions never re-render when state changes.

```js
const CartStateContext = createContext();
const CartDispatchContext = createContext();

function CartProvider({ children }) {
  const [cart, dispatch] = useReducer(cartReducer, []);

  // dispatch is stable — React guarantees it never changes
  return (
    <CartDispatchContext.Provider value={dispatch}>
      <CartStateContext.Provider value={cart}>
        {children}
      </CartStateContext.Provider>
    </CartDispatchContext.Provider>
  );
}

// Only subscribes to dispatch — never re-renders on cart change
function AddToCartButton({ item }) {
  const dispatch = useContext(CartDispatchContext);
  return <button onClick={() => dispatch({ type: 'ADD', item })}>Add</button>;
}

// Subscribes to state — re-renders when cart changes (correct)
function CartSummary() {
  const cart = useContext(CartStateContext);
  return <div>{cart.length} items</div>;
}
```

> **Key insight:** `useReducer`'s `dispatch` is referentially stable — React guarantees it never changes across renders. This makes it the perfect value to put in a separate context.

---

### Pattern 3 — Stabilize the value with `useMemo`

When you can't split the context, memoize the value object so it doesn't get a new reference on every render:

```js
function UserProvider({ children }) {
  const [user, setUser] = useState(null);

  // New object only when user actually changes
  const value = useMemo(() => ({ user, setUser }), [user]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}
```

Without `useMemo`, `{ user, setUser }` is a new object literal on every render of `UserProvider` — triggering all subscribers even when nothing changed.

---

### Pattern 4 — `React.memo` at the component level

Wrap context consumers in `React.memo` so prop-unchanged renders from a parent don't compound with context re-renders:

```js
// Without memo: re-renders when parent renders AND when context changes
// With memo: re-renders ONLY when context changes (if props haven't changed)
const CartItem = React.memo(function CartItem({ itemId }) {
  const cart = useContext(CartStateContext);
  const item = cart.find(i => i.id === itemId);
  return <div>{item.name}</div>;
});
```

---

### Pattern 5 — Custom hook as the public API (always do this)

Never expose `useContext(XContext)` directly. Wrap it. This gives you a place to add validation, computed values, and lets you swap the implementation later without changing every consumer:

```js
export function useCart() {
  const context = useContext(CartStateContext);
  if (context === undefined) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}

export function useCartDispatch() {
  const context = useContext(CartDispatchContext);
  if (context === undefined) {
    throw new Error('useCartDispatch must be used within CartProvider');
  }
  return context;
}
```

If you later swap Context for Zustand or Redux, you change one file — not every consumer.

---

## The honest ceiling — what to tell the interviewer

Even with all these patterns, Context has a fundamental limitation compared to Redux's `useSelector`: **you cannot subscribe to a slice of context**. If `CartStateContext` holds `{ items, total, coupon }` and a component only needs `total`, it will still re-render when `items` changes.

> "For high-frequency updates or large state objects with many partial consumers, I'd reach for Zustand or Redux. Context works best when update frequency is low and consumer count is manageable. The split-context + dispatch pattern gets you most of the way there for medium-complexity apps, but it doesn't replace selector-based precision."

---

## Summary — optimization patterns at a glance

| Pattern | What it prevents | When to use |
|---|---|---|
| Split contexts by concern | Cross-concern re-renders | Always — first thing to do |
| Separate state + dispatch contexts | Dispatch-only consumers re-rendering | Any `useReducer`-based context |
| `useMemo` on value | New object reference every render | When you can't split contexts |
| `React.memo` on consumers | Parent re-renders cascading | High-render-frequency parents |
| Custom hook wrapper | Direct context exposure | Always — makes refactoring safe |
