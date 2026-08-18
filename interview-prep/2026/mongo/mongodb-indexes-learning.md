# MongoDB Indexes — Learning & Interview Notes

## 1. Why indexes exist

Without a suitable index, MongoDB may scan the whole collection:

COLLSCAN → check documents one by one.

An index is an ordered data structure that helps MongoDB locate candidate documents efficiently.

Indexes improve reads, but cost storage, memory/cache, and write/update/delete maintenance.

---

## 2. Creating and inspecting indexes

```javascript
db.users.createIndex({ age: 1 })
db.users.createIndex({ age: -1 })

db.users.getIndexes()
```

`1` = ascending, `-1` = descending.

MongoDB automatically creates the `_id` index.

For a single-field index, one index can generally support both ascending and descending operations by scanning it in different directions.

---

## 3. COLLSCAN vs IXSCAN

### COLLSCAN

MongoDB scans collection documents.

```text
COLLSCAN
  ↓
document 1
document 2
document 3
...
```

### IXSCAN

MongoDB scans an index to locate candidates.

```text
IXSCAN
  ↓
matching index entries
```

---

## 4. explain("executionStats")

Use:

```javascript
db.users.find({
  age: 30
}).explain("executionStats")
```

Important fields:

- `winningPlan`
- `rejectedPlans`
- `nReturned`
- `totalKeysExamined`
- `totalDocsExamined`
- `indexBounds`

### nReturned

Number of documents returned.

### totalKeysExamined

Number of index entries examined.

### totalDocsExamined

Number of actual documents examined/fetched.

These numbers do not have to be equal.

Example:

```text
totalKeysExamined: 3
totalDocsExamined: 1
nReturned: 1
```

means three index entries were examined, but only one document needed to be fetched and returned.

---

## 5. FETCH

A common indexed plan is:

```text
FETCH
  |
  └── IXSCAN
```

`IXSCAN` finds candidate records through the index.

`FETCH` retrieves the actual documents when the index does not contain everything required by the query/result.

---

## 6. Covered queries

A query can sometimes be answered completely from the index.

Example:

```javascript
db.users.createIndex({ age: 1 })

db.users.find(
  { age: 35 },
  { age: 1, _id: 0 }
)
```

If the index contains everything required, MongoDB can avoid fetching documents.

A covered plan may look like:

```text
PROJECTION_COVERED
  |
  └── IXSCAN
```

A key clue is:

```text
totalDocsExamined: 0
```

---

## 7. Index bounds

`indexBounds` shows the portion of the index being searched.

Equality:

```javascript
db.users.find({ age: 30 })
```

may produce:

```javascript
indexBounds: {
  age: [ "[30, 30]" ]
}
```

Range:

```javascript
db.users.find({ age: { $gt: 30 } })
```

may produce:

```javascript
indexBounds: {
  age: [ "(30, inf]" ]
}
```

Interpretation:

```text
[30, 30]  → age = 30
(30, inf] → age > 30
```

---

## 8. Index-supported sorting

With:

```javascript
db.users.createIndex({ age: 1 })
```

MongoDB can satisfy:

```javascript
db.users.find().sort({ age: 1 })
```

by scanning the ordered index.

No separate `SORT` stage is required.

The same index can support:

```javascript
.sort({ age: -1 })
```

by scanning backward.

Mental model:

```text
{ age: 1 }

forward:
26 → 28 → 30 → 32 → 35 → 40

backward:
40 → 35 → 32 → 30 → 28 → 26
```

---

## 9. Compound indexes

Example:

```javascript
db.users.createIndex({
  age: 1,
  city: 1
})
```

Think of it as:

```text
FIRST  → age
SECOND → city
```

Conceptually:

```text
age   city
-----------
28    Bangalore
28    Mumbai
29    Delhi
30    Bangalore
32    Bangalore
35    Delhi
35    Mumbai
40    Delhi
```

MongoDB orders by `age` first, and within equal ages, by `city`.

Field order matters.

---

## 10. Leftmost-prefix rule

For:

```javascript
{ age: 1, city: 1 }
```

the leftmost field is `age`.

The index is naturally useful for:

```text
age
age + city
```

but not efficiently for:

```text
city alone
```

Think of a phone book sorted by:

```text
Last Name → First Name
```

You can efficiently find a last name, but the structure is not primarily organized by first name.

Important nuance:

> "Cannot efficiently use" does not mean MongoDB can never scan the index. It means the compound index cannot use `city` as its efficient leading search prefix.

### Playground result we observed

For:

```javascript
db.users.find({ age: 35 }).explain("executionStats")
```

MongoDB used the simple `age_1` index.

For:

```javascript
db.users.find({ city: "Delhi" }).explain("executionStats")
```

our observed winning plan was:

```text
COLLSCAN
```

with:

```text
totalKeysExamined: 0
totalDocsExamined: 9
nReturned: 3
```

For:

```javascript
db.users.find({
  age: 35,
  city: "Delhi"
}).explain("executionStats")
```

MongoDB used:

```text
age_1_city_1
```

and could use both index fields.

---

## 11. Query planner

MongoDB may have several possible indexes.

Example:

```text
{ age: 1 }
{ age: -1 }
{ age: 1, city: 1 }
{ city: 1, name: 1, age: 1 }
```

The query planner evaluates candidate plans and chooses a winning plan.

`explain()` can show:

```text
winningPlan
rejectedPlans
```

Mental model:

```text
Query
  ↓
Query Planner
  ├── candidate A
  ├── candidate B
  └── candidate C
  ↓
Winning Plan
```

It does not simply choose the biggest or most complicated index.

---

## 12. Compound index sort directions

For:

```javascript
{ age: 1, name: 1 }
```

forward scanning naturally gives:

```text
age ↑
name ↑
```

Backward scanning gives:

```text
age ↓
name ↓
```

But:

```text
age ↑
name ↓
```

is a mixed direction and cannot be produced by simply reversing the entire `{ age: 1, name: 1 }` index.

A corresponding index pattern can be used:

```javascript
{ age: 1, name: -1 }
```

Key idea:

> Reversing a compound index reverses all of its fields together.

---

## 13. ESR rule

ESR is a guideline for designing compound indexes:

```text
E → Equality
S → Sort
R → Range
```

A common starting point is:

```text
Equality fields
      ↓
Sort fields
      ↓
Range fields
```

Example:

```javascript
db.users.find({
  city: "Delhi",
  age: { $gt: 35 }
}).sort({
  name: 1
})
```

Roles:

```text
city → Equality
name → Sort
age  → Range
```

Natural starting index:

```javascript
{
  city: 1,
  name: 1,
  age: 1
}
```

### Important

ESR is based on **how the field is used by the query**, not its data type.

For example:

```javascript
age: 35
```

is Equality.

```javascript
name: { $gt: "M" }
```

is Range.

---

## 14. ESR experiment from the playground

We created:

```javascript
db.users.createIndex({
  city: 1,
  name: 1,
  age: 1
})
```

Then ran:

```javascript
db.users.find({
  city: "Delhi",
  age: { $gt: 35 }
}).sort({
  name: 1
}).explain("executionStats")
```

Observed:

```text
indexName: city_1_name_1_age_1
totalKeysExamined: 3
totalDocsExamined: 1
nReturned: 1
```

Winning plan:

```text
FETCH
  |
  └── IXSCAN
```

There was no `SORT` stage in the winning plan.

Index bounds were:

```javascript
{
  city: [ '["Delhi", "Delhi"]' ],
  name: [ '[MinKey, MaxKey]' ],
  age: [ '(35, inf]' ]
}
```

Meaning:

```text
city → equality
name → index ordering for sort
age  → range
```

A `SORT` appeared in a rejected candidate plan, showing that the query planner considered another strategy but selected the ESR-compatible index plan.

---

## 15. Special index types

### Unique

```javascript
db.users.createIndex(
  { email: 1 },
  { unique: true }
)
```

Prevents duplicate indexed values.

Typical uses:

```text
email
username
employeeId
orderNumber
```

### Multikey

When an indexed field is an array, MongoDB automatically creates a multikey index.

Example:

```javascript
{
  name: "Alice",
  skills: ["Java", "MongoDB", "Node"]
}
```

Index:

```javascript
db.users.createIndex({
  skills: 1
})
```

Conceptually, the array elements become index entries.

```text
Java
MongoDB
Node
```

`explain()` may show:

```text
isMultiKey: true
```

### Sparse

```javascript
db.users.createIndex(
  { email: 1 },
  { sparse: true }
)
```

Only documents where the indexed field exists are represented in the index.

### Partial

```javascript
db.users.createIndex(
  { age: 1 },
  {
    partialFilterExpression: {
      isPremium: true
    }
  }
)
```

Only documents satisfying the partial filter are indexed.

Partial indexes provide more control than sparse indexes.

### TTL

TTL = Time To Live.

Example:

```javascript
db.sessions.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
)
```

MongoDB's background TTL process removes expired documents.

Common uses:

```text
sessions
temporary tokens
temporary data
expiring events/logs
```

TTL deletion is not guaranteed to happen at the exact expiration second.

---

# 16. Important interview questions

### Q1. What is an index?

An ordered data structure that helps MongoDB locate matching documents without scanning the whole collection.

### Q2. What is COLLSCAN?

A collection scan where MongoDB examines collection documents.

### Q3. What is IXSCAN?

An index scan where MongoDB examines index entries.

### Q4. What is FETCH?

Retrieving actual documents after locating candidates through an index.

### Q5. What is a covered query?

A query that can be answered entirely from the index without fetching documents.

### Q6. What does totalKeysExamined mean?

Number of index entries examined.

### Q7. What does totalDocsExamined mean?

Number of actual documents examined/fetched.

### Q8. Why can totalKeysExamined be greater than nReturned?

The index can contain candidate entries that are examined but don't ultimately produce returned documents.

### Q9. Why can totalDocsExamined be 0?

The query may be covered by the index.

### Q10. Why can an index avoid SORT?

Because its ordered entries can already provide the requested sort order.

### Q11. Can `{ age: 1 }` support descending sorting?

Yes. MongoDB can scan the index backward.

### Q12. Why does compound index field order matter?

Because the index is ordered by the first field, then the second field within equal values of the first, and so on.

### Q13. Explain the leftmost-prefix rule.

For:

```javascript
{ age: 1, city: 1 }
```

the index is naturally useful for `age` and `age + city`, but not efficiently for `city` alone.

### Q14. What is ESR?

Equality → Sort → Range, a guideline for designing compound indexes.

### Q15. Is ESR absolute?

No. It is a guideline. Actual performance depends on selectivity, data distribution, sort requirements, query shape, available indexes, and the query planner.

### Q16. Why not create indexes on every field?

Indexes consume storage and memory and add write/update/delete maintenance cost.

### Q17. What is a unique index?

An index that prevents duplicate indexed values.

### Q18. What is a multikey index?

An index on an array field where MongoDB indexes array elements.

### Q19. Sparse vs partial index?

Sparse indexes only include documents where the field exists. Partial indexes include documents satisfying a specified filter expression.

### Q20. What is a TTL index?

An index that enables automatic removal of expired documents through MongoDB's TTL background process.

---

# 17. Practical index investigation workflow

When investigating a MongoDB query:

```text
1. Understand the query
        ↓
2. Identify available indexes
        ↓
3. Check compound-index field order
        ↓
4. Check leftmost prefix
        ↓
5. Check whether index can satisfy sort
        ↓
6. Check whether query can be covered
        ↓
7. Run explain("executionStats")
        ↓
8. Inspect winningPlan
        ↓
9. Inspect rejectedPlans
        ↓
10. Check COLLSCAN vs IXSCAN
        ↓
11. Check totalKeysExamined
        ↓
12. Check totalDocsExamined
        ↓
13. Compare with nReturned
```

---

# 18. Final mental model

```text
INDEX
  |
  ├── Single-field
  │      ├── forward scan
  │      └── backward scan
  │
  ├── Compound
  │      ├── field order matters
  │      ├── leftmost-prefix rule
  │      └── ESR guideline
  │
  └── Special
         ├── Unique
         ├── Multikey
         ├── Sparse
         ├── Partial
         └── TTL

QUERY
  ↓
QUERY PLANNER
  ↓
winningPlan
  ↓
IXSCAN / COLLSCAN
  ↓
FETCH (if required)
  ↓
RESULT
```

---

# 19. MongoDB learning progress

Completed:

```text
MongoDB basics
      ↓
find()
      ↓
query operators
      ↓
nested documents
      ↓
arrays
      ↓
$elemMatch
      ↓
COLLSCAN
      ↓
Indexes
      ↓
explain()
      ↓
IXSCAN / FETCH
      ↓
Covered queries
      ↓
Index-supported sorting
      ↓
Compound indexes
      ↓
Leftmost-prefix rule
      ↓
ESR
      ↓
Query planner
      ↓
Special index types
```

## Next: Aggregation Pipeline

Start with:

```javascript
db.users.aggregate([
  {
    $match: {
      age: { $gt: 30 }
    }
  }
])
```

Then learn:

```text
$match
  ↓
$project
  ↓
$group
  ↓
$sum / $avg / $min / $max
  ↓
$sort
  ↓
$limit / $skip
  ↓
$unwind
  ↓
$lookup
  ↓
$set / $addFields
  ↓
$filter / $map
  ↓
$cond / $switch
  ↓
date operators
  ↓
$facet
  ↓
$bucket
  ↓
advanced pipelines
  ↓
aggregation optimization
  ↓
indexes + aggregation
  ↓
real-world problems
```
