# 01 - PLCS Building Lifecycle Mapping

> How ISO 10303-239 (PLCS), AEC Model v2.2, IEC 81346, and ISO 55000 map to
> Doorman's Object Management System (OMS) and Swedish building phases.

---

## 1. Standards Overview

| Standard | Scope | Doorman Relevance |
|----------|-------|-------------------|
| **ISO 10303-239 (PLCS)** | Product lifecycle support -- through-life data exchange | Core information model for object types, attributes, and lifecycle states |
| **AEC Model v2.2** | PLCS-based SysML model for AEC (Testbed 3) | Direct class-to-table mapping; breakdowns, items, properties, change management |
| **IEC 81346** | Reference designation / structuring principles | Object identification and breakdown hierarchy (=, +, -, %) |
| **ISO/IEC 81355** | Classification of documents | Document management within Doorman modules |
| **ISO 55000** | Asset management framework | Three-ring governance: Organisation, Information, Processes |
| **ISO 19650** | BIM information management | PIM/AIM lifecycle, handover between project and operations |
| **CoClass** | Swedish classification (successor to BSAB) | Classification hierarchies for object types |
| **KKS** | Power plant component designation | Alternative classification source |

---

## 2. Information Model Levels

PLCS defines three information model levels that map directly to building lifecycle phases:

```
PIM-Design (Krav)          PIM-Realized (Losning)       AIM (Forvaltningsmodell)
 Requirements/Specs     --> Design/Constructed data  --> Operations/FM data
 "What we need"             "What we built"              "What we manage"

 Doorman: object_types       Doorman: object_instances    Doorman: attribute_values
 + object_attributes         + attribute_values           + audit_log (history)
 (schema definition)         (populated data)             (living operational data)
```

### PIM (Project Information Model) -- Delivery Phase

- **PIM-Design**: Functional and spatial requirements. Object type definitions, attribute schemas, validation rules.
- **PIM-Realized**: As-built data. Populated instances with verified attribute values after construction.
- Managed by project team (Projektledare, Projektorer, Entreprenorer).

### AIM (Asset Information Model) -- Operations Phase

- Operational data enriched over time. Maintenance history, sensor readings, condition assessments.
- Managed by FM team (Forvaltare, Teknikverksamhet).
- **Handover** (Overlamning) is the critical transition point between PIM and AIM.

---

## 3. Swedish Building Phases --> PLCS States

| Phase (Swedish) | English | PLCS Lifecycle State | Doorman `lifecycle_phase` | Key Activities |
|-----------------|---------|---------------------|--------------------------|----------------|
| **Utredning** | Investigation | `AS_REQUIRED` | `investigation` | Space program, feasibility study, risk analysis |
| **Forstudie** | Pre-study | `AS_REQUIRED` | `pre_study` | Concept design, cost estimates |
| **Projektering** | Design | `AS_DESIGNED` | `design` | Detailed design across all disciplines |
| **Upphandling** | Procurement | `AS_DESIGNED` | `procurement` | Tender, contract award |
| **Produktion** | Construction | `AS_PLANNED` / `AS_REALIZED` | `production` | Build, install, commission |
| **Overlamning** | Handover | `AS_REALIZED` --> `AS_IS` | `handover` | PIM --> AIM transfer |
| **Forvaltning** | Operations/FM | `AS_IS` | `operations` | Maintenance, drift, repairs |
| **Avveckling** | Decommission | `AS_REMOVED` | `decommission` | Demolition, disposal |

### State Transition Rules

```
investigation --> pre_study --> design --> procurement --> production --> handover --> operations
                                                                                       |
                                                                                       v
                                                                                  decommission
```

Each transition requires a **phase gate approval** (implemented as Camunda exclusive gateway):

- `investigation --> pre_study`: Space program approved
- `pre_study --> design`: Feasibility study approved, budget allocated
- `design --> procurement`: Design documents approved by all disciplines
- `procurement --> production`: Contracts signed
- `production --> handover`: Commissioning protocols signed, OVK approved
- `handover --> operations`: AIM validated, FM team accepts

---

## 4. AEC Model v2.2 Domain Classes --> Doorman Tables

The AEC Model v2.2 (Testbed 3, by Torbjorn Holm / TBHK) defines domain classes that map to Doorman's OMS schema:

### 4.1 Classification Hierarchies

**AEC Model**: `ClassificationClass` --> `ClassificationClassHierarchy` with `ClassificationSource` (Government, Organization).

**Doorman mapping**:

| AEC Class | Doorman Table | Notes |
|-----------|---------------|-------|
| `ClassificationClass` | `samrum_classifications` | ISO 81346, CoClass, KKS |
| `ClassificationSource` | `samrum_classifications.description` | Source authority |
| `ClassificationClassHierarchy` | `object_relationships` (type=classification) | Parent-child classification |

Supported classification standards (from AEC Model slide):
- ISO 81346 (reference designations)
- ISO/IEC 81355 (document classification)
- KKS (power plant systems)
- CoClass (Swedish building classification)

### 4.2 Breakdown Structures

**AEC Model** defines 6 breakdown types, each with its own element hierarchy:

| Breakdown Type | AEC Root Class | ISO 81346 Prefix | Doorman `breakdown_type` | Example |
|---------------|----------------|-------------------|--------------------------|---------|
| **Functional** | `FunctionalBreakdown` --> `FunctionalBreakdownElement` | `=` | `functional` | "Passage control function" |
| **Spatial** | `SpatialBreakdown` --> `SpatialBreakdownElement` | `-` | `spatial` | "Floor 3, Room 301" |
| **Physical** | `PhysicalBreakdown` --> `PhysicalBreakdownElement` | `+` | `physical` | "Door leaf, frame, hardware" |
| **System** | `SystemBreakdown` --> `SystemBreakdownElement` | `%` | `system` | "Fire alarm system" |
| **Network** | `NetworkBreakdown` --> `NetworkElementBreakdownElement` | (network) | `network` | "BACnet segment, IP subnet" |
| **Group** | `GroupBreakdown` --> `GroupBreakdownElement` | (group) | `group` | "Maintenance batch, delivery pallet" |

**Doorman mapping**: All breakdowns use `object_relationships` with the proposed `breakdown_type` column:

```sql
-- Existing table, proposed addition
ALTER TABLE object_relationships
  ADD COLUMN breakdown_type VARCHAR(50)
  CHECK (breakdown_type IN ('functional','spatial','physical','system','network','group'));
```

### 4.3 Item Management

**AEC Model**: `Item` (theoretical specification) --> realized as `PhysicalItem` (real-world object).

| AEC Class | Doorman Table | Notes |
|-----------|---------------|-------|
| `Item` | `object_types` + `object_attributes` | Product specification / catalog item |
| `PhysicalItem` | `object_instances` | Actual installed item with serial number |
| `ItemAssembly` | `object_instances` with parent_instance_id | Assembly hierarchy |
| `PhysicalItemAssembly` | `object_instance_relationships` | Physical component tree |
| `Organization` | (new) or user groups | Supplier, manufacturer |
| `Document` | (new) or module-linked | Drawings, specs, certificates |
| `DigitalFile` | (future) | BIM models, PDFs |
| `GeometryPlacementCarrier` | (future) | IFC, STEP geometry references |

**Key distinction**:
- **Item** = "Assa Abloy Connect lock, model 4545" (specification)
- **PhysicalItem** = "Serial #A12345, installed on Door D.003" (realized instance)

### 4.4 Realization Pattern

The AEC Model's realization pattern (Items --> Physical Elements) maps to Doorman's two-level architecture:

```
Functional Breakdown       Physical Breakdown
    Element         --realizedBy-->    Element
       |                                  |
   specifiedBy                        installedItem
       |                                  |
     Item           --realizedBy-->  PhysicalItem
 (object_type +     (object_instance +
  attributes)        attribute_values)
```

This is already naturally captured in Doorman:
- `object_types` + `object_attributes` = Item specification
- `object_instances` + `attribute_values` = PhysicalItem realization
- `lifecycle_phase` tracks where in the realization journey an instance sits

### 4.5 Properties with Qualifiers

**AEC Model**: `Property` --> `PropertyValueQualifier` enum: `CALCULATED`, `ESTIMATED`, `MEASURED`, `PREDICTED`, `TARGET`.

**Doorman mapping** -- proposed `value_qualifier` column on `attribute_values`:

```sql
ALTER TABLE attribute_values
  ADD COLUMN value_qualifier VARCHAR(20) DEFAULT 'TARGET'
  CHECK (value_qualifier IN ('CALCULATED','ESTIMATED','MEASURED','PREDICTED','TARGET'));
```

This enables tracking how a value was obtained:

| Qualifier | When Used | Example |
|-----------|-----------|---------|
| `TARGET` | Design phase -- required performance | "Fire resistance: EI60" |
| `ESTIMATED` | Pre-study -- rough calculation | "U-value: ~0.18 W/m2K" |
| `CALCULATED` | Design phase -- engineering calc | "Air flow: 150 l/s" |
| `PREDICTED` | Simulation result | "Energy use: 45 kWh/m2" |
| `MEASURED` | Commissioning / operations | "Actual air flow: 148 l/s" |

### 4.6 Change Management

**AEC Model**: `ChangeOrder` --> `ChangeProposal` --> `ChangeNotice` with Problem Reports.

**Doorman mapping**: Change management flows through BPMN processes:

| AEC Class | Doorman Mechanism |
|-----------|-------------------|
| `ProblemReport` | Camunda start event (message or form submission) |
| `ChangeProposal` | User task: propose change with affected attributes |
| `ChangeOrder` | Approval gateway with multi-group consensus |
| `ChangeNotice` | Service task: apply attribute_values updates + audit_log |
| `ChangeHistory` | `audit_log` table (immutable) |

---

## 5. ISO 55000 Asset Management Framework

The Tillgangshantering (Asset Management) framework from TCG defines three concentric rings that map to Doorman's architecture:

### Three-Ring Model

```
+--------------------------------------------------+
| ORGANISATIONSSTYRNING (Organizational Governance) |  ISO 9001
|  +--------------------------------------------+  |
|  | TILLGANGSFORVALTNING (Asset Management)     |  |  ISO 55000
|  |  +--------------------------------------+  |  |
|  |  | INFORMATIONSSTYRNING (Info Mgmt)      |  |  |  ISO 19650
|  |  |                                       |  |  |
|  |  |  PIM (Leveransfas)                    |  |  |
|  |  |       |                               |  |  |
|  |  |       v  Overlamning                   |  |  |
|  |  |                                       |  |  |
|  |  |  AIM (Driftfas)                       |  |  |
|  |  |       ISO/IEC 81346                   |  |  |
|  |  +--------------------------------------+  |  |
|  +--------------------------------------------+  |
+--------------------------------------------------+
```

### Mapping to Doorman Layers

| Ring | ISO | Doorman Layer | Implementation |
|------|-----|---------------|----------------|
| **Informationsstyrning** | ISO 19650, 81346 | OMS schema + data | `object_types`, `object_attributes`, `attribute_values`, `object_relationships` |
| **Tillgangsforvaltning** | ISO 55000 | Permissions + Processes | `permissions`, `task_permission_rules`, BPMN workflows, `audit_log` |
| **Organisationsstyrning** | ISO 9001 | User groups + Governance | User groups, Camunda candidate groups, approval workflows |

### Four Pillars of Asset Management Framework

From the TCG presentation (slide 11):

| Pillar (Swedish) | English | Doorman Implementation |
|-----------------|---------|----------------------|
| **Processer och arbetssatt** | Processes & Methods | Camunda BPMN workflows |
| **Roller och organisering** | Roles & Organization | `permissions.user_group_id`, Camunda candidate groups |
| **Informationsstruktur** | Information Structure | OMS schema (object_types, attributes, relationships) |
| **Systemstod** | System Support | Doorman application itself |

---

## 6. Proposed Schema Additions

Based on the PLCS/AEC mapping analysis, three columns should be added to existing tables:

### 6.1 `lifecycle_phase` on `object_instances`

```sql
ALTER TABLE object_instances
  ADD COLUMN lifecycle_phase VARCHAR(30) DEFAULT 'design'
  CHECK (lifecycle_phase IN (
    'investigation','pre_study','design','procurement',
    'production','handover','operations','decommission'
  ));

CREATE INDEX idx_object_instances_lifecycle ON object_instances(lifecycle_phase);
```

**Purpose**: Track where each object instance sits in the building lifecycle, independently of any running BPMN process. An object can be in `operations` phase even if no process is currently active for it.

### 6.2 `value_qualifier` on `attribute_values`

```sql
ALTER TABLE attribute_values
  ADD COLUMN value_qualifier VARCHAR(20) DEFAULT 'TARGET'
  CHECK (value_qualifier IN ('CALCULATED','ESTIMATED','MEASURED','PREDICTED','TARGET'));
```

**Purpose**: Distinguish between design targets, calculated values, and measured actuals -- critical for PIM-->AIM handover where design values get replaced by as-built measurements.

### 6.3 `breakdown_type` on `object_relationships`

```sql
ALTER TABLE object_relationships
  ADD COLUMN breakdown_type VARCHAR(20)
  CHECK (breakdown_type IN ('functional','spatial','physical','system','network','group'));
```

**Purpose**: A single door can appear in multiple breakdowns simultaneously:
- Functional: "Fire compartment boundary" (=FF01.D003)
- Spatial: "Building A, Floor 3, Room 301" (-A.3.301.D003)
- Physical: "Door leaf + frame + hardware" (+D003.1, +D003.2)
- System: "Access control zone North" (%AC.N.D003)

---

## 7. Lifecycle Phase Transitions in Doorman

### How Phases Interact with Forms and Permissions

```
Phase Gate         | Form Behavior                          | Permission Behavior
-------------------|----------------------------------------|--------------------
investigation      | Only space program fields visible      | Owner + PM groups active
pre_study          | + feasibility fields visible           | + Design lead joins
design             | Full attribute schema visible          | All discipline groups active
procurement        | Design fields read-only, cost editable | + Contractor groups join
production         | Installation fields editable           | Contractor WRITE, Designer READ
handover           | Commissioning checklist fields         | FM groups join, project groups READ
operations         | Maintenance + operational fields       | FM WRITE, project groups removed
decommission       | Disposal fields                        | FM + Owner only
```

### Phase-Aware FormService Behavior

The existing `FormService.generateFormForTask()` algorithm does not need modification. Instead, `task_permission_rules` entries are keyed by `process_definition_key` + `task_name`, and different processes run in different lifecycle phases. The phase gate pattern ensures only phase-appropriate processes are active.

---

## 8. Cross-Reference: Samrum Object Types to PLCS Breakdowns

The 89 OMS object types (from migration 007) map to AEC breakdown structures:

| Breakdown | Example Samrum Types | Count |
|-----------|---------------------|-------|
| **Functional** | Brand- och sakerhetsfunktion, Brandfunktionsprocessen | ~8 |
| **Spatial** | Rum, Coclass Utrymme, Byggnads/lokalbenamning, Fastighet | ~6 |
| **Physical** | ID tilltradeobjekt, Laskista, Golv, Yttervagg, Grundkonstruktion | ~15 |
| **System** | Luftbehandlingssystem, Avloppssystem, BIP-kod system | ~10 |
| **Network** | (Mapped via relationships, not distinct types) | 0 |
| **Group** | Nyckelgrupp, Kategori, Paket entreprenad | ~5 |
| **Project/Document** | Projektdokument, Dokument-Ritning, AMA-beskrivning | ~20 |
| **Administrative** | Avtal/Projekt, Samrumbehorighet, ATA-redovisning | ~25 |

---

## 9. Summary: What PLCS Means for Doorman

1. **Doorman already implements PLCS patterns** -- `object_types`/`object_instances` = Item/PhysicalItem; `permissions` = role-based access; `audit_log` = change history.

2. **Three proposed columns** (`lifecycle_phase`, `value_qualifier`, `breakdown_type`) bridge the gap between Doorman's current schema and full PLCS compliance.

3. **BPMN processes map to lifecycle phases** -- each Camunda Call Activity operates within a specific phase, and phase gates enforce transition rules.

4. **The FormService doesn't need algorithm changes** -- PLCS compliance comes from correct `task_permission_rules` configuration per phase, not from code changes.

5. **AEC Model breakdowns enable multiple views** of the same objects -- a door is simultaneously a physical component, a fire compartment boundary, and an access control point.
