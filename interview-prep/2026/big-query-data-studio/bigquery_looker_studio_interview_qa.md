# BigQuery & Looker Studio — Interview Questions & Answers

## 1. What is BigQuery?

**Answer:**

BigQuery is Google's fully managed, serverless cloud data warehouse designed primarily for large-scale analytical workloads (OLAP).

It is useful for running complex queries over very large datasets without managing database servers, storage, or compute infrastructure.

**Key points:**
- Serverless
- Designed for analytics / OLAP
- Distributed query processing
- Columnar storage
- Separates compute and storage
- Supports SQL
- Works well with BI tools such as Looker Studio

---

## 2. BigQuery vs MySQL/PostgreSQL

| MySQL/PostgreSQL | BigQuery |
|---|---|
| Primarily OLTP | Primarily OLAP |
| Application transactions | Analytics/reporting |
| Frequent INSERT/UPDATE/DELETE | Large analytical queries |
| Usually long-lived database instances | Serverless |
| Row-oriented workloads are common | Columnar analytical storage |
| Good for individual transactional queries | Good for aggregations over huge datasets |

**Interview answer:**

> I would typically use MySQL or PostgreSQL for application transactions and BigQuery for analytical workloads. For example, an e-commerce application could store orders in PostgreSQL, replicate or transform that data into BigQuery, and use BigQuery for revenue, customer, and trend analysis.

---

## 3. What is OLTP?

**OLTP = Online Transaction Processing.**

It handles day-to-day application transactions.

Examples:

```text
Create order
Update customer
Process payment
Update inventory
```

Typical databases:

```text
MySQL
PostgreSQL
SQL Server
```

The focus is:
- Fast individual transactions
- Consistency
- Inserts/updates/deletes
- Concurrent users

---

## 4. What is OLAP?

**OLAP = Online Analytical Processing.**

It is designed for analyzing large amounts of historical data.

Examples:

```text
Revenue by month
Sales by country
Top customers
Year-over-year growth
```

BigQuery is an OLAP/data-warehouse platform.

---

## 5. OLTP vs OLAP

```text
OLTP
  ↓
Run the business

OLAP
  ↓
Analyze the business
```

Example:

```text
Customer places order
        ↓
PostgreSQL / MySQL
        ↓
Transaction completed
        ↓
Data moved to BigQuery
        ↓
Analytics
        ↓
Looker Studio dashboard
```

---

## 6. What is a BigQuery Project, Dataset, and Table?

BigQuery commonly uses:

```text
PROJECT.DATASET.TABLE
```

For our exercise:

```text
bigquery-learning-505503.sales.orders
```

means:

```text
Project  → bigquery-learning-505503
Dataset  → sales
Table    → orders
```

A **project** is the broader Google Cloud resource container.

A **dataset** is a logical container for BigQuery tables and other resources.

A **table** contains the actual data.

---

## 7. What is a dataset?

A dataset is a logical container for tables in BigQuery.

Example:

```text
sales
├── orders
├── customers
└── products
```

It helps organize related analytical data.

---

## 8. What is serverless BigQuery?

Serverless means you don't have to provision or manage database servers, disks, or CPU capacity yourself.

You submit:

```sql
SELECT ...
```

and Google manages the underlying infrastructure required to execute the query.

---

## 9. Why is BigQuery fast for analytical workloads?

Several important ideas contribute:

1. **Distributed processing** — query work can be distributed across many workers.
2. **Columnar storage** — analytical queries can efficiently process only the columns they need.
3. **Separation of compute and storage** — storage and query processing are managed independently.
4. **Partitioning and clustering** — can reduce unnecessary data processing.

A good interview answer:

> BigQuery is optimized for analytical workloads through distributed query execution and columnar storage, and partitioning and clustering can further reduce the amount of data that needs to be processed.

---

## 10. What is partitioning?

Partitioning divides a BigQuery table into partitions based on a partitioning column.

A common example is a date:

```text
orders
├── 2024
├── 2025
├── Jan 2026
├── Feb 2026
└── Mar 2026
```

If a query asks for March 2026, BigQuery can potentially avoid scanning unrelated partitions.

**Interview answer:**

> Partitioning divides a table into logical partitions, commonly by date or timestamp, so queries can scan only relevant partitions instead of the entire table.

---

## 11. Why is partitioning useful?

Suppose a table contains years of order data.

Query:

```sql
SELECT *
FROM orders
WHERE order_date >= '2026-01-01';
```

If the table is partitioned by `order_date`, BigQuery can use partition pruning to avoid reading irrelevant older partitions.

Benefits:
- Less data processed
- Better query performance
- Potentially lower query cost

---

## 12. What is clustering?

Clustering organizes data based on selected columns.

For example:

```text
Partition: March 2026

cluster by:
country
customer_id
```

If queries frequently filter on `country`, clustering can help BigQuery find relevant data more efficiently.

**Mental model:**

```text
Partitioning
→ Which large chunk of data?

Clustering
→ How is data organized within that chunk?
```

---

## 13. Partitioning vs clustering

| Partitioning | Clustering |
|---|---|
| Divides table into partitions | Organizes data within a table/partition |
| Usually based on date/time or another suitable column | Based on one or more columns |
| Helps eliminate entire partitions | Helps reduce unnecessary data within relevant storage |
| Think "large chunks" | Think "organization inside chunks" |

They can be used together.

---

## 14. What is data scanning in BigQuery?

BigQuery processes data as part of query execution. The amount of data processed is important for performance and, depending on the billing model/usage, cost.

For a huge table, avoid unnecessarily scanning all columns and all historical data.

Prefer queries that:
- Select only needed columns
- Filter on partitioning columns when appropriate
- Use suitable partitioning and clustering

Avoid blindly doing:

```sql
SELECT *
FROM huge_table;
```

when you only need a few columns and a limited time period.

---

## 15. Why should I avoid SELECT *?

`SELECT *` requests all columns.

If a table has many columns and you only need two, explicitly selecting those columns can reduce unnecessary data processing.

Prefer:

```sql
SELECT
  customer_id,
  amount
FROM orders;
```

instead of:

```sql
SELECT *
FROM orders;
```

---

## 16. What is DML?

DML means **Data Manipulation Language**.

Examples:

```sql
INSERT
UPDATE
DELETE
MERGE
```

During our BigQuery Sandbox exercise, DML was restricted because billing was not enabled.

---

## 17. What is DDL?

DDL means **Data Definition Language**.

Examples:

```sql
CREATE TABLE
CREATE SCHEMA
ALTER TABLE
DROP TABLE
```

We created our table using CTAS:

```sql
CREATE OR REPLACE TABLE `project.dataset.orders` AS
SELECT ...
```

---

## 18. What is CTAS?

CTAS means **Create Table As Select**.

Example:

```sql
CREATE OR REPLACE TABLE `project.sales.orders` AS
SELECT ...
```

It creates a table from the result of a query.

It is useful for creating transformed or derived tables.

---

## 19. What is WHERE vs HAVING?

### WHERE

Filters individual rows **before aggregation**.

```sql
SELECT
  country,
  SUM(amount) AS revenue
FROM orders
WHERE amount > 10000
GROUP BY country;
```

### HAVING

Filters groups **after aggregation**.

```sql
SELECT
  country,
  SUM(amount) AS revenue
FROM orders
GROUP BY country
HAVING SUM(amount) > 10000;
```

Mental model:

```text
WHERE
 ↓
filter rows

GROUP BY
 ↓
create groups

HAVING
 ↓
filter groups
```

---

## 20. Why can't I use SUM() in WHERE?

This is invalid conceptually:

```sql
WHERE SUM(amount) > 10000
```

`WHERE` operates before aggregation.

`SUM()` is calculated during the aggregation stage.

Use:

```sql
HAVING SUM(amount) > 10000
```

when filtering aggregated results.

---

## 21. What is a CTE?

CTE = **Common Table Expression**.

Example:

```sql
WITH country_revenue AS (
  SELECT
    country,
    SUM(amount) AS revenue
  FROM orders
  GROUP BY country
)

SELECT *
FROM country_revenue
WHERE revenue > 10000;
```

A CTE creates a named temporary query result that can be referenced by the following query.

CTEs improve readability and help break complex analytical queries into logical steps.

---

## 22. What is a window function?

A window function calculates a value across related rows **without collapsing those rows**.

Example:

```sql
SELECT
  order_id,
  country,
  amount,
  SUM(amount) OVER (
    PARTITION BY country
  ) AS country_revenue
FROM orders;
```

Each order remains in the result, while the total revenue for its country is added to each row.

### Key distinction

```text
GROUP BY
→ reduces/collapses rows

Window function
→ keeps rows and calculates across them
```

---

## 23. What is RANK()?

`RANK()` assigns rankings based on an ordering.

Example:

```sql
SELECT
  customer,
  revenue,
  RANK() OVER (
    ORDER BY revenue DESC
  ) AS revenue_rank
FROM customer_revenue;
```

This can be used for:
- Top customers
- Top products
- Department rankings
- Sales rankings

---

## 24. What is ETL?

ETL:

```text
Extract
Transform
Load
```

Example:

```text
Production DB
   ↓
Extract
   ↓
Transform
   ↓
BigQuery
```

The data is transformed before loading into the warehouse.

---

## 25. What is ELT?

ELT:

```text
Extract
Load
Transform
```

Example:

```text
Production DB
   ↓
Extract
   ↓
BigQuery
   ↓
Transform using SQL
```

Modern cloud data warehouses such as BigQuery make ELT attractive because they provide scalable compute for transformations.

### Easy distinction

```text
ETL
Transform before warehouse

ELT
Transform inside warehouse
```

---

## 26. How would you design a production analytics pipeline?

A simple architecture:

```text
Application
    ↓
MySQL / PostgreSQL / MongoDB
    ↓
CDC / ETL / ELT
    ↓
BigQuery
    ↓
Transformations
    ↓
Analytical tables/views
    ↓
Looker Studio
    ↓
Dashboard
```

For larger systems, ingestion may involve services such as Pub/Sub, Dataflow, Cloud Storage, or other pipeline technologies.

---

# Looker Studio Interview Questions

## 27. What is Looker Studio?

Looker Studio is a BI and visualization tool that connects to data sources such as BigQuery and lets users create dashboards, reports, charts, tables, filters, and KPIs.

Think:

```text
BigQuery
   ↓
Data
   ↓
Looker Studio
   ↓
Visualization
```

---

## 28. Is Looker Studio a database?

No.

BigQuery is the analytical data warehouse.

Looker Studio is primarily the visualization/BI layer.

```text
BigQuery
→ stores and analyzes data

Looker Studio
→ visualizes the data
```

---

## 29. What is a dimension?

A dimension describes **how you want to group or categorize data**.

Examples:

```text
country
customer
category
product
order_date
```

For:

> Revenue by country

the dimension is:

```text
country
```

A useful mental model:

```text
Dimension
≈ GROUP BY
```

---

## 30. What is a metric?

A metric is a value that you calculate or measure.

Examples:

```text
SUM(amount)
COUNT(order_id)
AVG(amount)
```

For:

> Revenue by country

you have:

```text
Dimension → country
Metric    → SUM(amount)
```

Mental model:

```text
Dimension
→ How do I group?

Metric
→ What do I calculate?
```

---

## 31. What is a Scorecard?

A scorecard displays a single important KPI.

Examples:

```text
Total Revenue
Total Orders
Total Customers
Average Order Value
```

Example:

```text
SUM(amount)
```

can produce:

```text
TOTAL REVENUE
₹177,300
```

---

## 32. What is a filter in Looker Studio?

A filter allows users to restrict the data displayed in charts.

Example:

```text
Country = India
```

Then the dashboard can show only India's revenue, orders, customers, etc.

---

## 33. What is a time-series chart?

A time-series chart visualizes a metric over time.

Example:

```text
Dimension → order_date
Metric    → SUM(amount)
```

This can show:

```text
Revenue
  │
  │       ●
  │   ●
  │ ●     ●
  └──────────────
    Jan Feb Mar
```

---

## 34. How does Looker Studio connect to BigQuery?

Conceptually:

```text
Looker Studio
      ↓
BigQuery connector
      ↓
Project
      ↓
Dataset
      ↓
Table / View
```

The report uses the BigQuery data source and visualizes the returned data.

---

## 35. What happens when I create "Revenue by Country" in Looker Studio?

Suppose:

```text
Dimension = country
Metric = SUM(amount)
```

Conceptually, this corresponds to:

```sql
SELECT
  country,
  SUM(amount) AS revenue
FROM orders
GROUP BY country;
```

So the mental model is:

```text
Dimension
→ grouping

Metric
→ aggregation
```

---

# Architecture / Scenario Questions

## 36. Why not connect Looker Studio directly to the production MySQL database?

You technically can connect BI tools to databases in some scenarios, but for large-scale analytics it is generally better to separate transactional and analytical workloads.

Reasons include:
- Avoiding analytical queries impacting production traffic
- Better scalability for analytical workloads
- Historical data aggregation
- Warehouse-specific optimization
- Better separation of concerns

Typical architecture:

```text
Production DB
     ↓
Data pipeline
     ↓
BigQuery
     ↓
Looker Studio
```

---

## 37. How would you optimize a slow BigQuery query?

I would investigate:

1. How much data is being processed?
2. Am I selecting unnecessary columns?
3. Can partition pruning be used?
4. Is the table appropriately partitioned?
5. Would clustering help?
6. Can expensive joins or transformations be optimized?
7. Can repeated transformations be materialized into appropriate tables/views?
8. Can the query be rewritten to reduce intermediate data?

---

## 38. When would you use a view?

A view can encapsulate a query so consumers can query a logical dataset without repeatedly writing the underlying SQL.

Example:

```sql
CREATE VIEW sales.monthly_revenue AS
SELECT
  DATE_TRUNC(order_date, MONTH) AS month,
  SUM(amount) AS revenue
FROM sales.orders
GROUP BY month;
```

Looker Studio can then consume the view.

---

## 39. Table vs view?

### Table

Stores data physically.

```text
Table
→ stored dataset
```

### View

Stores the query definition and returns query results when accessed.

```text
View
→ saved query / logical representation
```

A view can be useful for presenting a clean analytical interface to BI users.

---

## 40. What would you put in BigQuery vs Looker Studio?

A good rule:

### BigQuery

Put substantial data transformation and analytical logic here:

```text
Joins
Complex transformations
Large aggregations
Data cleansing
Reusable analytical datasets
```

### Looker Studio

Use it mainly for:

```text
Visualization
KPIs
Charts
Filters
Dashboard interaction
Presentation
```

This keeps the dashboard layer simpler.

---

# Rapid-Fire Interview Answers

### BigQuery?

> Serverless cloud data warehouse for large-scale analytics.

### OLTP?

> Transaction processing used by applications.

### OLAP?

> Analytical processing over large datasets.

### Partitioning?

> Divides data into partitions to reduce unnecessary scanning.

### Clustering?

> Organizes data based on selected columns within the table/partition.

### Dimension?

> How you group or categorize data.

### Metric?

> What you measure or aggregate.

### Looker Studio?

> BI and visualization layer for building dashboards and reports.

### ETL?

> Extract → Transform → Load.

### ELT?

> Extract → Load → Transform.

### CTE?

> A named temporary query result used within a SQL statement.

### Window function?

> Performs calculations across related rows without collapsing the result rows.

### `WHERE`?

> Filters rows before aggregation.

### `HAVING`?

> Filters groups after aggregation.

---

# The Most Important Mental Model

If you remember only this, remember:

```text
                 APPLICATION
                      │
                      ↓
             MySQL / PostgreSQL
                      │
                  ETL / ELT
                      │
                      ↓
                  BigQuery
                      │
              ┌───────┴────────┐
              │                │
          Partitioning      Clustering
              │                │
              └───────┬────────┘
                      ↓
               Analytical SQL
                      │
                      ↓
                Looker Studio
                      │
          ┌───────────┼───────────┐
          ↓           ↓           ↓
       Scorecard    Chart       Filter
          │           │           │
          └───────────┼───────────┘
                      ↓
                   Dashboard
```

## For your interview preparation

For a **Node.js / React / Full Stack + Cloud** interview, I would prioritize:

1. BigQuery vs MySQL/PostgreSQL
2. OLTP vs OLAP
3. Partitioning
4. Clustering
5. Data scanned and query optimization
6. ETL vs ELT
7. CTEs and window functions
8. BigQuery architecture
9. Looker Studio dimensions vs metrics
10. BigQuery → Looker Studio architecture

You don't need to memorize the Looker Studio UI. Focus on the **architecture and mental models**.
