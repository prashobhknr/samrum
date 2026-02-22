# Phase 5 Plan - Testing & Go-Live

**Project:** Doorman  
**Phase:** 5 of 5 (Final Phase)  
**Duration:** 4 weeks  
**Status:** 📋 READY TO START  
**Prerequisites:** ✅ Phase 1-4 Complete

## Overview

Phase 5 focuses on comprehensive testing, security hardening, performance validation, and production deployment. This is the final phase before going live with the Doorman system.

## Phase 5 Objectives

1. **User Acceptance Testing (UAT)** - Validate system meets business requirements
2. **Performance Testing** - Ensure system handles production load
3. **Security Audit & Hardening** - OWASP compliance, penetration testing ready
4. **Production Deployment** - Infrastructure setup, monitoring, disaster recovery
5. **Go-Live Execution** - Data migration, cutover, user training

## Timeline & Milestones

### Week 1: UAT Preparation & Execution
**Goal:** Confirm system meets business requirements with actual users

#### Tasks
1. **UAT Environment Setup** (Day 1)
   - Clone Phase 3 backend API to UAT server
   - Deploy Phase 4 frontend to UAT
   - Configure test database (copy of production schema)
   - Set up Keycloak/LDAP UAT instance

2. **UAT Test Plan Creation** (Days 1-2)
   - Happy path: 4 personas × 5 workflows = 20 scenarios
   - Error paths: 15 error scenarios (network, validation, auth)
   - Edge cases: 10 edge cases (concurrent access, boundary conditions)
   - **Total: 45 test cases**

3. **Test Data Preparation** (Days 2-3)
   - Load 100+ sample doors (different types, classes, statuses)
   - Configure 4 test groups (locksmiths, supervisors, maintenance, admin)
   - Create 8 test users (2 per group)
   - Set up Camunda processes with real-like data

4. **UAT Execution** (Days 3-5)
   - Run 45 test cases with 4 actual users
   - Document pass/fail results
   - Capture bugs (severity: critical/high/medium/low)
   - Record performance metrics
   - Gather user feedback

5. **Bug Fixes & Regression Testing** (Daily)
   - Fix critical/high bugs same day
   - Regression test fixes
   - Update UAT results

### Week 2: Performance & Security Testing

#### Performance Testing (Days 1-2)
**Goal:** Validate system handles production load

**Scenarios:**
1. **Load Test: Concurrent Users**
   - Ramp up: 10 → 50 → 100 → 500 users over 30 minutes
   - Steady state: 500 concurrent users for 15 minutes
   - Ramp down: 500 → 0 users
   - **Target:** <500ms response time, <1% errors

2. **Stress Test: Peak Load**
   - 1000 concurrent users
   - Find breaking point
   - Test error recovery

3. **Endurance Test: Extended Run**
   - 100 concurrent users for 4 hours
   - Monitor memory leaks
   - Check database performance

4. **Soak Test: Data Volume**
   - Test with 10,000+ doors
   - Test with 1+ year of audit logs
   - Measure query performance

**Tools:** k6, Apache JMeter, or Artillery  
**Baseline Metrics:**
- API response time: <500ms (p99)
- Database query time: <100ms (p99)
- Frontend load time: <2s (3G network)
- Error rate: <0.1%
- CPU utilization: <70%
- Memory: <2GB on single instance

#### Security Testing (Days 2-5)

**Security Audit Checklist (OWASP Top 10):**

1. **Injection Attacks**
   - SQL injection (test all inputs with SQL payloads)
   - NoSQL injection (if applicable)
   - Command injection

2. **Authentication & Authorization**
   - Test session hijacking
   - Test token expiration
   - Test multi-group permission merging
   - Test scope-based filtering (ALL/OWN/ASSIGNED)

3. **Sensitive Data Exposure**
   - Check HTTPS everywhere
   - Verify CSP headers
   - Check for hardcoded secrets
   - Audit log contains no passwords

4. **XML External Entities (XXE)**
   - If parsing XML, test XXE payloads

5. **Broken Access Control**
   - Test horizontal privilege escalation (user sees own doors only)
   - Test vertical privilege escalation (locksmith → supervisor)
   - Test task permission rules enforcement

6. **Security Misconfiguration**
   - Review Docker image vulnerabilities
   - Check API default configs
   - Test CORS policy

7. **XSS Prevention**
   - Test stored XSS (form submission)
   - Test reflected XSS (URL parameters)
   - Verify input sanitization

8. **CSRF Protection**
   - Verify CSRF tokens on state-changing requests
   - Test form submission from external site

9. **Using Components with Known Vulnerabilities**
   - Run `npm audit` on all packages
   - Update vulnerable dependencies
   - Document any acceptable risks

10. **Insufficient Logging & Monitoring**
    - Verify audit trail captures all changes
    - Ensure sensitive actions logged
    - Check error logs don't expose stack traces to users

**Security Testing Tools:**
- OWASP ZAP (automated scanning)
- Burp Suite Community (manual testing)
- npm audit (dependency scanning)
- Snyk (vulnerability monitoring)

**Security Sign-Off:** All critical/high issues fixed, medium/low documented with mitigation

### Week 3: Production Deployment Preparation

#### Infrastructure Setup (Days 1-3)

**Database Migration**
1. Export current test data from local PostgreSQL
2. Set up production PostgreSQL (RDS or managed service)
3. Run all migrations (001, 002, 003)
4. Validate data integrity
5. Set up automated backups (daily + hourly)
6. Configure point-in-time recovery

**Backend Deployment**
1. Build Docker image for Phase 3 backend
2. Push to container registry (Docker Hub, ECR, or similar)
3. Deploy to Kubernetes or Docker Swarm
4. Configure health checks
5. Set up auto-scaling (min 2, max 10 instances)
6. Configure load balancer
7. Set up API rate limiting (100 req/s per user)

**Frontend Deployment**
1. Build Docker image for Phase 4 frontend
2. Push to container registry
3. Deploy to CDN or frontend hosting (Vercel, Netlify, or K8s)
4. Configure domain/SSL
5. Set up caching (static assets: 1 month, HTML: 5 minutes)

**Monitoring & Alerting** (Days 2-3)
1. Application Performance Monitoring (APM)
   - Set up New Relic, Datadog, or CloudWatch
   - Monitor API response times, error rates, throughput
   - Track database performance metrics

2. Infrastructure Monitoring
   - CPU, memory, disk usage
   - Network latency
   - Container health

3. Log Aggregation
   - Centralized logging (ELK stack, CloudWatch, Splunk)
   - Application logs
   - Audit logs
   - Error logs

4. Alerting Rules
   - Critical: Response time > 1s, error rate > 1%, database down
   - Warning: Response time > 500ms, error rate > 0.5%
   - Info: Deployments, configuration changes

#### Disaster Recovery Planning (Days 3-4)

**Backup Strategy**
1. Database backups every 1 hour (7-day retention)
2. Daily snapshots (30-day retention)
3. Test restore procedures weekly
4. Document RTO/RPO: 1 hour / 15 minutes

**Failover Planning**
1. Multi-region deployment (if applicable)
2. Database replication/clustering
3. Load balancer failover
4. DNS failover configuration

**Runbooks**
1. Database failure recovery
2. API server crash recovery
3. Frontend deployment rollback
4. Authentication system failure
5. Network partition recovery

#### Documentation (Day 4)

1. **Deployment Guide**
   - Prerequisites
   - Step-by-step deployment commands
   - Rollback procedures
   - Troubleshooting guide

2. **Operations Runbook**
   - Daily health checks
   - Common issues and solutions
   - Escalation procedures
   - Contact information

3. **Architecture Documentation**
   - System diagram (updated)
   - Component overview
   - Data flow diagram
   - Security architecture

4. **User Documentation**
   - Quick start guide
   - Feature overview
   - FAQ
   - Support contact info

### Week 4: Go-Live & Stabilization

#### Pre-Go-Live (Days 1-2)

1. **Final Validation**
   - Re-run critical UAT test cases
   - Performance test on prod-like environment
   - Security review sign-off
   - Data migration validation

2. **User Training**
   - Train 4 user groups on assigned features
   - Conduct dry runs
   - Distribute documentation
   - Set up help desk support

3. **Cutover Planning**
   - Decide on cutover approach (big bang or phased)
   - Create detailed cutover schedule
   - Assign roles (database lead, app lead, comms)
   - Prepare rollback plan

4. **Communication**
   - Notify stakeholders of go-live date/time
   - Send system access credentials to users
   - Confirm user readiness

#### Go-Live Day (Day 3)

**Cutover Window:** Saturday 02:00-06:00 (4-hour window, low traffic)

1. **00:00 - Pre-flight Check**
   - Verify all systems operational
   - Confirm backups recent
   - Notify teams

2. **02:00 - Begin Cutover**
   - Stop old system (legacy Samrum)
   - Snapshot current database
   - Run final data validation

3. **02:30 - Deploy New System**
   - Deploy Phase 3 backend
   - Deploy Phase 4 frontend
   - Verify all health checks pass
   - Run smoke tests

4. **03:00 - Data Validation**
   - Verify all 5000+ doors migrated
   - Check permission rules applied
   - Validate audit trail intact

5. **03:30 - Open to Users**
   - Enable Keycloak/LDAP authentication
   - Verify user login
   - Run first transaction
   - Monitor error logs

6. **04:00 - Stabilization**
   - Monitor performance metrics
   - Check error rates
   - Verify all integrations working
   - Address immediate issues

7. **06:00 - Post-Cutover Review**
   - Compare metrics to baseline
   - Document any issues
   - Plan post-go-live activities
   - Celebrate! 🎉

#### Post-Go-Live Monitoring (Days 4-7)

**Week 1 After Go-Live**

1. **Intensive Monitoring**
   - 24/7 on-call support team
   - Monitor all key metrics
   - Quick response to issues
   - User feedback channel

2. **Bug Fixes**
   - Any critical bugs fixed within 1 hour
   - High bugs within 4 hours
   - Hot patches deployed as needed

3. **Performance Tuning**
   - Optimize slow queries
   - Adjust caching strategies
   - Fine-tune auto-scaling
   - Review logs for warnings

4. **User Support**
   - Monitor help desk tickets
   - Conduct user calls if needed
   - Update documentation
   - Address training gaps

5. **Stabilization Goals**
   - Zero critical bugs
   - <0.1% error rate
   - <500ms p99 response time
   - User satisfaction >4/5

## Success Criteria

### UAT Sign-Off
- ✅ 45/45 test cases passed (or critical issues fixed)
- ✅ 4 user groups confirm system meets requirements
- ✅ Performance acceptable to users
- ✅ No data loss or corruption

### Performance Baseline
- ✅ <500ms p99 response time (target: <200ms)
- ✅ <0.5% error rate under 500 concurrent users
- ✅ 4-hour soak test with <70% CPU, <2GB memory

### Security Sign-Off
- ✅ OWASP Top 10 checklist completed
- ✅ All critical/high vulnerabilities fixed
- ✅ Security audit report approved
- ✅ Third-party penetration test passed (optional but recommended)

### Go-Live Execution
- ✅ System available within cutover window
- ✅ All 5000+ doors migrated and accessible
- ✅ Permission rules enforced correctly
- ✅ Audit trail intact and queryable
- ✅ User authentication working
- ✅ First transactions completed successfully

### Post-Go-Live Stabilization
- ✅ Zero critical bugs in first week
- ✅ <0.1% error rate for 7 days
- ✅ User feedback positive
- ✅ Support tickets <5/day by day 3

## Risk Mitigation

### Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Data migration issues | Medium | Critical | Test migration 3x before go-live, validate all doors |
| Performance degradation | Medium | High | Load test to 2x expected capacity, optimize DB queries |
| Authentication system down | Low | Critical | Test Keycloak/LDAP failover, have backup auth method |
| Users can't find features | Medium | High | Conduct user training, in-app help, support team on standby |
| Third-party API failures | Low | High | API rate limiting configured, graceful degradation |
| Database corruption | Low | Critical | Automated backups, point-in-time recovery tested |

## Resources Required

### Team
- **Project Lead:** 1 (coordination, communication)
- **QA Engineers:** 2 (UAT, test case execution)
- **Performance Engineer:** 1 (load testing, optimization)
- **Security Engineer:** 1 (security testing, hardening)
- **DevOps/SRE:** 1-2 (infrastructure, deployment, monitoring)
- **Backend Engineers:** 1-2 (bug fixes, optimization)
- **Frontend Engineers:** 1 (bug fixes, optimization)
- **Business Users:** 4-8 (UAT participants)

### Tools
- Testing: k6, JMeter, Postman, Jest
- Security: OWASP ZAP, Burp Suite, npm audit
- Monitoring: New Relic, Datadog, CloudWatch, ELK
- Deployment: Docker, Kubernetes/Docker Swarm, Terraform
- Communication: Slack, email, shared dashboard

### Infrastructure
- UAT environment (mirrors production)
- Performance testing environment (isolated)
- Production environment (3+ instances)
- Database (RDS or managed PostgreSQL)
- Monitoring/logging infrastructure
- Backup storage (S3 or equivalent)

## Success Outcome

**Phase 5 Complete When:**

1. ✅ UAT: All test cases passed, users approved system
2. ✅ Performance: Baseline metrics achieved, load test passed
3. ✅ Security: OWASP audit complete, issues resolved
4. ✅ Go-Live: System operational, doors accessible, transactions flowing
5. ✅ Stabilization: System stable, users productive, support low volume

**End Result:** Doorman system live, replacing legacy Samrum, all 5000+ doors operational, users trained, monitoring in place.

## Post-Go-Live Activities (Beyond Phase 5)

1. **Knowledge Transfer** - Document lessons learned
2. **Optimization** - Continue performance tuning
3. **Feature Enhancements** - Gather user feedback for Phase 2 features
4. **Monitoring & Alerting** - Continuous improvement
5. **Disaster Recovery Drills** - Test failover procedures quarterly

---

**Next Steps:** 
1. Review this plan with stakeholders
2. Assign team members to roles
3. Set up UAT and production environments
4. Week 1: Begin UAT preparation
