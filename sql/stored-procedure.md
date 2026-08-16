Stored procedures encapsulate reusable database-side operations and can be useful for transactional, batch, and data-intensive operations. However, I wouldn't put all business logic into stored procedures. In a typical Node.js microservice architecture, domain and application logic generally belongs in the service layer, while stored procedures can be used selectively where database-side execution provides a clear benefit.

```
CREATE DEFINER=`root`@`localhost` PROCEDURE `get_employee_salary`(IN emp_id INT)
BEGIN

    SELECT
        CONCAT_WS(' ', e.first_name, e.last_name) AS employee,
        d.name AS department,
        s.amount AS salary
    FROM employees e
    JOIN department d
        ON d.id = e.department_id
    JOIN salary s
        ON s.employee_id = e.id
    WHERE e.id = emp_id
      AND s.to_date IS NULL;

END
```