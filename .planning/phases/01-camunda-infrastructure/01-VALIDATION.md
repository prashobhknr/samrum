---
phase: 1
slug: camunda-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + curl/bash scripts (no automated test framework needed — infrastructure phase) |
| **Config file** | none |
| **Quick run command** | `curl -s http://localhost:8080/engine-rest/engine \| jq .` |
| **Full suite command** | `bash .planning/phases/01-camunda-infrastructure/verify.sh` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick `curl` check against Camunda REST
- **After every plan wave:** Run full verify script
- **Before `/gsd:verify-work`:** All 3 success criteria must be manually confirmed
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 1-01-01 | 01 | 0 | INFRA-01 | manual | `java -version` | ⬜ pending |
| 1-01-02 | 01 | 0 | INFRA-01 | manual | Check doorman_user DDL grants | ⬜ pending |
| 1-01-03 | 01 | 1 | INFRA-01 | manual | Download + extract Camunda JAR | ⬜ pending |
| 1-01-04 | 01 | 1 | INFRA-01 | manual | Drop PostgreSQL JDBC driver in userlib/ | ⬜ pending |
| 1-01-05 | 01 | 1 | INFRA-01 | automated | `curl -s http://localhost:8080/engine-rest/engine \| jq .` | ⬜ pending |
| 1-02-01 | 02 | 1 | INFRA-02 | automated | `node backend/scripts/deploy-bpmn.mjs && curl .../process-definition` | ⬜ pending |
| 1-02-02 | 02 | 1 | INFRA-02 | manual | Restart server, verify version count unchanged in Cockpit | ⬜ pending |
| 1-03-01 | 03 | 2 | INFRA-03 | automated | `curl localhost:3000/api/camunda/engine-rest/process-definition` | ⬜ pending |
| 1-03-02 | 03 | 2 | INFRA-03 | manual | Open frontend, verify no CORS error in browser console | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Confirm `doorman_user` DDL privileges (SELECT, CREATE TABLE on doorman_db)
- [ ] If missing: run `GRANT CREATE ON SCHEMA public TO doorman_user;` as `a123`
- [ ] Confirm Java 21 available: `java -version`
- [ ] Confirm `processes/` directory BPMN count: `find processes/ -name "*.bpmn" | wc -l` → 39

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cockpit accessible at localhost:8080 | INFRA-01 | Browser UI, not REST-testable | Open http://localhost:8080/camunda, login with demo/demo |
| Startup logs show PostgreSQL driver, not H2 | INFRA-01 | Log inspection | `grep -i "postgresql\|h2" camunda-run/logs/camunda-bpm-run.log` |
| 39 BPMNs visible in Cockpit Processes list | INFRA-02 | Cockpit UI count | Open Cockpit → Processes, count deployed definitions |
| Restart does not add versions | INFRA-02 | Requires two restarts and count comparison | Restart server twice, Cockpit version count stays same |
| No CORS error in browser | INFRA-03 | Browser devtools | Open frontend, check Network tab for CORS preflight failures |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
