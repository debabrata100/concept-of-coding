# Fetch top two salaries from each department

```
SELECT *
FROM (
	SELECT
		d.name as department, 
		e.first_name, 
		e.last_name, 
		s.amount,
		DENSE_RANK() OVER(
			PARTITION BY d.id
			ORDER BY s.amount DESC
		) AS salary_rank
		FROM department d
		join employees e 
			ON d.id = e.department_id
		join salary s 
			ON s.employee_id = e.id 
		WHERE s.to_date IS NULL
) ranked_salary
WHERE salary_rank <= 2
ORDER BY department, salary_rank;

```