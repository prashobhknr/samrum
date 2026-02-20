# 🚀 GitHub Setup - Push Your Repo

**Git repo is ready locally.** Now push to GitHub!

---

## Option 1: Push to New GitHub Repo (Easiest)

### Step 1: Create repo on GitHub
1. Go to https://github.com/new
2. Repository name: `doorman`
3. Description: `Camunda Door Module - Process Orchestration for Building Access Control`
4. Make it **Public** (or Private if you prefer)
5. **Do NOT** initialize with README, .gitignore, or license (we have them)
6. Click "Create repository"

### Step 2: Get the remote URL
After creation, you'll see:
```
https://github.com/YOUR_USERNAME/doorman.git
```
Copy this URL.

### Step 3: Add remote and push
```bash
cd /Users/prashobh/.openclaw/workspace/doorman

# Add GitHub as remote
git remote add origin https://github.com/YOUR_USERNAME/doorman.git

# Rename branch to 'main' (modern standard)
git branch -M main

# Push to GitHub
git push -u origin main
```

**That's it!** Your repo is now on GitHub. ✅

---

## Option 2: Using GitHub CLI (If Installed)

```bash
cd /Users/prashobh/.openclaw/workspace/doorman

# Create repo on GitHub directly
gh repo create doorman --public --source=. --remote=origin --push

# Done! 🎉
```

---

## Option 3: Use Existing Private Repo

If you have a company GitLab/GitHub:
```bash
cd doorman

git remote add origin https://your-git-server.com/your-org/doorman.git
git branch -M main
git push -u origin main
```

---

## Verify Push Succeeded

```bash
git remote -v
# Should show:
# origin https://github.com/YOUR_USERNAME/doorman.git (fetch)
# origin https://github.com/YOUR_USERNAME/doorman.git (push)

git log --oneline
# Should show your commit
```

---

## After Push: Continue Development

```bash
# Create develop branch for next phase
git checkout -b develop
git push -u origin develop

# Future feature branches
git checkout -b feature/phase-2-migration
# ... make changes ...
git push -u origin feature/phase-2-migration
# ... create PR on GitHub ...
```

---

## GitHub Actions CI/CD (Optional - Phase 2)

Create `.github/workflows/test.yml`:
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci --prefix backend
      - run: npm test --prefix backend
      - run: npm run test:coverage --prefix backend
```

This auto-runs tests on every push! 🎯

---

**Next:** Ready for Phase 2 implementation!
