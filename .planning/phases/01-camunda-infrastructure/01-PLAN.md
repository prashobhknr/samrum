---
phase: 01-camunda-infrastructure
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - camunda-bpm-run/configuration/userlib/postgresql-42.7.4.jar
autonomous: false
requirements:
  - INFRA-01
must_haves:
  truths:
    - "Operaton starts and Cockpit is accessible at http://localhost:8080/operaton"
    - "Startup log shows org.postgresql.Driver loaded, not H2 or jdbc:h2:mem"
    - "ACT_* tables exist in doorman_db after first start (schema-update created them)"
  artifacts:
    - path: "camunda-bpm-run/configuration/default.yml"
      provides: "PostgreSQL datasource config, admin user, CORS enabled, deploy-changed-only"
      contains: "spring.datasource"
    - path: "camunda-bpm-run/configuration/userlib/postgresql-42.7.4.jar"
      provides: "PostgreSQL JDBC driver for Operaton classpath"
  key_links:
    - from: "camunda-bpm-run/configuration/default.yml"
      to: "doorman_db"
      via: "spring.datasource.url = jdbc:postgresql://localhost:5432/doorman_db"
      pattern: "jdbc:postgresql"
    - from: "camunda-bpm-run/configuration/userlib/"
      to: "org.postgresql.Driver"
      via: "Operaton scans userlib/ for JARs at boot"
      pattern: "postgresql-.*\\.jar"
---

<objective>
Download Operaton Run (open-source Camunda 7 fork), place the PostgreSQL JDBC driver, grant DDL privileges to doorman_user, and start Operaton — confirming it boots against PostgreSQL.

Purpose: Operaton must persist process data in doorman_db (not in-memory H2) so restarts do not lose deployments or process instances.
Output: Running Operaton accessible at localhost:8080, backed by PostgreSQL.

NOTE: default.yml already exists with correct operaton.bpm settings. No config changes needed.
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-camunda-infrastructure/01-RESEARCH.md
</context>

<tasks>

<task type="checkpoint:human-action">
  <name>Task 1: Grant DDL privileges, download Operaton + JDBC driver</name>
  <files>camunda-bpm-run/, camunda-bpm-run/configuration/userlib/postgresql-42.7.4.jar</files>
  <action>
    Run these commands in order (PowerShell, Windows). Each must succeed before the next.

    STEP 1 — Grant DDL privileges to doorman_user (run as DB owner):
    ```powershell
    psql -U a123 -d doorman_db -c "GRANT CREATE ON SCHEMA public TO doorman_user;"
    psql -U a123 -d doorman_db -c "GRANT USAGE ON SCHEMA public TO doorman_user;"
    # Confirm:
    psql -U a123 -d doorman_db -c "\du doorman_user"
    ```

    STEP 2 — Download Operaton Run from GitHub releases:
    Visit https://github.com/operaton/operaton/releases and download the latest
    `operaton-bpm-run-*.tar.gz` or `.zip` archive.

    Extract into the existing `camunda-bpm-run/` directory:
    ```powershell
    cd c:\ws\learn\samrum\samrum
    # Extract Operaton Run (adjust filename to match downloaded version)
    # The archive should contain: internal/, start.bat, start.sh, etc.
    # IMPORTANT: Preserve configuration/default.yml (our config is already correct)
    ```

    STEP 3 — Download PostgreSQL JDBC driver (must be done BEFORE first Operaton start):
    ```powershell
    New-Item -ItemType Directory -Force camunda-bpm-run\configuration\userlib
    Invoke-WebRequest -Uri "https://repo1.maven.org/maven2/org/postgresql/postgresql/42.7.4/postgresql-42.7.4.jar" `
      -OutFile camunda-bpm-run\configuration\userlib\postgresql-42.7.4.jar
    Get-Item camunda-bpm-run\configuration\userlib\postgresql-42.7.4.jar
    # Should show: postgresql-42.7.4.jar (~1MB)
    ```

    STEP 4 — Ensure camunda-bpm-run/ is in .gitignore:
    ```powershell
    Select-String "camunda-bpm-run" .gitignore
    # If not present, add:
    Add-Content .gitignore "camunda-bpm-run/"
    ```
  </action>
  <verify>
    - `Test-Path camunda-bpm-run\configuration\userlib\postgresql-42.7.4.jar` returns True
    - `Test-Path camunda-bpm-run\start.bat` returns True (confirms Operaton extracted)
    - `psql -U doorman_user -d doorman_db -c "CREATE TABLE _test_priv (id int); DROP TABLE _test_priv;"` succeeds
  </verify>
  <done>Operaton extracted at camunda-bpm-run/, JDBC JAR present in userlib/, doorman_user can CREATE TABLE in doorman_db.</done>
</task>

<task type="auto">
  <name>Task 2: Verify existing default.yml configuration</name>
  <files>camunda-bpm-run/configuration/default.yml</files>
  <action>
    The configuration file already exists with correct Operaton settings.
    Verify it contains the required operaton.bpm settings — no changes needed.
  </action>
  <verify>
    Read default.yml and confirm: operaton.bpm.admin-user, spring.datasource with PostgreSQL, schema-update: true.
  </verify>
  <done>default.yml verified — PostgreSQL datasource, schema-update true, deploy-changed-only true, admin demo/demo.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Start Operaton and verify PostgreSQL boot</name>
  <what-built>Operaton Run configured for PostgreSQL with JDBC driver in userlib/</what-built>
  <how-to-verify>
    ```powershell
    cd c:\ws\learn\samrum\samrum\camunda-bpm-run
    .\start.bat
    # Wait ~30 seconds for startup to complete
    ```

    1. Startup log must show PostgreSQL, NOT H2:
       WANT: org.postgresql.Driver or "Using database type: postgres"
       DO NOT WANT: jdbc:h2:mem or H2Database

    2. Operaton REST is up:
    ```powershell
    Invoke-RestMethod http://localhost:8080/engine-rest/engine
    # Expected: name=default
    ```

    3. ACT_* tables created in doorman_db:
    ```powershell
    psql -U doorman_user -d doorman_db -c "\dt ACT_*"
    # Expected: list of ACT_RE_*, ACT_RU_*, ACT_HI_*, ACT_GE_* tables
    ```

    4. Cockpit accessible:
       Open http://localhost:8080/operaton/app/cockpit/ in browser.
       Login: demo / demo
       NOTE: If /operaton/ path doesn't work, try /camunda/ — depends on Operaton version.

    If startup fails:
    - "NoClassDefFoundError: org.postgresql.Driver" → JDBC JAR not found in userlib/
    - "permission denied to create table" → DDL grant failed, re-run Step 1
    - "jdbc:h2:mem" in logs → default.yml not being read or was overwritten
  </how-to-verify>
  <resume-signal>Type "approved" when Cockpit loads and REST returns engine list.</resume-signal>
</task>

</tasks>

<verification>
Phase 1, Plan 01 success when:
1. `Invoke-RestMethod http://localhost:8080/engine-rest/engine` returns default engine
2. Operaton startup log contains `org.postgresql` and NOT `jdbc:h2:mem`
3. `\dt ACT_*` in psql shows Operaton schema tables
4. Cockpit UI loads and is accessible
</verification>

<success_criteria>
Operaton is running on Windows, backed by doorman_db (PostgreSQL). Cockpit is accessible. Process data will persist across restarts.
</success_criteria>
