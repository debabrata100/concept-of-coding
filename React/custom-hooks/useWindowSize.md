# useWindowWize without using useState and useEffect

```import { useSyncExternalStore } from "react";

let snapShot = {
  h: window.innerHeight,
  w: window.innerWidth,
};

function getSnapshot() {
  return snapShot;
}

function subscribe(callback) {
  function handleSize() {
     snapShot = {
      h: window.innerHeight,
      w: window.innerWidth,
    };
    callback();
  }
  window.addEventListener("resize", handleSize);
  return () => window.removeEventListener("resize", handleSize);
}

function useWindowSize() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

function App() {
  const { h, w } = useWindowSize();
  return (
    <div>
      <h1>This is your App</h1>
      <p>We want to showcase some custom hooks here</p>
      <p>
        h: {h}, w: {w}
      </p>
    </div>
  );
}

export default App;
```