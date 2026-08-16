# Department wise employee count

```
SELECT 
d.name as department,
COUNT(e.id) AS employee_count
FROM
department d
JOIN employees e
ON d.id = e.department_id
GROUP BY d.id, d.name;

```
# Count employees department-wise, but show only departments with more than 3 employees.
```
SELECT 
d.name as department,
COUNT(e.id) AS employee_count
FROM
department d
JOIN employees e
ON d.id = e.department_id
GROUP BY d.id, d.name
HAVING COUNT(e.id) > 3;

```