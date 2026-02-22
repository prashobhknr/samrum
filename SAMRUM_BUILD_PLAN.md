# Samrum Admin UI - Build Plan

## Design System
- **Colors:** #1e2a3a (header), #f59e0b (orange accent), #f8fafc (bg), #0ea5e9 (blue)
- **Layout:** Dark top nav + left tree sidebar + main content + right detail panel
- **Style:** Modern, clean, professional — inspired by Samrum PDF wireframes

## Phases

### Phase 1 — Foundation (Tailwind + Shared Components)
- tailwind.config.js — Samrum color tokens
- components/SamrumLayout.tsx — App shell (header + sidebar + content)
- components/Header.tsx — Top nav with SAMRUM logo + Logga ut
- components/TreeNav.tsx — Expandable tree with folder/file icons
- components/DataGrid.tsx — Table with toolbar + sort + checkboxes
- components/DetailPanel.tsx — Right panel with breadcrumbs + form

### Phase 2 — Admin Dashboard
- pages/admin/index.tsx — Stats cards + quick links

### Phase 3 — Classifications (simplest CRUD)
- pages/admin/classifications.tsx — Full CRUD, styled

### Phase 4 — Object Types
- pages/admin/object-types.tsx — Tree + grid + detail
- pages/admin/object-types/[id].tsx — Object type detail with module table

### Phase 5 — Modules + Folders
- pages/admin/modules.tsx — Tree + detail panel
- pages/admin/module-folders.tsx — Folder hierarchy

### Phase 6 — Relationships
- pages/admin/relationships.tsx — Grid + detail

### Phase 7 — Login + Project Selection
- pages/login.tsx — Samrum-style login
- pages/select-project.tsx — Project picker

## Notify via WhatsApp after each phase ✅
