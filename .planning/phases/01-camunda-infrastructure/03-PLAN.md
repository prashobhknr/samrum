---
phase: 01-camunda-infrastructure
plan: 03
type: execute
wave: 2
depends_on:
  - "01-PLAN"
files_modified:
  - backend/demo-server.mjs
autonomous: true
requirements:
  - INFRA-03
must_haves:
  truths:
    - "curl localhost:3000/api/camunda/engine-rest/process-definition returns the same JSON as localhost:8080/engine-rest/process-definition"
    - "No request from the frontend (localhost:3001) ever reaches port 8080 directly"
    - "POST and GET requests both proxy correctly (method and body forwarded)"
  artifacts:
    - path: "backend/demo-server.mjs"
      provides: "/api/camunda/* proxy route block forwarding to Operaton engine-rest at http://localhost:8080/engine-rest"
      contains: "pathname.startsWith('/api/camunda/')"
  key_links:
    - from: "frontend (localhost:3001)"
      to: "backend (localhost:3000/api/camunda/*)"
      via: "all Operaton REST calls use /api/camunda/ prefix, never :8080 directly"
      pattern: "/api/camunda/"
    - from: "backend demo-server.mjs proxy handler"
      to: "http://localhost:8080/engine-rest"
      via: "fetch() forwarding to Operaton with method + body + content-type"
      pattern: "engine-rest"
---

<objective>
Add a thin `/api/camunda/*` proxy route block to `demo-server.mjs` that forwards all matching requests to Operaton's engine-rest at `localhost:8080`, stripping the `/api/camunda` prefix. This ensures the frontend never contacts port 8080 directly, avoiding CORS issues and centralizing auth enforcement later.

Purpose: The frontend must be able to call Operaton REST APIs through the existing backend, with no CORS configuration needed on Operaton's side.
Output: Modified `demo-server.mjs` with proxy route block inserted before the 404 fallback.
</objective>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-camunda-infrastructure/01-RESEARCH.md
@backend/demo-server.mjs
</context>

<interfaces>
<!-- demo-server.mjs HTTP handler structure (from reading the file) -->

The HTTP handler in demo-server.mjs is structured as:
```javascript
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers set here
  res.setHeader(...)

  // OPTIONS preflight handled here

  // readBody helper defined here

  try {
    // Route handlers: if (pathname === '/api/...' && req.method === 'GET') { ... }
    // ... many routes ...

    // FALLS THROUGH to 404 at bottom of try block
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (err) {
    // error handler
  }
});
```

The proxy block must be inserted INSIDE the try block, BEFORE the 404 fallback.
It must use `return` after sending the response so the 404 is not reached.

The existing `readBody` helper uses string concatenation (JSON parsing).
The proxy must read raw bytes (Buffer.concat), not use readBody, since Camunda responses
may not always be JSON (could be XML for BPMN download endpoints).
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Insert /api/camunda/* proxy block into demo-server.mjs</name>
  <files>backend/demo-server.mjs</files>
  <action>
    Find the 404 fallback line inside the `try` block of the HTTP handler. It looks like:
    ```javascript
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
    ```

    Insert the following block IMMEDIATELY BEFORE those two lines (still inside the try block):

    ```javascript
    // ─── Camunda Proxy ────────────────────────────────────────────────────────
    // Forwards all /api/camunda/* requests to Operaton engine-rest.
    // Strips /api/camunda prefix; preserves method, query string, and body.
    // Frontend never contacts port 8080 directly.
    if (pathname.startsWith('/api/camunda/')) {
      const camundaBase = process.env.CAMUNDA_REST_URL || 'http://localhost:8080/engine-rest';
      const camundaPath = pathname.replace('/api/camunda', '');
      const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
      const targetUrl = `${camundaBase}${camundaPath}${queryString}`;

      let body = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        body = Buffer.concat(chunks);
      }

      const camundaRes = await fetch(targetUrl, {
        method: req.method,
        headers: {
          ...(req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {}),
          'Accept': req.headers['accept'] || 'application/json',
        },
        body,
      });

      const responseBody = await camundaRes.text();
      const contentType = camundaRes.headers.get('content-type') || 'application/json';
      res.writeHead(camundaRes.status, { 'Content-Type': contentType });
      res.end(responseBody);
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────
    ```

    Implementation notes:
    - Use `for await (const chunk of req)` for body reading — this is native Node streams, matches the ESM async context
    - Do NOT set Content-Type manually if the request doesn't have one (avoids overriding multipart boundaries in later phases)
    - Use `camundaRes.headers.get('content-type')` so BPMN XML responses return the correct content type
    - `return` after `res.end()` prevents falling through to the 404

    After editing, verify syntax:
    ```powershell
    node --check backend/demo-server.mjs
    ```
  </action>
  <verify>
    Verify: `node --check backend/demo-server.mjs` exits 0.
  </verify>
  <done>demo-server.mjs has the /api/camunda/* proxy block before the 404 fallback. File passes node --check.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Smoke test the proxy routes</name>
  <what-built>Proxy block in demo-server.mjs forwarding /api/camunda/* to Operaton engine-rest</what-built>
  <how-to-verify>
    Operaton and backend must both be running. Then run all tests:

    TEST 1 — GET proxy (process definitions list):
    ```powershell
    Invoke-RestMethod http://localhost:3000/api/camunda/engine-rest/process-definition | Select-Object -First 3
    # Expected: process definition objects (same as direct Operaton call)
    ```

    TEST 2 — Compare direct vs proxied response (must match):
    ```powershell
    $direct = (Invoke-RestMethod 'http://localhost:8080/engine-rest/process-definition?latestVersion=true').Count
    $proxied = (Invoke-RestMethod 'http://localhost:3000/api/camunda/engine-rest/process-definition?latestVersion=true').Count
    "Direct: $direct, Proxied: $proxied"
    # Expected: same number (39)
    ```

    TEST 3 — Engine endpoint via proxy:
    ```powershell
    Invoke-RestMethod http://localhost:3000/api/camunda/engine-rest/engine
    # Expected: name=default
    ```

    TEST 4 — Non-Camunda route still works (regression):
    ```powershell
    Invoke-WebRequest -Uri http://localhost:3000/api/login -Method POST -ContentType 'application/json' -Body '{"username":"x","password":"x"}' -SkipHttpErrorCheck
    # Expected: 401 (not proxy error, not 404)
    ```

    TEST 5 — Frontend CORS (manual):
    Open browser devtools on http://localhost:3001.
    In console: `fetch('http://localhost:3000/api/camunda/engine-rest/engine').then(r => r.json()).then(console.log)`
    Expected: [{name: "default"}] with no CORS error.
  </how-to-verify>
  <resume-signal>Type "approved" when all 5 tests pass. Describe which test failed and the error output if blocked.</resume-signal>
</task>

</tasks>

<verification>
Plan 03 success:
1. `Invoke-RestMethod http://localhost:3000/api/camunda/engine-rest/engine` returns default engine
2. Proxied and direct process-definition counts match (39)
3. Existing routes (e.g. `/api/login`) still return correct responses — proxy did not break routing
4. No CORS error from browser at localhost:3001
</verification>

<success_criteria>
The frontend can call any Operaton REST endpoint via `localhost:3000/api/camunda/engine-rest/*` with no CORS error. Port 8080 is never contacted by the browser. All existing backend routes continue to work.
</success_criteria>

<output>
After completion, create `.planning/phases/01-camunda-infrastructure/01-03-SUMMARY.md`
</output>
