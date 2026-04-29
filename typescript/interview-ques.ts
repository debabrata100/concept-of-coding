interface Person {
  name: string;
  age: number;
}

type SortArrType = string[];

function sortByAge(arr: Person[]): SortArrType {
  return arr
    .sort((a, b) => a.age - b.age)
    .reduce((acc: SortArrType, curr) => {
      return [...acc, `${curr.name} - ${curr.age}`];
    }, []);
}

const arr = [
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 },
  { name: "Charlie", age: 35 },
];
const a = sortByAge(arr);
console.log(a);
// Output: [ 'Bob - 25', 'Alice - 30', 'Charlie - 35' ]
