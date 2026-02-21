# Samrum Admin - Implementation Plan

## 🎯 Goal
Expand Doorman's admin UI to support full Samrum-compatible object management system.
All data lives in PostgreSQL (`doorman_db`). Frontend is Next.js on port 3001. Backend API on port 3000.

## 📊 Samrum Schema → PostgreSQL Mapping

### Core Tables to Create in doorman_db

```sql
-- Data Types (ST = StorageType, DT = DataType)
samrum_storage_types  (id, name)            -- String, Numeric, Blob, Date, Boolean
samrum_data_types     (id, name, storage_type_id, allow_user_create, is_complex, is_entity)

-- Object Type Classification
samrum_classifications (id, name, description)

-- Object Types  
samrum_object_types (
  id, data_type_id, name_singular, name_plural, 
  default_attr_caption, description, is_abstract, 
  classification_id, database_id, exists_only_in_parent_scope
)

-- Module Folder (phase grouping)
samrum_module_folders (id, parent_id, name, description)

-- Project Modules (work phases/modules)
samrum_modules (
  id, name, description, allow_incomplete_versions, folder_id
)

-- Object Type Relationships (= Attributes)
samrum_relationships (
  id, caption_singular, caption_plural, 
  from_type_id, to_type_id,
  min_relations, max_relations, 
  min_error_msg, max_error_msg,
  max_related_by, nr_decimals, sort,
  copy_attribute, exists_in_parent_scope, 
  allow_in_lists, show_in_lists_default,
  is_requirement, sys_caption, guid
)

-- Module → ObjectType assignments
samrum_module_object_types (
  id, object_type_id, module_id, allow_edit, 
  show_as_root, allow_insert, is_main_object_type
)

-- Module → Relationship assignments  
samrum_module_relationships (
  id, relationship_id, module_id, allow_edit, read_only
)

-- Object Instances (actual data rows)
samrum_objects (
  id, guid, string_value, numeric_value, date_value, 
  boolean_value, display_value, object_type_id, 
  title_storage_type_id, is_predefined
)

-- Object Relations (links between instances)
samrum_object_relations (
  id, from_object_id, to_object_id, relationship_id
)

-- Users
samrum_users (id, username, password_hash, full_name, email, created_at)

-- Roles
samrum_roles (id, sys_name, friendly_name, description, is_derived)

-- Role → User assignments
samrum_user_roles (user_id, role_id)

-- Project Databases
samrum_project_databases (id, name, database_name, description)

-- User → Database access
samrum_user_databases (id, user_id, database_id)

-- Relationship Dependency Types
samrum_dependency_types (id, name)

-- Relationship Dependencies (conditional attributes)
samrum_relationship_deps (id, relationship_id, conditional_relationship_id, dependency_type_id)
```

## 🗂️ Admin Use Cases (UI Pages)

### Phase 1: Core Structure Admin
1. **Object Types Admin** (`/admin/object-types`)
   - List all object types with search/filter
   - Create new object type (name, data type, classification, abstract flag)
   - Edit existing object type
   - Delete (with dependency check)
   - Show relationship count per type

2. **Classifications Admin** (`/admin/classifications`)
   - List all OTC classifications
   - CRUD operations

3. **Module Folders Admin** (`/admin/module-folders`)
   - Hierarchical folder structure (tree view)
   - CRUD operations

4. **Modules Admin** (`/admin/modules`)
   - List modules with folder grouping
   - Create/edit module (name, description, folder)
   - Assign object types to module (OTM)
   - Assign relationships to module (OTRM)

### Phase 2: Relationships/Attributes Admin
5. **Relationships Admin** (`/admin/relationships`)
   - List all OTR relationships
   - Create/edit relationship (from type → to type, constraints)
   - Set min/max cardinality
   - Set sort order, list visibility

### Phase 3: User & Access Admin
6. **Users Admin** (`/admin/users`)
   - List users
   - Create/edit user
   - Assign roles to user
   - Assign database access

7. **Roles Admin** (`/admin/roles`)
   - List/CRUD roles

8. **Database Access Admin** (`/admin/databases`)
   - List project databases
   - Manage user database assignments

### Phase 4: Data Browsing
9. **Object Browser** (`/admin/objects`)
   - Browse objects by type
   - View object relations
   - Filter by module

## 📦 Data Import from CSV

Import from `/Users/prashobh/Downloads/Visakh/Database Excel/`:
- `ST_StorageType.csv` → samrum_storage_types
- `DT_DataType.csv` → samrum_data_types  
- `OTC_ObjectTypeClassification.csv` → samrum_classifications
- `OT_ObjectType.csv` → samrum_object_types
- `PMF_ProjectModuleFolder.csv` → samrum_module_folders
- `PMO_ProjectModule.csv` → samrum_modules
- `OTR_ObjectTypeRelationship.csv` → samrum_relationships
- `OTM_ProjectModuleObjectType.csv` → samrum_module_object_types
- `OTRM_ProjectModuleObjectTypeRelationship.csv` → samrum_module_relationships

## 🏗️ Architecture

**Backend** (`/doorman/backend/src/`):
- New router: `src/routes/samrum-admin.ts`
- Services: `src/services/samrumAdminService.ts`
- DB script: `database/migrations/002_samrum_schema.sql`
- Import script: `scripts/import-samrum-data.js`

**Frontend** (`/doorman/frontend/pages/admin/`):
- `object-types.tsx` - Object types list + CRUD
- `object-types/[id].tsx` - Object type detail/edit
- `classifications.tsx` - Classifications CRUD
- `module-folders.tsx` - Module folders tree
- `modules.tsx` - Modules list + CRUD  
- `modules/[id].tsx` - Module detail with OTM/OTRM assignments
- `relationships.tsx` - Relationships list + CRUD
- `users.tsx` - Users list + CRUD
- `roles.tsx` - Roles CRUD
- Layout: update `components/Layout.tsx` with admin nav section

## 🔄 Implementation Order (Step by Step)

1. ✅ Create PostgreSQL schema (002_samrum_schema.sql)
2. ✅ Import CSV data (import-samrum-data.js)
3. ✅ Create backend API routes (samrum-admin.ts)
4. ✅ Classifications page (simplest CRUD)
5. ✅ Object Types page (with data type + classification)
6. ✅ Module Folders page (tree)
7. ✅ Modules page (with OTM assignments)
8. ✅ Relationships page (complex - from/to types, constraints)
9. ✅ Users page
10. ✅ Roles page
11. ✅ Object browser page

## 🧪 Testing Protocol

After each page:
1. Check `http://localhost:3001/admin/<page>`  
2. Verify list loads with correct data
3. Test create form
4. Test edit form
5. Test delete (with confirmation)
6. Verify data persists after refresh
