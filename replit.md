# Jimma City Digital Street Address MIS

A full-stack municipal property registration and address management system for Jimma City, Ethiopia. Field enumerators register properties with GPS coordinates, kebele/city officers approve records, and the system generates official address codes.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Leaflet/OpenStreetMap
- API: Express 5 + JWT authentication
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/` — DB tables: kebeles, streets, users, properties, approvals, property_photos, audit_logs
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/middlewares/auth.ts` — JWT middleware
- `artifacts/jimma-mis/src/` — React frontend
- `artifacts/jimma-mis/src/hooks/use-auth.tsx` — Auth context

## Default Login Credentials

| Username | Password | Role |
|---|---|---|
| admin | admin123 | Admin |
| city_officer1 | admin123 | City Officer |
| kebele_officer1 | admin123 | Kebele Officer |
| enumerator1 | admin123 | Enumerator |
| viewer1 | admin123 | Viewer |

## Address Code Format

`JIM-KB{KebeleCode}-ST{StreetCode}-BL{BlockCode}-HN{HouseNumber}`

Example: `JIM-KB01-ABAJIF-BL01-HN101`

## Approval Workflow

1. Enumerator submits property (status: `pending`)
2. Kebele Officer verifies (status: `kebele_verified`)
3. City Officer approves → system generates official address code (status: `approved`)
4. Rejected records can be edited and resubmitted

## Roles

- **Admin** — Full access, user management
- **City Officer** — Approve/reject properties
- **Kebele Officer** — Verify properties in their kebele
- **Enumerator** — Register new properties
- **Viewer** — Read-only access

## Architecture decisions

- Contract-first: OpenAPI spec gates codegen, which gates frontend hooks — no manual type duplication
- JWT stored in localStorage, sent as `Authorization: Bearer` header via `setAuthTokenGetter` in `@workspace/api-client-react/custom-fetch`
- Leaflet + OpenStreetMap for GIS (no API key needed, open tiles)
- Address code auto-generated on approval: `JIM-KB{kebele}-ST{street}-BL{block}-HN{house}`
- Role-based access enforced on both frontend (UI visibility) and backend (route middleware)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- `JWT_SECRET` env var defaults to a hardcoded dev string — set it properly in production
- Leaflet marker icons need CDN workaround for default icons in Vite builds

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
