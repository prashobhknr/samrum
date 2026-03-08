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
      provides: "/api/camunda/* proxy route block forwarding to http://localhost:8080/engine-rest"
      contains: "pathname.startsWith('/api/camunda/')"
  key_links:
    - from: "frontend (localhost:3001)"
      to: "backend (localhost:3000/api/camunda/*)"
      via: "all Camunda REST calls use /api/camunda/ prefix, never :8080 directly"
      pattern: "/api/camunda/"
    - from: "backend demo-server.mjs proxy handler"
      to: "http://localhost:8080/engine-rest"
      via: "fetch() forwarding with method + body + content-type"
      pattern: "engine-rest"
---

<objective>
Add a thin `/api/camunda/*` proxy route block to `demo-server.mjs` that forwards all matching requests to Camunda's engine-rest at `localhost:8080`, stripping the `/api/camunda` prefix. This ensures the frontend never contacts port 8080 directly, avoiding CORS issues and centralizing auth enforcement later.

Purpose: The frontend must be able to call Camunda REST APIs through the existing backend, with no CORS configuration needed on Camunda's side.
Output: Modified `demo-server.mjs` with proxy route block inserted before the 404 fallback.
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
    // Forwards all /api/camunda/* requests to Camunda engine-rest.
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
    - Use `camundaRes.headers.get('content-type')` so BPMN XML responses (future phase) return the correct content type
    - `return` after `res.end()` prevents falling through to the 404

    After editing, verify syntax:
    ```bash
    node --check /Users/prashobh/.openclaw/workspace/doorman/backend/demo-server.mjs && echo "syntax OK"
    ```
  </action>
  <verify>
    <automated>node --check /Users/prashobh/.openclaw/workspace/doorman/backend/demo-server.mjs && echo "syntax OK"</automated>
  </verify>
  <done>demo-server.mjs has the /api/camunda/* proxy block before the 404 fallback. File passes node --check.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Smoke test the proxy routes</name>
  <what-built>Proxy block in demo-server.mjs forwarding /api/camunda/* to Camunda engine-rest</what-built>
  <how-to-verify>
    Camunda and backend must both be running. Then run all three tests:

    TEST 1 — GET proxy (process definitions list):
    ```bash
    curl -s http://localhost:3000/api/camunda/engine-rest/process-definition | python3 -m json.tool | head -20
    # Expected: JSON array of process definition objects (same as direct Camunda call)
    ```

    TEST 2 — Compare direct vs proxied response (must match):
    ```bash
    DIRECT=$(curl -s 'http://localhost:8080/engine-rest/process-definition?latestVersion=true' | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))")
    PROXIED=$(curl -s 'http://localhost:3000/api/camunda/engine-rest/process-definition?latestVersion=true' | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))")
    echo "Direct: $DIRECT, Proxied: $PROXIED"
    # Expected: same number (39)
    ```

    TEST 3 — Engine endpoint via proxy:
    ```bash
    curl -s http://localhost:3000/api/camunda/engine-rest/engine
    # Expected: [{"name":"default"}]
    ```

    TEST 4 — Non-Camunda route still works (regression):
    ```bash
    curl -s http://localhost:3000/api/login -X POST -H "Content-Type: application/json" -d '{"username":"x","password":"x"}'
    # Expected: 401 JSON (not proxy error, not 404)
    ```

    TEST 5 — Frontend CORS (manual):
    Open browser devtools on http://localhost:3001 (or any frontend page).
    In the browser console run:
    ```javascript
    fetch('http://localhost:3000/api/camunda/engine-rest/engine').then(r => r.json()).then(console.log)
    ```
    Expected: `[{name: "default"}]` with no CORS error in the Network tab.
  </how-to-verify>
  <resume-signal>Type "approved" when all 5 tests pass. Describe which test failed and the error output if blocked.</resume-signal>
</task>

</tasks>

<verification>
Plan 03 success:
1. `curl -s http://localhost:3000/api/camunda/engine-rest/engine` returns `[{"name":"default"}]`
2. `curl -s 'http://localhost:3000/api/camunda/engine-rest/process-definition?latestVersion=true' | python3 -c "import sys,json; print(len(json.load(sys.stdin)))"` outputs `39`
3. Existing routes (e.g. `/api/login`) still return correct responses — proxy did not break routing
4. No CORS error from browser at localhost:3001
</verification>

<success_criteria>
The frontend can call any Camunda REST endpoint via `localhost:3000/api/camunda/engine-rest/*` with no CORS error. Port 8080 is never contacted by the browser. All existing backend routes continue to work.
</success_criteria>

<output>
After completion, create `.planning/phases/01-camunda-infrastructure/01-03-SUMMARY.md`
</output>
