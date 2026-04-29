type Car = {
  model: string;
  year: number;
};

type NullableCar = {
  [prop in keyof Car]: Car[prop] | null;
};

// more genric syntax

type NullableObj<Obj> = {
  [prop in keyof Obj]: Obj[prop] | null;
};

type NC1 = NullableObj<Car>;
/************----Exclude-----************/
type PartailConfig = {
  mode: "dark" | "light" | undefined;
  refreshRate: number | undefined;
};

type DefiniteProperties<T> = {
  [K in keyof T]: Exclude<T[K], undefined>;
};

type DefiniteConfig = DefiniteProperties<PartailConfig>;

/**-Pick-Omit-****************/

type ServerConfig = {
  apiKey: string;
  privateToken: string;
  debugMode: boolean;
};

type PublicConfig1 = {
  [K in Exclude<keyof ServerConfig, `private${string}`>]: ServerConfig[K];
};
type PublicConfig2 = Omit<ServerConfig, `private${string}`>;
type PublicConfig3 = Pick<ServerConfig, "apiKey" | "debugMode">;

/****-----Arrays------****/

type WrappedElements<T> = {
  [K in keyof T]: { value: T[K] };
};

type MyStrings = string[];
type WrappedStrings = WrappedElements<MyStrings>;

type MyTuple = [number, boolean, 23];
type WrappedTuple = WrappedElements<MyTuple>;

type KeyTuple = ["key-123", "key-456", "blabla"];

type ExtractKeys<T extends any[]> = {
  [S in keyof T]: T[S] extends `key-${infer K}` ? K : T[S];
};
type RealTuple = ExtractKeys<KeyTuple>; // ["123","456","blabla"]

/****--Optional and Required--*****/
type MakeOptional<T> = {
  [K in keyof T]?: T[K];
};
type MakeRequired<T> = {
  [K in keyof T]-?: T[K];
};

type Product = {
  id: number;
  title: string;
  price: number;
};
type PartialProduct = MakeOptional<Product>;
type RequiredProduct = MakeRequired<PartialProduct>;
type OptionalProduct = Partial<Product>;

type Point = [number, number];
type OptionalPoint = MakeOptional<Point>;

/******--Key Mapiing--******* */

type Resources = {
  product: string;
  customer: string;
  inventory: number;
};
type NewKeys = `get${Capitalize<keyof Resources>}`;

type RemapKeys<T> = {
  [K in keyof T as `get${Capitalize<K & string>}`]: () => T[K];
};

type getResources = RemapKeys<Resources>;
