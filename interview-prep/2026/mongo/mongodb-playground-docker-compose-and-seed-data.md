# MongoDB Playground — Docker Compose Setup & Practice Seed Data

This file is a **reusable setup guide** for the MongoDB Zero-to-Hero learning project.

Use this together with:

> `mongodb-zero-to-hero-pre-indexes.md`

The idea is simple:

```text
This file
   ↓
Start MongoDB
   ↓
Open Mongo Shell
   ↓
Create/reset practice database
   ↓
Run seed data
   ↓
Open pre-index notes
   ↓
Practice
```

---

# 1. Prerequisites

You need:

- Docker
- Docker Compose

Check:

```bash
docker --version
docker compose version
```

Modern Docker uses:

```bash
docker compose
```

rather than the older:

```bash
docker-compose
```

---

# 2. Project Structure

Create a directory:

```bash
mkdir mongodb-playground
cd mongodb-playground
```

Recommended structure:

```text
mongodb-playground/
│
├── docker-compose.yml
│
├── init/
│   └── 01-seed.js
│
└── README.md
```

You can keep your learning notes outside this directory or alongside it.

---

# 3. Docker Compose Configuration

Create:

```text
docker-compose.yml
```

with:

```yaml
services:
  mongo:
    image: mongo:8.3
    container_name: mongo-playground
    restart: unless-stopped

    ports:
      - "27017:27017"

    environment:
      MONGO_INITDB_DATABASE: playground

    volumes:
      - mongo_data:/data/db
      - ./init:/docker-entrypoint-initdb.d:ro

volumes:
  mongo_data:
```

## What this does

### MongoDB image

```yaml
image: mongo:8.3
```

Runs MongoDB 8.3.

### Container name

```yaml
container_name: mongo-playground
```

Makes the container easy to recognize.

### Port mapping

```yaml
ports:
  - "27017:27017"
```

Maps:

```text
Mac/host port 27017
        ↓
Container port 27017
```

So applications running on your machine can connect using:

```text
mongodb://localhost:27017
```

### Persistent volume

```yaml
volumes:
  - mongo_data:/data/db
```

MongoDB stores its database files under:

```text
/data/db
```

inside the container.

Docker stores that data in the named volume:

```text
mongo_data
```

Therefore:

```text
docker compose down
```

does NOT delete the database data.

But:

```bash
docker compose down -v
```

does remove the named volume and therefore resets the database.

This distinction is very important.

---

# 4. Start MongoDB

From the project directory:

```bash
docker compose up -d
```

Check:

```bash
docker compose ps
```

You should see the MongoDB container running.

You can also check:

```bash
docker ps
```

---

# 5. Check MongoDB Logs

If something doesn't work:

```bash
docker compose logs mongo
```

Follow logs:

```bash
docker compose logs -f mongo
```

Stop following with:

```text
Ctrl + C
```

---

# 6. Open Mongo Shell

MongoDB's shell is called:

```text
mongosh
```

The easiest way is to enter the running container:

```bash
docker exec -it mongo-playground mongosh
```

You should get a shell similar to:

```text
test>
```

You are now inside MongoDB.

---

# 7. Check Databases

Inside `mongosh`:

```javascript
show dbs
```

Select the playground database:

```javascript
use playground
```

Check the current database:

```javascript
db
```

Expected:

```text
playground
```

---

# 8. Seed Data Automatically

Docker's official MongoDB image executes JavaScript files placed under:

```text
/docker-entrypoint-initdb.d/
```

during the **initial database initialization**.

Our compose file mounts:

```yaml
- ./init:/docker-entrypoint-initdb.d:ro
```

So:

```text
init/01-seed.js
```

becomes:

```text
/docker-entrypoint-initdb.d/01-seed.js
```

inside the container.

---

# 9. Seed Script

Create:

```text
init/01-seed.js
```

Use:

```javascript
db = db.getSiblingDB("playground");

db.users.drop();

db.users.insertMany([
  {
    _id: 1,
    name: "John",
    age: 28,
    city: "Kolkata",
    state: "West Bengal",
    isPremium: false,
    email: "john@example.com",
    skills: ["Node", "React", "MongoDB"],
    address: {
      city: "Kolkata",
      state: "West Bengal",
      pin: "700001"
    },
    projects: [
      {
        name: "OMS",
        experience: 3
      },
      {
        name: "Billing",
        experience: 2
      }
    ]
  },

  {
    _id: 2,
    name: "Alice",
    age: 32,
    city: "Bangalore",
    state: "Karnataka",
    isPremium: true,
    email: "alice@example.com",
    skills: ["Java", "Spring", "MongoDB"],
    address: {
      city: "Bangalore",
      state: "Karnataka",
      pin: "560001"
    },
    projects: [
      {
        name: "Payments",
        experience: 5
      },
      {
        name: "OMS",
        experience: 3
      }
    ]
  },

  {
    _id: 3,
    name: "Bob",
    age: 35,
    city: "Delhi",
    state: "Delhi",
    isPremium: false,
    skills: ["Node", "MongoDB", "Redis"],
    address: {
      city: "Delhi",
      state: "Delhi",
      pin: "110001"
    },
    projects: [
      {
        name: "OMS",
        experience: 1
      },
      {
        name: "Billing",
        experience: 3
      }
    ]
  },

  {
    _id: 4,
    name: "David",
    age: 40,
    city: "Delhi",
    state: "Delhi",
    isPremium: true,
    email: "david@example.com",
    skills: ["React", "Next.js", "Node"],
    address: {
      city: "Delhi",
      state: "Delhi",
      pin: "110002"
    },
    projects: [
      {
        name: "Frontend",
        experience: 6
      },
      {
        name: "OMS",
        experience: 4
      }
    ]
  },

  {
    _id: 5,
    name: "Emma",
    age: 28,
    city: "Mumbai",
    state: "Maharashtra",
    isPremium: true,
    email: "emma@example.com",
    skills: ["Python", "MongoDB", "Redis"],
    address: {
      city: "Mumbai",
      state: "Maharashtra",
      pin: "400001"
    },
    projects: [
      {
        name: "Analytics",
        experience: 2
      }
    ]
  },

  {
    _id: 6,
    name: "Frank",
    age: 45,
    city: "Kolkata",
    state: "West Bengal",
    isPremium: false,
    email: "frank@example.com",
    skills: ["Java", "Kafka", "MongoDB"],
    address: {
      city: "Kolkata",
      state: "West Bengal",
      pin: "700002"
    },
    projects: [
      {
        name: "Payments",
        experience: 8
      },
      {
        name: "OMS",
        experience: 5
      }
    ]
  },

  {
    _id: 7,
    name: "Grace",
    age: 30,
    city: "Bangalore",
    state: "Karnataka",
    isPremium: false,
    skills: ["Node", "React"],
    address: {
      city: "Bangalore",
      state: "Karnataka",
      pin: "560002"
    },
    projects: [
      {
        name: "Frontend",
        experience: 3
      }
    ]
  },

  {
    _id: 8,
    name: "Henry",
    age: 26,
    city: "Pune",
    state: "Maharashtra",
    isPremium: true,
    email: "henry@example.com",
    skills: ["Go", "MongoDB", "Docker"],
    address: {
      city: "Pune",
      state: "Maharashtra",
      pin: "411001"
    },
    projects: [
      {
        name: "Platform",
        experience: 2
      }
    ]
  },

  {
    _id: 9,
    name: "Iris",
    age: 38,
    city: "Hyderabad",
    state: "Telangana",
    isPremium: true,
    email: "iris@example.com",
    skills: ["Java", "Kafka", "Redis"],
    address: {
      city: "Hyderabad",
      state: "Telangana",
      pin: "500001"
    },
    projects: [
      {
        name: "Payments",
        experience: 7
      },
      {
        name: "Platform",
        experience: 4
      }
    ]
  },

  {
    _id: 10,
    name: "Jack",
    age: 33,
    city: "Chennai",
    state: "Tamil Nadu",
    isPremium: false,
    skills: ["Node", "MongoDB", "Docker"],
    address: {
      city: "Chennai",
      state: "Tamil Nadu",
      pin: "600001"
    },
    projects: [
      {
        name: "OMS",
        experience: 3
      }
    ]
  },

  {
    _id: 11,
    name: "Kevin",
    age: 29,
    city: "Delhi",
    state: "Delhi",
    isPremium: false,
    email: "kevin@example.com",
    skills: ["React", "Redux"],
    address: {
      city: "Delhi",
      state: "Delhi",
      pin: "110003"
    },
    projects: [
      {
        name: "Frontend",
        experience: 4
      }
    ]
  },

  {
    _id: 12,
    name: "Laura",
    age: 41,
    city: "Bangalore",
    state: "Karnataka",
    isPremium: true,
    email: "laura@example.com",
    skills: ["Node", "MongoDB", "Kafka"],
    address: {
      city: "Bangalore",
      state: "Karnataka",
      pin: "560003"
    },
    projects: [
      {
        name: "OMS",
        experience: 6
      },
      {
        name: "Payments",
        experience: 5
      }
    ]
  }
]);

print("Seed complete");
print("Users: " + db.users.countDocuments());
```

---

# 10. Important: Seed Scripts Run Only During Initialization

This is an important Docker/MongoDB behavior.

If you already have:

```text
mongo_data
```

and run:

```bash
docker compose up -d
```

MongoDB is already initialized.

The initialization script will generally NOT run again.

So if you edit:

```text
init/01-seed.js
```

and want a completely fresh database:

```bash
docker compose down -v
docker compose up -d
```

The `-v` removes the persistent volume.

Then MongoDB initializes again and runs the seed script.

WARNING:

```bash
docker compose down -v
```

deletes your MongoDB playground data.

Use it when you intentionally want to reset the environment.

---

# 11. Verify the Seed Data

Enter the shell:

```bash
docker exec -it mongo-playground mongosh
```

Then:

```javascript
use playground
```

Count documents:

```javascript
db.users.countDocuments()
```

Expected:

```text
12
```

View everything:

```javascript
db.users.find()
```

Pretty output:

```javascript
db.users.find().pretty()
```

---

# 12. Basic Queries From the Pre-Index Lesson

## All users

```javascript
db.users.find()
```

## Alice

```javascript
db.users.find({
  name: "Alice"
})
```

## Age greater than 30

```javascript
db.users.find({
  age: {
    $gt: 30
  }
})
```

## Age greater than or equal to 30

```javascript
db.users.find({
  age: {
    $gte: 30
  }
})
```

## Age less than 30

```javascript
db.users.find({
  age: {
    $lt: 30
  }
})
```

## Projection

```javascript
db.users.find(
  {},
  {
    name: 1,
    city: 1,
    _id: 0
  }
)
```

---

# 13. AND

Find users older than 30 AND living in Delhi:

```javascript
db.users.find({
  age: {
    $gt: 30
  },
  city: "Delhi"
})
```

---

# 14. OR

```javascript
db.users.find({
  $or: [
    {
      city: "Delhi"
    },
    {
      city: "Bangalore"
    }
  ]
})
```

---

# 15. AND + OR

Find:

```text
age > 30
AND
(city = Delhi OR Mumbai)
```

```javascript
db.users.find({
  age: {
    $gt: 30
  },
  $or: [
    {
      city: "Delhi"
    },
    {
      city: "Mumbai"
    }
  ]
})
```

---

# 16. `$in`

```javascript
db.users.find({
  city: {
    $in: [
      "Delhi",
      "Mumbai",
      "Kolkata",
      "Bangalore"
    ]
  }
})
```

---

# 17. `$nin`

```javascript
db.users.find({
  city: {
    $nin: [
      "Delhi",
      "Mumbai"
    ]
  }
})
```

---

# 18. `$exists`

Users with an email:

```javascript
db.users.find({
  email: {
    $exists: true
  }
})
```

Users without an email:

```javascript
db.users.find({
  email: {
    $exists: false
  }
})
```

The seed data intentionally contains some users without email so this query is useful.

---

# 19. `$ne`

```javascript
db.users.find({
  city: {
    $ne: "Delhi"
  }
})
```

---

# 20. Embedded Document Queries

Find users whose nested address city is Kolkata:

```javascript
db.users.find({
  "address.city": "Kolkata"
})
```

Find users from West Bengal:

```javascript
db.users.find({
  "address.state": "West Bengal"
})
```

---

# 21. Array Queries

Find users who know MongoDB:

```javascript
db.users.find({
  skills: "MongoDB"
})
```

Find users whose skills contain Node OR React:

```javascript
db.users.find({
  skills: {
    $in: [
      "Node",
      "React"
    ]
  }
})
```

---

# 22. `$elemMatch`

Find users who have ONE project where:

```text
name = OMS
AND
experience = 3
```

```javascript
db.users.find({
  projects: {
    $elemMatch: {
      name: "OMS",
      experience: 3
    }
  }
})
```

---

# 23. The Array Trap — Practice It

Run:

```javascript
db.users.find({
  "projects.name": "OMS",
  "projects.experience": 3
})
```

Compare that with:

```javascript
db.users.find({
  projects: {
    $elemMatch: {
      name: "OMS",
      experience: 3
    }
  }
})
```

They do NOT necessarily mean the same thing.

The first query can satisfy its conditions using different array elements.

`$elemMatch` requires the conditions to be satisfied by the same array element.

---

# 24. Practice Questions Before Indexes

Try solving these yourself before looking at the answers.

## Q1

Find all users older than 35.

## Q2

Find all premium users.

## Q3

Find users from Delhi OR Kolkata.

## Q4

Find users from Delhi, Mumbai, or Bangalore using `$in`.

## Q5

Find users who are not premium.

## Q6

Find users who don't live in Delhi.

## Q7

Find users older than 30 AND premium.

## Q8

Find users older than 30 AND living in Delhi OR Mumbai.

## Q9

Find users whose address city is Kolkata.

## Q10

Find users who know MongoDB.

## Q11

Find users whose skills contain Node OR React.

## Q12

Find users who have a project named OMS.

## Q13

Find users who have a single project where:

```text
name = OMS
experience = 3
```

## Q14

Find users who don't have an email field.

---

# 25. Answers

## Q1

```javascript
db.users.find({
  age: {
    $gt: 35
  }
})
```

## Q2

```javascript
db.users.find({
  isPremium: true
})
```

## Q3

```javascript
db.users.find({
  $or: [
    {
      city: "Delhi"
    },
    {
      city: "Kolkata"
    }
  ]
})
```

## Q4

```javascript
db.users.find({
  city: {
    $in: [
      "Delhi",
      "Mumbai",
      "Bangalore"
    ]
  }
})
```

## Q5

```javascript
db.users.find({
  isPremium: false
})
```

or, if the requirement is specifically "not equal to true":

```javascript
db.users.find({
  isPremium: {
    $ne: true
  }
})
```

These are not always equivalent for missing fields; understand the exact requirement.

## Q6

```javascript
db.users.find({
  city: {
    $ne: "Delhi"
  }
})
```

## Q7

```javascript
db.users.find({
  age: {
    $gt: 30
  },
  isPremium: true
})
```

## Q8

```javascript
db.users.find({
  age: {
    $gt: 30
  },
  $or: [
    {
      city: "Delhi"
    },
    {
      city: "Mumbai"
    }
  ]
})
```

## Q9

```javascript
db.users.find({
  "address.city": "Kolkata"
})
```

## Q10

```javascript
db.users.find({
  skills: "MongoDB"
})
```

## Q11

```javascript
db.users.find({
  skills: {
    $in: [
      "Node",
      "React"
    ]
  }
})
```

## Q12

```javascript
db.users.find({
  "projects.name": "OMS"
})
```

## Q13

```javascript
db.users.find({
  projects: {
    $elemMatch: {
      name: "OMS",
      experience: 3
    }
  }
})
```

## Q14

```javascript
db.users.find({
  email: {
    $exists: false
  }
})
```

---

# 26. Useful Shell Commands

## Show databases

```javascript
show dbs
```

## Select database

```javascript
use playground
```

## Show collections

```javascript
show collections
```

## Count users

```javascript
db.users.countDocuments()
```

## Drop users collection

```javascript
db.users.drop()
```

## Drop playground database

```javascript
db.dropDatabase()
```

## Exit mongosh

```javascript
exit
```

---

# 27. Reset Everything

If the playground gets messy and you want to start from the beginning:

```bash
docker compose down -v
docker compose up -d
```

Then:

```bash
docker exec -it mongo-playground mongosh
```

and:

```javascript
use playground
db.users.countDocuments()
```

Expected:

```text
12
```

---

# 28. Normal Stop vs Full Reset

## Stop containers

```bash
docker compose down
```

The named volume remains.

Your data remains.

Next time:

```bash
docker compose up -d
```

your data is still there.

---

## Full reset

```bash
docker compose down -v
```

The named volume is deleted.

Next:

```bash
docker compose up -d
```

MongoDB initializes from scratch and runs the seed script.

Use this when you intentionally want a clean playground.

---

# 29. Daily Learning Workflow

When returning to MongoDB practice:

```bash
cd mongodb-playground
```

Start MongoDB:

```bash
docker compose up -d
```

Check it:

```bash
docker compose ps
```

Open MongoDB:

```bash
docker exec -it mongo-playground mongosh
```

Select database:

```javascript
use playground
```

Verify data:

```javascript
db.users.countDocuments()
```

Then open:

```text
mongodb-zero-to-hero-pre-indexes.md
```

and practice from the beginning.

---

# 30. When We Start Indexes

Do NOT add random indexes before learning them.

The learning sequence will be deliberate.

We'll start with:

```javascript
db.users.getIndexes()
```

Then:

```javascript
db.users.createIndex({
  age: 1
})
```

Then:

```javascript
db.users.find({
  age: 30
}).explain("executionStats")
```

We'll learn to interpret:

```text
COLLSCAN
IXSCAN
FETCH
nReturned
totalKeysExamined
totalDocsExamined
executionTimeMillis
```

Then we'll move to:

```text
Single-field indexes
        ↓
Compound indexes
        ↓
Leftmost prefix
        ↓
ESR rule
        ↓
Multikey indexes
        ↓
Unique indexes
        ↓
Partial indexes
        ↓
Sparse indexes
        ↓
TTL indexes
        ↓
Covered queries
        ↓
Query planner
        ↓
Index optimization
```

Only after that will we move deeply into:

```text
AGGREGATION PIPELINE
```

---

# 31. One Important Note About This Dataset

This dataset is intentionally small.

That is good for learning query syntax and understanding results.

But it is **not large enough to demonstrate realistic index-performance differences**.

Later, when we learn indexes and `explain()`, we should generate a much larger dataset—potentially hundreds of thousands or millions of documents—so you can actually observe:

```text
COLLSCAN
vs
IXSCAN
```

and understand:

```text
totalDocsExamined
totalKeysExamined
```

in a meaningful way.

We will generate that data when we reach the indexing/performance section rather than making the initial playground unnecessarily large.

---

# 32. Quick Recovery Checklist

If you come back months later and forget everything:

```bash
# 1. Enter project
cd mongodb-playground

# 2. Start MongoDB
docker compose up -d

# 3. Check container
docker compose ps

# 4. Open Mongo shell
docker exec -it mongo-playground mongosh

# 5. Select database
use playground

# 6. Verify seed data
db.users.countDocuments()

# 7. Start learning
# Open mongodb-zero-to-hero-pre-indexes.md
```

If the data is corrupted or you want a clean start:

```bash
docker compose down -v
docker compose up -d
```

Then repeat the shell steps.

---

# 33. Current Learning Position

At the time this document was created, the MongoDB course has completed:

```text
✓ ObjectId and distributed ID generation
✓ find()
✓ Equality queries
✓ Comparison operators
✓ Projection
✓ Collection scans
✓ Query selectivity
✓ AND
✓ OR
✓ $in
✓ $nin
✓ $exists
✓ $ne
✓ Embedded documents
✓ Dot notation
✓ Arrays
✓ Array membership queries
✓ $elemMatch
✓ Array condition matching trap
✓ Multikey index mental model
```

The next lesson is:

```text
→ INDEXES
```

Start from the beginning of the index lesson rather than creating indexes yourself beforehand.
