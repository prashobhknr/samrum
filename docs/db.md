# Database Architecture

## Overview

Doorman uses a **single PostgreSQL database** (`doorman_db`) that contains two logical layers:

1. **OMS Layer** — New object management system. Stores live instance data and drives dynamic forms.
2. **Samrum Import Layer** — Read-only schema imported from the legacy SQL Server system. Configuration data only (no instance rows).

The legacy Samrum system ran on **SQL Server** with a two-tier database architecture:
- One `SAMRUM_Master` database for users, roles, and project registry
- One per-project database per project (e.g. `SAMRUM_KvVallgossen`, `SAMRUM_VasterasLasarett`) each containing instance data + a copy of the full structure schema

---

## 1. OMS Layer (new)

Tables defined in `database/migrations/001_create_oms_schema.sql` and `003_phase3_task_permission_rules.sql`.

### `object_types`
Defines what kinds of objects exist (e.g. Door, Lock, Wall Type).

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| name | VARCHAR(255) UNIQUE | e.g. "Door", "Lock" |
| description | TEXT | |
| icon_url | VARCHAR(255) | |
| created_at / updated_at | TIMESTAMP | |

**Seeded data:** 5 types — Door (id=1), Lock (id=2), Door Frame (id=3), Door Automation (id=4), Wall Type (id=5).

---

### `object_attributes`
Defines the attributes (fields) for each object type. Adding a row here adds a new field — no code changes needed.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| object_type_id | INT → object_types | |
| attribute_name | VARCHAR(255) | e.g. "door_id", "fire_class" |
| attribute_type | VARCHAR(50) | `text`, `number`, `date`, `enum`, `reference`, `boolean` |
| is_required | BOOLEAN | |
| is_key | BOOLEAN | Key/identifier attribute |
| enum_values | JSONB | Array of allowed values, e.g. `["mortise","rim","electronic"]` |
| default_value | TEXT | |
| help_text | TEXT | |
| placeholder | TEXT | |
| reference_object_type_id | INT → object_types | For `reference` type attributes |

**Seeded data:** 60+ attributes for the Door type (door_id, door_name, location_description, fire_class, security_class, lock_type, etc.).

---

### `object_relationships`
Defines structural relationships between object types.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| parent_object_type_id | INT → object_types | |
| child_object_type_id | INT → object_types | |
| relationship_name | VARCHAR(255) | e.g. "contains", "mounted_in" |
| cardinality | VARCHAR(50) | `1:1`, `1:N`, `N:M` |
| parent_level | INT | Hierarchy depth (1–4) |

**Seeded data (4 relationships):**
- Door → Lock (1:N, "contains")
- Door → Door Frame (1:1, "has")
- Door → Door Automation (0:1, "has")
- Door → Wall Type (N:1, "mounted_in")

> **Gap:** No `object_instance_relationships` table exists yet. These relationships are structural only — no instance rows link e.g. a specific Door to a specific Lock. The old system had `OR_ObjectRelationship` for this.

---

### `object_instances`
Actual object rows (e.g. a specific door "D-101").

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| object_type_id | INT → object_types | |
| external_id | VARCHAR(255) | Legacy door_id from Samrum |
| name | VARCHAR(255) | |
| parent_instance_id | INT → object_instances | Single-parent hierarchy (self-ref) |

**Seeded data:** ~400+ Door instances imported from the Samrum demo project.

---

### `attribute_values`
EAV table — stores all attribute values for all instances.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| object_instance_id | INT → object_instances | |
| object_attribute_id | INT → object_attributes | |
| value | TEXT | All values stored as text |
| updated_at | TIMESTAMP | |

UNIQUE constraint: `(object_instance_id, object_attribute_id)`.

---

### `permissions`
Group-level access control at the attribute level.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| user_group_id | VARCHAR(255) | e.g. "locksmiths", "supervisors", "security_admin" |
| object_type_id | INT → object_types | |
| object_attribute_id | INT → object_attributes | |
| operation | VARCHAR(50) | `READ`, `WRITE`, `DELETE` |
| scope | VARCHAR(50) | `ALL`, `OWN`, `ASSIGNED` |

---

### `task_permission_rules`
Per-task, per-group field visibility rules (drives dynamic forms).

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| process_definition_key | VARCHAR(255) | Camunda process key e.g. "door-unlock" |
| task_name | VARCHAR(255) | Camunda task name |
| user_group_id | VARCHAR(255) | |
| visible_attributes | JSONB | Array of attribute IDs |
| editable_attributes | JSONB | |
| required_attributes | JSONB | |
| conditional_visibility | JSONB | |
| field_order | JSONB | |
| dropdown_scope | VARCHAR(50) | `ALL`, `OWN`, `ASSIGNED` |
| form_header_text | TEXT | |
| form_footer_text | TEXT | |
| requires_approval | BOOLEAN | |
| approval_group_id | VARCHAR(255) | |
| task_timeout_minutes | INT | Default 30 |

UNIQUE: `(process_definition_key, task_name, user_group_id)`.

---

### `task_object_mappings`
Links Camunda process tasks to OMS object types.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| process_definition_key | VARCHAR(255) | |
| task_name | VARCHAR(255) | |
| object_type_id | INT → object_types | |
| process_variable_name | VARCHAR(255) | Camunda variable name |

---

### `attribute_validators`
Per-attribute validation rules (applied server-side and in forms).

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| object_attribute_id | INT → object_attributes | |
| validator_type | VARCHAR(100) | `required`, `min_length`, `pattern`, `enum`, etc. |
| validator_params | JSONB | Rule parameters |
| error_message | TEXT | |
| applies_to_groups | JSONB | null = all groups |

---

### `field_dependencies`
Conditional show/hide/require logic between fields (e.g. lock_type=electronic → show battery_status).

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| process_definition_key | VARCHAR(255) | |
| source_attribute_id | INT → object_attributes | The controlling field |
| source_value | VARCHAR(255) | The trigger value |
| dependent_attribute_id | INT → object_attributes | The affected field |
| dependency_type | VARCHAR(50) | `SHOW`, `HIDE`, `REQUIRE`, `DISABLE`, `ENABLE` |
| applies_to_groups | JSONB | |

---

### `audit_log`
Immutable change history.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| user_id | VARCHAR(255) | |
| action | VARCHAR(100) | e.g. `ATTRIBUTE_UPDATED`, `FORM_VIEWED` |
| object_instance_id | INT | |
| object_type_id | INT | |
| attribute_id | INT | |
| task_id | VARCHAR(255) | |
| old_value / new_value | TEXT | |
| details | JSONB | |
| timestamp | TIMESTAMP | |

---

## 2. Samrum Import Layer (legacy config, read-only)

Tables defined in `database/migrations/002_samrum_schema.sql`, `003_samrum_projects.sql`, `004_samrum_users.sql`.

These tables mirror the legacy SQL Server structure database and contain imported configuration data. There are **no live instance rows** — all instance data lives in the OMS layer above.

### `samrum_storage_types`
5 primitive storage types: String, Numeric, Blob, Date, Boolean.

| Column | Type |
|---|---|
| id | SERIAL PK |
| name | VARCHAR(50) |

---

### `samrum_data_types`
16 UI-level data types built on storage types.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| name | VARCHAR(100) | e.g. "Text", "Nummer", "Datum", "Ja/Nej", "PDF-dokument" |
| storage_type_id | INT → samrum_storage_types | |
| allow_user_create | BOOLEAN | |
| is_complex | BOOLEAN | Complex types can add sub-attributes |
| is_entity | BOOLEAN | Entity types have their own identity |

---

### `samrum_classifications`
100+ category labels for grouping object types (e.g. "Dörrar mått", "Passagekontroll", "Larm och säkerhet dörrar").

| Column | Type |
|---|---|
| id | SERIAL PK |
| name | VARCHAR(255) |
| description | TEXT |

---

### `samrum_object_types`
~1400 object type definitions imported from the old system. Each type is either a "real" entity or a lookup/enum type.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| data_type_id | INT → samrum_data_types | |
| name_singular / name_plural | VARCHAR(255) | Swedish names |
| default_attr_caption | VARCHAR(255) | |
| description | TEXT | |
| is_abstract | BOOLEAN | Abstract types cannot have instances |
| classification_id | INT → samrum_classifications | |
| database_id | VARCHAR(100) | Legacy SQL Server table name |
| exists_only_in_parent_scope | BOOLEAN | Can only exist as child |

---

### `samrum_relationships`
~4259 relationship definitions between samrum_object_types. In the old system, **scalar attributes were modeled as relationships** from an entity type to a primitive/data type (e.g. "Door → Text" = a text field on Door). True structural relationships connect entity types.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| caption_singular / caption_plural | VARCHAR(255) | Swedish field labels |
| from_type_id | INT → samrum_object_types | |
| to_type_id | INT → samrum_object_types | |
| min_relations / max_relations | INT | Cardinality constraints (0/1/NULL=unlimited) |
| sort_order | INT | Display ordering |
| allow_in_lists | BOOLEAN | Show in grid/list views |
| show_in_lists_default | BOOLEAN | Show by default (vs hidden/selectable) |
| is_requirement | BOOLEAN | Required in locked versions |
| sys_caption | VARCHAR(255) | System/API name |
| guid | UUID | Legacy GUID from SQL Server |

---

### `samrum_module_folders`
114 hierarchical folders for organizing modules.

| Column | Type |
|---|---|
| id | SERIAL PK |
| parent_id | INT → samrum_module_folders (self-ref) |
| name / description | VARCHAR(255) / TEXT |

---

### `samrum_modules`
~271 module definitions. A module is a named view/form template that shows specific object types and their relationships.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| name | VARCHAR(255) | e.g. "Tillträdesobjekt arkitekt" |
| description | TEXT | |
| allow_incomplete_versions | BOOLEAN | |
| folder_id | INT → samrum_module_folders | |
| **oms_object_type_id** | INT → object_types | **Added directly to DB** (not in any migration). Links module to OMS type for instance fetching. Module 269 → OMS type 1 (Door). |

> **Note:** `oms_object_type_id` column is present in the running DB but missing from migration files. It needs to be added as a proper `ALTER TABLE` migration.

---

### `samrum_module_object_types`
~2808 assignments: which samrum_object_types appear in which module.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| module_id | INT → samrum_modules | |
| object_type_id | INT → samrum_object_types | Note: FK to samrum_object_types, NOT to oms object_types |
| allow_edit | BOOLEAN | |
| show_as_root | BOOLEAN | Whether this type is the root/primary type in the module |
| allow_insert | BOOLEAN | |
| is_main_object_type | BOOLEAN | |

---

### `samrum_module_relationships`
~13,649 assignments: which relationships (fields) are shown in each module. This is the primary column definition list for a module.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| module_id | INT → samrum_modules | |
| relationship_id | INT → samrum_relationships | |
| allow_edit | BOOLEAN | |
| read_only | BOOLEAN | |

---

### `samrum_projects`
21 projects seeded from the PDF wireframes (mirrors legacy `PDB_ProjectDatabase` in SQL Server master DB).

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| name | VARCHAR(255) | e.g. "Västerås lasarett (gemensam, ny)" |
| database_name | VARCHAR(255) | Original SQL Server DB name |
| description | TEXT | |
| is_active | BOOLEAN | |
| created_by | VARCHAR(100) | |

---

### `samrum_project_modules`
Junction table linking projects to modules. All modules are currently assigned to all projects (cross-join seed).

| Column | Type |
|---|---|
| id | SERIAL PK |
| project_id | INT → samrum_projects |
| module_id | INT → samrum_modules |
| is_enabled | BOOLEAN |

UNIQUE: `(project_id, module_id)`.

---

### `samrum_users`
Application users.

| Column | Type |
|---|---|
| id | SERIAL PK |
| username | VARCHAR(255) UNIQUE |
| email | VARCHAR(255) |
| password_hash | VARCHAR(255) |
| created_at / updated_at | TIMESTAMPTZ |

Seeded: `admin`, `lars.haggstrom`, `mats.arkitekt`, `security.guard`.

---

### `samrum_user_roles`
Role assignments per user.

| Column | Type | Notes |
|---|---|---|
| user_id | INT → samrum_users | |
| role | VARCHAR(100) | e.g. "global_security_admin" |

PK: `(user_id, role)`.

---

### `samrum_user_projects`
Which projects a user can access.

| Column | Type |
|---|---|
| user_id | INT → samrum_users |
| project_id | INT → samrum_projects |

PK: `(user_id, project_id)`.

---

## 3. Legacy SQL Server Architecture (old system reference)

The old Samrum system used SQL Server with **three tiers**:

### 3a. Master Database (`SAMRUM_Master`)
Shared across all projects. Contains:

| Old Table | Description | New Equivalent |
|---|---|---|
| `US_User` | Users | `samrum_users` |
| `UR_UserRole` | Role definitions | `samrum_user_roles` |
| `RFU_RoleForUser` | User→Role assignments | `samrum_user_roles` |
| `PDB_ProjectDatabase` | Project registry | `samrum_projects` |
| `UPDB_UserInDatabase` | User→Project access | `samrum_user_projects` |
| `VAV_ValidApplicationVersion` | App version whitelist | not migrated |
| `DV_DatabaseVersion` | Master DB version | not migrated |

---

### 3b. Structure Database (shared template)
Deployed to every project. Contains the full object type schema:

| Old Table | Row Count | Description | New Equivalent |
|---|---|---|---|
| `OT_ObjectType` | ~1400 | Object type definitions | `samrum_object_types` |
| `DT_DataType` | 16 | Data types (Text, Datum, Ja/Nej, etc.) | `samrum_data_types` |
| `ST_StorageType` | 5 | Storage primitives | `samrum_storage_types` |
| `OTC_ObjectTypeClassification` | ~100 | Category groups | `samrum_classifications` |
| `OTR_ObjectTypeRelationship` | ~4259 | Field/relationship definitions | `samrum_relationships` |
| `OTRD_ObjectTypeRelationshipDependency` | ~1307 | Conditional field deps | `field_dependencies` (partial) |
| `OTID_ObjectTypeIdentity` | 7 | Identity sequence overrides | not migrated |
| `PMO_ProjectModule` | ~271 | Module definitions | `samrum_modules` |
| `PMF_ProjectModuleFolder` | ~114 | Module folders | `samrum_module_folders` |
| `OTM_ProjectModuleObjectType` | ~2808 | Module→Type assignments | `samrum_module_object_types` |
| `OTRM_ProjectModuleObjectTypeRelationship` | ~13649 | Module→Field assignments | `samrum_module_relationships` |
| `RVW_ReportView` | — | Report view definitions | not migrated |
| `RVF_ReportViewFragment` | — | Report fragments | not migrated |
| `EXD_ExportImportDefinition` et al | — | Export/Import framework | B014 (partial) |
| `ODB_ObjectDatabase` | — | Database registry | not migrated |
| `RDT_RelationshipDependencyType` | — | Dependency type enum | not migrated |
| `UDTR_UniqueConstraintForObjectTypeRelationship` | — | Uniqueness rules | not migrated |

---

### 3c. Per-Project Database
One per project, contains instance data:

| Old Table | Description | New Equivalent |
|---|---|---|
| `OB_ObjectInstance` | Object instances | `object_instances` |
| `OR_ObjectRelationship` | Instance-level relationship links | **MISSING** (see gaps) |
| `OTROB_ObjectTypeRelationshipForObjectInstance` | Which relationships an instance participates in | not migrated |
| `OIP_ObjectInstanceSelectionParameter` | Instance filter parameters | not migrated |
| `MVS_ModuleVersion` | Module version snapshots | not migrated |
| `ME_ModifyEvent` | Change events | `audit_log` (partial) |
| `MEM_ModifyEventMemo` | Change memos | not migrated |
| `PM_Memo` | Object notes/memos | not migrated |
| `FL_File` | File attachments | not migrated |
| `OBFL_ObjectInstanceFile` | Object→File links | not migrated |
| `UPM_UserPrivilegesForModule` | Per-user, per-module privileges | `permissions` (group-based only) |
| `SS_SystemSettings` | System settings | not migrated |
| `RDE_ReportDesign` et al | Reporting system | not migrated |
| `EXID_ExportImportObjectId` | Export/Import IDs | B014 (partial) |
| `SP_SelectionParameter` / `RSP_ReportSelectionParameter` | Report selection params | not migrated |
| `UST_UserSetting` / `USTV_UserSettingValue` | Per-user settings | not migrated |

> Note: In the old system, each `OB_ObjectInstance` row did not store attribute values in a separate table. Attribute values were stored as **columns** on per-object-type instance tables generated dynamically by the application. The new OMS uses an EAV approach via `attribute_values`.

---

## 4. Gaps in New Schema vs Old

The following features exist in the old Samrum system but are not yet implemented in the new schema:

### Critical (blocks instance data completeness)

| Gap | Old System | Impact |
|---|---|---|
| **Instance-level relationships** | `OR_ObjectRelationship` table linked specific Door instances to specific Lock instances | Cannot show Lock/Wall data for a specific door; column groups show null |
| **`samrum_modules.oms_object_type_id` migration** | Added directly to DB, no migration file | Would be lost on DB rebuild; needs a proper `ALTER TABLE` migration |

### Important (blocks full feature parity)

| Gap | Old System | Impact |
|---|---|---|
| **Per-user module privileges** | `UPM_UserPrivilegesForModule` (individual user level) | New system only has group-level permissions; can't grant one user access to specific module |
| **Module versioning** | `MVS_ModuleVersion` + `ME_ModifyEvent` | No version history for module data snapshots |
| **File attachments** | `FL_File` + `OBFL_ObjectInstanceFile` | Cannot attach images/PDFs to object instances |
| **Object memos** | `PM_Memo` | No free-text notes on instances |
| **Relationship dependencies** | `OTRD_ObjectTypeRelationshipDependency` (1307 entries) | Conditional show/hide of fields based on other field values. Partially replaced by `field_dependencies` but OTR-level dependencies not fully mapped |

### OTR Rich Metadata (partial gap)

The old `OTR_ObjectTypeRelationship` had these columns not present in `samrum_relationships`:

| Old Column | Meaning | Missing in New |
|---|---|---|
| `OTR_ConstraintMinNumericValue` / `OTR_ConstraintMaxNumericValue` | Numeric range validation | Yes (use `attribute_validators` in OMS) |
| `OTR_ConstraintMaxNrOfChars` | Max length | Yes |
| `OTR_ConstraintRegularExpression` | Regex pattern | Yes |
| `OTR_NrOfDecimals` | Decimal precision | Yes |
| `OTR_CopyAttribute` | Whether to copy value on duplication | Yes |
| `OTR_ExistsOnlyInParentScope` | Only exists as child | Partially (object_instances.parent_instance_id) |
| `OTR_RequiredInLockedVersion` | Required when version is locked | Yes |
| `OTR_Guid` | Stable cross-DB identifier | Yes |
| `OTR_RealSort` | Physical sort order override | Yes |

### Not Migrated (lower priority)

| Feature | Old Tables |
|---|---|
| Reporting system | `RDE_ReportDesign`, `RD_ReportDefinition`, `RDP_*`, `RVW_ReportView`, `RVF_ReportViewFragment`, `RM_ReportRenderMode` |
| Export/Import framework | `EXD_ExportImportDefinition`, `EXOT_*`, `EXOTR_*`, `EXP_*`, `EIE_*`, etc. |
| System settings | `SS_SystemSettings` |
| User settings | `UST_UserSetting`, `USTV_UserSettingValue` |
| App version gating | `VAV_ValidApplicationVersion`, `VSAV_ValidStructureApplicationVersion` |
| Object type identity sequences | `OTID_ObjectTypeIdentity` |
| Selection parameters | `SP_SelectionParameter`, `RSP_ReportSelectionParameter`, `OIP_ObjectInstanceSelectionParameter` |

---

## 5. Key Design Differences

| Aspect | Old Samrum | New Doorman OMS |
|---|---|---|
| **Attribute storage** | Dynamic columns per object type table (denormalized) | EAV via `attribute_values` (normalized) |
| **Attribute definition** | `OTR_ObjectTypeRelationship` (attributes = relationships to data types) | `object_attributes` (dedicated table) |
| **Permissions** | Per-user per-module (`UPM_UserPrivilegesForModule`) | Group-based (`permissions` + `task_permission_rules`) |
| **Relationships** | Two levels: type-level (OTR) + instance-level (OR) | Type-level only (`object_relationships`); no instance-level yet |
| **Versioning** | Full module version snapshots (`MVS_ModuleVersion`) | Audit log only |
| **Form generation** | Static form definitions per module/role | Dynamic from `task_permission_rules` + `field_dependencies` |
| **Multi-DB** | One SQL Server DB per project | Single PostgreSQL DB for all projects |
| **Change tracking** | `ME_ModifyEvent` / `MEM_ModifyEventMemo` | `audit_log` (JSONB details) |
