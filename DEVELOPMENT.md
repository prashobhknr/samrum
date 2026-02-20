# 🔧 DEVELOPMENT.md - Local Development Setup

Complete guide to set up and run Doorman locally for development.

---

## 📋 Prerequisites

Install these before starting:

- **Node.js** 18+ ([nodejs.org](https://nodejs.org))
- **Docker & Docker Compose** ([docker.com](https://docker.com))
- **PostgreSQL** 14+ (optional - use Docker instead)
- **Git** ([git-scm.com](https://git-scm.com))
- **Code Editor** (VSCode recommended)

Verify installations:
```bash
node --version     # Should be v18+
docker --version   # Should be 20.10+
docker-compose --version  # Should be 1.29+
git --version      # Should be 2.30+
```

---

## ⚡ Quick Start (5 Minutes)

### 1. Navigate to Project
```bash
cd /Users/prashobh/.openclaw/workspace/doorman
```

### 2. Copy Environment File
```bash
cp .env.example .env
# No changes needed for local development (defaults work)
```

### 3. Start Docker Services
```bash
docker-compose up -d
```

Wait for health checks to pass (2-3 minutes):
```bash
docker-compose logs postgres  # Watch for "database system is ready"
```

### 4. Run Migrations & Seeds
```bash
# In another terminal
cd backend
npm install
npm run migrate
npm run seed
```

### 5. Start Backend
```bash
npm run dev
```

Server running: **http://localhost:3000**

### 6. Test It
```bash
curl http://localhost:3000/api/objects/types
# Should return JSON list of object types
```

**Done!** Backend is running locally. 🎉

---

## 🐳 Docker Services

### Start All Services
```bash
docker-compose up -d
```

### Check Status
```bash
docker-compose ps

# Expected:
# doorman-postgres   Up (health: healthy)
# doorman-pgadmin    Up
# doorman-backend    Up
```

### View Logs
```bash
docker-compose logs -f postgres     # PostgreSQL logs
docker-compose logs -f pgadmin      # pgAdmin logs
docker-compose logs -f backend      # Backend logs
```

### Stop Services
```bash
docker-compose down        # Stop all, keep data
docker-compose down -v     # Stop all, remove volumes
```

### Restart Services
```bash
docker-compose restart postgres
docker-compose restart backend
```

---

## 🛢️ Database Management

### Connect to PostgreSQL

**Via psql (terminal):**
```bash
psql -h localhost -U doorman_user -d doorman_db
# Password: doorman_pass

# Inside psql:
\dt                    # List tables
\d object_types        # Show table schema
SELECT COUNT(*) FROM object_types;  # Count rows
\q                     # Quit
```

**Via pgAdmin (web):**
1. Open http://localhost:5050
2. Login: admin@doorman.local / admin
3. Register server:
   - Name: Doorman
   - Host: postgres
   - Username: doorman_user
   - Password: doorman_pass

### Run Migrations

```bash
cd backend

# Run all pending migrations
npm run migrate

# Or manually:
psql -U doorman_user -d doorman_db -f ../database/migrations/001_create_oms_schema.sql
psql -U doorman_user -d doorman_db -f ../database/migrations/002_seed_door_objects.sql
```

### Seed Sample Data

```bash
npm run seed

# Or manually:
psql -U doorman_user -d doorman_db -f database/seeds/sample-data.sql
```

### Reset Database (Caution!)

```bash
docker-compose down -v                    # Remove volume
docker-compose up -d postgres             # Recreate empty
npm run migrate && npm run seed            # Re-populate
```

---

## 🚀 Backend Development

### Install Dependencies
```bash
cd backend
npm install
```

### Start Dev Server (with auto-reload)
```bash
npm run dev

# Expected output:
# 🚀 Server running on http://localhost:3000
# 📊 Connected to PostgreSQL
```

### TypeScript Compilation
```bash
npm run build          # Compile to dist/
npm run typecheck      # Type check without emitting

# Fix errors:
npm run lint:fix
```

### Running Tests

```bash
npm test               # Run all tests once
npm run test:watch     # Watch mode (re-run on changes)
npm run test:coverage  # Coverage report
```

### Code Quality

```bash
npm run lint           # Check for style issues
npm run lint:fix       # Auto-fix lint issues
npm run typecheck      # Type check
```

---

## 📝 API Testing

### Using curl

```bash
# Get all object types
curl http://localhost:3000/api/objects/types

# Create new object type
curl -X POST http://localhost:3000/api/objects/types \
  -H "Content-Type: application/json" \
  -d '{"name":"Emergency Door","description":"Fire escape door"}'

# Get object type by ID
curl http://localhost:3000/api/objects/types/1

# Create object instance
curl -X POST http://localhost:3000/api/objects/instances \
  -H "Content-Type: application/json" \
  -d '{"object_type_id":1,"external_id":"D-002","name":"Side Entrance"}'

# Get instances
curl http://localhost:3000/api/objects/instances

# Set attribute value
curl -X POST http://localhost:3000/api/objects/instances/1/attributes \
  -H "Content-Type: application/json" \
  -d '[{"attribute_id":1,"value":"D-001"}]'

# Get attribute values
curl http://localhost:3000/api/objects/instances/1/attributes
```

### Using Postman

1. Import API collection: `docs/Doorman.postman_collection.json`
2. Set environment: 
   - base_url: http://localhost:3000
3. Run requests

### Using VS Code REST Client

Create `test.http`:
```
GET http://localhost:3000/api/objects/types

###
POST http://localhost:3000/api/objects/types
Content-Type: application/json

{
  "name": "Test Object",
  "description": "Test Description"
}
```

Click "Send Request" above each endpoint.

---

## 🐛 Debugging

### Debug in VS Code

1. Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Program",
      "program": "${workspaceFolder}/backend/src/index.ts",
      "preLaunchTask": "tsc: build",
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"]
    }
  ]
}
```

2. Set breakpoints (click line number)
3. Press F5 to start debugging
4. Use Debug Console to inspect variables

### View Logs

```bash
# Backend logs
docker-compose logs backend -f

# Database logs
docker-compose logs postgres -f

# All services
docker-compose logs -f
```

### Common Issues

**"Connection refused" to PostgreSQL:**
```bash
docker-compose ps | grep postgres    # Check if running
docker-compose up -d postgres        # Start if not
docker logs doorman-postgres         # Check for errors
```

**"Port 3000 already in use":**
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port in .env
API_PORT=3001
```

**"Module not found" errors:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**"TypeScript errors":**
```bash
npm run typecheck              # See full errors
npm run lint:fix               # Fix style issues
```

---

## 📚 Project Structure

```
doorman/
├── backend/
│   ├── src/
│   │   ├── index.ts                  # Server entry point
│   │   ├── config/
│   │   │   ├── database.ts          # DB connection
│   │   │   └── env.ts               # Environment vars
│   │   ├── routes/
│   │   │   ├── objects.ts           # /api/objects/* routes
│   │   │   ├── forms.ts             # /api/forms/* routes
│   │   │   └── permissions.ts       # /api/permissions/* routes
│   │   ├── controllers/
│   │   │   └── objectController.ts  # Request handlers
│   │   ├── services/
│   │   │   ├── ObjectService.ts     # OMS logic
│   │   │   ├── FormService.ts       # Form generation
│   │   │   └── PermissionService.ts # Permissions
│   │   ├── middleware/
│   │   │   ├── auth.ts              # Auth middleware
│   │   │   ├── errorHandler.ts      # Error handling
│   │   │   └── logging.ts           # Request logging
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript interfaces
│   │   └── utils/
│   │       └── database.ts          # Database queries
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── ObjectService.test.ts
│   │   │   └── PermissionService.test.ts
│   │   └── integration/
│   │       ├── api.test.ts
│   │       └── database.test.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── database/
│   ├── migrations/
│   │   ├── 001_create_oms_schema.sql
│   │   └── 002_seed_door_objects.sql
│   └── seeds/
│       └── sample-data.sql
├── docs/
│   ├── API.md
│   ├── DATABASE.md
│   ├── SETUP.md
│   └── TESTING.md
├── README.md
├── AGENT.md
├── DEVELOPMENT.md (you are here)
├── ARCHITECTURE_IMPL.md
├── docker-compose.yml
├── .env.example
└── .gitignore
```

---

## 🧪 Writing Tests

### Unit Test Example

```typescript
// tests/unit/ObjectService.test.ts
import { ObjectService } from '../../src/services/ObjectService';
import { db } from '../../src/config/database';

describe('ObjectService', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.close();
  });

  test('createObjectType should insert and return object', async () => {
    const result = await ObjectService.createObjectType({
      name: 'TestObject',
      description: 'Test'
    });

    expect(result).toHaveProperty('id');
    expect(result.name).toBe('TestObject');
  });
});
```

### Run Tests

```bash
npm test                  # Run all
npm test -- ObjectService # Run specific
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

---

## 🚀 Before Committing

Checklist:

```bash
# 1. Type check
npm run typecheck

# 2. Lint
npm run lint:fix

# 3. Tests
npm test

# 4. Build
npm run build

# 5. Manual API test
curl http://localhost:3000/api/objects/types

# 6. View changes
git status
git diff

# 7. Commit
git add .
git commit -m "[PHASE-1] feat: your feature description"
```

---

## 📞 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connection refused" PostgreSQL | `docker-compose up -d postgres` |
| "Port 3000 in use" | Change API_PORT in .env |
| "npm: command not found" | Install Node.js from nodejs.org |
| "docker: command not found" | Install Docker Desktop |
| "TypeScript errors" | `npm run typecheck` to see full errors |
| "Tests failing" | Check .env DATABASE_URL, run migrations |
| "Module not found" | `rm -rf node_modules && npm install` |

---

## 📚 Next Steps

1. **Read [README.md](./README.md)** - Project overview
2. **Read [AGENT.md](./AGENT.md)** - How to contribute
3. **Check [docs/API.md](./docs/API.md)** - API reference
4. **Run `npm run dev`** - Start developing!

---

**Happy developing! 🚀**

Last updated: 2026-02-20
