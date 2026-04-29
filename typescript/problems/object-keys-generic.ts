/* 
function getObjKeys(object: unknown) {
    return Object.keys(object);
}
const test = getObjKeys({
    key1: "value 1",
    key2: 123
})

// ("key1" | "key2")
*/

function getObjKeys<T extends {}>(object: T) {
  return Object.keys(object) as Array<keyof T>;
}
const test1 = getObjKeys({
  key1: "value 1",
  key2: 123,
});
