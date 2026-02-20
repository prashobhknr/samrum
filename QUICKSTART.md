# ⚡ QUICKSTART - Get Running in 5 Minutes

## 1️⃣ Check Prerequisites
```bash
node --version      # Must be 18+
docker --version    # Must be 20.10+
```

## 2️⃣ Start Services
```bash
cd /Users/prashobh/.openclaw/workspace/doorman
docker-compose up -d
```

Wait 2-3 minutes for services to be healthy:
```bash
docker-compose logs postgres  # Watch for "database system is ready"
```

## 3️⃣ Test API
```bash
curl http://localhost:3000/health
# Response: { "status": "ok", "timestamp": "..." }

echo "✅ Backend is running!"
```

## 4️⃣ Access Admin Panel
```
Browser: http://localhost:5050
Username: admin@doorman.local
Password: admin
```

Connect to database:
- Server: postgres
- Username: doorman_user  
- Password: doorman_pass

## 5️⃣ Run Migrations (if needed)
```bash
cd backend
npm install
npm run migrate
npm run seed
```

## ✅ You're Done!

**What's running:**
- 🐘 PostgreSQL database (port 5432)
- 📊 pgAdmin admin panel (port 5050)
- 🚀 Express API (port 3000)

**Next:**
- Read: `/Users/prashobh/.openclaw/workspace/doorman/README.md`
- Develop: `/Users/prashobh/.openclaw/workspace/doorman/DEVELOPMENT.md`
- Contribute: `/Users/prashobh/.openclaw/workspace/doorman/AGENT.md`

---

**Questions?** See TROUBLESHOOTING section in DEVELOPMENT.md
