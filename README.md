# 🚪 Doorman - Camunda Door Module System

**Modern process orchestration platform for door/lock management with dynamic permission-based forms.**

Built with Camunda 7, Node.js, Express, PostgreSQL, and React.

---

## 📋 Quick Overview

Doorman is a complete refactor of the legacy Samrum door management system. It replaces SAS-based scripting with **BPMN process orchestration**, **dynamic form generation**, and **fine-grained permission controls**.

**Key Features:**
- ✅ BPMN process orchestration (Camunda 7)
- ✅ Object Management System (OMS) - door, lock, frame, automation objects
- ✅ Dynamic form generation (database-driven, zero code changes)
- ✅ Multi-group permission merging (UNION visible, INTERSECTION editable)
- ✅ Field dependencies & cascading updates
- ✅ Complete audit trail (all actions logged)
- ✅ Three-tier UI architecture (Admin, Users, Object Managers)
- ✅ Production-ready (scaling, performance, security)

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- PostgreSQL 14+ (optional if using Docker)

### Run Locally

```bash
# 1. Clone/navigate to doorman
cd /Users/prashobh/.openclaw/workspace/doorman

# 2. Start services (PostgreSQL, pgAdmin)
docker-compose up -d

# 3. Run migrations & seeds
npm run migrate
npm run seed

# 4. Start backend API
npm run dev

# 5. Test API
curl http://localhost:3000/api/objects/types
```

Backend running at: **http://localhost:3000**  
pgAdmin running at: **http://localhost:5050** (admin@doorman.local / admin)

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **[AGENT.md](./AGENT.md)** | How to contribute (agents & developers) |
| **[DEVELOPMENT.md](./DEVELOPMENT.md)** | Local development setup |
| **[ARCHITECTURE_IMPL.md](./ARCHITECTURE_IMPL.md)** | Design → Code mapping |
| **[docs/SETUP.md](./docs/SETUP.md)** | Production deployment |
| **[docs/API.md](./docs/API.md)** | API reference |
| **[docs/DATABASE.md](./docs/DATABASE.md)** | Database schema |
| **[docs/TESTING.md](./docs/TESTING.md)** | Running tests |

---

## 🏗️ Project Structure

```
doorman/
├── README.md (you are here)
├── AGENT.md (development workflow)
├── DEVELOPMENT.md (local setup)
├── ARCHITECTURE_IMPL.md (design notes)
├── docker-compose.yml
├── .env.example
├── package.json
│
├── database/
│   ├── migrations/
│   │   ├── 001_create_oms_schema.sql
│   │   └── 002_seed_door_objects.sql
│   └── seeds/
│       └── sample-data.sql
│
├── src/
│   ├── index.ts (Express server)
│   ├── config/ (database, env)
│   ├── routes/ (API endpoints)
│   ├── services/ (OMS, permissions, forms)
│   ├── controllers/ (request handlers)
│   ├── middleware/ (auth, logging, errors)
│   ├── types/ (TypeScript interfaces)
│   └── utils/ (helpers)
│
├── tests/
│   ├── unit/ (service tests)
│   └── integration/ (API tests)
│
├── docs/
│   ├── SETUP.md (production)
│   ├── API.md (endpoints)
│   ├── DATABASE.md (schema)
│   ├── TESTING.md (test suite)
│   └── TROUBLESHOOTING.md (common issues)
│
└── .github/
    └── workflows/
        └── test.yml (CI/CD)
```

---

## 🔗 Related Design Documents

All architecture & design in `/Users/prashobh/.openclaw/workspace/`:

1. **ARCHITECTURE.md** - System design (3-tier UI, data model, permission model)
2. **DOOR_MODULE_DESIGN.md** - Door object hierarchy, 60+ attributes, relationships
3. **IMPLEMENTATION_ROADMAP.md** - 5-phase plan, 16 weeks, 135 person-days
4. **DYNAMIC_FORM_GENERATION.md** - Form engine algorithm, database-driven
5. **ENHANCED_USE_CASES.md** - 14 scenarios (emergency, bulk ops, conflicts, etc.)
6. **ENHANCEMENT_SUMMARY.md** - What's included, innovations

**Start with:** ARCHITECTURE.md (executive summary)

---

## 📊 Current Phase

**Phase 1: Foundation (Weeks 1-2)** ← YOU ARE HERE

- ✅ Project structure created
- ✅ PostgreSQL OMS schema (11 tables)
- ✅ Door objects & attributes seeded
- ✅ Express API with OMS CRUD endpoints
- ✅ Docker infrastructure
- ✅ Comprehensive documentation
- ✅ Unit & integration tests
- ✅ CI/CD pipeline (GitHub Actions)

**Next:** Phase 2 (Data Migration) - Extract legacy door data, transform, migrate to OMS

---

## 🛠️ Development

### Common Tasks

**Add a new object type:**
```sql
INSERT INTO object_types (name, description) 
VALUES ('Fire Door', 'Door with fire safety features');
```

**Add attribute to object type:**
```sql
INSERT INTO object_attributes (object_type_id, attribute_name, attribute_type, is_required)
VALUES (1, 'fire_rating', 'text', true);
```

**Create permission rule for task:**
```sql
INSERT INTO task_permission_rules 
  (process_definition_key, task_name, user_group_id, visible_attributes, editable_attributes)
VALUES 
  ('door-unlock', 'Inspect Door', 'locksmiths', '[1,2,12,100]', '[2,12,100]');
```

See **[AGENT.md](./AGENT.md)** for detailed developer workflows.

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

Target: **>80% code coverage**

---

## 🚢 Deployment

```bash
# Production build
npm run build

# Start production
npm start

# Or use Docker
docker-compose -f docker-compose.prod.yml up
```

See **[docs/SETUP.md](./docs/SETUP.md)** for detailed production setup.

---

## 📈 API Examples

### Create Door Object Type
```bash
POST /api/objects/types
{
  "name": "Door",
  "description": "Physical door in building"
}
```

### Create Door Instance
```bash
POST /api/objects/instances
{
  "object_type_id": 1,
  "external_id": "D-001",
  "name": "Main Entrance Door"
}
```

### Set Door Attributes
```bash
POST /api/objects/instances/1/attributes
[
  {"attribute_id": 1, "value": "D-001"},
  {"attribute_id": 2, "value": "mortise"},
  {"attribute_id": 3, "value": "Building A, 2nd floor"}
]
```

Full API reference: **[docs/API.md](./docs/API.md)**

---

## 🔐 Architecture (Simplified)

```
┌─────────────────────────────────┐
│   Camunda Process Engine        │ ← BPMN processes, task management
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│   Express.js Backend API        │ ← OMS CRUD, Forms, Permissions
│   /api/objects/*                │
│   /api/forms/*                  │
│   /api/permissions/*            │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│   PostgreSQL Database           │ ← 11 OMS tables
│   (object_types, attributes...  │
│   permissions, audit_log)       │
└─────────────────────────────────┘
```

Full architecture: **[ARCHITECTURE_IMPL.md](./ARCHITECTURE_IMPL.md)**

---

## 🤝 Contributing

See **[AGENT.md](./AGENT.md)** for:
- Development workflow
- Git branching strategy
- Code review checklist
- Testing requirements
- How to add new features

---

## 📞 Questions?

- **Setup issues?** → See [DEVELOPMENT.md](./DEVELOPMENT.md)
- **API questions?** → See [docs/API.md](./docs/API.md)
- **Database questions?** → See [docs/DATABASE.md](./docs/DATABASE.md)
- **Architecture questions?** → See [ARCHITECTURE_IMPL.md](./ARCHITECTURE_IMPL.md)
- **Design details?** → See main design docs in parent directory

---

## 📋 Status

**Phase 1 Status:** ✅ COMPLETE (Phase 1)
- OMS schema created
- Door objects defined
- API endpoints functional
- Tests passing
- Documentation complete

**Phase 2:** Data Migration (starting)
**Phase 3:** Dynamic Form Generation
**Phase 4:** UI Development (Tier 2 & 3)
**Phase 5:** Testing & Go-Live

---

## 📄 License & Info

**Project:** Doorman (Samrum Door Module Refactor)  
**Created:** 2026-02-20  
**By:** Prashobh + Opus Architecture  
**Status:** Phase 1 Foundation Complete

**Next Steps:**
1. Review DEVELOPMENT.md for local setup
2. Review AGENT.md for contribution workflow
3. Phase 2: Data migration from legacy Samrum

---

**Happy coding! 🚪**

Last updated: 2026-02-20
