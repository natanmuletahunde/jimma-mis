# Jimma City Digital Street Addressing & Housing Management Information System (MIS)
## Comprehensive Project Specification, Requirements, Business Logic & Architecture Document

---

## 1. Executive Summary & Vision

The **Jimma City Digital Street Addressing & Housing Management Information System (Jimma MIS)** is a modern, enterprise-grade municipal governance platform designed for the **Jimma City Administration** (Oromia Region, Ethiopia). 

### 1.1 The Municipal Problem
Historically, Jimma City—like many rapidly expanding urban centers in Ethiopia—faced critical municipal challenges:
1. **Informal and Inconsistent Addressing**: Properties lacked standardized codes, making emergency dispatch (ambulance, fire, police), utility delivery (EEU, Ethio Telecom), and postal services slow or impossible.
2. **Municipal Revenue Leakage**: Lack of an accurate, geo-referenced property cadastre led to uncollected property taxes, unassessed building additions, and informal commercial activities.
3. **Fragmented Urban Planning**: Kebele administrations, city planning offices, and revenue authorities operated with disconnected paper records.

### 1.2 The Digital Solution
The Jimma MIS establishes a **single digital source of truth**:
- **Field Enumeration**: Surveyors collect GPS coordinates, photos, structural types, and owner details on mobile devices.
- **Hierarchical Governance**: A strict 3-tier review process (Enumerator → Kebele Verification → City Planning Approval).
- **Automated Algorithmic Addressing**: Official digital address codes generated systematically:
  $$\text{Address Code} = \text{JIM-KB}\{\text{Kebele}\}\text{-ST}\{\text{Street}\}\text{-BL}\{\text{Block}\}\text{-HN}\{\text{HouseNumber}\}$$
- **Interactive GIS Mapping**: Real-time Leaflet/OpenStreetMap geospatial visualization of all parcels, streets, and kebele boundaries.
- **Government Assessment & Revenue Projection**: Automated valuation categorizations and annual tax liability calculations.

---

## 2. Core Business Logic & Rules Engine

### 2.1 The Standardized Address Code Generation Algorithm
Every building or land parcel in Jimma City receives a unique, non-repeating address code upon final approval.

```
Format: JIM-KB{XX}-ST{YYY}-BL{ZZ}-HN{NNN}
```

- **City Prefix**: `JIM` (Jimma City Administration)
- **Kebele Code (`KB{XX}`)**: 2-digit code representing the administrative kebele (e.g., `KB01` for Ginjo, `KB02` for Bacho Bore).
- **Street Code (`ST{YYY}`)**: Official alphabetic/numeric abbreviation of the registered street or corridor (e.g., `ABAJIF`, `UNIRD`, `HOSAV`).
- **Block Code (`BL{ZZ}`)**: Survey sector/block index within the kebele (e.g., `BL01` to `BL99`).
- **House / Parcel Number (`HN{NNN}`)**: Sequential, unique parcel or entrance identifier along that street segment.

#### Business Invariants:
1. **Uniqueness**: No two properties in the city can ever share an identical address code.
2. **Immutability upon Approval**: Once an address code is generated and stamped onto an official QR plate, it cannot be modified without an authorized administrative revocation protocol.
3. **Sub-unit Addressing**: Multi-story buildings (e.g., G+4) retain the primary parcel address with appended unit extensions (e.g., `JIM-KB01-ABAJIF-BL01-HN101-U02`).

---

### 2.2 Three-Tier Multi-Level Verification & Approval Workflow

The system enforces a legally compliant municipal approval pipeline:

```
[Field Survey / Enumerator]
           │
           ▼ (Status: 'pending')
[Kebele Officer Review]
     │               │
     ▼ (Valid)       ▼ (Discrepancy)
[Status: 'kebele_verified']  ──► [Status: 'rejected'] ──► Returned to Enumerator
     │
     ▼
[City Planning Officer Review]
     │               │
     ▼ (Final OK)    ▼ (Technical Flaw)
[Status: 'approved'] ──► [Status: 'rejected']
     │
     ├── Auto-generate Official Address Code
     ├── Generate Encrypted QR Code Payload
     └── Calculate Initial Government Tax Assessment
```

#### Step 1: Enumerator Data Capture (`pending`)
- Field enumerator surveys parcel using mobile GPS.
- Captures: Latitude/Longitude (accuracy ≤ 5m), owner full name, phone number, structural use (Residential, Commercial, Mixed, Industrial, Government), number of floors, and building photo.
- Record enters system in `pending` state.

#### Step 2: Kebele Officer Local Verification (`kebele_verified`)
- The Kebele Officer reviews records restricted to their assigned Kebele boundary.
- Verifies physical existence, boundary disputes, and local ownership rights.
- **Actions**:
  - `Verify`: Advances status to `kebele_verified`.
  - `Reject`: Requires mandatory rejection reason (e.g., *"Boundary dispute with neighbor parcel"*, *"Incorrect house number"*).

#### Step 3: City Officer Approval & Official Registration (`approved`)
- City Planning Director reviews structural zoning compliance, street alignment, and master plan conformity.
- **Actions**:
  - `Approve`: Triggers the address code generator, issues official QR code metadata, locks the record, and writes an immutable entry into the municipal `audit_logs`.
  - `Reject`: Sends record back to Kebele officer or field team for correction.

---

### 2.3 Government Valuation & Municipal Tax Assessment Engine

The system features an automated preliminary property tax and valuation calculator based on Ethiopian municipal property rating standards:

$$\text{Assessed Base Value} = (\text{Land Area } m^2 \times \text{Kebele Zone Rate}) + (\text{Built Area } m^2 \times \text{Floor Multiplier} \times \text{Structure Coefficient})$$

$$\text{Annual Municipal Tax} = \text{Assessed Base Value} \times \text{Property Category Tax Rate}$$

#### Standard Municipal Parameters:
| Property Category | Land / Structure Coefficient | Tax Rate (%) | Inspection Frequency |
|---|---|---|---|
| **Residential (Single/Villa)** | $1.00 \times \text{Base}$ | $0.10\%$ | Every 3 Years |
| **Commercial (Retail/Hotel)** | $1.75 \times \text{Base}$ | $0.25\%$ | Annual |
| **Mixed Use (Commercial + Res)** | $1.40 \times \text{Base}$ | $0.20\%$ | Biennial |
| **Industrial / Warehouse** | $1.50 \times \text{Base}$ | $0.20\%$ | Annual |
| **Government / Institutional** | $1.00 \times \text{Base}$ | Exempt ($0.00\%$) | Every 5 Years |

---

### 2.4 QR Code & Physical Plate Verification
1. When a property status becomes `approved`, a secure QR payload is generated:
   ```json
   {
     "code": "JIM-KB01-ABAJIF-BL01-HN101",
     "owner": "Ato Bekele Tadesse",
     "kebele": "Ginjo",
     "use": "Commercial",
     "v": 1
   }
   ```
2. The municipal signage division prints this onto metal digital address plates mounted on house gates.
3. Citizens, postal workers, emergency drivers, and tax collectors can scan the QR code to verify the legal authenticity of the address without logging into administrative consoles.

---

### 2.5 Security, Audit Logging & Password Governance
1. **Audit Trail**: Every creation, status update, approval, rejection, and deletion creates an immutable row in `audit_logs` capturing:
   - `action` (e.g., `PROPERTY_APPROVED`, `VALUATION_UPDATED`, `USER_LOGIN`)
   - `userId` & `username`
   - `entityType` & `entityId`
   - `timestamp` & IP/network metadata
2. **Password Recovery**:
   - Secure two-channel reset: Generates a cryptographically random, 1-hour expiry reset token.
   - Dispatches reset link via **Gmail SMTP** and verification SMS via **Africa's Talking**.

---

## 3. Role-Based Access Control (RBAC) Matrix

| Feature / Action | Admin | City Officer | Kebele Officer | Enumerator | Viewer |
|---|:---:|:---:|:---:|:---:|:---:|
| **Sign In & Profile** | Yes | Yes | Yes | Yes | Yes |
| **Executive Dashboard & Stats** | Full | Full | Kebele Only | Kebele Only | View Only |
| **View Properties List & Map** | City-wide | City-wide | Kebele Only | Assigned Only | View Only |
| **Register New Property** | Yes | Yes | Yes | Yes | No |
| **Verify Property (Kebele level)** | Yes | No | Yes | No | No |
| **Approve Property (City level)** | Yes | Yes | No | No | No |
| **Valuation & Tax Assessment** | Yes | Yes | View Only | No | View Only |
| **Export Official Reports** | Excel/PDF | Excel/PDF | PDF (Kebele) | No | No |
| **Setup (Kebeles, Streets, Blocks)**| Yes | Yes | No | No | No |
| **User & Role Management** | Yes | No | No | No | No |
| **View Audit Logs** | Yes | Yes | No | No | No |

---

## 4. Functional Requirements Specification

- **FR-01: Authentication & Session Management**: Users authenticate via username or email with hashed passwords (`bcryptjs`). Sessions maintained with 24-hour signed JWTs.
- **FR-02: Self-Service Password Reset**: Users can request password resets with automated email delivery (via Gmail SMTP) and SMS verification.
- **FR-03: Property Registration**: Enumerators capture comprehensive parcel data, owner ID/phone, building use, GPS lat/long, and structural photos.
- **FR-04: Automated Address Code Issuance**: System strictly auto-generates canonical Jimma address codes according to municipal spatial standards.
- **FR-05: Kebele Boundary Segregation**: Kebele officers are scoped to view and approve only properties within their designated jurisdiction.
- **FR-06: GIS Map Exploration**: Interactive Leaflet map supporting street layers, kebele polygons, status-coded pins, cluster view, and search-to-zoom.
- **FR-07: Government Assessment & Revenue Dashboards**: Live calculation of total assessed property value, expected annual tax revenue, and kebele compliance rates.
- **FR-08: Property Search & Filtering**: Multi-parameter search by address code, owner name, kebele, building use, structural type, and verification status.
- **FR-09: Digital QR Code Generation**: Instant client-side and printable SVG/PNG QR code generation for every registered and approved property.
- **FR-10: Offline / Poor Connection Resilience**: Client-side storage (`localStorage`) and service-worker caching for field enumerators operating in areas with intermittent connectivity.
- **FR-11: Administrative Setup**: Administrative modules to register and manage Kebeles, official Street Names, and Block sector boundaries.
- **FR-12: Audit Logging**: Complete traceability of administrative and field actions for anti-corruption and governance compliance.

---

## 5. Non-Functional Requirements Specification

- **NFR-01: Performance**: Web application initial paint $< 1.5$ seconds; API response time for property searches $< 120\text{ms}$ on cloud database.
- **NFR-02: Security**: Zero plaintext passwords; JWT token cryptographic verification; CORS whitelisting; parameterized SQL queries via Drizzle ORM preventing SQL injection.
- **NFR-03: Geospatial Accuracy**: GPS latitude and longitude stored with 6-decimal-place precision ($\approx 0.1\text{m}$ ground resolution).
- **NFR-04: Scalability**: Architecture capable of indexing and querying $250,000+$ urban parcels across all 17 Jimma kebeles without degradation.
- **NFR-05: Cross-Platform Accessibility**: Responsive user interface optimized for mobile tablets (field enumerators), laptops, and multi-monitor office workstations.
- **NFR-06: High Availability**: Cloud database on Neon PostgreSQL with automatic pooling, connection re-try, and multi-region replication.

---

## 6. System Architecture & Technical Stack

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT TIER (React 19)                        │
│   • Vite Bundler                     • Tailwind CSS v4 / Shadcn UI     │
│   • Leaflet GIS OpenStreetMap        • Wouter Client-Side Router       │
│   • TanStack Query (React Query)     • Recharts Analytics Engine       │
│   • Client Seed Data & Offline Mock Adapter (localStorage)             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (JSON / REST API)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        API SERVER (Express 5 ESM)                      │
│   • Router & Route Controllers       • Pino Structured JSON Logger     │
│   • JWT Auth & Role Middleware       • Multer Image Uploads            │
│   • Nodemailer (Gmail SMTP)          • Africa's Talking SMS Gateway    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SQL (node-postgres / Pooler)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       PERSISTENCE TIER (Neon Cloud)                    │
│   • PostgreSQL 16+ Serverless        • Drizzle ORM Type-Safe Queries   │
│   • Database Pooler (AWS us-east-2)  • Automated Schema Migrations     │
└────────────────────────────────────────────────────────────────────────┘
```

### Technical Component Rationale:
1. **Frontend (`artifacts/jimma-mis`)**: React 19 with Vite delivers minimal bundle sizes ($< 400\text{kB}$ gzipped), high frame rates for map panning, and reactive dashboards.
2. **Backend (`artifacts/api-server`)**: Express 5 on Node.js provides lightweight, asynchronous I/O with high concurrency for field enumerators submitting surveys simultaneously.
3. **Database (`lib/db`)**: Neon PostgreSQL offers serverless auto-scaling compute, instant point-in-time recovery, and connection pooling.
4. **Contract-First Code Generation (`lib/api-spec`)**: `openapi.yaml` acts as the single source of truth; Orval generates type-safe React Query hooks and Zod schemas automatically.

---

## 7. Database Entity Relationship Model

```
 ┌──────────────┐          1:N          ┌──────────────┐
 │   kebeles    │ ────────────────────< │   streets    │
 └──────┬───────┘                       └──────┬───────┘
        │                                      │
        │ 1:N                                  │ 1:N
        ▼                                      ▼
 ┌──────────────┐          1:N          ┌──────────────┐
 │    users     │ ────────────────────< │  properties  │
 └──────┬───────┘                       └──────┬───────┘
        │                                      │
        │ 1:N                                  │ 1:N
        ▼                                      ▼
 ┌──────────────┐                       ┌──────────────┐
 │  audit_logs  │                       │  approvals   │
 └──────────────┘                       └──────────────┘
```

### Table Definitions:
1. **`kebeles`**: `id`, `name`, `code` (unique, e.g. `GNJ`), `city`, `sub_city`, `woreda`, `status`, `created_at`.
2. **`streets`**: `id`, `name`, `code` (e.g. `ABJFR`), `kebele_id` (FK), `start_intersection`, `end_intersection`, `status`.
3. **`blocks`**: `id`, `code` (e.g. `BLK-01`), `kebele_id` (FK), `street_id` (FK).
4. **`users`**: `id`, `username`, `password_hash`, `full_name`, `email`, `phone`, `role`, `kebele_id` (FK), `is_active`, `reset_token`, `reset_token_expiry`.
5. **`properties`**: `id`, `address_code` (unique), `house_number`, `building_name`, `property_type`, `ownership_type`, `owner_name`, `owner_phone`, `occupant_name`, `occupant_phone`, `business_name`, `business_license_number`, `number_of_floors`, `building_use`, `kebele`, `street_name`, `block_code`, `latitude`, `longitude`, `property_photo`, `status` (`pending`, `kebele_verified`, `approved`, `rejected`), `remark`, `created_by` (FK), `created_at`.
6. **`approvals`**: `id`, `property_id` (FK), `reviewed_by` (FK), `role`, `status`, `comments`, `created_at`.
7. **`audit_logs`**: `id`, `action`, `entity`, `entity_id`, `user_id` (FK), `details`, `created_at`.

---

## 8. Deployment & Operational Procedures

### 8.1 Production Deployment Options
- **Vercel (Primary / Recommended for Presentation)**:
  - Configuration defined in `vercel.json`.
  - Client-side mock adapter (`mock-data-adapter.ts`) guarantees **100% uptime, zero cold starts, and immediate response** for executive demonstrations.
- **Railway / Render (Full-Stack Containerized)**:
  - Container defined in `Dockerfile` (Node 22-slim + pnpm).
  - Listens on port `5000` with Express serving both `/api` endpoints and compiled SPA static assets.

### 8.2 Operational Health & Maintenance
- **Health Check Endpoint**: `GET /api/healthz` returns `{ "status": "ok", "timestamp": ... }`.
- **Database Backup**: Neon cloud automated snapshots with daily point-in-time recovery.
- **Audit Compliance**: Municipal auditors can export annual activity logs to CSV/Excel from the Audit Logs console.

---

*Document certified for the Jimma City Digital Street Address & Housing MIS Implementation.*
