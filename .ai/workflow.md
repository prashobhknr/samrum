# GSD Workflow — Copilot

Workflow orchestration rules for AI-assisted development. Read `.planning/STATE.md` at session start to understand current position.

## Planning

- `.planning/STATE.md` — current phase, progress, accumulated decisions, blockers
- `.planning/ROADMAP.md` — phase breakdown with success criteria
- `.planning/PROJECT.md` — project overview and requirements
- `.planning/phases/<phase>/` — per-phase research, plans, and validation reports

## GSD Agents

Use subagents for focused execution. Available GSD agents:

| Agent | Purpose |
|-------|---------|
| `gsd-phase-researcher` | Research how to implement a phase → produces RESEARCH.md |
| `gsd-planner` | Create executable plan with task breakdown → produces PLAN.md |
| `gsd-plan-checker` | Verify plan achieves phase goal before execution |
| `gsd-executor` | Execute plan with atomic commits and checkpoints |
| `gsd-verifier` | Verify phase goal achievement (goal-backward analysis) |
| `gsd-debugger` | Investigate bugs using scientific method |
| `gsd-codebase-mapper` | Explore codebase and write structured analysis |
| `gsd-integration-checker` | Verify cross-phase integration and E2E flows |

## Rules

### Plan Before Build
- Enter plan mode for non-trivial tasks (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan — don't keep pushing
- Write detailed specs upfront to reduce ambiguity

### Subagent Strategy
- Use subagents liberally to keep main context clean
- Offload research, exploration, and parallel analysis
- One task per subagent for focused execution

### Verification Before Done
- Never mark a task complete without proving it works
- Run tests, check logs, demonstrate correctness
- Ask: "Would a staff engineer approve this?"

### Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them

### State Management
- Update `.planning/STATE.md` after completing each plan
- Record decisions, env/ops notes, and blockers as they arise
- Track velocity metrics (plans completed, duration)

## Commit Convention

```
[PHASE-#] type: description
```

Types: feat, fix, docs, refactor, test, chore

## Current Milestone

See `.planning/ROADMAP.md` — v1.0 Operaton Integration + Task Worker UI

4 phases: Camunda Infrastructure → External Task Worker → Task Worker UI → Process Timeline
