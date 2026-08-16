# Fetch a new column in the query called 'grade'. The employees who are getting salary above 1lakh fall into A, which are above 80 fall into B, which are above 60 fall into C, which are below 60 fall into D

```
SELECT
	CONCAT (e.first_name, ' ', e.last_name) AS name,
	CASE
		WHEN s.amount >= 100000 THEN 'A'
        WHEN s.amount >= 80000 THEN 'B'
        WHEN s.amount >= 60000 THEN 'C'
        ELSE 'D'
	END AS grade
FROM employees e
join salary s
on e.id = s.employee_id
order by grade ASC;


```