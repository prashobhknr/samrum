# Phase 1: Camunda Infrastructure - Research

**Researched:** 2026-03-08 (updated 2026-03-09: Camunda 7 → Operaton)
**Domain:** Operaton Run (open-source Camunda 7 fork, standalone JAR) — PostgreSQL setup, BPMN deployment, backend proxy
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Operaton Run (standalone JAR) starts without Docker on Windows, backed by existing PostgreSQL (`doorman_db`) instead of H2 | PostgreSQL JDBC driver placement, `default.yml` datasource config (operaton.bpm namespace), Java required |
| INFRA-02 | Backend deploys all 39 BPMN files to Operaton via REST on startup, using `deploy-changed-only` to prevent version proliferation on restart | `deployBpmn.mjs` multipart POST pattern, native FormData in Node, recursive directory scan |
| INFRA-03 | All frontend → Operaton REST calls are proxied through `/api/camunda/*` routes in `demo-server.mjs` (avoids CORS, enforces auth) | Proxy route block pattern, thin passthrough |
</phase_requirements>

---

## Summary

Phase 1 delivers exactly three things: Operaton running on PostgreSQL, all 39 BPMNs deployed (version 1 only), and a backend proxy route block so the frontend never calls Operaton directly. These are pure infrastructure and configuration tasks — no new business logic, no frontend pages, and no external task worker (that is Phase 2).

The existing PostgreSQL at `postgresql://doorman_user:doorman_pass@localhost:5432/doorman_db` is the target database. No Docker is involved. The `default.yml` config already uses the `operaton.bpm` namespace.

One critical finding from reading the actual BPMN files: all 39 processes use `camunda:delegateExpression="${delegateName}"` (Java Spring Bean delegation), NOT `camunda:type="external"` with a topic name. This means the service tasks in these BPMNs are designed for Java delegates, not for the external task worker pattern. **For Phase 1, this does not block deployment or Cockpit visibility.** Operaton will accept and deploy these BPMNs successfully regardless of implementation type. However, the planner must note this as a Phase 2 concern: the BPMNs will need to be converted from `delegateExpression` to `camunda:type="external"` with named topics before the Node.js external task worker can execute any service task. This BPMN migration is out of Phase 1 scope but must be surfaced.

**Primary recommendation:** Download Operaton Run from GitHub releases, verify the existing `default.yml` config (already has PostgreSQL datasource and `deploy-changed-only=true`), drop the PostgreSQL JDBC driver JAR into `configuration/userlib/`, start, then add `deployBpmn.mjs` to `demo-server.mjs` startup and a thin `/api/camunda/*` proxy block.

---

## Standard Stack

### Core

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Operaton Run | latest | Standalone process engine JAR (open-source Camunda 7 fork) | REST API at `localhost:8080/engine-rest`; download from GitHub releases |
| Java (OpenJDK) | 21 (already installed) | JVM for Operaton JAR | Java 11+ required; Java 21 confirmed on this machine |
| PostgreSQL JDBC driver | 42.7.x | Connects Operaton to PostgreSQL | Not bundled in Operaton Run; must be placed in `configuration/userlib/` |
| Node.js native `FormData` | built-in (Node 18+) | Multipart POST for BPMN deployment | Node 25.6.1 is running; no `form-data` npm package needed |
| `node-fetch` / native `fetch` | built-in (Node 18+) | HTTP calls to Operaton REST | Already used in demo-server.mjs via global `fetch` |

### No New npm Dependencies for Phase 1

Phase 1 requires zero new npm packages. All network calls use native `fetch`. BPMN file reading uses native `fs/promises`. The proxy routes use the existing `http` module already running in `demo-server.mjs`.

**Download URLs:**
```powershell
# Operaton Run — download from GitHub releases
# https://github.com/operaton/operaton/releases
Invoke-WebRequest -Uri "https://github.com/operaton/operaton/releases/latest" -OutFile operaton-run.zip

# PostgreSQL JDBC driver (42.7.4 — latest 42.x as of research date)
# From Maven Central:
Invoke-WebRequest -Uri "https://repo1.maven.org/maven2/org/postgresql/postgresql/42.7.4/postgresql-42.7.4.jar" -OutFile postgresql-42.7.4.jar
```

---

## Architecture Patterns

### Recommended File Structure (Phase 1 additions only)

```
doorman/
├── camunda-bpm-run/                    # Operaton Run installation directory
│   ├── configuration/
│   │   ├── default.yml                 # PostgreSQL datasource (operaton.bpm namespace)
│   │   └── userlib/
│   │       └── postgresql-42.7.4.jar  # NEW: JDBC driver (not bundled)
│   └── start.bat                       # Operaton startup script (Windows)
│
└── backend/
    ├── demo-server.mjs                  # MODIFIED: import deployBpmn + proxy routes
    └── src/
        └── camunda/
            ├── deployBpmn.mjs           # NEW: deploy 39 BPMNs on startup
            └── camundaProxy.mjs         # NEW: /api/camunda/* route handlers
```

### Pattern 1: PostgreSQL Configuration for Operaton Run

**What:** Operaton Run uses YAML for configuration. The file is `configuration/default.yml` inside the Operaton Run directory. Override the H2 datasource with PostgreSQL credentials.

**Critical:** The JDBC driver JAR must be physically present in `configuration/userlib/` before starting. Operaton Run scans this directory on boot.

```yaml
# camunda-bpm-run/configuration/default.yml

spring.datasource:
  url: jdbc:postgresql://localhost:5432/doorman_db
  username: doorman_user
  password: doorman_pass
  driver-class-name: org.postgresql.Driver

operaton.bpm:
  database:
    schema-update: true   # auto-create Operaton tables in doorman_db on first start
  admin-user:
    id: demo
    password: demo
    firstName: Demo
  filter:
    create: All Tasks

operaton.bpm.run.cors:
  enabled: false  # Disabled: all Operaton calls go through Node.js proxy, never from browser directly
```

**Verification:** After startup, check logs for `org.postgresql.Driver` (not `H2`). Check Cockpit at `http://localhost:8080/operaton/app/cockpit/` shows zero deployments (not H2 demo data).

### Pattern 2: BPMN Deployment on Server Start (deploy-changed-only)

**What:** `deployBpmn.mjs` reads all `.bpmn` files under `processes/` recursively and POSTs each to Operaton's `deployment/create` endpoint. Uses `deploy-changed-only=true` so Operaton skips unchanged files on subsequent starts (hash comparison built into Operaton).

**Key constraint from codebase:** The 39 BPMN files are spread across subdirectories (`processes/phases/`, `processes/sub/`, `processes/operations/`, etc.). The deployment loop must use `recursive: true` in `fs.readdir`.

**Deployment strategy:** Deploy ALL 39 files in a SINGLE deployment call (one multipart POST with all files attached). This keeps them as one deployment unit, making version management simpler. Operaton's `deploy-changed-only` then applies at the file level within the deployment.

```javascript
// backend/src/camunda/deployBpmn.mjs
import { readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';

const CAMUNDA_BASE = process.env.CAMUNDA_REST_URL || 'http://localhost:8080/engine-rest';
const BPMN_DIR = resolve('../processes');  // relative to backend dir

export async function deployAllBpmns() {
  const allFiles = await readdir(BPMN_DIR, { recursive: true });
  const bpmnFiles = allFiles.filter(f => f.endsWith('.bpmn'));

  const form = new FormData();
  form.append('deployment-name', 'doorman-processes');
  form.append('enable-duplicate-filtering', 'true');
  form.append('deploy-changed-only', 'true');
  form.append('deployment-source', 'doorman-backend');

  for (const file of bpmnFiles) {
    const fullPath = join(BPMN_DIR, file);
    const content = await readFile(fullPath);
    const blob = new Blob([content], { type: 'application/xml' });
    form.append(file.replace(/\//g, '_'), blob, file);
  }

  const res = await fetch(`${CAMUNDA_BASE}/deployment/create`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BPMN deployment failed: ${res.status} ${text}`);
  }

  const result = await res.json();
  console.log(`[Operaton] Deployed ${bpmnFiles.length} BPMNs. Deployment ID: ${result.id}`);
  return result;
}
```

**Integration in demo-server.mjs** (after DB connect succeeds):
```javascript
import { deployAllBpmns } from './src/camunda/deployBpmn.mjs';

client.connect(async (err) => {
  if (err) { console.error('DB connection failed', err); process.exit(1); }
  console.log('Connected to PostgreSQL');

  // Deploy BPMNs to Operaton on startup (idempotent)
  try {
    await deployAllBpmns();
  } catch (e) {
    console.warn('[Operaton] BPMN deployment failed (Operaton may not be running):', e.message);
    // Non-fatal: server continues; BPMNs will deploy on next start when Operaton is up
  }
});
```

### Pattern 3: Operaton Proxy Routes Block

**What:** A route block in `demo-server.mjs` catches all requests matching `/api/camunda/*`, strips the prefix, and forwards them to Operaton's `engine-rest` endpoint. The frontend never calls port 8080 directly.

**Why a passthrough proxy, not individual routes:** Phase 1 only needs the proxy infrastructure. Specific enriched routes (e.g., injecting `formSchema` into task list responses) are Phase 3 concerns. Keep Phase 1 as a thin passthrough.

```javascript
// Inside demo-server.mjs HTTP handler, before the 404 fallback:

if (pathname.startsWith('/api/camunda/')) {
  const camundaBase = process.env.CAMUNDA_REST_URL || 'http://localhost:8080/engine-rest';
  const camundaPath = pathname.replace('/api/camunda', '');
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const targetUrl = `${camundaBase}${camundaPath}${queryString}`;

  // Forward body if present
  let body = undefined;
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }

  const camundaRes = await fetch(targetUrl, {
    method: req.method,
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'Accept': 'application/json',
    },
    body,
  });

  const data = await camundaRes.text();
  res.writeHead(camundaRes.status, { 'Content-Type': 'application/json' });
  res.end(data);
  return;
}
```

### Anti-Patterns to Avoid

- **Starting Operaton before placing the JDBC driver JAR:** Operaton will silently fall back to H2 in-memory mode, create schema under H2, then fail confusingly when you add the JAR later. Always place the JAR FIRST.
- **Deploying each BPMN as a separate named deployment:** Creates 39 separate deployments, making version management unwieldy. Use ONE deployment with all 39 files.
- **Using `schema-update: create-drop`:** Will drop and recreate Operaton tables on every restart, wiping process history. Use `true` (adds missing columns only).
- **Exposing port 8080 to the frontend:** Never. The proxy route pattern means `localhost:8080` is only accessed from the Node.js backend.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multipart BPMN upload | Custom multipart encoder | Native `FormData` (Node 18+) | Already available in Node 25.6.1; zero deps |
| HTTP proxy | Custom stream pipe | `fetch` + forward body buffer | Camunda REST is JSON; buffered proxy is sufficient at this scale |
| BPMN file discovery | Custom glob | `fs.readdir` with `{ recursive: true }` | Sufficient for a flat directory tree; no glob library needed |

---

## Common Pitfalls

### Pitfall 1: H2 In-Memory Default Wipes All Data on Restart

**What goes wrong:** Operaton Run ships with H2 in-memory as default. Every restart loses all process instances, deployments, and Cockpit data.

**How to avoid:** Configure `default.yml` with the PostgreSQL datasource BEFORE the first start. Place the JDBC JAR in `configuration/userlib/` first. Confirm startup log shows `org.postgresql.Driver` not `H2`.

**Warning signs:** Cockpit shows zero deployments after restart even though you deployed earlier; startup log mentions `jdbc:h2:mem:`.

### Pitfall 2: PostgreSQL JDBC Driver Not Bundled

**What goes wrong:** Operaton Run does not bundle the PostgreSQL driver. If the JAR is missing from `configuration/userlib/`, Operaton cannot find `org.postgresql.Driver` and either falls back to H2 or fails to start.

**How to avoid:** Download `postgresql-42.7.4.jar` from Maven Central and place it in `configuration/userlib/` before starting. The filename does not matter; Operaton scans the directory for JARs.

### Pitfall 3: BPMN Version Proliferation on Restart

**What goes wrong:** Every server start calls `deployment/create`. Without `deploy-changed-only=true`, Operaton creates a new process definition version (v2, v3...) even if nothing changed. Running instances stay pinned to their original version.

**How to avoid:** Include `deploy-changed-only=true` in the multipart form from the FIRST deploy. Never remove this flag. Verify by querying `GET /engine-rest/process-definition` after two restarts — only version 1 should exist.

### Pitfall 4: BPMNs Use delegateExpression — External Task Worker Cannot Execute Them As-Is

**What goes wrong:** All 39 BPMN files use `camunda:delegateExpression="${delegateName}"` on service tasks. This is the Java Spring Bean delegation pattern. Operaton will deploy and display these BPMNs in Cockpit without error, but when a process instance reaches a service task, Operaton will try to resolve the Spring bean and fail with a `ProcessEngineException: Unknown property used in expression: ${projectInitDelegate}`.

**Phase 1 impact:** None — INFRA-01 and INFRA-02 only require BPMNs to be visible in Cockpit, not to execute. The deployment itself succeeds regardless of implementation type.

**Phase 2 impact:** HIGH — Phase 2 (External Task Worker) requires converting each service task in all 39 BPMNs from `camunda:delegateExpression` to `camunda:type="external"` with a `camunda:topic` matching the delegate name. This is an XML edit on each BPMN file. The planner must schedule this BPMN migration as the first task in Phase 2, before any worker implementation.

**Warning signs (Phase 2):** Process instances start but immediately fail at first service task with `ProcessEngineException` or `SpEL expression` error; incidents appear in Cockpit immediately.

### Pitfall 5: demo-server.mjs Crashes if Camunda Is Not Running

**What goes wrong:** `deployAllBpmns()` throws a network error if Operaton is not started before the backend. If this is not caught, `demo-server.mjs` exits.

**How to avoid:** Wrap the `deployAllBpmns()` call in try/catch. Log a warning but do not kill the server. The backend is useful (OMS admin, form configuration) even when Operaton is offline. BPMNs will be deployed on next startup.

### Pitfall 6: `schema-update: true` Conflicts with doorman_db Ownership

**What goes wrong:** Operaton Run's `schema-update: true` runs DDL against `doorman_db` to create its `ACT_*` tables. These tables will be owned by `doorman_user` (the credentials in `default.yml`). If `doorman_user` lacks DDL privileges (only has DML), Operaton fails with `permission denied to create table`.

**How to avoid:** Before first Operaton start, grant DDL privileges to `doorman_user` on `doorman_db`, or run the Operaton schema SQL manually as `a123` (the DB owner). Operaton's SQL scripts are in the JAR at `sql/create/postgres_engine_7.sql` and `postgres_identity_7.sql`. Alternatively, set `schema-update: create` on first start as `a123`, then switch to `true`.

**Project-specific note:** Per MEMORY.md, DB is owned by `a123` and `doorman_user` has restricted grants. This WILL block first-start DDL. Run Camunda schema creation separately as `a123` or grant CREATE TABLE to `doorman_user` on the public schema.

---

## Code Examples

### BPMN Deployment — Verified Pattern for Node.js Native FormData

```javascript
# Source: Operaton REST docs /deployment/create + Node.js 18+ FormData
// Confirmed: Node 25.6.1 has native FormData with Blob support

const form = new FormData();
form.append('deployment-name', 'doorman-processes');
form.append('enable-duplicate-filtering', 'true');
form.append('deploy-changed-only', 'true');

const bpmnContent = await readFile('./processes/master-building-lifecycle.bpmn');
const blob = new Blob([bpmnContent], { type: 'application/xml' });
form.append('master-building-lifecycle.bpmn', blob, 'master-building-lifecycle.bpmn');

const res = await fetch('http://localhost:8080/engine-rest/deployment/create', {
  method: 'POST',
  body: form,
  // Do NOT set Content-Type header manually — fetch sets multipart boundary automatically
});
```

### Verify PostgreSQL Connection in Operaton Startup Log

```
# What you WANT to see (PostgreSQL connected):
org.operaton.bpm.engine.impl.db.sql.DbSqlSessionFactory - Using database type: postgres
org.postgresql.Driver - Registered driver version: 4.2

# What you DO NOT want to see (H2 fallback):
com.h2database.jdbc.JdbcDriver - ...
jdbc:h2:mem:operaton
```

### Verify deploy-changed-only Works

```bash
# After second server restart, only version 1 should exist:
curl http://localhost:8080/engine-rest/process-definition?key=master-building-lifecycle
# Response should show "version": 1 — NOT version 2 or higher
```

### Proxy Route Smoke Test

```bash
# Verify proxy passes through correctly:
curl http://localhost:3000/api/camunda/engine-rest/process-definition
# Should return same JSON as:
curl http://localhost:8080/engine-rest/process-definition
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Camunda 7 full distribution (WAR deploy to Tomcat) | Operaton Run (standalone JAR, no app server) | Operaton fork (2024) | No Java web server needed; single JAR startup |
| `application.properties` | `application.yml` (YAML) | Operaton Run default | YAML is the standard config format for Operaton Run |
| `form-data` npm package | Native `FormData` + `Blob` | Node.js 18 (2022) | Zero deps for multipart upload; available in Node 25.6.1 |

**Deprecated/outdated in existing research:**
- Architecture research references `import FormData from 'form-data'` (npm package). This is NOT needed on Node 25.6.1. Use native `FormData` + `Blob` instead.

---

## Open Questions

1. **Operaton schema creation permissions for `doorman_user`**
   - What we know: DB is owned by `a123`; `doorman_user` has SELECT/INSERT/UPDATE grants on existing tables
   - What's unclear: Whether `doorman_user` can CREATE TABLE for `ACT_*` Operaton tables
   - Recommendation: Wave 0 task — as `a123`, pre-create Operaton schema by running the Operaton SQL scripts before starting the JAR, OR grant `doorman_user` CREATE privileges on the public schema. Check `\du doorman_user` in psql.

2. **Single deployment vs. per-file deployments**
   - What we know: Operaton `deploy-changed-only` works at the resource level within a deployment
   - What's unclear: Whether deploying all 39 files in one deployment call performs well or hits a payload size limit
   - Recommendation: Use single deployment (all 39 files). Total BPMN size for this project is estimated < 1MB; no payload concern.

3. **BPMN delegateExpression → external task conversion scope**
   - What we know: All 39 BPMNs use `camunda:delegateExpression`; none use `camunda:type="external"`
   - What's unclear: Whether any BPMNs should keep `delegateExpression` (e.g., simple expression evaluation) or all must be converted
   - Recommendation: This is a Phase 2 planning question. Flag for the Phase 2 research phase. Phase 1 is unaffected.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected for backend (Jest configured but no tests for server-level integration) |
| Config file | `backend/package.json` scripts.test — Jest unit tests only |
| Quick run command | `curl http://localhost:3000/api/camunda/engine-rest/process-definition` |
| Full suite command | Manual startup verification sequence (see below) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Operaton starts with PostgreSQL, not H2 | smoke | `curl -s http://localhost:8080/engine-rest/engine | grep default` | ❌ Wave 0 |
| INFRA-01 | PostgreSQL driver loaded (not H2) | log-check | `grep 'org.postgresql' < operaton-startup.log` | ❌ Wave 0 |
| INFRA-02 | All 39 BPMNs visible in Cockpit after start | smoke | `curl -s 'http://localhost:8080/engine-rest/process-definition?latestVersion=true' | jq length` should equal 39 | ❌ Wave 0 |
| INFRA-02 | No new versions created on second start | regression | Re-start server; `curl .../process-definition?key=master-building-lifecycle` version stays 1 | ❌ Wave 0 |
| INFRA-03 | Proxy returns process list via backend | smoke | `curl http://localhost:3000/api/camunda/engine-rest/process-definition` returns 200 | ❌ Wave 0 |
| INFRA-03 | No CORS errors from frontend origin | manual | Open browser devtools on `localhost:3001`; check Network tab for CORS errors | manual-only |

### Sampling Rate

- **Per task commit:** Run relevant curl smoke test for the specific deliverable
- **Per wave merge:** Full startup verification sequence: start Operaton, start backend, run all 5 curl tests above
- **Phase gate:** All 5 automated tests pass AND Cockpit shows 39 deployments at version 1

### Wave 0 Gaps

- [ ] `backend/src/camunda/deployBpmn.mjs` — covers INFRA-02 (does not exist yet)
- [ ] `backend/src/camunda/camundaProxy.mjs` — covers INFRA-03 (does not exist yet)
- [ ] Camunda `configuration/default.yml` — covers INFRA-01 (Camunda not yet downloaded)
- [ ] `configuration/userlib/postgresql-42.7.4.jar` — covers INFRA-01 (not yet downloaded)
- [ ] Camunda schema pre-created in `doorman_db` — covers INFRA-01 (DDL permissions concern)

---

## Sources

### Primary (HIGH confidence)

- Existing codebase: `backend/demo-server.mjs` — directly read; confirmed http module, no Express, Node 25.6.1
- Existing codebase: `backend/src/delegates/index.ts`, `types.ts` — directly read; confirmed 50+ delegate names
- Existing codebase: `processes/**/*.bpmn` — directly read; confirmed `camunda:delegateExpression` pattern on all service tasks, zero `camunda:type="external"` tasks
- Confirmed: `java -version` = OpenJDK 21 at `/usr/local/Cellar/openjdk@21/21.0.7/`
- Confirmed: 39 `.bpmn` files across 7 subdirectories (`find processes -name "*.bpmn" | wc -l` = 39)
- [Camunda 7.23 Download Center](https://downloads.camunda.cloud/release/camunda-bpm/run/7.23/) — JAR availability
- [Camunda Run docs: Configuration](https://docs.camunda.org/manual/latest/user-guide/camunda-bpm-run/) — `application.yml` datasource keys
- [Maven Central: postgresql JDBC](https://repo1.maven.org/maven2/org/postgresql/postgresql/) — driver JAR location
- `.planning/research/PITFALLS.md` — project research, directly read; pitfalls 1, 2, 5 directly applicable to Phase 1

### Secondary (MEDIUM confidence)

- [Camunda Forum: H2 File Database Not Created — Only In-Memory](https://forum.camunda.io/t/h2-file-database-is-physically-not-created-but-only-in-memory/18431) — H2 default pitfall
- [Camunda Forum: Problem with Camunda REST API and CORS](https://forum.camunda.io/t/problem-with-camunda-rest-api-and-cors/29912) — CORS + auth interaction
- `.planning/research/ARCHITECTURE.md` — project research, directly read; proxy pattern and deployment pattern

### Tertiary (LOW confidence)

- Architecture research note on `form-data` npm package — overridden by direct verification that Node 25.6.1 has native FormData; use native API instead

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Java 21 confirmed installed; Camunda 7.23.0 download URL verified; JDBC driver location confirmed; Node 25.6.1 FormData confirmed native
- Architecture: HIGH — deployBpmn pattern verified against Camunda REST docs and existing codebase structure; proxy pattern confirmed against demo-server.mjs structure
- Pitfalls: HIGH (Camunda infra) — H2 default, JDBC driver placement, deploy-changed-only, and PostgreSQL DDL permissions are all verified via official docs or direct codebase reading; MEDIUM for DB permissions pitfall (depends on `doorman_user` grant level not yet verified)
- BPMN delegateExpression finding: HIGH — directly read from BPMN XML files; all 39 files confirmed

**Research date:** 2026-03-08
**Valid until:** 2026-06-08 (stable Camunda 7 config; JDBC driver minor version may update)
