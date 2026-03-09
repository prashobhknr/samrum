# 09 - Process KPIs, SLAs, and Monitoring

> Defines key performance indicators, service level agreements, and monitoring
> strategies for the building lifecycle process suite.

---

## 1. Phase Duration KPIs

### Target Duration per Phase

| Phase | Target | Warning | Escalation | Camunda Timer |
|-------|--------|---------|------------|---------------|
| Investigation | 60 days | 75 days | 90 days (P90D) | Non-interrupting boundary |
| Pre-study | 90 days | 105 days | 120 days (P120D) | Non-interrupting boundary |
| Design | 180 days | 240 days | 270 days (P270D) | Non-interrupting boundary |
| Procurement | 90 days | 105 days | 120 days (P120D) | Non-interrupting boundary |
| Production | 365 days | 600 days | 730 days (P730D) | Non-interrupting boundary |
| Handover | 60 days | 75 days | 90 days (P90D) | Non-interrupting boundary |
| Operations | Ongoing | - | - | - |
| Decommission | 180 days | - | - | - |

### Phase Gate Pass Rate

| KPI | Target | Measurement |
|-----|--------|-------------|
| Investigation gate pass rate (first attempt) | > 80% | `investigationApproved == true` on first pass |
| Design validation pass rate | > 70% | `validationPassed == true` on first pass |
| Final inspection pass rate | > 60% | `inspectionApproved == true` on first attempt |
| Phase rework cycles average | < 1.5 | Count of gate rejections per phase instance |

---

## 2. Discipline Design KPIs

### Phase A Completion (Baseline Producers)

| KPI | Target | Source |
|-----|--------|--------|
| Architecture design duration | < 45 days | ca_design_arch start → end |
| Structural design duration | < 60 days | ca_design_structural start → end |
| Fire safety design duration | < 40 days | ca_design_fire start → end |
| Baseline review meeting duration | < 5 days | baseline_review claim → complete |

### Phase B Completion (Consumer Disciplines)

| KPI | Target | Source |
|-----|--------|--------|
| Phase B total duration | < 90 days | fork_phase_b → join_phase_b |
| Longest discipline (bottleneck) | < 75 days | Max of individual discipline durations |
| Cross-discipline clash count | < 10 per project | designValidationDelegate output |

---

## 3. Operational Process SLAs

### Access Management

| Request Type | SLA | Escalation |
|-------------|-----|------------|
| New access | 3 business days | After 5 days |
| Modify access | 1 business day | After 2 days |
| Revoke access | 4 hours | After 8 hours |
| Lost card | 1 hour (deactivation) | Immediate |
| Temporary access | 2 hours | After 4 hours |

### Maintenance Cycle

| KPI | Target |
|-----|--------|
| Planned maintenance completion | > 95% on schedule |
| Corrective maintenance response | < 24 hours for critical |
| Maintenance backlog | < 30 days overdue items |

### Warranty Claims

| KPI | Target |
|-----|--------|
| Claim acknowledgment | < 5 business days |
| Critical defect repair | < 10 business days |
| Non-critical defect repair | < 30 business days |
| 2-year inspection on time | 100% |
| 5-year final review on time | 100% |

### Energy Management

| KPI | Target |
|-----|--------|
| Energy data collection (annual) | 100% completion |
| Energy reduction vs. baseline | > 2% year-over-year |
| Measure implementation rate | > 75% of approved measures |

### Inspections

| Inspection | SLA | Regulatory |
|-----------|-----|-----------|
| OVK | On schedule (3-6 yr cycle) | Mandatory, PBL 8:25 |
| Elevator | Every 18 months | Mandatory, AFS 2003:6 |
| SBA fire review | Annual | BBR, LSO 2003:778 |
| Energy declaration | Every 10 years | Mandatory, Lag 2006:985 |

---

## 4. Emergency Response SLAs

| Incident Type | Initial Response | Assessment Complete | Full Resolution |
|--------------|-----------------|--------------------| --------------- |
| Fire | Immediate | 4 hours | Project-dependent |
| Water damage | 30 minutes | 2 hours | 7 days |
| Security breach | 15 minutes | 1 hour | 24 hours |
| Structural damage | 1 hour | 4 hours | Project-dependent |
| Power failure | 15 minutes | 1 hour | 4 hours |
| Gas leak | Immediate | 2 hours | 24 hours |

---

## 5. Change Management KPIs

| KPI | Target |
|-----|--------|
| Change request classification time | < 2 business days |
| Minor change implementation | < 10 business days |
| Moderate change (renovation) duration | < 90 days |
| Change request rejection rate | < 20% |
| Post-change verification pass rate | > 95% |

---

## 6. Camunda Monitoring Queries

### Active Process Instances by Phase
```sql
SELECT pd.key_ AS process_key,
       COUNT(*) AS active_instances
FROM act_ru_execution e
JOIN act_re_procdef pd ON e.proc_def_id_ = pd.id_
WHERE e.parent_id_ IS NULL
  AND pd.key_ IN ('master-building-lifecycle',
    'investigation-phase', 'pre-study-phase', 'design-phase',
    'procurement-phase', 'production-phase', 'handover-phase',
    'operations-phase', 'decommission-phase')
GROUP BY pd.key_
ORDER BY pd.key_;
```

### Overdue Tasks (past SLA)
```sql
SELECT t.name_ AS task_name,
       t.assignee_ AS assignee,
       t.create_time_ AS created,
       EXTRACT(DAY FROM NOW() - t.create_time_) AS days_open,
       pd.key_ AS process_key
FROM act_ru_task t
JOIN act_re_procdef pd ON t.proc_def_id_ = pd.id_
WHERE t.create_time_ < NOW() - INTERVAL '5 days'
ORDER BY t.create_time_;
```

### Phase Duration Analysis
```sql
SELECT pd.key_ AS phase,
       AVG(EXTRACT(EPOCH FROM (hi.end_time_ - hi.start_time_))/86400) AS avg_days,
       MIN(EXTRACT(EPOCH FROM (hi.end_time_ - hi.start_time_))/86400) AS min_days,
       MAX(EXTRACT(EPOCH FROM (hi.end_time_ - hi.start_time_))/86400) AS max_days,
       COUNT(*) AS completed_count
FROM act_hi_procinst hi
JOIN act_re_procdef pd ON hi.proc_def_id_ = pd.id_
WHERE hi.end_time_ IS NOT NULL
GROUP BY pd.key_
ORDER BY pd.key_;
```

### Gate Rejection Rate
```sql
SELECT v.name_ AS gate_variable,
       COUNT(CASE WHEN v.text_ = 'false' THEN 1 END) AS rejections,
       COUNT(*) AS total,
       ROUND(100.0 * COUNT(CASE WHEN v.text_ = 'false' THEN 1 END) / COUNT(*), 1) AS rejection_pct
FROM act_hi_varinst v
WHERE v.name_ LIKE '%Approved'
GROUP BY v.name_
ORDER BY rejection_pct DESC;
```

### Discipline Bottleneck (Design Phase)
```sql
SELECT pd.key_ AS discipline,
       AVG(EXTRACT(EPOCH FROM (hi.end_time_ - hi.start_time_))/86400) AS avg_days
FROM act_hi_procinst hi
JOIN act_re_procdef pd ON hi.proc_def_id_ = pd.id_
WHERE pd.key_ IN ('design-architecture', 'design-structural', 'fire-safety',
  'design-door-process', 'access-control', 'electrical', 'hvac',
  'design-sprinkler', 'design-transport', 'design-plumbing')
  AND hi.end_time_ IS NOT NULL
GROUP BY pd.key_
ORDER BY avg_days DESC;
```

---

## 7. Dashboard Recommendations

### Executive Dashboard
- Total active building projects (master instances)
- Projects per phase (bar chart)
- Phase gate pass/fail ratio
- Overdue escalations count
- Average phase duration vs. target

### Operations Dashboard
- Active maintenance tasks
- Warranty claims (open/resolved)
- Access requests pending
- Upcoming inspections (next 90 days)
- Energy consumption trend

### Project Manager Dashboard
- Current phase and progress
- Discipline completion status (Phase A/B)
- Open tasks per discipline
- Clash count from last validation
- Budget estimate vs. actual
- Days remaining to phase deadline
