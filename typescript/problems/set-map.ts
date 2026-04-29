const emails: Set<string> = new Set();

emails.add("test@abc.com");
emails.add("test2@abc.com");

const books = new Map<number, string>();

books.set(1, "The Great Gatsby");
books.set(2, "To Kill a Mockingbird");
books.set(3, "1984");

books.set(4, true);

function getObjectKeys<T extends {}>(object: T) {
  return Object.keys(object) as (keyof T)[];
}

const test = getObjectKeys({
  key1: "value 1",
  key2: 123,
});
