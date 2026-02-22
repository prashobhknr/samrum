# Security Audit Checklist - Doorman System

**Phase:** 5 (Testing & Go-Live)  
**Date:** 2026-02-20  
**Status:** Ready for Execution  
**OWASP Reference:** OWASP Top 10 2021

## Executive Summary

This document provides comprehensive security testing procedures for the Doorman system covering:
- OWASP Top 10 vulnerabilities
- Authentication & authorization
- Data protection
- Infrastructure security
- Compliance requirements

---

## 1. Injection Attacks

### 1.1 SQL Injection Testing

**Risk Level:** CRITICAL  
**Affected Components:** API layer, database queries

#### Test Cases

**TC-S-001: SQL Injection in Door ID Parameter**
```bash
# URL: GET /api/objects/door/:id
# Test payload in door ID
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3001/api/objects/door/D-001' OR '1'='1"

# Expected: Safe
# Result: ✅ Parametrized queries used (no injection possible)
# Evidence: Check backend code for prepared statements
```

**TC-S-002: SQL Injection in Search Parameter**
```bash
# URL: GET /api/objects?search=VALUE
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3001/api/objects?search=D-001'; DROP TABLE doors; --"

# Expected: Rejected or escaped
# Result: ✅ Input sanitized, no table dropped
```

**TC-S-003: SQL Injection in POST Data**
```bash
# Endpoint: POST /api/objects/door
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "D-9999'\'' OR '\''1'\''='\''1",
    "name": "Test"
  }' \
  http://localhost:3001/api/objects/door

# Expected: Validation error or safe insertion
# Result: ✅ Prepared statements prevent injection
```

**Remediation Checklist:**
- [ ] All database queries use parameterized statements (Sequelize, Prisma, etc.)
- [ ] Input validation on all parameters
- [ ] Output encoding for display
- [ ] No string concatenation in SQL
- [ ] Database user has minimal privileges

**Code Review:**
```typescript
// ✅ SAFE - Using parameterized query
const door = await Door.findByPk(doorId); // Sequelize ORM

// ❌ UNSAFE - String concatenation
const query = `SELECT * FROM doors WHERE id = '${doorId}'`;
```

---

### 1.2 NoSQL Injection

**If applicable:** (Check if MongoDB or similar used)

**TC-S-004: NoSQL Injection**
```javascript
// Example if using MongoDB
// Unsafe:
db.collection('doors').find({ doorId: req.query.doorId })

// Safe:
db.collection('doors').findOne({ doorId: String(req.query.doorId) })
```

---

## 2. Authentication & Session Management

### 2.1 Authentication Security

**Risk Level:** CRITICAL

**TC-S-005: Default Credentials**
- [ ] No default admin user with password "admin" or "password"
- [ ] All test accounts removed from production
- [ ] Change default ports, paths, etc.

**Test:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -d '{"email":"admin@doorman.local","password":"admin"}'
# Expected: ❌ Either user not found OR stronger password required
```

**TC-S-006: Weak Password Policy**
- [ ] Password minimum length: 12 characters (or 10+)
- [ ] Require mixed case, numbers, special characters
- [ ] Password history: prevent reuse of last 5 passwords
- [ ] Temporary passwords expire after 24 hours

**TC-S-007: Session Timeout**
- [ ] Session timeout: 60 minutes (configurable)
- [ ] Inactivity logout
- [ ] Logout on browser close (optional)
- [ ] Token refresh mechanism

**Test:**
```javascript
// Login, wait 61 minutes, try to access
const token = await login(); // valid
sleep(61 * 60 * 1000); // wait 61 minutes
const response = await fetch('/api/doors', {
  headers: { 'Authorization': `Bearer ${token}` }
});
// Expected: 401 Unauthorized
```

**TC-S-008: Password Reset Vulnerability**
- [ ] Reset tokens expire after 30 minutes
- [ ] Reset tokens single-use only
- [ ] Reset email sent to registered email
- [ ] No email enumeration (don't reveal user exists)

**Remediation:**
```typescript
// Generate secure reset token
const resetToken = crypto.randomBytes(32).toString('hex');
const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

// Store with expiry (30 min)
await user.update({
  resetPasswordToken: hashedToken,
  resetPasswordExpire: Date.now() + 30 * 60 * 1000,
});

// Send reset link (don't expose token in URL if sensitive)
// Better: send via secure email link
```

### 2.2 Authorization & Access Control

**Risk Level:** CRITICAL

**TC-S-009: Horizontal Privilege Escalation**
```bash
# User john.locksmith tries to access jane.supervisor's tasks
curl -H "Authorization: Bearer JOHN_TOKEN" \
  "http://localhost:3001/api/users/jane.supervisor/tasks"

# Expected: ✅ 403 Forbidden (can't access other user's data)
```

**TC-S-010: Vertical Privilege Escalation**
```bash
# Locksmith tries to perform supervisor-only action
curl -X PUT \
  -H "Authorization: Bearer LOCKSMITH_TOKEN" \
  -d '{"verification_status":"approved"}' \
  http://localhost:3001/api/tasks/verify-door-task

# Expected: ✅ 403 Forbidden
```

**TC-S-011: Token Manipulation**
```bash
# Decode JWT token, modify payload, re-encode
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
// Attacker decodes → changes role from "locksmith" to "admin" → encodes
const maliciousToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."; // modified

curl -H "Authorization: Bearer ${maliciousToken}" \
  "http://localhost:3001/api/admin/users"

# Expected: ✅ Invalid signature error (JWT validation fails)
# Remediation: Verify JWT signature on every request
```

**Code Review - JWT Verification:**
```typescript
// ✅ SAFE - Verify signature with secret
const decoded = jwt.verify(token, process.env.JWT_SECRET);

// ❌ UNSAFE - No signature verification
const decoded = jwt.decode(token); // No verification!
```

---

## 3. Sensitive Data Exposure

### 3.1 Data Transmission (HTTPS/TLS)

**Risk Level:** CRITICAL

**TC-S-012: HTTPS Enforcement**
- [ ] All traffic over HTTPS in production
- [ ] HTTP redirects to HTTPS
- [ ] HSTS header enabled (6 months minimum)
- [ ] TLS 1.2+ only (no SSL 3.0, TLS 1.0, 1.1)

**Test:**
```bash
# Check headers
curl -I https://doorman.example.com/

# Expected headers:
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Content-Security-Policy: ...
```

**TC-S-013: Certificate Validation**
- [ ] Valid SSL certificate
- [ ] Certificate matches domain
- [ ] No self-signed certs in production
- [ ] Certificate expiry monitoring

### 3.2 Data at Rest

**Risk Level:** HIGH

**TC-S-014: Database Encryption**
- [ ] PostgreSQL encryption at rest (TDE or file-level)
- [ ] Sensitive columns encrypted (if applicable)
- [ ] Backup encryption
- [ ] Encryption key management

**TC-S-015: No Hardcoded Secrets**
```bash
# Scan codebase for secrets
npm audit
git log -S "password" -- '*.js' '*.ts'
grep -r "password.*=" . --include="*.js" --include="*.ts"

# Expected: ✅ No hardcoded passwords, API keys, tokens
```

**TC-S-016: Secrets Management**
- [ ] All secrets in environment variables or secrets vault
- [ ] No secrets in `.env` committed to git
- [ ] `.env.example` shows structure without values
- [ ] Use HashiCorp Vault or AWS Secrets Manager in production

**TC-S-017: PII Data Handling**
- [ ] No PII in logs
- [ ] No passwords in audit trail
- [ ] Minimal PII retention
- [ ] Data anonymization for testing

**Remediation:**
```typescript
// ❌ UNSAFE - PII in logs
console.log(`User login: ${email} with password: ${password}`);
console.log(user); // Contains sensitive data

// ✅ SAFE - No sensitive data logged
console.log(`User login: ${email}`); // Just user identifier
logger.info('User authenticated', { userId: user.id, role: user.role });
```

---

## 4. XML External Entities (XXE)

**Risk Level:** MEDIUM (if parsing XML)

**TC-S-018: XXE Vulnerability**
```xml
<!-- Test payload -->
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ELEMENT foo ANY>
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<foo>&xxe;</foo>
```

**Expected:** ✅ XML parsing disabled or safe configuration

**Remediation:**
```typescript
// ❌ UNSAFE
const parser = new xml2js.Parser();

// ✅ SAFE
const parser = new xml2js.Parser({
  strict: false,
  dtdFullyProcessed: false,
  doctype: null,
  validateOnly: true,
  normalizeTags: true,
});
```

---

## 5. Broken Access Control

**Risk Level:** CRITICAL

**TC-S-019: Object-Level Access Control**
```bash
# User can access door D-001, tries to access D-999 (different owner)
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3001/api/objects/door/D-999"

# Expected: ✅ 403 Forbidden (if not owner/assigned)
# OR ✅ Filtered data (if system shows only owned doors)
```

**TC-S-020: Function-Level Access Control**
```bash
# Locksmith tries to delete door
curl -X DELETE \
  -H "Authorization: Bearer LOCKSMITH_TOKEN" \
  "http://localhost:3001/api/objects/door/D-001"

# Expected: ✅ 403 Forbidden (no DELETE permission)
```

**TC-S-021: Data-Based Access Control**
```bash
# Permission rules should enforce:
# - locksmiths see doors assigned to them
# - supervisors see all doors + supervisor tasks
# - admins see everything

# Verify in database:
SELECT * FROM permissions 
WHERE group_id IN (SELECT id FROM groups WHERE name = 'locksmiths');

# Expected: ✅ Proper READ/WRITE/DELETE permissions defined
```

---

## 6. Security Misconfiguration

### 6.1 Server & Framework Configuration

**Risk Level:** HIGH

**TC-S-022: Debug Mode Disabled**
```bash
# Check if debug mode is on
curl http://localhost:3001/api/test-nonexistent

# Expected: ✅ 404 error without stack trace
# NOT: ❌ Full stack trace, file paths, secrets
```

**TC-S-023: HTTP Security Headers**
```bash
curl -I https://doorman.example.com/

# Expected headers:
# ✅ X-Content-Type-Options: nosniff
# ✅ X-Frame-Options: DENY (or SAMEORIGIN)
# ✅ X-XSS-Protection: 1; mode=block
# ✅ Content-Security-Policy: default-src 'self'
# ✅ Referrer-Policy: strict-origin-when-cross-origin
```

**Code:**
```typescript
// ✅ Add security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

**TC-S-024: CORS Configuration**
```bash
# Check CORS headers
curl -H "Origin: http://evil.com" \
  http://localhost:3001/api/objects

# Expected: ✅ NOT * (wildcard)
# Expected: ✅ No Allow-Credentials with wildcard
```

**Remediation:**
```typescript
// ❌ UNSAFE - Allows all origins
app.use(cors()); // Default allows *

// ✅ SAFE - Whitelist origins
const corsOptions = {
  origin: ['https://doorman.example.com', 'https://app.example.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
```

### 6.2 Dependency Vulnerabilities

**Risk Level:** MEDIUM

**TC-S-025: Audit Dependencies**
```bash
npm audit
npm audit --audit-level=moderate

# Expected: ✅ No critical or high vulnerabilities
# Acceptable: ✅ Medium vulnerabilities with mitigation plan
```

**Remediation:**
```bash
npm install -g npm@latest
npm audit fix
npm audit fix --audit-level=moderate

# Check lock file
npm ci  # Use lock file instead of npm install
```

**TC-S-026: Outdated Packages**
```bash
npm outdated
npx snyk test

# Update packages periodically
npm update
```

---

## 7. Cross-Site Scripting (XSS)

### 7.1 Stored XSS

**Risk Level:** CRITICAL

**TC-S-027: Stored XSS in Door Name**
```bash
# Create door with XSS payload
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "external_id": "D-9999",
    "name": "<img src=x onerror=\"alert(123)\">"
  }' \
  http://localhost:3001/api/objects/door

# Then access door in UI
# Expected: ✅ Image not loaded, no alert (XSS prevented)
# NOT: ❌ Alert box appears (XSS successful)
```

**Remediation:**
```typescript
// ❌ UNSAFE - Directly rendering user input
<h1>{door.name}</h1>

// ✅ SAFE - React escapes by default
<h1>{door.name}</h1>  // React auto-escapes

// ✅ SAFE - Sanitize if rendering HTML
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
<div>{clean}</div>
```

### 7.2 Reflected XSS

**Risk Level:** MEDIUM

**TC-S-028: Reflected XSS in URL**
```bash
# Attack URL
http://doorman.example.com/?search=<script>alert(1)</script>

# Expected: ✅ Query parameter escaped in display
# Expected: ✅ No script execution
```

### 7.3 DOM-based XSS

**Risk Level:** MEDIUM

**TC-S-029: Unsafe DOM Manipulation**
```javascript
// ❌ UNSAFE
document.getElementById('result').innerHTML = userInput;

// ✅ SAFE
document.getElementById('result').textContent = userInput;

// ✅ SAFE - React
<div>{userInput}</div>  // Auto-escaped
```

---

## 8. Cross-Site Request Forgery (CSRF)

**Risk Level:** MEDIUM

**TC-S-030: CSRF Token Protection**
```bash
# Verify CSRF token on state-changing requests
# Expected: ✅ POST/PUT/DELETE require valid CSRF token

# Test bypassing CSRF:
curl -X POST \
  -d '{"action":"update_door"}' \
  -b "session=USER_SESSION" \
  http://doorman.example.com/api/doors/edit

# Expected: ✅ 403 Forbidden (CSRF token required)
# OR: ✅ Token auto-generated and validated
```

**Remediation:**
```typescript
// ✅ CSRF middleware
import csrf from 'csurf';

app.post('/api/forms/submit',
  csrf(),
  (req, res) => {
    // Process form
  }
);

// Token in response:
res.json({ csrfToken: req.csrfToken() });
```

**Frontend:**
```typescript
// ✅ Include CSRF token in requests
const response = await fetch('/api/forms/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': document.querySelector('[name="_csrf"]').value,
  },
  body: JSON.stringify(formData),
});
```

---

## 9. Using Components with Known Vulnerabilities

**Risk Level:** MEDIUM

**TC-S-031: Dependency Scanning**
```bash
npm audit
npm audit --json > audit-report.json

# Use Snyk for continuous scanning
npm install -g snyk
snyk test --severity-threshold=high
```

**Remediation Workflow:**
1. Fix critical/high vulnerabilities immediately
2. Plan fixes for medium within 2 weeks
3. Document acceptable risks (with approval)
4. Regular updates (monthly)

---

## 10. Insufficient Logging & Monitoring

### 10.1 Audit Logging

**Risk Level:** MEDIUM

**TC-S-032: Audit Trail Completeness**
```bash
# Verify all critical actions logged:
# ✅ Login attempts (success/failure)
# ✅ Permission changes
# ✅ Data modifications (create/update/delete)
# ✅ Admin actions
# ✅ Failed access attempts

SELECT * FROM audit_log WHERE action IN (
  'user_login',
  'user_logout',
  'permission_granted',
  'permission_revoked',
  'door_created',
  'door_updated',
  'door_deleted',
  'access_denied'
);

# Expected: ✅ 1000+ audit entries for load test
```

**TC-S-033: Log Data Security**
- [ ] Logs never contain passwords
- [ ] Logs never contain API keys or tokens
- [ ] Logs don't expose file paths or source code
- [ ] Logs encrypted in transit and at rest
- [ ] Log retention: 90 days minimum (2 years ideal)

**Remediation:**
```typescript
// ❌ UNSAFE - Logs contain password
logger.info('User login', { email, password: user.password });

// ✅ SAFE - No sensitive data
logger.info('User login', { userId: user.id, email: user.email });
logger.debug('Form submitted', { taskId, fieldCount: formData.length });
```

### 10.2 Error Handling

**Risk Level:** MEDIUM

**TC-S-034: Error Messages Don't Leak Info**
```bash
# Test with invalid user
curl -X POST \
  -d '{"email":"nonexistent@test.com","password":"test"}' \
  http://localhost:3001/api/auth/login

# Response should be generic:
# ✅ "Invalid username or password"
# NOT: ❌ "User not found" (reveals user doesn't exist)
# NOT: ❌ "Incorrect password" (confirms user exists)
```

**Remediation:**
```typescript
// ❌ UNSAFE - Different messages
if (!user) return res.status(401).json({ message: 'User not found' });
if (password !== user.password) return res.status(401).json({ message: 'Wrong password' });

// ✅ SAFE - Generic message
const user = await User.findOne({ email });
const isValid = user && await bcrypt.compare(password, user.password);
if (!isValid) return res.status(401).json({ message: 'Invalid credentials' });
```

---

## Security Testing Tools

### Automated Scanning

```bash
# OWASP ZAP
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://doorman.example.com

# npm audit
npm audit --severity=high

# Snyk
snyk test

# Dependabot (GitHub)
# https://github.com/settings/security_analysis

# SonarQube
sonar-scanner -Dsonar.projectKey=doorman \
  -Dsonar.sources=. \
  -Dsonar.host.url=http://sonarqube:9000 \
  -Dsonar.login=TOKEN
```

### Manual Testing

```bash
# Burp Suite Community
# 1. Configure browser proxy to Burp
# 2. Navigate application
# 3. Use Scanner to identify vulnerabilities
# 4. Perform manual testing on findings

# Postman Security Testing
# 1. Create API collection
# 2. Add security test scripts
# 3. Run collection with security payloads
```

---

## Security Sign-Off Checklist

### Before Go-Live

- [ ] All OWASP Top 10 items reviewed
- [ ] No critical security vulnerabilities
- [ ] High vulnerabilities documented with mitigation
- [ ] Security team approval obtained
- [ ] Penetration test completed (optional but recommended)
- [ ] Code review with security focus completed
- [ ] Dependencies audited and updated
- [ ] Secrets properly managed (no hardcoded values)
- [ ] HTTPS/TLS configured correctly
- [ ] Authentication & authorization working
- [ ] Input validation implemented
- [ ] Output encoding implemented
- [ ] Logging & monitoring in place
- [ ] Error handling doesn't leak information
- [ ] Disaster recovery tested

### Continuous Security

- [ ] Weekly: `npm audit` checks
- [ ] Monthly: Dependency updates
- [ ] Quarterly: Security testing
- [ ] Annually: Penetration test
- [ ] Always: Code review with security lens

---

## Security Incident Response

If vulnerability discovered:

1. **Assess:** Severity, impact, affected users
2. **Isolate:** Patch or disable affected feature
3. **Notify:** Inform stakeholders, security team
4. **Remediate:** Fix vulnerability, update code
5. **Test:** Verify fix works, no regression
6. **Deploy:** Roll out patch to production
7. **Monitor:** Watch for exploitation attempts
8. **Review:** Document lessons learned

---

## References

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP Testing Guide: https://owasp.org/www-project-web-security-testing-guide/
- CWE Top 25: https://cwe.mitre.org/top25/
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework/

---

**Security Audit Status:** ✅ Ready for Execution

**Next Steps:**
1. Run automated scanning tools (ZAP, npm audit, Snyk)
2. Execute manual testing procedures
3. Document findings in separate report
4. Address critical/high issues
5. Obtain security sign-off before go-live
