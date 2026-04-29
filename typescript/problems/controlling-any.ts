/*
const getUser = async (id: number) => {
  const user = await fetch(`/users/${id}`).then((response) => response.json());
  return user;
};

const myFunc = async () => {
    const data = await getUser<{id: number, username: string}>(23);
} 
*/

const getUser = async <T>(id: number) => {
  const user: T = await fetch(`/users/${id}`).then((response) =>
    response.json()
  );
  return user;
};

const myFunc = async () => {
  const data = await getUser<{ id: number; username: string }>(23);
};
