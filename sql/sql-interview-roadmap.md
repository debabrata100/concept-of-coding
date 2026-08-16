# SQL Interview Questions Roadmap

## Level 1: Joins

1.  List every employee with their department name.
Ans: SELECT 
d.name AS department,
CONCAT_WS(' ', e.first_name, e.last_name) AS name
FROM employees e
JOIN department d
ON e.department_id = d.id;

2.  Show all employees, including employees without a department.
Ans: SELECT 
d.name AS department,
e.first_name
FROM employees e
LEFT JOIN department d
ON e.department_id = d.id;
3.  Show all departments, including departments with no employees.
Ans:
SELECT 
d.name AS department,
e.first_name
FROM department d
LEFT JOIN employees e
ON e.department_id = d.id;

4. Find employees who don't belong to any department.
Ans:
  SELECT 
CONCAT_WS(' ', e.first_name, e.last_name) AS name
FROM employees e
WHERE e.department_id IS NULL;

5.  Find departments that don't have any employees.
Ans:
SELECT 
d.name
FROM department d
LEFT JOIN employees e
ON d.id = e.department_id
WHERE e.id IS NULL;

## Level 2: Aggregation

6.  Count employees in each department.
Ans:
SELECT
d.name,
COUNT(CASE WHEN e.id IS NOT NULL THEN 1 END) as employee_count
FROM department d
LEFT JOIN employees e
ON d.id = e.department_id
GROUP BY d.id;
7.  Find departments having more than 3 employees.
SELECT
d.name,
COUNT(e.id) as employee_count
FROM department d
JOIN employees e
ON d.id = e.department_id
GROUP BY d.id
HAVING COUNT(e.id) > 3;
8.  Find the department with the maximum number of employees.
Ans:
SELECT
	d.name,
	COUNT(e.id) as employee_count
FROM department d
JOIN employees e
	ON d.id = e.department_id
GROUP BY d.id, d.name
ORDER BY employee_count desc
LIMIT 1;

WHY d.id, d.name both, because PostgreSQl and SQL server databases are stricter.
They simply follow the SQL standard:
  if it's in SELECT,
  it must appear in GROUP BY
  unless it's aggregated.

Run the following query, you will get to know:
SELECT
    department_id,
    first_name
FROM employees
GROUP BY department_id;

9.  Calculate the average salary of each department.
SELECT
	d.name,
	AVG(s.amount)
FROM department d
JOIN employees e
	ON d.id = e.department_id
JOIN salary s
	ON s.employee_id = e.id AND s.to_date IS NULL
GROUP BY d.id, d.name;

10. Find the total salary paid department-wise (current salaries).
SELECT
	d.name,
	SUM(s.amount) as total_salary
FROM department d
JOIN employees e
	ON d.id = e.department_id
JOIN salary s
	ON s.employee_id = e.id AND s.to_date IS NULL
GROUP BY d.id, d.name;

## Level 3: Filtering

11. Find employees earning more than the department average.
Ans:
CTE solution:

With DepartmentAverage AS 
(
	SELECT
	e.department_id,
	AVG(s.amount) as avg_salary
	FROM employees e
	JOIN salary s
		ON e.id = s.employee_id
	WHERE s.to_date IS NULL
	GROUP BY e.department_id
)

SELECT
CONCAT_WS(' ', e.first_name, e.last_name) as employee_name,
d.name,
s.amount,
da.department_id,
da.avg_salary
FROM employees e
JOIN department d
	ON e.department_id = d.id
JOIN salary s
	ON s.employee_id = e.id
JOIN DepartmentAverage da
	ON e.department_id = da.department_id
WHERE s.to_date IS NULL and s.amount > da.avg_salary
ORDER BY d.name ASC;

SUB Query Solution:
SELECT
    CONCAT_WS(' ', e.first_name, e.last_name) AS employee,
    d.name AS department,
    s.amount,
    da.avg_salary
FROM employees e
JOIN department d
    ON d.id = e.department_id
JOIN salary s
    ON s.employee_id = e.id
JOIN (
    SELECT
        e.department_id,
        AVG(s.amount) AS avg_salary
    FROM employees e
    JOIN salary s
        ON e.id = s.employee_id
    WHERE s.to_date IS NULL
    GROUP BY e.department_id
) da
    ON da.department_id = e.department_id
WHERE s.to_date IS NULL
AND s.amount > da.avg_salary;

12. Find employees earning the highest salary in each department.
Ans:
SELECT
d.name,
CONCAT_WS(' ', e.first_name, e.last_name) as employee_name,
s.amount
FROM
employees e
JOIN salary s
	ON s.employee_id = e.id
JOIN department d
	ON e.department_id = d.id
JOIN (
SELECT
	e.department_id,
	MAX(s.amount) as highest_salary
	FROM
	employees e
	join salary s
		ON s.employee_id = e.id
	WHERE s.to_date IS NULL AND e.department_id IS NOT NULL
	GROUP BY e.department_id
) ms
	ON ms.department_id = e.department_id
WHERE s.amount = ms.highest_salary;
    
    
    
13. Find employees earning the second highest salary.
Ans:
SELECT *
FROM
(
	SELECT
	CONCAT_WS(' ', e.first_name, e.last_name) as emp_name,
	s.amount,
	DENSE_RANK() OVER(
		ORDER BY s.amount DESC
	) AS salary_rank

	from department d
	JOIN employees e
		ON e.department_id = d.id
	JOIN salary s
		ON s.employee_id = e.id
) ranked_salary

WHERE salary_rank = 3;
    
14. Find top 3 salaries department-wise.
SELECT * 
FROM
	(
		SELECT
		CONCAT_WS(' ', e.first_name, e.last_name) as employee_name,
		d.name,
		DENSE_RANK() OVER(
			partition by d.id
			ORDER BY s.amount DESC
		) as salary_rank,
		s.amount
		FROM employees e
		JOIN department d
			ON e.department_id = d.id
		JOIN salary s
			ON s.employee_id = e.id
		WHERE s.to_date IS NULL

    ) ranked_salary
WHERE salary_rank < 4;


15. Find departments whose average salary is greater than ₹70,000.

## Level 4: NULL Tricks

16. Count employees without departments.
17. Count salary history rows and current salary rows.
18. Find employees who have never received a salary increment.
19. Find employees having more than one salary record.
20. Find employees whose current salary is less than their previous
    salary.

## Level 5: Window Functions

21. Rank employees by salary.
22. Rank employees department-wise.
23. Dense rank employees department-wise.
24. Find the highest paid employee in every department.
25. Find top 2 salaries department-wise.

## Level 6: Subqueries

26. Employees earning above company average.
27. Employees earning below company average.
28. Department whose total salary is highest.
29. Employees hired before the average hire date.
30. Employees whose salary equals the maximum salary.

## Level 7: Real Interview Questions

31. Show salary growth for every employee.
32. Find employees who joined in the same year.
33. Find duplicate salaries.
34. Find employees sharing the same salary.
35. Find the gap between the highest and lowest salary department-wise.
36. Find employees hired in the last two years.
37. Find the department spending the most on salaries.
38. Find employees whose salary is above their manager's salary.
39. Find employees whose salary has increased by more than 20%.
40. Pivot departments into columns.

## Level 8: Advanced / Tricky

41. Find the third highest salary without using LIMIT.
SELECT amount
FROM
(
	SELECT
	s.amount,
	DENSE_RANK() OVER (
		ORDER BY s.amount DESC
	) AS salary_rank
	FROM
	salary s
	where s.to_date IS NULL
) ranked_salary
WHERE salary_rank = 3

if you need one row then: SELECT DISTINCT amount

42. Find duplicate email addresses.
43. Delete duplicate employees while keeping the oldest record.
44. Find employees earning the same salary in different departments.
SELECT
d.name as department,
CONCAT_WS(' ',e.first_name, e.last_name) as name,
s.amount
FROM
employees e
JOIN salary s
	ON s.employee_id = e.id
JOIN department d
	ON e.department_id = d.id
where s.to_date IS NULL
AND s.amount IN (
	SELECT
		s.amount
	FROM employees e
	JOIN department d
		ON d.id = e.department_id
	JOIN salary s
		ON s.employee_id = e.id
	WHERE s.to_date IS NULL
	GROUP BY s.amount
	HAVING COUNT(DISTINCT d.id) > 1
)
ORDER BY s.amount DESC, d.name;

45. Find departments where every employee earns more than ₹70,000.
SELECT
d.id,
d.name
from department d
JOIN employees e
	ON e.department_id = d.id
JOIN salary s
	ON s.employee_id = e.id
GROUP BY d.id, d.name
HAVING MIN(s.amount) > 70000;

46. Find departments where at least one employee earns more than
    ₹1,00,000.
47. Find employees whose current salary is the highest salary they have
    ever received.
48. Find employees who have never changed departments.
49. Find consecutive salary increments.
50. Find employees with missing salary records.

# Top 10 SQL Questions Asked in Almost Every Interview

1.  Employee count department-wise.
2.  Top N salaries.
3.  Second highest salary.
4.  Highest salary department-wise.
5.  Employees earning above department average.
6.  Departments with no employees.
7.  Employees with no department.
8.  Current salary vs salary history.
9.  ROW_NUMBER vs RANK vs DENSE_RANK.
10. Salary growth calculation.
