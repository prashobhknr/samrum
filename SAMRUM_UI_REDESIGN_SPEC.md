# Samrum Admin UI Redesign Specification

## Design Language

### Colors
- **Header background:** `#1a1a2e` (dark charcoal/navy)
- **Header text:** `#ffffff` (white)
- **Primary accent:** `#e67e22` (orange/amber) - buttons, links, highlights
- **Secondary accent:** `#3498db` (blue) - table headers, selected items
- **Background:** `#f5f5f5` (light gray)
- **Card/Panel background:** `#ffffff`
- **Border:** `#ddd`
- **Text primary:** `#333`
- **Text secondary:** `#666`
- **Success:** `#27ae60`
- **Warning:** `#f39c12`
- **Error:** `#e74c3c`

### Typography
- **Font family:** Inter, system-ui, sans-serif
- **Logo:** "SAMRUM" in uppercase, bold, white
- **Headings:** Bold, dark
- **Body:** Regular weight

### Layout
- **3-column layout:**
  - Left sidebar (250px): Tree navigation
  - Center content (flexible): Main data grid/forms
  - Right sidebar (300px): Details panel, version info, actions

### Components

#### Header Bar
```
┌─────────────────────────────────────────────────────────────────┐
│ SAMRUM                                              [Logga ut]  │
└─────────────────────────────────────────────────────────────────┘
```
- Dark background (#1a1a2e)
- Logo left-aligned
- "Logga ut" button top-right (orange)

#### Tree Navigation (Left Sidebar)
- Yellow folder icons for expandable nodes
- Document icons for leaf nodes
- `+` / `-` expand/collapse indicators
- Selected item highlighted in blue
- Section headers in bold

#### Data Grid
- Toolbar with action buttons (Skapa ny, Radera, Ändra, Exportera, Importera, Kolumner)
- Sortable column headers with dropdown arrows
- Checkbox column for row selection
- "Visa" link column for detail view
- Pagination at bottom

#### Detail Panel (Right Sidebar)
- Breadcrumb navigation
- Form fields (read-only with edit mode)
- Action buttons (Radera, Ändra)
- Version history section
- Related items section

#### Buttons
- Primary: Orange background, white text
- Secondary: Gray background, dark text
- Danger: Red background, white text
- All buttons: Rounded corners (6px), padding 8px 16px

#### Forms
- Label above input
- Input fields: white background, gray border, rounded corners
- Required fields marked with asterisk
- Error messages in red below field

---

## Pages to Implement

### 1. Login Page (`/login`)
**URL:** `http://localhost:3001/login`

**Layout:**
- Dark header with SAMRUM logo
- Centered login form
- Fields: Användarnamn, Lösenord
- Button: "Logga in"

### 2. Project Selection (`/select-project`)
**URL:** `http://localhost:3001/select-project`

**Layout:**
- Header: SAMRUM
- Heading: "Välj projekt"
- Link: "✖ Avbryt" (top-right)
- Table: Projekt | Beskrivning
- Sortable by Projekt

### 3. User Start Page (`/start`)
**URL:** `http://localhost:3001/start`

**3-column layout:**
- **Left:** Moduler tree (expandable folders)
- **Center:** Information panel (content area)
- **Right:** Användare list with "Visa" links

### 4. Module Page - Object Administration (`/module/[moduleId]`)
**URL:** `http://localhost:3001/module/[id]`

**3-column layout:**
- **Left:** "Visa som lista" tree navigation
- **Center:** Data grid with toolbar (Skapa ny, Radera, Gruppvis ändring, Utskrifter, Exportera, Importera, Kolumner)
- **Right:** Modulbeskrivning, Versioner, Generella utskrifter

### 5. User Administration (`/admin/users`)
**URL:** `http://localhost:3001/admin/users`

**Tabs:**
1. Användarinformation (username, email, change password)
2. Roller (role checkboxes)
3. Projekttillgång (project access checkboxes)

**Right sidebar:** User list with pagination

### 6. Database Administration (`/admin/database`)
**URL:** `http://localhost:3001/admin/database`

**Tree navigation:**
- Projektdatabaser
- Moduler
- Objekttyper
- Klassifikationer
- Import/Export

**Detail panel:** Shows selected item details

### 7. Object Types Administration (`/admin/object-types/[id]`)
**URL:** `http://localhost:3001/admin/object-types/[id]`

**Detail panel fields:**
- AdministrationsId
- Namn, Singular
- Namn, plural
- Klassificering
- Id är räknare
- Rubrik för Id
- Beskrivning
- Är verkligt objekt
- Existerar endast med förälder

**Table:** Module associations (Modul, Huvudobjekt för modul, Ändringsbar, Kan skapas)

### 8. Modules Administration (`/admin/modules/[id]`)
**URL:** `http://localhost:3001/admin/modules/[id]`

**Detail panel fields:**
- Modulnamn
- Beskrivning
- Tillåt ofullständiga versioner (Ja/Nej)

### 9. Import Objects (`/module/[id]/import`)
**Modal dialog:**
- File path input
- "Bläddra..." button
- "Avbryt" / "Importera" buttons

### 10. Export Objects (`/module/[id]/export`)
**Dropdown menu:**
- Excel-Dörrar artikellista
- Excelexport, valda kolumner

---

## Database Tables (Already Loaded)

```sql
samrum_storage_types      -- Storage type definitions
samrum_data_types         -- Data type definitions  
samrum_classifications    -- Object classifications
samrum_object_types       -- 1,400 object types
samrum_module_folders     -- Module folder hierarchy
samrum_modules            -- 271 modules
samrum_relationships      -- 4,259 relationships
samrum_module_object_types -- Module-object type associations
samrum_module_relationships -- Module relationship configurations
```

---

## API Endpoints (Already in demo-server.mjs)

```
GET    /api/samrum/storage-types
GET    /api/samrum/data-types
GET    /api/samrum/classifications
POST   /api/samrum/classifications
PUT    /api/samrum/classifications/:id
DELETE /api/samrum/classifications/:id

GET    /api/samrum/object-types (with search, pagination)
GET    /api/samrum/object-types/:id
POST   /api/samrum/object-types
PUT    /api/samrum/object-types/:id
DELETE /api/samrum/object-types/:id

GET    /api/samrum/relationships
GET    /api/samrum/relationships/:id
POST   /api/samrum/relationships
PUT    /api/samrum/relationships/:id
DELETE /api/samrum/relationships/:id

GET    /api/samrum/module-folders
GET    /api/samrum/modules
GET    /api/samrum/modules/:id
POST   /api/samrum/modules
PUT    /api/samrum/modules/:id
DELETE /api/samrum/modules/:id
```

---

## Implementation Tasks

1. **Create shared layout components:**
   - `components/AdminLayout.tsx` - 3-column layout with header
   - `components/Header.tsx` - SAMRUM header with logout button
   - `components/TreeNav.tsx` - Expandable tree navigation
   - `components/DataGrid.tsx` - Sortable data table with toolbar
   - `components/DetailPanel.tsx` - Right sidebar detail view

2. **Create page components:**
   - `pages/login.tsx`
   - `pages/select-project.tsx`
   - `pages/start.tsx`
   - `pages/module/[id].tsx`
   - `pages/admin/users.tsx`
   - `pages/admin/database.tsx`
   - `pages/admin/object-types/[id].tsx` (enhance existing)
   - `pages/admin/modules/[id].tsx` (enhance existing)

3. **Update styling:**
   - Update TailwindCSS config with Samrum colors
   - Create reusable button components
   - Create form field components

4. **Add export/import functionality:**
   - Excel export (xlsx library)
   - IFC import dialog

---

## Swedish UI Labels

```
Logga in = Log in
Logga ut = Log out
Användarnamn = Username
Lösenord = Password
Välj projekt = Select project
Avbryt = Cancel
Projekt = Project
Beskrivning = Description
Moduler = Modules
Användare = Users
Visa = Show/View
Ny användare = New user
Administrera användare = Administer users
Användarinformation = User information
Epost = Email
Ändra = Change
Byt lösenord = Change password
Roller = Roles
Projekttillgång = Project access
Spara = Save
Radera = Delete
Skapa ny = Create new
Gruppvis ändring = Batch edit
Utskrifter = Printouts
Exportera = Export
Importera = Import
Kolumner = Columns
Modulnamn = Module name
Beskrivning = Description
Tillåt ofullständiga versioner = Allow incomplete versions
Ja = Yes
Nej = No
Objekttyper = Object types
Klassifikationer = Classifications
Projektdatabaser = Project databases
```
