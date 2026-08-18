# SonarQube — Interview Notes

## Quality Gate vs Quality Profile

- **Quality Profile** — a collection of rules SonarQube applies when analyzing your code (which code smells, bugs, and vulnerabilities to check for, per language). Defines *what gets checked*.
- **Quality Gate** — a set of pass/fail conditions a project must meet before it's considered releasable (e.g., "0 new bugs," "coverage on new code ≥ 80%," "no new security hotspots"). Defines *whether the result is good enough to ship*.

Profiles define what gets checked; gates define whether the result passes.

---

## Metrics SonarQube Analyzes

| Area | Measured Through | Rating |
|------|------------------|--------|
| **Reliability** | Bugs (code that is demonstrably wrong) | A–E |
| **Security** | Vulnerabilities + Security Hotspots | A–E |
| **Maintainability** | Code Smells → Technical Debt | A–E |
| **Coverage** | Line + condition/branch coverage (%) | — |
| **Duplications** | % duplicated lines, # duplicated blocks | — |
| **Size** | LOC, statements, functions, classes, files | — |
| **Complexity** | Cyclomatic + Cognitive complexity | — |
| **Issues** | Count by severity: Blocker, Critical, Major, Minor, Info | — |

**Clean as You Code** — SonarQube emphasizes metrics on *new code* (changed since a reference point) over the total on the whole project. Fix new problems as you go rather than paying down years of accumulated debt at once.

---

## Code Examples by Type (JavaScript/TypeScript)

### Bug (Reliability)
Code that will actually fail at runtime.

```javascript
function getUser(users, id) {
  const user = users.find(u => u.id === id);
  return user.name; // Bug: user can be undefined → TypeError
}
```

Fix: guard with `user?.name` or an explicit check.

### Vulnerability (Security)
Exploitable code.

```javascript
app.get('/search', (req, res) => {
  const query = `SELECT * FROM products WHERE name = '${req.query.name}'`;
  db.execute(query); // SQL injection
});
```

Flagged because user input flows straight into a query. Fix: parameterized queries.

### Security Hotspot
Security-sensitive, needs manual review (not necessarily a bug).

```javascript
const server = https.createServer({
  secureProtocol: 'TLSv1_method' // Hotspot: weak/outdated TLS — review if intended
});
```

Hotspots aren't auto-failed; a reviewer confirms whether the usage is safe in context.

### Code Smell (Maintainability)
Works fine, but hard to maintain.

```javascript
function process(data, flag, mode, retry, verbose, cache) {
  // too many parameters; SonarQube flags this
  if (flag) {
    if (mode === 'a') {
      if (retry) {
        // deeply nested — another smell
      }
    }
  }
}
```

No runtime problem, but contributes to **technical debt**.

### Coverage
Which lines your tests actually hit.

```javascript
export function classify(n) {
  if (n > 0) return 'positive';   // covered by test below
  if (n < 0) return 'negative';   // NOT covered → lowers coverage
  return 'zero';                  // NOT covered
}

// test only checks the positive path
test('positive', () => expect(classify(5)).toBe('positive'));
```

SonarQube reports the negative/zero branches as uncovered.

### Duplication
The same block repeated.

```javascript
// file A
function formatUserA(u) {
  return { name: u.name.trim(), email: u.email.toLowerCase(), active: true };
}
// file B — identical logic copy-pasted
function formatUserB(u) {
  return { name: u.name.trim(), email: u.email.toLowerCase(), active: true };
}
```

Fix: extract a shared function.

### Cyclomatic vs Cognitive Complexity

```javascript
// Cyclomatic complexity = number of independent paths
function grade(score) {
  if (score >= 90) return 'A';      // +1
  else if (score >= 80) return 'B'; // +1
  else if (score >= 70) return 'C'; // +1
  else return 'F';
}

// Cognitive complexity punishes nesting specifically
function check(a, b, c) {
  if (a) {                // +1
    if (b) {              // +2 (nested, so +1 extra)
      if (c) {            // +3 (deeper nesting)
        return true;
      }
    }
  }
  return false;
}
```

Both may have similar cyclomatic scores, but the nested one has much higher **cognitive** complexity — the metric that better reflects human readability.

### Issue Severity
A classification, not a code pattern. The *same* smell (e.g., an unused variable) might be **Minor**, while a hardcoded password is **Blocker**. Severity is SonarQube's judgment of impact, assigned per rule.

---

## Interview Closer

Most metrics map back to the three ratings:

- Bugs → **Reliability**
- Vulnerabilities / Hotspots → **Security**
- Code Smells → **Maintainability**

SonarQube grades each **A–E**.
