/*
const submitData = (data: unknown) => {
  return {
    ...data,
    timeStamp: new Date(),
  };
};
const data = [
  {
    id: 123,
    title: "This is fake title",
  },
];
const submitedUsers = data.map(submitData); 
output: 
const submitedUsers: ({
    id: number;
    title: string;
} & {
    timeStamp: Date;
})[]
*/

const submitData = <T extends { id: number; title: string }>(data: T) => {
  return {
    ...data,
    timeStamp: new Date(),
  };
};
const data = [
  {
    id: 123,
    title: "This is fake title",
  },
];
const submitedUsers = data.map(submitData);
