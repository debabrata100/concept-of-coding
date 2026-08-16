# Count how many to_date is null and how many are not null

```
SELECT
COUNT(CASE WHEN to_date IS NULL THEN 1 END) AS current_sal,
COUNT(CASE WHEN to_date IS NOT NULL THEN 1 END) as salary_history
FROM salary;
```