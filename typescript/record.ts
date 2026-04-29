type K = "user" | "admin" | "guest";
type V = "read" | "write" | "execute";

type Permission = Record<K, V>;

const permissions: Permission = {
  user: "read",
  admin: "write",
  guest: "read",
};

type BoolRecord = Record<string, symbol>;

const br: BoolRecord = {
  one: Symbol("one"),
  two: Symbol("two"),
};

/* Q:
type TemplateLiteralKeys = `${"id" | "title" | "author"}`;
type ObjWithKeys = any; // ID: string, TITLE: string, AUTHOR: string
*/

type TemplateLiteralKeys = `${"id" | "title" | "author"}`;
type ObjWithKeys = Record<Uppercase<TemplateLiteralKeys>, string>;
