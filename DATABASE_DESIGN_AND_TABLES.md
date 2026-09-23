# Jimma City Digital Street Addressing & Housing Management Information System (MIS)
# Complete Database Design, Data Dictionaries & DB Diagram Code

> **Documentation & Database Architecture Specification**  
> **Target RDBMS:** PostgreSQL 16+ (Neon Cloud Serverless)  
> **Visual Modeling Tool:** dbdiagram.io (DBML & PostgreSQL DDL supported)

---

## Quick Navigation
1. [DBML Code (Copy-Paste Directly into dbdiagram.io)](#1-dbml-code-ready-for-dbdiagramio)
2. [PostgreSQL DDL Code (Alternative dbdiagram.io SQL Import)](#2-postgresql-ddl-code-alternative-sql-import)
3. [Entity Relationship Model & Architecture Overview](#3-entity-relationship-model--architecture-overview)
4. [Complete Data Dictionaries (All 8 Database Tables)](#4-complete-data-dictionaries-all-8-tables)
   - [Table 1: kebeles](#table-1-kebeles-administrative-kebele-jurisdictions)
   - [Table 2: streets](#table-2-streets-road-network--infrastructure-inventory)
   - [Table 3: blocks](#table-3-blocks-sub-kebele-planning-sectors)
   - [Table 4: users](#table-4-users-system-accounts--access-control)
   - [Table 5: properties](#table-5-properties-core-digital-cadastre--housing-register)
   - [Table 6: property_photos](#table-6-property_photos-multi-angle-photo-attachments)
   - [Table 7: approvals](#table-7-approvals-multi-tier-review--approval-history)
   - [Table 8: audit_logs](#table-8-audit_logs-system-security--audit-trail)
5. [Foreign Key & Referential Integrity Matrix](#5-foreign-key--referential-integrity-matrix)
6. [Domain Enumerations & Lookup Values](#6-domain-enumerations--system-lookup-values)
7. [Algorithmic Address Code Specification](#7-algorithmic-address-code-specification)

---

## 1. DBML Code (Ready for dbdiagram.io)

> **Instructions for dbdiagram.io:**
> 1. Open [https://dbdiagram.io](https://dbdiagram.io).
> 2. Create a new diagram.
> 3. Delete any default code in the left editor panel.
> 4. Copy and paste the entire block below into the left panel. Your interactive database diagram will render instantly with all tables, fields, types, and relationship connectors.

```dbml
// ============================================================================
// JIMMA CITY DIGITAL STREET ADDRESSING & HOUSING MANAGEMENT SYSTEM (MIS)
// DBML SCHEMA FOR DBDATAMODEL / DBDATADIAGRAM.IO
// ============================================================================

Project jimma_city_digital_mis {
  database_type: 'PostgreSQL'
  Note: '''
    # Jimma City Digital Street Addressing & Housing Management System (MIS)
    Enterprise Cadastral & Housing Addressing Infrastructure
    Jimma City Administration, Oromia Region, Ethiopia
  '''
}

// ----------------------------------------------------------------------------
// 1. KABELES (Administrative Jurisdictions)
// ----------------------------------------------------------------------------
Table kebeles {
  id integer [pk, increment, note: 'Primary Key']
  name text [not null, note: 'Official Kebele Name (e.g. Ginjo, Bacho, Ajora)']
  code text [not null, unique, note: 'Unique 3-4 letter Kebele code (e.g. GNJ, BCH, AJR)']
  city text [not null, default: 'Jimma', note: 'Municipality name']
  sub_city text [note: 'Sub-city administration boundary']
  woreda text [note: 'Woreda boundary identifier']
  district text [note: 'District / Sector within Jimma']
  status text [not null, default: 'active', note: 'active | inactive']
  created_at timestamp_with_time_zone [not null, default: `now()`]
  updated_at timestamp_with_time_zone [not null, default: `now()`]

  Note: 'Master administrative Kebele boundary definitions'
}

// ----------------------------------------------------------------------------
// 2. STREETS (Road Corridor & Infrastructure Inventory)
// ----------------------------------------------------------------------------
Table streets {
  id integer [pk, increment, note: 'Primary Key']
  name text [not null, note: 'Full Road Name (e.g. Aba Jifar Palace Road)']
  code text [not null, note: 'Standard street code abbreviation (e.g. ABAJIF, UNIRD)']
  kebele_id integer [not null, note: 'Foreign Key to kebeles.id']
  street_type text [note: 'Avenue, Boulevard, Street, Lane, Highway, Ring Road']
  road_surface text [note: 'Asphalt, Cobblestone, Gravel, Earth']
  start_lat real [note: 'GIS start latitude (EPSG:4326)']
  start_lng real [note: 'GIS start longitude (EPSG:4326)']
  end_lat real [note: 'GIS end latitude (EPSG:4326)']
  end_lng real [note: 'GIS end longitude (EPSG:4326)']
  length_meters real [note: 'Calculated street segment length in meters']
  width_meters real [note: 'Road cross-sectional width in meters']
  condition text [not null, default: 'good', note: 'good | fair | poor']
  start_intersection text [note: 'Starting landmark or cross-street']
  end_intersection text [note: 'Ending landmark or cross-street']
  lanes integer [default: 2, note: 'Total vehicular lanes']
  has_sidewalk boolean [default: false, note: 'Pedestrian walkway presence']
  has_street_lights boolean [default: false, note: 'Municipal street lighting presence']
  has_drainage boolean [default: false, note: 'Storm water drainage ditch presence']
  description text [note: 'Survey remarks & road characteristics']
  status text [not null, default: 'active', note: 'active | inactive']
  created_at timestamp_with_time_zone [not null, default: `now()`]
  updated_at timestamp_with_time_zone [not null, default: `now()`]

  Note: 'Municipal street network, road geometry, and physical infrastructure'
}

// ----------------------------------------------------------------------------
// 3. BLOCKS (Cadastral Survey Sectors)
// ----------------------------------------------------------------------------
Table blocks {
  id integer [pk, increment, note: 'Primary Key']
  code text [not null, note: 'Block sector code (e.g. BL01, BL02, BLK-09)']
  kebele_id integer [not null, note: 'Foreign Key to kebeles.id']
  street_id integer [not null, note: 'Foreign Key to streets.id']
  description text [note: 'Sector notes or physical boundaries']
  status text [not null, default: 'active', note: 'active | inactive']
  created_at timestamp_with_time_zone [not null, default: `now()`]
  updated_at timestamp_with_time_zone [not null, default: `now()`]

  Note: 'Sub-kebele micro-blocks and cadastral planning sectors'
}

// ----------------------------------------------------------------------------
// 4. USERS (Municipal Staff Accounts & RBAC)
// ----------------------------------------------------------------------------
Table users {
  id integer [pk, increment, note: 'Primary Key']
  username text [not null, unique, note: 'System username or official email']
  password_hash text [not null, note: 'bcrypt cryptographic password hash']
  full_name text [not null, note: 'Officer full legal name']
  email text [note: 'Contact and notification email']
  phone text [note: 'Mobile telephone for SMS alerts and recovery']
  role text [not null, default: 'viewer', note: 'admin | city_officer | kebele_officer | enumerator | viewer']
  kebele_id integer [note: 'Optional foreign key to kebeles.id for kebele-scoped officers']
  is_active boolean [not null, default: true, note: 'Account enabled / disabled flag']
  reset_token text [note: 'Cryptographic password reset token']
  reset_token_expiry timestamp_with_time_zone [note: 'Reset token expiration timestamp']
  created_at timestamp_with_time_zone [not null, default: `now()`]
  updated_at timestamp_with_time_zone [not null, default: `now()`]

  Note: 'Municipal staff credentials, role-based access permissions, and kebele scoping'
}

// ----------------------------------------------------------------------------
// 5. PROPERTIES (Core Housing & Digital Cadastre Register)
// ----------------------------------------------------------------------------
Table properties {
  id integer [pk, increment, note: 'Primary Key']
  address_code text [unique, note: 'Standard Jimma Address Code: JIM-KB{XX}-ST{YY}-BL{ZZ}-HN{NNN}']
  house_number text [note: 'Sequential door / parcel number along street']
  building_name text [note: 'Distinctive building or facility name']
  property_type text [not null, default: 'residential', note: 'residential | commercial | mixed | institution | industrial | government']
  ownership_type text [note: 'private | government | kebele | religious | customary']
  owner_name text [not null, note: 'Full legal name of title holder or owner']
  owner_phone text [note: 'Contact telephone of property owner']
  occupant_name text [note: 'Tenant or resident name (if rented)']
  occupant_phone text [note: 'Tenant or resident contact phone']
  business_name text [note: 'Trade name of enterprise (for commercial/mixed)']
  business_license_number text [note: 'Municipal trade license registration number']
  number_of_floors integer [note: 'Building storeys (e.g. 1 for ground villa, 4 for G+3)']
  building_use text [note: 'Detailed description of building usage']
  kebele text [not null, note: 'Kebele code or name where parcel is situated']
  street_name text [not null, note: 'Primary street providing parcel access']
  block_code text [note: 'Cadastral block code']
  latitude real [note: 'GPS WGS 84 Latitude coordinate']
  longitude real [note: 'GPS WGS 84 Longitude coordinate']
  property_photo text [note: 'Primary front facade image URL']
  status text [not null, default: 'pending', note: 'pending | kebele_verified | approved | rejected']
  remark text [note: 'Surveyor comments or officer rejection rationale']
  created_by integer [note: 'Foreign Key to users.id (Enumerator who surveyed parcel)']
  created_at timestamp_with_time_zone [not null, default: `now()`]
  updated_at timestamp_with_time_zone [not null, default: `now()`]

  Note: 'Master digital property cadastre, ownership, spatial coordinates, and verification state'
}

// ----------------------------------------------------------------------------
// 6. PROPERTY_PHOTOS (Multi-Angle Facade & Evidence Photos)
// ----------------------------------------------------------------------------
Table property_photos {
  id integer [pk, increment, note: 'Primary Key']
  property_id integer [not null, note: 'Foreign Key to properties.id']
  photo_url text [not null, note: 'Stored image path or CDN link']
  file_name text [note: 'Original image filename']
  file_type text [note: 'MIME format: image/jpeg, image/png, image/webp']
  photo_category text [not null, default: 'other', note: 'front_view | side_view | business_sign | document | other']
  uploaded_by integer [note: 'Foreign Key to users.id']
  created_at timestamp_with_time_zone [not null, default: `now()`]

  Note: 'Photographic documentation gallery supporting property identification'
}

// ----------------------------------------------------------------------------
// 7. APPROVALS (Multi-Tier Review & Audit Workflow)
// ----------------------------------------------------------------------------
Table approvals {
  id integer [pk, increment, note: 'Primary Key']
  property_id integer [not null, note: 'Foreign Key to properties.id']
  action text [not null, note: 'approved | rejected | kebele_verified | resubmitted']
  actor_id integer [note: 'Foreign Key to users.id (Reviewing Officer)']
  remark text [note: 'Official legal or survey review comments']
  created_at timestamp_with_time_zone [not null, default: `now()`]

  Note: 'Immutable historical record of verification and approval actions'
}

// ----------------------------------------------------------------------------
// 8. AUDIT_LOGS (Security, Auth & Activity Audit Ledger)
// ----------------------------------------------------------------------------
Table audit_logs {
  id integer [pk, increment, note: 'Primary Key']
  user_id integer [note: 'Foreign Key to users.id (Action author)']
  action text [not null, note: 'Action verb (e.g. PROPERTY_APPROVED, USER_LOGIN)']
  entity_type text [note: 'Target table/entity (property, user, street, etc.)']
  entity_id integer [note: 'Target entity primary key identifier']
  entity_name text [note: 'Human-readable identifier (address code, username)']
  old_value text [note: 'Serialized prior state (JSON string)']
  new_value text [note: 'Serialized updated state (JSON string)']
  ip_address text [note: 'Client IPv4/IPv6 address']
  device_info text [note: 'Browser User-Agent / client environment']
  details text [note: 'Descriptive narrative of system mutation']
  created_at timestamp_with_time_zone [not null, default: `now()`]

  Note: 'Tamper-resistant audit log for anti-corruption and governance traceability'
}

// ============================================================================
// RELATIONSHIPS & REFERENTIAL INTEGRITY (FOREIGN KEYS)
// ============================================================================

Ref: streets.kebele_id > kebeles.id [delete: restrict]
Ref: blocks.kebele_id > kebeles.id [delete: restrict]
Ref: blocks.street_id > streets.id [delete: restrict]
Ref: users.kebele_id > kebeles.id [delete: set null]
Ref: properties.created_by > users.id [delete: set null]
Ref: property_photos.property_id > properties.id [delete: cascade]
Ref: property_photos.uploaded_by > users.id [delete: set null]
Ref: approvals.property_id > properties.id [delete: cascade]
Ref: approvals.actor_id > users.id [delete: set null]
Ref: audit_logs.user_id > users.id [delete: set null]
```

---

## 2. PostgreSQL DDL Code (Alternative SQL Import)

> **Instructions for dbdiagram.io via SQL Import:**
> 1. In dbdiagram.io, click **Import** in the top navigation bar.
> 2. Select **PostgreSQL**.
> 3. Paste the entire SQL block below and click **Submit**. dbdiagram.io will parse the DDL and construct the ER diagram automatically.

```sql
-- ============================================================================
-- JIMMA CITY DIGITAL STREET ADDRESSING & HOUSING MANAGEMENT SYSTEM (MIS)
-- COMPLETE POSTGRESQL DDL SPECIFICATION
-- ============================================================================

-- Table 1: kebeles
CREATE TABLE kebeles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    city TEXT NOT NULL DEFAULT 'Jimma',
    sub_city TEXT,
    woreda TEXT,
    district TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table 2: streets
CREATE TABLE streets (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    kebele_id INTEGER NOT NULL REFERENCES kebeles(id) ON DELETE RESTRICT,
    street_type TEXT,
    road_surface TEXT,
    start_lat REAL,
    start_lng REAL,
    end_lat REAL,
    end_lng REAL,
    length_meters REAL,
    width_meters REAL,
    condition TEXT NOT NULL DEFAULT 'good',
    start_intersection TEXT,
    end_intersection TEXT,
    lanes INTEGER DEFAULT 2,
    has_sidewalk BOOLEAN DEFAULT FALSE,
    has_street_lights BOOLEAN DEFAULT FALSE,
    has_drainage BOOLEAN DEFAULT FALSE,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table 3: blocks
CREATE TABLE blocks (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    kebele_id INTEGER NOT NULL REFERENCES kebeles(id) ON DELETE RESTRICT,
    street_id INTEGER NOT NULL REFERENCES streets(id) ON DELETE RESTRICT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table 4: users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'viewer' 
        CHECK (role IN ('admin', 'city_officer', 'kebele_officer', 'enumerator', 'viewer')),
    kebele_id INTEGER REFERENCES kebeles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    reset_token TEXT,
    reset_token_expiry TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table 5: properties
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    address_code TEXT UNIQUE,
    house_number TEXT,
    building_name TEXT,
    property_type TEXT NOT NULL DEFAULT 'residential' 
        CHECK (property_type IN ('residential', 'commercial', 'mixed', 'institution', 'industrial', 'government')),
    ownership_type TEXT,
    owner_name TEXT NOT NULL,
    owner_phone TEXT,
    occupant_name TEXT,
    occupant_phone TEXT,
    business_name TEXT,
    business_license_number TEXT,
    number_of_floors INTEGER,
    building_use TEXT,
    kebele TEXT NOT NULL,
    street_name TEXT NOT NULL,
    block_code TEXT,
    latitude REAL,
    longitude REAL,
    property_photo TEXT,
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'kebele_verified', 'approved', 'rejected')),
    remark TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table 6: property_photos
CREATE TABLE property_photos (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    file_name TEXT,
    file_type TEXT,
    photo_category TEXT NOT NULL DEFAULT 'other' 
        CHECK (photo_category IN ('front_view', 'side_view', 'business_sign', 'document', 'other')),
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table 7: approvals
CREATE TABLE approvals (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    action TEXT NOT NULL 
        CHECK (action IN ('approved', 'rejected', 'kebele_verified', 'resubmitted')),
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table 8: audit_logs
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    entity_name TEXT,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    device_info TEXT,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Database Performance Indexes
CREATE INDEX streets_kebele_id_idx ON streets(kebele_id);
CREATE INDEX blocks_kebele_id_idx ON blocks(kebele_id);
CREATE INDEX blocks_street_id_idx ON blocks(street_id);
CREATE INDEX users_kebele_id_idx ON users(kebele_id);
CREATE INDEX users_role_idx ON users(role);

CREATE INDEX properties_status_idx ON properties(status);
CREATE INDEX properties_kebele_idx ON properties(kebele);
CREATE INDEX properties_created_by_idx ON properties(created_by);
CREATE INDEX properties_property_type_idx ON properties(property_type);
CREATE INDEX properties_address_code_idx ON properties(address_code);
CREATE INDEX properties_status_kebele_idx ON properties(status, kebele);

CREATE INDEX property_photos_property_id_idx ON property_photos(property_id);
CREATE INDEX approvals_property_id_idx ON approvals(property_id);
CREATE INDEX audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX audit_logs_action_idx ON audit_logs(action);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at);
```

---

## 3. Entity Relationship Model & Architecture Overview

```
                                  ┌───────────────┐
                                  │    kebeles    │
                                  └───────┬───────┘
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  │ 1:N                   │ 1:N                   │ 1:N
                  ▼                       ▼                       ▼
           ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
           │   streets    │        │    blocks    │        │    users     │
           └──────┬───────┘        └──────────────┘        └──────┬───────┘
                  │ 1:N                                           │
                  │                                               │ 1:N
                  └───────────────────────┬───────────────────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │  properties  │
                                   └──────┬───────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  │ 1:N                                           │ 1:N
                  ▼                                               ▼
           ┌──────────────┐                                ┌──────────────┐
           │property_photo│                                │  approvals   │
           └──────────────┘                                └──────────────┘
```

---

## 4. Complete Data Dictionaries (All 8 Tables)

### Table 1: `kebeles` (Administrative Kebele Jurisdictions)
* **Primary Key:** `id`
* **Unique Key:** `code`
* **Description:** Represents official municipal Kebele territorial boundaries in Jimma City.

| Column Name | Type | Nullable | Constraints / Defaults | Description & Business Rules |
|---|---|:---:|---|---|
| `id` | `SERIAL` | **NO** | `PRIMARY KEY` | Auto-incrementing internal integer identifier. |
| `name` | `TEXT` | **NO** | — | Full legal name of the Kebele (e.g. Ginjo, Bacho, Ajora, Feres Megala). |
| `code` | `TEXT` | **NO** | `UNIQUE` | Standardized short code used in address generation (e.g. GNJ, BCH, AJR). |
| `city` | `TEXT` | **NO** | `DEFAULT 'Jimma'` | Municipality administration name. |
| `sub_city` | `TEXT` | YES | `NULL` | Optional sub-city boundary name. |
| `woreda` | `TEXT` | YES | `NULL` | Woreda jurisdiction code or name. |
| `district` | `TEXT` | YES | `NULL` | Urban planning district name. |
| `status` | `TEXT` | **NO** | `DEFAULT 'active'` | Kebele state: `active` or `inactive`. |
| `created_at` | `TIMESTAMPTZ`| **NO** | `DEFAULT NOW()` | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| **NO** | `DEFAULT NOW()` | Record last modification timestamp. |

---

### Table 2: `streets` (Road Network & Infrastructure Inventory)
* **Primary Key:** `id`
* **Foreign Key:** `kebele_id` $\rightarrow$ `kebeles(id)`
* **Description:** Catalogs all surveyed roadways, geometry coordinates, surface classifications, and municipal amenities.

| Column Name | Type | Nullable | Constraints / Defaults | Description & Business Rules |
|---|---|:---:|---|---|
| `id` | `SERIAL` | **NO** | `PRIMARY KEY` | Auto-incrementing road record ID. |
| `name` | `TEXT` | **NO** | — | Registered street name (e.g. "Stadium Street", "University Road"). |
| `code` | `TEXT` | **NO** | — | Street code abbreviation (e.g. `STADM`, `UNIRD`, `BONGA`). |
| `kebele_id` | `INTEGER` | **NO** | `REFERENCES kebeles(id)` | Foreign key linking the street to its primary administrative Kebele. |
| `street_type` | `TEXT` | YES | `NULL` | Road class: `Avenue`, `Boulevard`, `Street`, `Lane`, `Highway`. |
| `road_surface` | `TEXT` | YES | `NULL` | Material type: `Asphalt`, `Cobblestone`, `Gravel`, `Earth`. |
| `start_lat` | `REAL` | YES | `NULL` | GIS start latitude coordinate ($\approx 7.67^\circ$). |
| `start_lng` | `REAL` | YES | `NULL` | GIS start longitude coordinate ($\approx 36.83^\circ$). |
| `end_lat` | `REAL` | YES | `NULL` | GIS terminus latitude coordinate. |
| `end_lng` | `REAL` | YES | `NULL` | GIS terminus longitude coordinate. |
| `length_meters`| `REAL` | YES | `NULL` | Surveyed corridor length in meters. |
| `width_meters` | `REAL` | YES | `NULL` | Corridor cross-sectional width in meters. |
| `condition` | `TEXT` | **NO** | `DEFAULT 'good'` | Physical condition: `good`, `fair`, `poor`. |
| `start_intersection`| `TEXT` | YES | `NULL` | Road junction or landmark at origin. |
| `end_intersection` | `TEXT` | YES | `NULL` | Road junction or landmark at terminus. |
| `lanes` | `INTEGER` | YES | `DEFAULT 2` | Total number of vehicular travel lanes. |
| `has_sidewalk` | `BOOLEAN` | YES | `DEFAULT FALSE` | Presence of pedestrian footpaths. |
| `has_street_lights`| `BOOLEAN` | YES | `DEFAULT FALSE` | Presence of operational street illumination. |
| `has_drainage` | `BOOLEAN` | YES | `DEFAULT FALSE` | Presence of storm drainage channels. |
| `description` | `TEXT` | YES | `NULL` | Engineering notes and survey comments. |
| `status` | `TEXT` | **NO** | `DEFAULT 'active'` | Operational status: `active` or `inactive`. |
| `created_at` | `TIMESTAMPTZ`| **NO** | `DEFAULT NOW()` | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| **NO** | `DEFAULT NOW()` | Record last modification timestamp. |

---

### Table 3: `blocks` (Sub-Kebele Planning Sectors)
* **Primary Key:** `id`
* **Foreign Keys:** `kebele_id` $\rightarrow$ `kebeles(id)`, `street_id` $\rightarrow$ `streets(id)`
* **Description:** Cadastral survey blocks bounding property parcels within a Kebele and street.

| Column Name | Type | Nullable | Constraints / Defaults | Description & Business Rules |
|---|---|:---:|---|---|
| `id` | `SERIAL` | **NO** | `PRIMARY KEY` | Auto-incrementing block identifier. |
| `code` | `TEXT` | **NO** | — | Sector index code (e.g. `BL01`, `BL02`, `BLK-09`). |
| `kebele_id` | `INTEGER` | **NO** | `REFERENCES kebeles(id)` | Foreign key identifying parent Kebele. |
| `street_id` | `INTEGER` | **NO** | `REFERENCES streets(id)` | Foreign key identifying primary access street. |
| `description` | `TEXT` | YES | `NULL` | Sector boundaries or zone description. |
| `status` | `TEXT` | **NO** | `DEFAULT 'active'` | Operational status: `active` or `inactive`. |
| `created_at` | `TIMESTAMPTZ`| **NO** | `DEFAULT NOW()` | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| **NO** | `DEFAULT NOW()` | Record last modification timestamp. |

---

### Table 4: `users` (System Accounts & Access Control)
* **Primary Key:** `id`
* **Unique Key:** `username`
* **Foreign Key:** `kebele_id` $\rightarrow$ `kebeles(id)` (optional)
* **Description:** Authentication, user profiles, RBAC security roles, and password recovery states.

| Column Name | Type | Nullable | Constraints / Defaults | Description & Business Rules |
|---|---|:---:|---|---|
| `id` | `SERIAL` | **NO** | `PRIMARY KEY` | Auto-incrementing user account ID. |
| `username` | `TEXT` | **NO** | `UNIQUE` | Unique login username or official municipal email. |
| `password_hash`| `TEXT` | **NO** | — | Cryptographic hash generated with `bcryptjs` (10 rounds). |
| `full_name` | `TEXT` | **NO** | — | User's legal full name. |
| `email` | `TEXT` | YES | `NULL` | Contact email address. |
| `phone` | `TEXT` | YES | `NULL` | Mobile phone for password resets and SMS alerts. |
| `role` | `TEXT` | **NO** | `DEFAULT 'viewer'` | Access tier: `admin`, `city_officer`, `kebele_officer`, `enumerator`, `viewer`. |
| `kebele_id` | `INTEGER` | YES | `REFERENCES kebeles(id)` | Scopes Kebele Officers to their designated jurisdiction. |
| `is_active` | `BOOLEAN` | **NO** | `DEFAULT TRUE` | Account enablement status (`true` = active; `false` = suspended). |
| `reset_token` | `TEXT` | YES | `NULL` | Cryptographic hex token for self-service password recovery. |
| `reset_token_expiry`| `TIMESTAMPTZ`| YES | `NULL` | 1-hour expiration timestamp for reset token. |
| `created_at` | `TIMESTAMPTZ`| **NO** | `DEFAULT NOW()` | User creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| **NO** | `DEFAULT NOW()` | Profile last modification timestamp. |

---

### Table 5: `properties` (Core Digital Cadastre & Housing Register)
* **Primary Key:** `id`
* **Unique Key:** `address_code` (generated upon approval)
* **Foreign Key:** `created_by` $\rightarrow$ `users(id)`
* **Description:** Master cadastral entity recording land parcels, ownership, building metrics, coordinates, and address codes.

| Column Name | Type | Nullable | Constraints / Defaults | Description & Business Rules |
|---|---|:---:|---|---|
| `id` | `SERIAL` | **NO** | `PRIMARY KEY` | Auto-incrementing parcel ID. |
| `address_code` | `TEXT` | YES | `UNIQUE (issued)` | Algorithmic address code: `JIM-KB{XX}-ST{YY}-BL{ZZ}-HN{NNN}`. Issued upon final approval. |
| `house_number` | `TEXT` | YES | `NULL` | Entrance door or sequential house number along the road. |
| `building_name`| `TEXT` | YES | `NULL` | Prominent name of building or commercial complex. |
| `property_type`| `TEXT` | **NO** | `DEFAULT 'residential'` | Usage: `residential`, `commercial`, `mixed`, `institution`, `industrial`, `government`. |
| `ownership_type`| `TEXT`| YES | `NULL` | Tenure type: `private`, `government`, `kebele`, `religious`, `customary`. |
| `owner_name` | `TEXT` | **NO** | — | Full legal name of property owner or legal entity. |
| `owner_phone` | `TEXT` | YES | `NULL` | Contact phone number of property owner. |
| `occupant_name`| `TEXT` | YES | `NULL` | Name of current resident or commercial tenant. |
| `occupant_phone`| `TEXT`| YES | `NULL` | Contact phone number of current occupant. |
| `business_name`| `TEXT` | YES | `NULL` | Trade name of commercial establishment on parcel. |
| `business_license_number`| `TEXT`| YES | `NULL` | Official municipal trade registration license number. |
| `number_of_floors`| `INTEGER`| YES | `NULL` | Total storeys (e.g. 1 for ground villa, 4 for G+3). |
| `building_use` | `TEXT` | YES | `NULL` | Detailed spatial usage description. |
| `kebele` | `TEXT` | **NO** | — | Administrative Kebele where parcel resides. |
| `street_name` | `TEXT` | **NO** | — | Registered street providing primary parcel access. |
| `block_code` | `TEXT` | YES | `NULL` | Cadastral block index. |
| `latitude` | `REAL` | YES | `NULL` | GPS WGS 84 Latitude ($\approx 7.64^\circ - 7.72^\circ \text{N}$). |
| `longitude` | `REAL` | YES | `NULL` | GPS WGS 84 Longitude ($\approx 36.80^\circ - 36.88^\circ \text{E}$). |
| `property_photo`| `TEXT` | YES | `NULL` | Relative URL/path to primary facade photograph. |
| `status` | `TEXT` | **NO** | `DEFAULT 'pending'` | Workflow state: `pending`, `kebele_verified`, `approved`, `rejected`. |
| `remark` | `TEXT` | YES | `NULL` | Surveyor remarks, officer feedback, or rejection reasons. |
| `created_by` | `INTEGER` | YES | `REFERENCES users(id)` | Field enumerator who surveyed and registered parcel. |
| `created_at` | `TIMESTAMPTZ`| **NO** | `DEFAULT NOW()` | Survey creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| **NO** | `DEFAULT NOW()` | Record last modification timestamp. |

---

### Table 6: `property_photos` (Multi-Angle Photo Attachments)
* **Primary Key:** `id`
* **Foreign Keys:** `property_id` $\rightarrow$ `properties(id)` [ON DELETE CASCADE], `uploaded_by` $\rightarrow$ `users(id)` [ON DELETE SET NULL]
* **Description:** Gallery of visual inspection photos (facades, street numbers, title deeds, trade license banners).

| Column Name | Type | Nullable | Constraints / Defaults | Description & Business Rules |
|---|---|:---:|---|---|
| `id` | `SERIAL` | **NO** | `PRIMARY KEY` | Auto-incrementing photo record ID. |
| `property_id` | `INTEGER` | **NO** | `REFERENCES properties(id)` | Foreign key linking image to target property. |
| `photo_url` | `TEXT` | **NO** | — | Persistent relative path or CDN URL of image asset. |
| `file_name` | `TEXT` | YES | `NULL` | Original upload filename. |
| `file_type` | `TEXT` | YES | `NULL` | MIME content type (e.g. `image/jpeg`, `image/png`). |
| `photo_category`| `TEXT` | **NO** | `DEFAULT 'other'` | Angle category: `front_view`, `side_view`, `business_sign`, `document`, `other`. |
| `uploaded_by` | `INTEGER` | YES | `REFERENCES users(id)` | Officer or enumerator who uploaded photo asset. |
| `created_at` | `TIMESTAMPTZ`| **NO** | `DEFAULT NOW()` | Upload timestamp. |

---

### Table 7: `approvals` (Multi-Tier Review & Approval History)
* **Primary Key:** `id`
* **Foreign Keys:** `property_id` $\rightarrow$ `properties(id)` [ON DELETE CASCADE], `actor_id` $\rightarrow$ `users(id)` [ON DELETE SET NULL]
* **Description:** Immutable chronological audit ledger tracking multi-level municipal verification transitions.

| Column Name | Type | Nullable | Constraints / Defaults | Description & Business Rules |
|---|---|:---:|---|---|
| `id` | `SERIAL` | **NO** | `PRIMARY KEY` | Auto-incrementing approval action ID. |
| `property_id` | `INTEGER` | **NO** | `REFERENCES properties(id)` | Foreign key linking review to target property. |
| `action` | `TEXT` | **NO** | — | Transition performed: `kebele_verified`, `approved`, `rejected`, `resubmitted`. |
| `actor_id` | `INTEGER` | YES | `REFERENCES users(id)` | Officer who authorized the action. |
| `remark` | `TEXT` | YES | `NULL` | Official justification or rejection comments. |
| `created_at` | `TIMESTAMPTZ`| **NO** | `DEFAULT NOW()` | Action execution timestamp. |

---

### Table 8: `audit_logs` (System Security & Audit Trail)
* **Primary Key:** `id`
* **Foreign Key:** `user_id` $\rightarrow$ `users(id)` [ON DELETE SET NULL]
* **Description:** Tamper-resistant security and operational ledger capturing all administrative actions, data edits, and logins.

| Column Name | Type | Nullable | Constraints / Defaults | Description & Business Rules |
|---|---|:---:|---|---|
| `id` | `SERIAL` | **NO** | `PRIMARY KEY` | Auto-incrementing audit log entry ID. |
| `user_id` | `INTEGER` | YES | `REFERENCES users(id)` | User who executed the action (`NULL` for automated events). |
| `action` | `TEXT` | **NO** | — | Action verb code (e.g. `PROPERTY_APPROVED`, `USER_LOGIN`). |
| `entity_type` | `TEXT` | YES | `NULL` | Target entity model (e.g. `property`, `user`, `street`). |
| `entity_id` | `INTEGER` | YES | `NULL` | Primary key of affected record. |
| `entity_name` | `TEXT` | YES | `NULL` | Human-readable title or code (e.g. address code). |
| `old_value` | `TEXT` | YES | `NULL` | Prior record state serialized in JSON. |
| `new_value` | `TEXT` | YES | `NULL` | Updated record state serialized in JSON. |
| `ip_address` | `TEXT` | YES | `NULL` | Client IPv4 or IPv6 network address. |
| `device_info` | `TEXT` | YES | `NULL` | Client browser User-Agent environment string. |
| `details` | `TEXT` | YES | `NULL` | Descriptive explanation of business event. |
| `created_at` | `TIMESTAMPTZ`| **NO** | `DEFAULT NOW()` | Immutable log timestamp. |

---

## 5. Foreign Key & Referential Integrity Matrix

| Source Table | Source Column | Target Table | Target Column | On Delete Action | Integrity Purpose |
|---|---|---|---|:---:|---|
| `streets` | `kebele_id` | `kebeles` | `id` | `RESTRICT` | Prevents deleting a Kebele while streets are mapped to it |
| `blocks` | `kebele_id` | `kebeles` | `id` | `RESTRICT` | Prevents deleting a Kebele while blocks are assigned |
| `blocks` | `street_id` | `streets` | `id` | `RESTRICT` | Prevents deleting a street with active cadastral blocks |
| `users` | `kebele_id` | `kebeles` | `id` | `SET NULL` | Preserves staff account if a Kebele boundary is decommissioned |
| `properties` | `created_by` | `users` | `id` | `SET NULL` | Preserves cadastral parcel history if enumerator account is removed |
| `property_photos`| `property_id`| `properties` | `id` | `CASCADE` | Automatically removes photo records if parent parcel is deleted |
| `property_photos`| `uploaded_by`| `users` | `id` | `SET NULL` | Retains image assets if uploader profile is deleted |
| `approvals` | `property_id`| `properties` | `id` | `CASCADE` | Automatically cleans up workflow steps if property is removed |
| `approvals` | `actor_id` | `users` | `id` | `SET NULL` | Retains official municipal approval records indefinitely |
| `audit_logs` | `user_id` | `users` | `id` | `SET NULL` | Retains immutable audit history for municipal compliance |

---

## 6. Domain Enumerations & System Lookup Values

### User Roles (`users.role`)
- `admin`: Complete administrative privileges, user management, and system setup.
- `city_officer`: City planning authority, zoning compliance, and final address code approval.
- `kebele_officer`: Local kebele administration, parcel verification, and dispute screening.
- `enumerator`: Mobile field surveyor capturing GPS coordinates, photos, and owner details.
- `viewer`: Read-only access for municipal observers, revenue auditors, and emergency services.

### Property Verification Workflow (`properties.status`)
- `pending`: Newly surveyed parcel submitted by field enumerator, awaiting Kebele review.
- `kebele_verified`: Validated by Kebele Officer for local boundary and ownership accuracy.
- `approved`: Officially confirmed by City Officer; triggers algorithmic address code and QR code generation.
- `rejected`: Flagged with discrepancy reason and returned to enumerator/kebele officer for field correction.

### Property Classification (`properties.property_type`)
- `residential`: Single-family villas, traditional residences, and private apartment compounds.
- `commercial`: Retail shops, banks, hotels, cafes, and business offices.
- `mixed`: Multi-story buildings combining ground-floor commercial with residential units above.
- `institution`: Educational facilities (Jimma University), hospitals, and public centers.
- `industrial`: Manufacturing plants, warehouses, processing mills, and storage yards.
- `government`: Kebele offices, municipal courts, police stations, and ministry regional branches.

### Photo Views (`property_photos.photo_category`)
- `front_view`: Main entrance facade and gate view.
- `side_view`: Side structural profile showing property boundary line.
- `business_sign`: Commercial signage, banner, or municipal license plate.
- `document`: Ownership certificate, lease agreement, or cadastral map excerpt.
- `other`: Supplementary context photograph.

---

## 7. Algorithmic Address Code Specification

When a property advances to `approved` status, the system generates a permanent, non-repeating address code:

$$\mathbf{\text{Address Code}} = \mathbf{\text{JIM}} - \mathbf{\text{KB}}\{\text{Kebele}\} - \mathbf{\text{ST}}\{\text{Street}\} - \mathbf{\text{BL}}\{\text{Block}\} - \mathbf{\text{HN}}\{\text{HouseNumber}\}$$

### Format Parameters:
- **`JIM`**: Fixed prefix identifying the Jimma City Administration.
- **`KB{Kebele}`**: Sanitized uppercase alphanumeric Kebele code (max 6 chars, e.g. `KBAJR`, `KBBCH`, `KBFMG`).
- **`ST{Street}`**: Sanitized uppercase alphanumeric Street code (max 6 chars, e.g. `STBONGA`, `STUNIRD`, `STSTADM`).
- **`BL{Block}`**: Alphanumeric block code (e.g. `BL01`, `BL02`).
- **`HN{HouseNumber}`**: Sequential house or entrance number along that street (e.g. `HN101`, `HN001`).

### Production Example:
$$\text{Input: Kebele} = \text{"AJR"}, \text{ Street} = \text{"Bonga Road"}, \text{ Block} = \text{"BL01"}, \text{ House} = \text{"101"}$$
$$\Downarrow$$
$$\mathbf{\text{JIM-KBAJR-STBONGA-BL01-HN101}}$$
