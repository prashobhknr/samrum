# Missing Frontend Requirements & Use Cases (Doorman vs. Samrum)

This document outlines the functional gaps and provides detailed implementation steps for AI agents to follow.

---

## 1. 🏗️ IFC & BIM Integration [Status: ✅ Completed]
The legacy system emphasized deep integration with BIM workflows, specifically IFC (Industry Foundation Classes) syncing.

### Use Case: Sync with Architectural Model
- **Actor**: Architect / Technical Designer
- **Description**: Import an IFC file to sync door and lock data with the OMS.
- **Implementation Steps for AI Agent**:
    1. **Backend**: 
       - Install `web-ifc` or a lightweight IFC-to-JSON parser.
       - Create `POST /api/admin/import-export/ifc/parse`: Accepts `.ifc` file, extracts `IfcDoor` properties, and returns a JSON preview.
       - Create `POST /api/admin/import-export/ifc/sync`: Accepts the preview + mapping configuration. It should perform `INSERT/UPDATE` on `object_instances` and `attribute_values`.
    2. **Frontend**:
       - In `frontend/pages/admin/import-export.tsx`, add an "Upload IFC" section.
       - Implement an `IFCMappingModal` that lists IFC properties (e.g., `GlobalId`, `Name`, `FireRating`) and allows mapping them to existing OMS `attribute_id`s.
       - Add a "Sync" button that calls the backend and shows a summary of created/updated records.

---

## 2. ⚡ Advanced Grid & Bulk Operations [Status: ✅ Completed]
The legacy system provided highly flexible grid views and sophisticated group editing capabilities.

### Use Case: Bulk Attribute Update (Group Edit)
- **Actor**: Object Manager
- **Description**: Update common attributes for multiple selected objects at once.
- **Implementation Steps for AI Agent**:
    1. **Backend**:
       - In `backend/demo-server.mjs`, add `PUT /api/objects/instances/bulk-update`.
       - Body expected: `{ ids: number[], attributes: Record<string, any> }`.
       - Logic: Use a transaction to loop through `ids` and perform an UPSERT on `attribute_values` for each attribute provided.
    2. **Frontend**:
       - Update `frontend/components/DataGrid.tsx`: Ensure the `selected` set of IDs is accessible to toolbar actions.
       - Add a "Bulk Edit" action to the `toolbarActions` in `frontend/pages/admin/modules.tsx` (or wherever the grid is used).
       - Create a `BulkEditModal` that uses `DynamicForm.tsx` but initializes all fields as empty. Only fields that the user modifies should be sent to the bulk update endpoint.

### Use Case: Personalized Column Configuration (View Designer)
- **Actor**: Administrator
- **Description**: Choose visible columns and set their order per module.
- **Implementation Steps for AI Agent**:
    1. **Database**: 
       - Add table `user_view_settings`: `user_id`, `module_id`, `column_layout` (JSONB).
    2. **Backend**:
       - Add `GET /api/admin/views/:module_id` and `POST /api/admin/views/:module_id`.
    3. **Frontend**:
       - Create `frontend/pages/admin/view-designer.tsx` to fix the current 404.
       - Implement a drag-and-drop list of attributes for the selected module.
       - Update `DataGrid.tsx` to accept a `columnOrder` and `visibleKeys` prop, and fetch these from the backend on load.

---

## 3. 📋 Comprehensive Reporting (Utskrifter) [Status: ✅ Completed]
### Use Case: Specification Sheet Generation
- **Actor**: Contractor / Locksmith
- **Description**: Generate a formatted PDF spec sheet for doors.
- **Implementation Steps for AI Agent**:
    1. **Backend**:
       - Install `pdfkit` or `puppeteer`.
       - Create `GET /api/admin/reports/spec-sheet`: Query params `ids` (comma separated list).
       - fetch instance data + attributes, generate a clean PDF layout matching the legacy "Utskrifter" style.
    2. **Frontend**:
       - In `DataGrid.tsx`, add a "Print/Report" icon to the toolbar.
       - When clicked, trigger `window.open(`${API_URL}/api/admin/reports/spec-sheet?ids=${selectedIds.join(',')}`)`.

---

## 4. 🧹 Data Consistency & Mapping [Status: ✅ Completed]
Identified issues where UI labels don't match data or types.

### Implementation Steps for AI Agent:
1. **Frontend Audit**: 
   - Review `frontend/components/DataGrid.tsx` rendering logic. 
   - Currently, it relies on `pivot` logic in `backend/demo-server.mjs` (line 579+). 
   - **Fix**: The pivot logic should check the `attribute_type` from `object_attributes` and return formatted values (e.g., proper Dates, "Yes/No" for booleans).
2. **Schema Alignment**: 
   - Update `002_seed_door_objects.sql` ensuring that `attribute_name` codes (like `fire_class`) are unique and descriptive.
   - Fix the "D-001" seed data in `002_seed_door_objects.sql` where maintenance dates currently contain model names.

---

## 5. 🔍 Data Validation & Quality Dashboard [Status: ⏳ Missing]
The legacy system had dedicated screens (A006/A007) for identifying and resolving data quality issues.

### Use Case: Analyze Incomplete Objects (A006)
- **Actor**: Project Manager
- **Description**: A view that lists all objects missing "mandatory" attributes according to their object type definition.
- **Implementation Steps**:
    1. **Backend**: Add `GET /api/admin/analysis/incomplete`: Queries `object_instances` and checks against `object_attributes` where `is_mandatory` is true (needs schema update).
    2. **Frontend**: Create `frontend/pages/admin/analysis.tsx`. Show a list of objects with a red "Missing Attributes" badge.

### Use Case: Validate Objects against Standards (A007)
- **Actor**: Quality Auditor
- **Description**: Run validation rules (e.g., "If Door type is Fire, then Fire Rating must not be empty").
- **Implementation Steps**:
    1. **Backend**: Create a rule engine or a set of hardcoded SQL checks for common standards.
    2. **Frontend**: Integrate these results into the Analysis dashboard.

---

## 6. 🌲 Hierarchical Navigation & UX [Status: ⏳ Missing]
Improving the information architecture to match Samrum's nested module structure.

### Use Case: Nested Sidebar Navigation
- **Actor**: All Users
- **Description**: Support folders and sub-folders for modules in the navigation sidebar.
- **Implementation Steps**:
    1. **Frontend**: Update `SideNav` component to recursively render `module_folders`.

---

## 7. ⚙️ Advanced Schema Administration [Status: ⏳ Missing]
### Use Case: Attribute Constraint Management (B012)
- **Actor**: Database Administrator
- **Description**: Set attributes as mandatory, read-only, or define list values (dropdowns).
- **Implementation Steps**:
    1. **Database**: Add `is_mandatory`, `is_readonly`, `validation_regex` to `object_attributes`.
    2. **Frontend**: Update `object-types/[id].tsx` to allow editing these new constraints.

---

## 8. 🔐 Role-Based Access Control (RBAC) [Status: ⏳ Missing]
### Use Case: Role-Specific Dashboards
- **Actor**: Architect, Locksmith, Admin
- **Description**: Different users see different sets of modules and have different permissions (Read/Write).
- **Implementation Steps**:
    1. **Database**: Update `users` table to include a `role` column.
    2. **Backend**: Implement middleware to check roles on protected endpoints.
    3. **Frontend**: Filter sidebar and actions based on the logged-in user's role.
