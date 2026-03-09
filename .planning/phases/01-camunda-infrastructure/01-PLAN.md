---
phase: 01-camunda-infrastructure
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - camunda-bpm-run/configuration/default.yml
  - camunda-bpm-run/configuration/userlib/postgresql-42.7.4.jar
autonomous: false
requirements:
  - INFRA-01
must_haves:
  truths:
    - "Camunda 7.23.0 starts and Cockpit is accessible at http://localhost:8080/camunda"
    - "Startup log shows org.postgresql.Driver loaded, not H2 or jdbc:h2:mem"
    - "ACT_* tables exist in doorman_db after first start (schema-update created them)"
  artifacts:
    - path: "camunda-bpm-run/configuration/default.yml"
      provides: "PostgreSQL datasource config, admin user, CORS disabled"
      contains: "spring.datasource"
    - path: "camunda-bpm-run/configuration/userlib/postgresql-42.7.4.jar"
      provides: "PostgreSQL JDBC driver for Camunda classpath"
  key_links:
    - from: "camunda-bpm-run/configuration/default.yml"
      to: "doorman_db"
      via: "spring.datasource.url = jdbc:postgresql://localhost:5432/doorman_db"
      pattern: "jdbc:postgresql"
    - from: "camunda-bpm-run/configuration/userlib/"
      to: "org.postgresql.Driver"
      via: "Camunda scans userlib/ for JARs at boot"
      pattern: "postgresql-.*\\.jar"
---

<objective>
Download Camunda 7.23.0 Run, configure it to use the existing PostgreSQL database instead of H2, place the PostgreSQL JDBC driver, grant DDL privileges to doorman_user, and start Camunda — confirming it boots against PostgreSQL.

Purpose: Camunda must persist process data in doorman_db (not in-memory H2) so restarts do not lose deployments or process instances.
Output: Running Camunda 7.23.0 accessible at localhost:8080, backed by PostgreSQL.
</objective>

<execution_context>
@/Users/prashobh/.claude/get-shit-done/workflows/execute-plan.md
@/Users/prashobh/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-camunda-infrastructure/01-RESEARCH.md
</context>

<tasks>

<task type="checkpoint:human-action">
  <name>Task 1: Grant DDL privileges and download Camunda + JDBC driver</name>
  <files>camunda-bpm-run/ (new directory), camunda-bpm-run/configuration/userlib/postgresql-42.7.4.jar</files>
  <action>
    Run these commands in order. Each must succeed before the next.

    STEP 1 — Grant DDL privileges to doorman_user (run as a123 — the DB owner):
    ```bash
    psql -U a123 -d doorman_db -c "GRANT CREATE ON SCHEMA public TO doorman_user;"
    psql -U a123 -d doorman_db -c "GRANT USAGE ON SCHEMA public TO doorman_user;"
    # Confirm:
    psql -U a123 -d doorman_db -c "\du doorman_user"
    ```

    STEP 2 — Download Camunda 7.23.0 Run to project root:
    ```bash
    cd /Users/prashobh/.openclaw/workspace/doorman
    curl -L -O https://downloads.camunda.cloud/release/camunda-bpm/run/7.23/camunda-bpm-run-7.23.0.zip
    unzip camunda-bpm-run-7.23.0.zip -d camunda-bpm-run
    rm camunda-bpm-run-7.23.0.zip
    ls camunda-bpm-run/
    # Should show: configuration/ internal/ start.sh (or start.bat)
    ```

    STEP 3 — Download PostgreSQL JDBC driver (must be done BEFORE first Camunda start):
    ```bash
    mkdir -p camunda-bpm-run/configuration/userlib
    curl -L -o camunda-bpm-run/configuration/userlib/postgresql-42.7.4.jar \
      https://repo1.maven.org/maven2/org/postgresql/postgresql/42.7.4/postgresql-42.7.4.jar
    ls -lh camunda-bpm-run/configuration/userlib/
    # Should show: postgresql-42.7.4.jar (~1MB)
    ```

    STEP 4 — Add camunda-bpm-run/ to .gitignore (binary JAR + large files should not be committed):
    ```bash
    echo "camunda-bpm-run/" >> /Users/prashobh/.openclaw/workspace/doorman/.gitignore
    echo "camunda-bpm-run-*.zip" >> /Users/prashobh/.openclaw/workspace/doorman/.gitignore
    ```
  </action>
  <verify>
    - `ls camunda-bpm-run/configuration/userlib/postgresql-42.7.4.jar` exits 0
    - `psql -U doorman_user -d doorman_db -c "CREATE TABLE _test_priv (id int); DROP TABLE _test_priv;"` succeeds (confirms DDL grant worked)
  </verify>
  <done>Camunda zip extracted at camunda-bpm-run/, JDBC JAR present in userlib/, doorman_user can CREATE TABLE in doorman_db.</done>
</task>

<task type="auto">
  <name>Task 2: Write Camunda configuration/default.yml with PostgreSQL datasource</name>
  <files>camunda-bpm-run/configuration/default.yml</files>
  <action>
    Create (overwrite) `camunda-bpm-run/configuration/default.yml` with exactly this content.
    Do NOT modify the existing default.yml in-place if it has H2 config — overwrite entirely.

    ```yaml
    # Doorman — Camunda 7.23.0 Run configuration
    # Replaces H2 in-memory default with PostgreSQL

    spring.datasource:
      url: jdbc:postgresql://localhost:5432/doorman_db
      username: doorman_user
      password: doorman_pass
      driver-class-name: org.postgresql.Driver

    camunda.bpm:
      database:
        schema-update: true
      admin-user:
        id: demo
        password: demo
        firstName: Demo
      filter:
        create: All Tasks

    camunda.bpm.run.cors:
      enabled: false
    ```

    Key points:
    - `schema-update: true` (NOT `create-drop` — that would wipe tables on restart)
    - `cors.enabled: false` — all Camunda calls go through Node.js proxy, never direct from browser
    - Credentials match MEMORY.md: doorman_user / doorman_pass / doorman_db

    After writing the file, verify it parses as valid YAML:
    ```bash
    python3 -c "import yaml; yaml.safe_load(open('camunda-bpm-run/configuration/default.yml'))" && echo "YAML valid"
    ```
  </action>
  <verify>
    <automated>python3 -c "import yaml; d=yaml.safe_load(open('/Users/prashobh/.openclaw/workspace/doorman/camunda-bpm-run/configuration/default.yml')); assert 'jdbc:postgresql' in d['spring.datasource']['url']; print('config OK')"</automated>
  </verify>
  <done>default.yml exists with PostgreSQL datasource, schema-update true, CORS disabled, admin user demo/demo.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Start Camunda and verify PostgreSQL boot</name>
  <what-built>Camunda 7.23.0 Run configured for PostgreSQL with JDBC driver in userlib/</what-built>
  <how-to-verify>
    Run these commands and confirm each expected outcome:

    ```bash
    cd /Users/prashobh/.openclaw/workspace/doorman/camunda-bpm-run
    ./start.sh
    # Wait ~30 seconds for startup to complete
    ```

    1. Startup log must show PostgreSQL, NOT H2:
    ```bash
    grep -i "postgresql\|h2\|jdbc" camunda-bpm-run/logs/camunda-bpm-run.log | head -20
    # WANT: org.postgresql.Driver or "Using database type: postgres"
    # DO NOT WANT: jdbc:h2:mem or H2Database
    ```

    2. Camunda REST is up:
    ```bash
    curl -s http://localhost:8080/engine-rest/engine | python3 -m json.tool
    # Expected: [{"name":"default"}]
    ```

    3. ACT_* tables created in doorman_db:
    ```bash
    psql -U doorman_user -d doorman_db -c "\dt ACT_*" | head -10
    # Expected: list of ACT_RE_*, ACT_RU_*, ACT_HI_*, ACT_GE_* tables
    ```

    4. Cockpit accessible:
       Open http://localhost:8080/camunda/app/cockpit/ in browser.
       Login: demo / demo
       Should see the main Cockpit dashboard (0 process definitions is expected at this point).

    If startup fails:
    - "NoClassDefFoundError: org.postgresql.Driver" → JDBC JAR not found. Check `ls camunda-bpm-run/configuration/userlib/`
    - "permission denied to create table" → DDL grant failed. Re-run Step 1 from Task 1 as a123.
    - "jdbc:h2:mem" in logs → default.yml not being read. Confirm file is at camunda-bpm-run/configuration/default.yml (not default.yml.bak or similar).
  </how-to-verify>
  <resume-signal>Type "approved" when Cockpit loads and curl returns engine list. Describe any errors if approval is blocked.</resume-signal>
</task>

</tasks>

<verification>
Phase 1, Plan 01 success when:
1. `curl -s http://localhost:8080/engine-rest/engine` returns `[{"name":"default"}]`
2. Camunda startup log contains `org.postgresql` and does NOT contain `jdbc:h2:mem`
3. `\dt ACT_*` in psql shows Camunda schema tables
4. Cockpit UI loads at http://localhost:8080/camunda/app/cockpit/
</verification>

<success_criteria>
Camunda 7.23.0 is running on macOS without Docker, backed by doorman_db (PostgreSQL). Cockpit is accessible. Process data will persist across restarts.
</success_criteria>

<output>
After completion, create `.planning/phases/01-camunda-infrastructure/01-01-SUMMARY.md`
</output>
