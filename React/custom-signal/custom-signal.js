// ref: https://www.youtube.com/watch?v=t18Kzj9S8-M

export function createNewSignal(initialValue) {
  let value = initialValue;
  function set(newValue) {
    value = newValue;
  }
  function read() {
    return value;
  }
  return { read, set };
}
