---
phase: 01-camunda-infrastructure
plan: 02
type: execute
wave: 2
depends_on:
  - "01-PLAN"
files_modified:
  - backend/src/camunda/deployBpmn.mjs
  - backend/demo-server.mjs
autonomous: true
requirements:
  - INFRA-02
must_haves:
  truths:
    - "All 39 BPMN process definitions are visible in Operaton Cockpit after backend starts"
    - "Restarting demo-server.mjs does not create version 2+ of any process definition"
    - "Backend logs show deployment count and deployment ID on startup"
  artifacts:
    - path: "backend/src/camunda/deployBpmn.mjs"
      provides: "BPMN deployment function using native FormData, deploy-changed-only"
      exports: ["deployAllBpmns"]
    - path: "backend/demo-server.mjs"
      provides: "deployAllBpmns() called after DB connect, non-fatal if Operaton is down"
  key_links:
    - from: "backend/src/camunda/deployBpmn.mjs"
      to: "http://localhost:8080/engine-rest/deployment/create"
      via: "fetch POST with native FormData, all 39 BPMNs in one deployment (Operaton REST API)"
      pattern: "deployment/create"
    - from: "backend/demo-server.mjs"
      to: "deployAllBpmns"
      via: "import + try/catch call after client.connect succeeds"
      pattern: "deployAllBpmns"
---

<objective>
Create `deployBpmn.mjs` that reads all 39 BPMN files from `processes/` recursively and POSTs them to Operaton in a single multipart deployment call with `deploy-changed-only=true`. Wire this into `demo-server.mjs` so it runs on every startup — idempotently.

Purpose: All process definitions must be visible in Operaton before Phase 2 can implement the external task worker, and before Phase 3 can start process instances.
Output: `backend/src/camunda/deployBpmn.mjs` + modified `demo-server.mjs` startup sequence.
</objective>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-camunda-infrastructure/01-RESEARCH.md
@backend/demo-server.mjs
</context>

<interfaces>
<!-- Key patterns from demo-server.mjs that deployBpmn.mjs must align with -->

demo-server.mjs uses ES Modules (.mjs), Node 25.6.1:
- Top-level imports: `import http from 'http'; import url from 'url'; import pkg from 'pg';`
- DB connect: `client.connect(err => { ... });`  (callback style, not async/await)
- No existing try/catch around the connect callback body

processes/ directory structure (39 BPMNs confirmed):
- processes/master-building-lifecycle.bpmn
- processes/emergency/*.bpmn
- processes/operations/*.bpmn
- processes/phases/*.bpmn
- processes/portfolio/*.bpmn
- processes/renovation/*.bpmn
- processes/sub/*.bpmn
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create backend/src/camunda/deployBpmn.mjs</name>
  <files>backend/src/camunda/deployBpmn.mjs</files>
  <action>
    Create the directory and file:
    ```powershell
    New-Item -ItemType Directory -Force backend\src\camunda
    ```

    Write `backend/src/camunda/deployBpmn.mjs` with exactly this implementation:

    ```javascript
    /**
     * deployBpmn.mjs — Deploy all doorman BPMN files to Camunda on startup.
     * Single deployment call with deploy-changed-only=true (idempotent).
     * Uses native FormData + Blob (Node 18+, confirmed on Node 25.6.1).
     */
    import { readdir, readFile } from 'fs/promises';
    import { join, resolve, dirname } from 'path';
    import { fileURLToPath } from 'url';

    const __dirname = dirname(fileURLToPath(import.meta.url));

    const CAMUNDA_BASE = process.env.CAMUNDA_REST_URL || 'http://localhost:8080/engine-rest';
    // processes/ is at repo root: backend/src/camunda/ -> ../../../processes
    const BPMN_DIR = resolve(__dirname, '../../..', 'processes');

    export async function deployAllBpmns() {
      // Recursively find all .bpmn files
      const allEntries = await readdir(BPMN_DIR, { recursive: true });
      const bpmnRelPaths = allEntries.filter(f => f.endsWith('.bpmn'));

      if (bpmnRelPaths.length === 0) {
        throw new Error(`No .bpmn files found in ${BPMN_DIR}`);
      }

      const form = new FormData();
      form.append('deployment-name', 'doorman-processes');
      form.append('enable-duplicate-filtering', 'true');
      form.append('deploy-changed-only', 'true');
      form.append('deployment-source', 'doorman-backend');

      for (const relPath of bpmnRelPaths) {
        const fullPath = join(BPMN_DIR, relPath);
        const content = await readFile(fullPath);
        // Use a flat filename as the form field name (slashes replaced with underscores)
        const fieldName = relPath.replace(/[\\/]/g, '_');
        const blob = new Blob([content], { type: 'application/xml' });
        // Third argument to form.append is the filename Camunda uses for deploy-changed-only hashing
        form.append(fieldName, blob, relPath);
      }

      // Do NOT set Content-Type manually — fetch sets the multipart boundary automatically
      const res = await fetch(`${CAMUNDA_BASE}/deployment/create`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Camunda deployment failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
      }

      const result = await res.json();
      const deployedCount = Object.keys(result.deployedProcessDefinitions || {}).length;
      console.log(`[Camunda] Deployed ${bpmnRelPaths.length} BPMN files. Deployment ID: ${result.id}. New definitions: ${deployedCount}`);
      return result;
    }
    ```

    BPMN_DIR path explanation:
    - This file lives at: `backend/src/camunda/deployBpmn.mjs`
    - `__dirname` = `{repo}/backend/src/camunda`
    - `resolve(__dirname, '../../..', 'processes')` = `{repo}/processes`
  </action>
  <verify>
    Verify the module loads and BPMN_DIR resolves to find all BPMN files.
  </verify>
  <done>deployBpmn.mjs exists, exports deployAllBpmns, finds exactly 39 BPMN files when the path is resolved relative to its location.</done>
</task>

<task type="auto">
  <name>Task 2: Wire deployAllBpmns into demo-server.mjs startup</name>
  <files>backend/demo-server.mjs</files>
  <action>
    Add the import at the top of demo-server.mjs (after the existing imports) and call deployAllBpmns() inside the client.connect callback after the success log line.

    IMPORT — add after line `const { Client } = pkg;`:
    ```javascript
    import { deployAllBpmns } from './src/camunda/deployBpmn.mjs';
    ```

    CONNECT CALLBACK — the existing callback is:
    ```javascript
    client.connect(err => {
      if (err) {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
      }
      console.log('✓ Connected to PostgreSQL');
    });
    ```

    Replace with (adds async + try/catch Camunda deploy after DB connect):
    ```javascript
    client.connect(async err => {
      if (err) {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
      }
      console.log('✓ Connected to PostgreSQL');

      // Deploy BPMNs to Camunda on startup (idempotent — deploy-changed-only)
      try {
        await deployAllBpmns();
      } catch (e) {
      // Non-fatal: backend is useful for OMS admin even when Operaton is offline
      console.warn('[Operaton] BPMN deployment skipped (Operaton may not be running):', e.message);
      }
    });
    ```

    Do not touch any other part of demo-server.mjs. The rest of the file (HTTP handler, routes, etc.) is unchanged.

    After editing, verify the file still parses as valid ES Module:
    ```powershell
    node --check backend/demo-server.mjs
    ```
  </action>
  <verify>
    Verify: `node --check backend/demo-server.mjs` exits 0.
  </verify>
  <done>demo-server.mjs imports deployAllBpmns from ./src/camunda/deployBpmn.mjs and calls it (with try/catch) inside the client.connect callback. File passes node --check.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify 39 BPMNs deployed and idempotent on restart</name>
  <what-built>deployBpmn.mjs wired into demo-server.mjs startup</what-built>
  <how-to-verify>
    Operaton must be running (from Plan 01). Then:

    1. Start backend:
    ```powershell
    cd c:\ws\learn\samrum\samrum
    node backend/demo-server.mjs
    ```

    2. Check backend logs for deployment confirmation:
    ```
    [Operaton] Deployed 39 BPMN files. Deployment ID: <uuid>. New definitions: 39
    ```
    (New definitions: 39 on first run; 0 on subsequent runs = deploy-changed-only working)

    3. Confirm 39 process definitions via REST:
    ```powershell
    Invoke-RestMethod 'http://localhost:8080/engine-rest/process-definition?latestVersion=true' | Measure-Object
    # Expected: Count = 39
    ```

    4. Restart server and confirm no new versions:
    ```powershell
    # Stop and restart backend, then check:
    Invoke-RestMethod 'http://localhost:8080/engine-rest/process-definition?key=master-building-lifecycle&latestVersion=true'
    # Expected: version = 1
    ```

    5. Open Cockpit at http://localhost:8080/operaton/app/cockpit/
       Navigate to Process Definitions. Should show ~39 processes listed.

    If deployment fails with HTTP 400/500:
    - Check backend logs for the error text (first 300 chars of Operaton response logged)
    - Common cause: Operaton not running → start camunda-bpm-run\start.bat first
  </how-to-verify>
  <resume-signal>Type "approved" when 39 definitions are confirmed in Cockpit and restart does not increment versions. Describe errors if blocked.</resume-signal>
</task>

</tasks>

<verification>
Plan 02 success:
1. `Invoke-RestMethod 'http://localhost:8080/engine-rest/process-definition?latestVersion=true'` returns 39 definitions
2. master-building-lifecycle version remains 1 after server restart
3. `node --check backend/demo-server.mjs` exits 0
</verification>

<success_criteria>
All 39 BPMN files are deployed to Operaton as a single idempotent deployment. Cockpit shows 39 process definitions. Subsequent server restarts do not create new versions.
</success_criteria>

<output>
After completion, create `.planning/phases/01-camunda-infrastructure/01-02-SUMMARY.md`
</output>
