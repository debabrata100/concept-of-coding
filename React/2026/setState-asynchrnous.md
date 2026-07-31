# Is React's setState is asynchronous 
Ans: No, setState and the setter function returned by React is not asynchronous, it is deffered or batched.
Other you would write
await setState();

# When next state depends on previous state
```
const onClick = () => {
  setState(count+1);
  setState(count+1);
  setState(count+1);
}
```
output will be 1.

right way:
```
const onClick = () => {
  setState(c => c+1);
  setState(c => c+1);
  setState(c => c+1);
}
```