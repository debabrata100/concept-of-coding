# useDeounce

```
function useDebounce(fn, delay = 300) {
  const timeoutRef = useRef(null);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  // clear any pending call on unmount
  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return useCallback(
    (...args) => {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        fnRef.current(...args);
      }, delay);
    },
    [delay], // fn removed — it's read via ref, not captured
  );
}
```