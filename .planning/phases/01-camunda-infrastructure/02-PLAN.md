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
    - "All 39 BPMN process definitions are visible in Camunda Cockpit after backend starts"
    - "Restarting demo-server.mjs does not create version 2+ of any process definition"
    - "Backend logs show deployment count and deployment ID on startup"
  artifacts:
    - path: "backend/src/camunda/deployBpmn.mjs"
      provides: "BPMN deployment function using native FormData, deploy-changed-only"
      exports: ["deployAllBpmns"]
    - path: "backend/demo-server.mjs"
      provides: "deployAllBpmns() called after DB connect, non-fatal if Camunda is down"
  key_links:
    - from: "backend/src/camunda/deployBpmn.mjs"
      to: "http://localhost:8080/engine-rest/deployment/create"
      via: "fetch POST with native FormData, all 39 BPMNs in one deployment"
      pattern: "deployment/create"
    - from: "backend/demo-server.mjs"
      to: "deployAllBpmns"
      via: "import + try/catch call after client.connect succeeds"
      pattern: "deployAllBpmns"
---

<objective>
Create `deployBpmn.mjs` that reads all 39 BPMN files from `processes/` recursively and POSTs them to Camunda in a single multipart deployment call with `deploy-changed-only=true`. Wire this into `demo-server.mjs` so it runs on every startup — idempotently.

Purpose: All process definitions must be visible in Camunda before Phase 2 can implement the external task worker, and before Phase 3 can start process instances.
Output: `backend/src/camunda/deployBpmn.mjs` + modified `demo-server.mjs` startup sequence.
</objective>

<execution_context>
@/Users/prashobh/.claude/get-shit-done/workflows/execute-plan.md
@/Users/prashobh/.claude/get-shit-done/templates/summary.md
</execution_context>

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
    ```bash
    mkdir -p /Users/prashobh/.openclaw/workspace/doorman/backend/src/camunda
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
    const BPMN_DIR = resolve(__dirname, '../../../..', 'processes');

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
    - `resolve(__dirname, '../../../..', 'processes')` = `{repo}/processes`
    - Confirm the path resolves correctly:
    ```bash
    node -e "
      import { dirname, resolve } from 'path';
      import { fileURLToPath } from 'url';
      const d = dirname(fileURLToPath(import.meta.url));
      console.log(resolve(d, 'backend/src/camunda/../../../..', 'processes'));
    " --input-type=module 2>/dev/null || \
    node -e "const {resolve} = require('path'); console.log(resolve('/Users/prashobh/.openclaw/workspace/doorman/backend/src/camunda', '../../../..', 'processes'))"
    # Expected: /Users/prashobh/.openclaw/workspace/doorman/processes
    ```
  </action>
  <verify>
    <automated>node --input-type=module &lt;&lt;'EOF'
import { deployAllBpmns } from '/Users/prashobh/.openclaw/workspace/doorman/backend/src/camunda/deployBpmn.mjs';
// Dry-run: just confirm the file loads and BPMN_DIR resolves correctly
import { readdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const BPMN_DIR = resolve('/Users/prashobh/.openclaw/workspace/doorman/backend/src/camunda', '../../../..', 'processes');
const files = await readdir(BPMN_DIR, { recursive: true });
const bpmns = files.filter(f => f.endsWith('.bpmn'));
if (bpmns.length !== 39) throw new Error(`Expected 39 BPMNs, found ${bpmns.length}`);
console.log(`OK: ${bpmns.length} BPMN files found`);
EOF</automated>
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
        // Non-fatal: backend is useful for OMS admin even when Camunda is offline
        console.warn('[Camunda] BPMN deployment skipped (Camunda may not be running):', e.message);
      }
    });
    ```

    Do not touch any other part of demo-server.mjs. The rest of the file (HTTP handler, routes, etc.) is unchanged.

    After editing, verify the file still parses as valid ES Module:
    ```bash
    node --check /Users/prashobh/.openclaw/workspace/doorman/backend/demo-server.mjs
    ```
  </action>
  <verify>
    <automated>node --check /Users/prashobh/.openclaw/workspace/doorman/backend/demo-server.mjs && echo "syntax OK"</automated>
  </verify>
  <done>demo-server.mjs imports deployAllBpmns from ./src/camunda/deployBpmn.mjs and calls it (with try/catch) inside the client.connect callback. File passes node --check.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify 39 BPMNs deployed and idempotent on restart</name>
  <what-built>deployBpmn.mjs wired into demo-server.mjs startup</what-built>
  <how-to-verify>
    Camunda must be running (from Plan 01). Then:

    1. Start backend:
    ```bash
    cd /Users/prashobh/.openclaw/workspace/doorman
    pkill -f demo-server.mjs 2>/dev/null; sleep 1
    node backend/demo-server.mjs &
    sleep 5
    ```

    2. Check backend logs for deployment confirmation:
    ```
    [Camunda] Deployed 39 BPMN files. Deployment ID: <uuid>. New definitions: 39
    ```
    (New definitions: 39 on first run; 0 on subsequent runs = deploy-changed-only working)

    3. Confirm 39 process definitions via REST:
    ```bash
    curl -s 'http://localhost:8080/engine-rest/process-definition?latestVersion=true' | python3 -m json.tool | grep '"key"' | wc -l
    # Expected: 39
    ```

    4. Restart server and confirm no new versions:
    ```bash
    pkill -f demo-server.mjs; sleep 1; node backend/demo-server.mjs &
    sleep 5
    # Check a known process — master-building-lifecycle should still be version 1:
    curl -s 'http://localhost:8080/engine-rest/process-definition?key=master-building-lifecycle&latestVersion=true' | python3 -m json.tool | grep '"version"'
    # Expected: "version": 1
    ```

    5. Open Cockpit at http://localhost:8080/camunda/app/cockpit/
       Navigate to Process Definitions. Should show ~39 processes listed.

    If deployment fails with HTTP 400/500:
    - Check backend logs for the error text (first 300 chars of Camunda response logged)
    - Common cause: Camunda not running → start camunda-bpm-run/start.sh first
  </how-to-verify>
  <resume-signal>Type "approved" when 39 definitions are confirmed in Cockpit and restart does not increment versions. Describe errors if blocked.</resume-signal>
</task>

</tasks>

<verification>
Plan 02 success:
1. `curl 'http://localhost:8080/engine-rest/process-definition?latestVersion=true' | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))"` outputs `39`
2. `curl 'http://localhost:8080/engine-rest/process-definition?key=master-building-lifecycle&latestVersion=true' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['version'])"` outputs `1` after two server restarts
3. `node --check backend/demo-server.mjs` exits 0
</verification>

<success_criteria>
All 39 BPMN files are deployed to Camunda as a single idempotent deployment. Cockpit shows 39 process definitions. Subsequent server restarts do not create new versions.
</success_criteria>

<output>
After completion, create `.planning/phases/01-camunda-infrastructure/01-02-SUMMARY.md`
</output>
