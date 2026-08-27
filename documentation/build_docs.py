from pathlib import Path
from html import escape
from weasyprint import HTML, CSS


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "pdf"
ASSETS = ROOT / "assets"
OUT.mkdir(parents=True, exist_ok=True)


PAGE_CSS = """
@page {
  size: A4;
  margin: 18mm 16mm 18mm 16mm;
  @bottom-left {
    content: "Jimma City Digital Street Address MIS";
    color: #64748b;
    font-size: 8pt;
  }
  @bottom-right {
    content: "Page " counter(page) " of " counter(pages);
    color: #64748b;
    font-size: 8pt;
  }
}
* { box-sizing: border-box; }
body {
  font-family: "DejaVu Sans", Arial, sans-serif;
  color: #172033;
  font-size: 9.5pt;
  line-height: 1.48;
  margin: 0;
}
h1, h2, h3, h4 { color: #0d3b66; margin: 0 0 7px; line-height: 1.2; }
h1 { font-size: 28pt; letter-spacing: -0.5px; }
h2 { font-size: 17pt; margin-top: 18px; border-bottom: 2px solid #1f9d67; padding-bottom: 5px; }
h3 { font-size: 12pt; margin-top: 13px; color: #14532d; }
h4 { font-size: 10pt; margin-top: 9px; color: #334155; }
p { margin: 5px 0 8px; }
ul, ol { margin: 5px 0 10px 17px; padding-left: 10px; }
li { margin: 3px 0; }
strong { color: #0f172a; }
.cover {
  min-height: 245mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 10mm 7mm;
  border-left: 9px solid #0d3b66;
  background: linear-gradient(135deg, #eef7ff 0%, #f7fbf9 65%, #e8f5ee 100%);
}
.cover .logo { width: 78px; height: 78px; object-fit: contain; margin-bottom: 18px; }
.cover .eyebrow { color: #1f9d67; text-transform: uppercase; letter-spacing: 2px; font-size: 9pt; font-weight: 700; }
.cover .subtitle { font-size: 14pt; color: #334155; max-width: 145mm; margin-top: 12px; }
.cover .meta { border-top: 1px solid #b9c9d8; padding-top: 10px; color: #475569; font-size: 9pt; }
.callout {
  background: #eef7ff;
  border-left: 4px solid #0d3b66;
  padding: 8px 11px;
  margin: 9px 0 12px;
}
.success {
  background: #edf9f2;
  border-left: 4px solid #1f9d67;
  padding: 8px 11px;
  margin: 9px 0 12px;
}
.warning {
  background: #fff8e6;
  border-left: 4px solid #d69e2e;
  padding: 8px 11px;
  margin: 9px 0 12px;
}
.danger {
  background: #fff1f2;
  border-left: 4px solid #c53030;
  padding: 8px 11px;
  margin: 9px 0 12px;
}
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.card {
  border: 1px solid #d8e2ea;
  border-radius: 6px;
  padding: 9px 10px;
  background: #fff;
}
.card h3 { margin-top: 0; }
.metric { font-size: 17pt; font-weight: 700; color: #0d3b66; }
.small { font-size: 8pt; color: #64748b; }
.muted { color: #64748b; }
.nowrap { white-space: nowrap; }
table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0 13px;
  font-size: 8.6pt;
}
th {
  background: #0d3b66;
  color: white;
  font-weight: 700;
  text-align: left;
  padding: 6px 7px;
}
td {
  border: 1px solid #d8e2ea;
  padding: 5px 7px;
  vertical-align: top;
}
tr:nth-child(even) td { background: #f8fafc; }
.badge {
  display: inline-block;
  border-radius: 20px;
  padding: 2px 7px;
  font-size: 8pt;
  font-weight: 700;
  background: #e8f5ee;
  color: #14532d;
}
.badge-blue { background: #e8f1fb; color: #0d3b66; }
.badge-amber { background: #fff4cf; color: #854d0e; }
.badge-red { background: #ffe4e6; color: #9f1239; }
.code {
  font-family: "DejaVu Sans Mono", monospace;
  background: #f1f5f9;
  color: #0f172a;
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 8.5pt;
}
.step {
  display: flex;
  gap: 10px;
  margin: 8px 0;
  page-break-inside: avoid;
}
.step-num {
  flex: 0 0 24px;
  height: 24px;
  border-radius: 50%;
  background: #0d3b66;
  color: white;
  text-align: center;
  padding-top: 3px;
  font-weight: 700;
}
.step-body { flex: 1; border-bottom: 1px solid #e2e8f0; padding-bottom: 7px; }
.step-body h3 { margin: 0 0 3px; }
.flow {
  display: flex;
  align-items: stretch;
  gap: 5px;
  margin: 12px 0 17px;
}
.flow-box {
  flex: 1;
  border: 1px solid #bdd1df;
  border-top: 4px solid #1f9d67;
  border-radius: 5px;
  padding: 8px 6px;
  text-align: center;
  background: #f8fcfa;
  font-size: 8pt;
}
.flow-arrow { align-self: center; color: #64748b; font-size: 15pt; font-weight: 700; }
.screenshot {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  margin: 5px 0 3px;
}
.screenshot-half { width: 100%; max-height: 105mm; object-fit: contain; }
.caption { text-align: center; color: #64748b; font-size: 8pt; margin-bottom: 10px; }
.page-break { page-break-before: always; }
.avoid-break { page-break-inside: avoid; }
.toc li { margin: 5px 0; }
.footer-note { margin-top: 18px; padding-top: 8px; border-top: 1px solid #cbd5e1; font-size: 8pt; color: #64748b; }
"""


def img(name: str, cls: str = "screenshot") -> str:
    path = ASSETS / name
    return f'<img class="{cls}" src="{path.as_uri()}" alt="{escape(name)}">'


def cover(title: str, subtitle: str, document_id: str) -> str:
    return f"""
    <section class="cover">
      <div>
        {img("jimma-logo.png", "logo")}
        <div class="eyebrow">Jimma City Administration</div>
        <h1>{escape(title)}</h1>
        <p class="subtitle">{escape(subtitle)}</p>
        <div class="success"><strong>Purpose:</strong> Practical reference for implementation, operations, training, and handover of the Jimma City Digital Street Address MIS.</div>
      </div>
      <div class="meta">
        <strong>Document:</strong> {escape(document_id)}<br>
        <strong>Prepared:</strong> 27 August 2026<br>
        <strong>System:</strong> Jimma City Digital Street Address MIS
      </div>
    </section>
    """


def render(filename: str, title: str, body: str, subtitle: str, document_id: str) -> Path:
    html = f"""<!doctype html>
    <html><head><meta charset="utf-8"><title>{escape(title)}</title></head>
    <body>{cover(title, subtitle, document_id)}<div class="page-break"></div>{body}
    <div class="footer-note">Controlled reference document. Update this document when the approved workflow, roles, integrations, or deployment configuration changes.</div>
    </body></html>"""
    output = OUT / filename
    HTML(string=html, base_url=str(ROOT)).write_pdf(output, stylesheets=[CSS(string=PAGE_CSS)])
    return output


requirements_body = """
<h2>1. System overview</h2>
<p>The Jimma City Digital Street Address MIS is a municipal property registration and address management system. Field enumerators capture property information, location, GPS, and evidence photographs. Kebele Officers verify records, City Officers complete final approval, and the system generates an official address code.</p>
<div class="callout"><strong>Address code format:</strong> <span class="code">JIM-KB{KebeleCode}-ST{StreetCode}-BL{BlockCode}-HN{HouseNumber}</span>. Example: <span class="code">JIM-KB01-ABAJIF-BL01-HN101</span>.</div>

<h2>2. Functional requirements</h2>
<table>
  <tr><th>ID</th><th>Capability</th><th>Expected behavior</th><th>Primary users</th></tr>
  <tr><td>FR-01</td><td>Authentication</td><td>Sign in, sign out, session validation, and protected application routes.</td><td>All users</td></tr>
  <tr><td>FR-02</td><td>Password recovery</td><td>Request a reset by username, send a time-limited reset link by email, and allow a one-time password change.</td><td>All users</td></tr>
  <tr><td>FR-03</td><td>Role-based access</td><td>Show and enforce functions according to Administrator, City Officer, Kebele Officer, Enumerator, and Viewer roles.</td><td>System</td></tr>
  <tr><td>FR-04</td><td>Master data</td><td>Create, edit, view, and administer kebeles, streets, and blocks. Active location values are used during property capture.</td><td>Administrator, City Officer; limited view for other roles</td></tr>
  <tr><td>FR-05</td><td>Property registration</td><td>Capture owner, contact, property type, ownership, building details, kebele, street, block, house number, and remarks.</td><td>Enumerator, Administrator</td></tr>
  <tr><td>FR-06</td><td>GPS capture</td><td>Capture current latitude and longitude from a supported device/browser or enter coordinates where permitted.</td><td>Enumerator</td></tr>
  <tr><td>FR-07</td><td>Evidence photos</td><td>Upload and classify front view, side view, business sign, document, or other photos. A front-view photo is required for submission.</td><td>Enumerator, Administrator</td></tr>
  <tr><td>FR-08</td><td>Duplicate protection</td><td>Check likely duplicate property information before creating a new record.</td><td>Enumerator, reviewers</td></tr>
  <tr><td>FR-09</td><td>Offline field work</td><td>Save field records locally as drafts while offline and sync them when connectivity returns.</td><td>Enumerator</td></tr>
  <tr><td>FR-10</td><td>Approval workflow</td><td>Submit for verification, verify at kebele level, approve at city level, reject with a required reason, and resubmit corrected records.</td><td>Enumerator, Kebele Officer, City Officer</td></tr>
  <tr><td>FR-11</td><td>Official addressing</td><td>Generate and display the official address code when City Officer approval is completed.</td><td>City Officer, Administrator; read-only visibility for others</td></tr>
  <tr><td>FR-12</td><td>Notifications</td><td>Send two separate SMS alerts to the owner: after Kebele verification and after final City approval. Delivery requires valid Africa's Talking configuration.</td><td>Property owner; system operators</td></tr>
  <tr><td>FR-13</td><td>Dashboard and analytics</td><td>Show totals, status distribution, kebele grouping, recent properties, trend information, and enumerator performance.</td><td>All authenticated users according to access</td></tr>
  <tr><td>FR-14</td><td>GIS map</td><td>Display properties with GPS coordinates on an interactive Leaflet/OpenStreetMap map and link map locations to property records.</td><td>All authenticated users</td></tr>
  <tr><td>FR-15</td><td>Reports</td><td>Filter property data, view address and property reports, and export report results where enabled.</td><td>All authenticated users according to access</td></tr>
  <tr><td>FR-16</td><td>Audit trail</td><td>Record important property, approval, user, and report actions for accountability and review.</td><td>Administrator, City Officer; review access for operational roles</td></tr>
  <tr><td>FR-17</td><td>User administration</td><td>Create, search, filter, update, activate/deactivate, and delete users. Kebele assignment is required for Kebele Officer and Enumerator roles.</td><td>Administrator; City Officer has management visibility</td></tr>
</table>

<h2>3. Non-functional requirements</h2>
<table>
  <tr><th>Quality area</th><th>Requirement</th><th>Operational measure / acceptance guidance</th></tr>
  <tr><td>Security</td><td>Protected routes, role checks, hashed passwords, bearer-token authentication, time-limited password reset tokens, and secret values kept outside source code.</td><td>Test every role against both permitted and denied actions; rotate production secrets before go-live.</td></tr>
  <tr><td>Availability</td><td>Web application and API should run as separate restartable services with a health endpoint.</td><td>Monitor <span class="code">/api/healthz</span>; restart a failed service without changing stored data.</td></tr>
  <tr><td>Performance</td><td>Lists, dashboard summaries, and filters should remain responsive for the expected municipal dataset.</td><td>Use pagination, indexed status/kebele/property fields, and report filters rather than loading all records unnecessarily.</td></tr>
  <tr><td>Data integrity</td><td>Required owner and location fields, approval status transitions, rejection reasons, and database relationships must be validated.</td><td>Do not approve a record that is missing required evidence or review information.</td></tr>
  <tr><td>Usability</td><td>Users should complete their common task with clear labels, visible status, and actionable error messages.</td><td>Enumerator can save offline; reviewer can understand the next action from the property status.</td></tr>
  <tr><td>Mobile readiness</td><td>Field collection must work on a phone-sized screen and tolerate intermittent connectivity.</td><td>Test GPS permission, camera/photo upload, offline draft saving, and later synchronization on the field device.</td></tr>
  <tr><td>Maintainability</td><td>API contract, generated client types, shared database schema, and frontend modules should remain synchronized.</td><td>Regenerate API clients after OpenAPI changes and run type checking before release.</td></tr>
  <tr><td>Auditability</td><td>Approvals, rejection reasons, user actions, and exports should be traceable to an actor and timestamp.</td><td>Review the Audit Logs page during monthly data-quality checks.</td></tr>
  <tr><td>Scalability</td><td>Support more kebeles, streets, blocks, users, photos, and properties without changing the business process.</td><td>Keep media storage and database backups independent from the application process.</td></tr>
  <tr><td>Interoperability</td><td>Use HTTP/JSON APIs, OpenAPI documentation, PostgreSQL, standard image uploads, OpenStreetMap tiles, and Africa's Talking SMS integration.</td><td>Document credentials and external service configuration per environment.</td></tr>
</table>

<h2>4. Acceptance checklist</h2>
<div class="grid">
  <div class="card"><h3>Registration</h3><ul><li>Owner and phone are captured.</li><li>Kebele, street, block, and house number are valid.</li><li>GPS and front photo are present before submission.</li><li>Duplicate warning is reviewed.</li></ul></div>
  <div class="card"><h3>Review</h3><ul><li>Kebele Officer verifies or rejects with a reason.</li><li>City Officer approves or rejects with a reason.</li><li>Approved records have an address code.</li><li>SMS events are logged operationally.</li></ul></div>
  <div class="card"><h3>Operations</h3><ul><li>Backups are scheduled.</li><li>Health check is monitored.</li><li>Demo passwords are changed.</li><li>Production SMS and email credentials are tested.</li></ul></div>
</div>
"""

technology_body = """
<h2>1. Technology stack</h2>
<table>
  <tr><th>Layer</th><th>Technology</th><th>Use in the system</th></tr>
  <tr><td>Frontend</td><td>React, TypeScript, Vite</td><td>Single-page municipal operations interface and responsive field collection screens.</td></tr>
  <tr><td>UI</td><td>Tailwind CSS, Radix UI primitives, Lucide icons</td><td>Consistent forms, navigation, dialogs, tables, badges, and responsive layouts.</td></tr>
  <tr><td>Routing</td><td>Wouter</td><td>Application routes such as Dashboard, Properties, Map, Reports, Users, Setup, and Mobile Collection.</td></tr>
  <tr><td>Data fetching</td><td>TanStack React Query</td><td>Query caching, mutations, loading states, and refetching for API data.</td></tr>
  <tr><td>Forms and validation</td><td>React Hook Form, Zod</td><td>Validated property, user, setup, authentication, and review inputs.</td></tr>
  <tr><td>Charts</td><td>Recharts</td><td>Dashboard trends, status distribution, kebele counts, and performance views.</td></tr>
  <tr><td>GIS</td><td>Leaflet and OpenStreetMap</td><td>Map view of properties with latitude and longitude; no commercial map API key required.</td></tr>
  <tr><td>Backend</td><td>Node.js, TypeScript, Express 5</td><td>REST API, business rules, authorization, uploads, reports, and integration endpoints.</td></tr>
  <tr><td>Authentication</td><td>JWT, bcryptjs</td><td>Bearer-token sessions and secure password hashing. Tokens are stored by the web client.</td></tr>
  <tr><td>Database</td><td>PostgreSQL, Drizzle ORM, drizzle-zod</td><td>Users, kebeles, streets, blocks, properties, approvals, property photos, and audit logs.</td></tr>
  <tr><td>API contract</td><td>OpenAPI 3.1, Orval, generated React Query hooks and Zod schemas</td><td>Contract-first alignment between API routes, frontend hooks, and validation types.</td></tr>
  <tr><td>Files</td><td>Multer-based image uploads</td><td>Stores and serves property evidence photos with category metadata.</td></tr>
  <tr><td>Email</td><td>Nodemailer with SMTP</td><td>Password reset email delivery using configured SMTP credentials.</td></tr>
  <tr><td>SMS</td><td>Africa's Talking SDK</td><td>Separate owner notifications for Kebele verification and City approval. Sandbox is for testing.</td></tr>
  <tr><td>Logging</td><td>Pino and pino-http</td><td>Structured API request and operational logging.</td></tr>
  <tr><td>Workspace</td><td>pnpm monorepo</td><td>Separates deployable artifacts from shared API client, API specification, and database libraries.</td></tr>
</table>

<h2>2. Main data entities</h2>
<div class="grid-3">
  <div class="card"><h3>Users</h3><p>Username, password hash, name, email, phone, role, Kebele assignment, and active status.</p></div>
  <div class="card"><h3>Properties</h3><p>Owner, contacts, address components, property type, ownership, floors, GPS, status, and remarks.</p></div>
  <div class="card"><h3>Approvals</h3><p>Property, action, actor, remark, and timestamp for verification, approval, rejection, or resubmission.</p></div>
  <div class="card"><h3>Locations</h3><p>Kebeles, streets, and blocks form the address hierarchy used by capture and code generation.</p></div>
  <div class="card"><h3>Photos</h3><p>Property photo URL, filename, file type, category, uploader, and timestamp.</p></div>
  <div class="card"><h3>Audit logs</h3><p>Actor, action, entity, before/after values, device/IP details, and timestamp.</p></div>
</div>

<h2>3. External services and environment configuration</h2>
<table>
  <tr><th>Configuration</th><th>Purpose</th><th>Required for</th></tr>
  <tr><td><span class="code">DATABASE_URL</span></td><td>PostgreSQL connection string</td><td>All API data operations</td></tr>
  <tr><td><span class="code">JWT_SECRET</span></td><td>Production signing secret for authentication tokens</td><td>Secure production authentication</td></tr>
  <tr><td><span class="code">SMTP_FROM_EMAIL</span></td><td>Sender address for password recovery emails</td><td>Password reset delivery</td></tr>
  <tr><td><span class="code">SMTP_APP_PASSWORD</span></td><td>SMTP provider app password; never paste into documentation or source code</td><td>Password reset delivery</td></tr>
  <tr><td><span class="code">AT_USERNAME</span></td><td>Africa's Talking account or sandbox username</td><td>SMS delivery</td></tr>
  <tr><td><span class="code">AT_API_KEY</span></td><td>Africa's Talking API key; sandbox and production keys differ</td><td>SMS delivery</td></tr>
</table>
<div class="warning"><strong>SMS note:</strong> Africa's Talking sandbox confirms requests in the simulator; it does not represent production handset delivery. Use a registered sender ID, the correct environment key, and funded/approved production configuration for live notifications.</div>

<h2>4. Technology hands-on orientation</h2>
<ol>
  <li>Open the web application and sign in with an assigned role.</li>
  <li>Use Dashboard to understand current data volume and status distribution.</li>
  <li>Use Properties to search, filter, open a record, and follow its status history.</li>
  <li>Use Map View to inspect GPS coverage and identify records without coordinates.</li>
  <li>Use Reports to filter and export operational lists.</li>
  <li>Use Setup only when authorized to maintain the kebele, street, and block hierarchy.</li>
  <li>Use Audit Logs to review who changed or approved a record.</li>
</ol>
"""

deployment_body = """
<h2>1. Deployment model</h2>
<p>The system is deployed as two coordinated services: a React/Vite web service for the browser interface and an Express API service for business logic and data. A PostgreSQL database stores transactional data, while property photos are stored in the API upload area or an approved persistent storage target.</p>
<div class="flow">
  <div class="flow-box"><strong>Browser</strong><br>Jimma MIS web app</div>
  <div class="flow-arrow">→</div>
  <div class="flow-box"><strong>API</strong><br>Express REST service</div>
  <div class="flow-arrow">→</div>
  <div class="flow-box"><strong>Database</strong><br>PostgreSQL / Drizzle</div>
  <div class="flow-arrow">→</div>
  <div class="flow-box"><strong>Services</strong><br>SMTP + Africa's Talking</div>
</div>

<h2>2. Release strategy</h2>
<div class="step"><div class="step-num">1</div><div class="step-body"><h3>Prepare</h3><p>Confirm the approved code version, database backup, environment values, SMS/email provider status, and an identified release owner.</p></div></div>
<div class="step"><div class="step-num">2</div><div class="step-body"><h3>Validate</h3><p>Run workspace type checks and build checks. If the API contract changes, regenerate the client hooks and schemas before building the frontend.</p></div></div>
<div class="step"><div class="step-num">3</div><div class="step-body"><h3>Apply database changes</h3><p>Apply schema changes to the target database using the approved migration/push process. Take a backup before destructive or structural changes.</p></div></div>
<div class="step"><div class="step-num">4</div><div class="step-body"><h3>Deploy services</h3><p>Deploy/restart the API and web services using the managed workflows. Keep the API reachable at the <span class="code">/api</span> path and keep the web application at the root path.</p></div></div>
<div class="step"><div class="step-num">5</div><div class="step-body"><h3>Smoke test</h3><p>Open login, sign in, load Dashboard, open Properties, view Map, open Reports, and perform one controlled approval test using non-production data.</p></div></div>
<div class="step"><div class="step-num">6</div><div class="step-body"><h3>Monitor and hand over</h3><p>Check the API health endpoint, application logs, database connectivity, upload access, password reset email, and SMS simulator/provider result.</p></div></div>

<h2>3. Operational checklist</h2>
<table>
  <tr><th>Area</th><th>Before release</th><th>After release</th></tr>
  <tr><td>Database</td><td>Backup completed; connection and schema reviewed; retention policy confirmed.</td><td>Run a read-only count check and verify new records can be read and written.</td></tr>
  <tr><td>Secrets</td><td>Use production-only values for database, JWT, SMTP, and SMS; keep them in managed secrets.</td><td>Confirm no secret appears in logs, screenshots, PDFs, or source control.</td></tr>
  <tr><td>Users</td><td>Confirm administrator and approver accounts; disable unused demo users.</td><td>Test each operational role with least-privilege actions.</td></tr>
  <tr><td>Notifications</td><td>Confirm owner phone format, sender configuration, and sandbox/production mode.</td><td>Trigger one controlled Kebele verification and City approval notification.</td></tr>
  <tr><td>Media</td><td>Confirm upload location is persistent and backed up; check file size/type limits.</td><td>Upload and view one approved test photo.</td></tr>
  <tr><td>Availability</td><td>Confirm web and API workflows are configured and restartable.</td><td>Check logs and <span class="code">/api/healthz</span>; document any warning.</td></tr>
  <tr><td>Rollback</td><td>Identify the prior known-good release and database recovery point.</td><td>Use rollback only after assessing data changes and user impact.</td></tr>
</table>

<h2>4. Backup, monitoring, and continuity</h2>
<ul>
  <li>Back up PostgreSQL on a schedule appropriate for daily property collection; retain at least one off-service copy.</li>
  <li>Back up property evidence photos together with the database reference data, or use persistent object storage with its own retention policy.</li>
  <li>Monitor API errors, database connection failures, upload errors, email failures, and SMS failures separately.</li>
  <li>Maintain a service contact list for database, hosting, email, and SMS provider support.</li>
  <li>Practice restoring a backup before the system is considered production-ready.</li>
</ul>
<div class="danger"><strong>Production safety:</strong> Change all demo passwords, set a strong <span class="code">JWT_SECRET</span>, and use valid production provider credentials. Do not distribute demo credentials as real operational credentials.</div>

<h2>5. Example run commands for maintainers</h2>
<p>The managed project provides the following maintainer commands:</p>
<table>
  <tr><th>Command</th><th>Purpose</th></tr>
  <tr><td><span class="code">pnpm --filter @workspace/api-server run dev</span></td><td>Run the API service in development.</td></tr>
  <tr><td><span class="code">pnpm run typecheck</span></td><td>Check shared libraries and application packages.</td></tr>
  <tr><td><span class="code">pnpm run build</span></td><td>Run type checking and package builds.</td></tr>
  <tr><td><span class="code">pnpm --filter @workspace/api-spec run codegen</span></td><td>Regenerate API client and validation outputs after OpenAPI changes.</td></tr>
  <tr><td><span class="code">pnpm --filter @workspace/db run push</span></td><td>Apply approved development database schema changes.</td></tr>
</table>
"""

manual_body = """
<h2>1. Who should use this manual?</h2>
<p>This guide is for Administrators, City Officers, Kebele Officers, Enumerators, and Viewers. Your assigned role determines the pages and actions available after sign-in.</p>
<div class="callout"><strong>Golden rule:</strong> The person who collects a property record should not be the only person who approves it. Use the two-stage review: Kebele verification, then City approval.</div>

<h2>2. Sign in</h2>
<div class="grid">
  <div>
    {login_image}
    <div class="caption">Figure 1. Current Jimma MIS sign-in screen.</div>
  </div>
  <div class="card">
    <h3>Steps</h3>
    <ol><li>Open the Jimma MIS web address.</li><li>Enter your assigned username.</li><li>Enter your password.</li><li>Select <strong>Sign In</strong>.</li></ol>
    <h3>If you forgot your password</h3>
    <ol><li>Select <strong>Forgot password?</strong>.</li><li>Enter your username.</li><li>Open the reset email sent to your registered address.</li><li>Choose a new password and return to Sign In.</li></ol>
    <div class="small">Only authorized Jimma City Administration personnel should use the system.</div>
  </div>
</div>

<h2>3. Main navigation</h2>
<table>
  <tr><th>Page</th><th>Use it for</th></tr>
  <tr><td>Dashboard</td><td>View totals, status counts, trends, kebele summaries, and recent property activity.</td></tr>
  <tr><td>Properties</td><td>Search records, filter by status/kebele/type, open details, and start or review property work.</td></tr>
  <tr><td>Map View</td><td>Inspect records with GPS coordinates and open the related property.</td></tr>
  <tr><td>Reports</td><td>Filter and export operational property reports.</td></tr>
  <tr><td>Mobile Collection</td><td>Enumerator-only field workflow for online capture and offline drafts.</td></tr>
  <tr><td>Users</td><td>Administrator and City Officer user-management view.</td></tr>
  <tr><td>Setup</td><td>Maintain kebeles, streets, and blocks when authorized.</td></tr>
  <tr><td>Audit Logs</td><td>Review traceable system and data actions.</td></tr>
</table>

<h2>4. Register a property online</h2>
<div class="step"><div class="step-num">1</div><div class="step-body"><h3>Open the new property form</h3><p>Choose <strong>Properties</strong>, then start a new property record.</p></div></div>
<div class="step"><div class="step-num">2</div><div class="step-body"><h3>Enter location</h3><p>Select the kebele, street, block, and house number. These values are used for address management.</p></div></div>
<div class="step"><div class="step-num">3</div><div class="step-body"><h3>Enter property and owner details</h3><p>Enter owner name and phone, property type, ownership type, building name/use, number of floors, occupant/business details, and remarks as applicable.</p></div></div>
<div class="step"><div class="step-num">4</div><div class="step-body"><h3>Capture GPS</h3><p>Select <strong>Capture Current GPS</strong> on a device with location permission, or enter the allowed coordinates. Confirm the point is near the property.</p></div></div>
<div class="step"><div class="step-num">5</div><div class="step-body"><h3>Add evidence photos</h3><p>Upload at least one <strong>Front View</strong> photo. Add side view, business sign, or document photos when useful.</p></div></div>
<div class="step"><div class="step-num">6</div><div class="step-body"><h3>Check duplicates and submit</h3><p>Review any duplicate warning. Save as a draft if information is incomplete, or submit for verification when GPS, required fields, and front photo are ready.</p></div></div>

<h2>5. Work offline on a mobile device</h2>
<ol>
  <li>Open <strong>Mobile Collection</strong> as an Enumerator.</li>
  <li>Complete the field form and capture GPS/photos when the device allows.</li>
  <li>Select <strong>Save Offline Draft</strong> when the network is unavailable.</li>
  <li>Open <strong>Drafts</strong> to review or delete a local draft.</li>
  <li>When connected, synchronize the draft. Confirm it appears as saved to the server.</li>
  <li>Submit online for Kebele verification once the record is complete.</li>
</ol>
<div class="warning">Offline saving protects field work, but it does not complete approval. A draft must synchronize and then enter the normal review workflow.</div>

<h2>6. Review and approval</h2>
<table>
  <tr><th>Status</th><th>Meaning</th><th>Next action</th></tr>
  <tr><td><span class="badge-amber badge">Draft</span></td><td>Work is saved but not submitted.</td><td>Complete required data and submit.</td></tr>
  <tr><td><span class="badge-amber badge">Pending</span></td><td>Submitted and waiting for review.</td><td>Kebele Officer checks the record.</td></tr>
  <tr><td><span class="badge-blue badge">Kebele Verified</span></td><td>Kebele-level review is complete.</td><td>City Officer performs final decision.</td></tr>
  <tr><td><span class="badge badge">Approved</span></td><td>Final decision accepted; official address code is available.</td><td>Use the code in reports and official communication.</td></tr>
  <tr><td><span class="badge-red badge">Rejected</span></td><td>Reviewer found an issue and entered a reason.</td><td>Enumerator corrects the record and resubmits.</td></tr>
</table>

<h2>7. Owner SMS alerts</h2>
<p>When the owner phone is present and SMS integration is configured, the system sends two different alerts:</p>
<ol><li><strong>Kebele verification:</strong> confirms the property was verified and is waiting for final City approval.</li><li><strong>City approval:</strong> confirms official approval and includes the generated address code.</li></ol>
<p>For a failed or missing SMS configuration, continue the record workflow, then report the delivery issue to the system Administrator. Never ask an owner to share an API key.</p>

<h2>8. Password reset screen</h2>
{reset_image}
<div class="caption">Figure 2. Password reset screen. A real reset link is required before the new-password form is shown.</div>

<h2>9. Common problems</h2>
<table>
  <tr><th>Problem</th><th>What to check</th></tr>
  <tr><td>Cannot sign in</td><td>Check username/password, account active status, and whether the API service is available.</td></tr>
  <tr><td>GPS is missing</td><td>Enable device location permission, move outdoors if appropriate, and retry. Do not submit without required GPS.</td></tr>
  <tr><td>Photo will not upload</td><td>Use a supported image type and keep it within the system size limit. Confirm network connectivity.</td></tr>
  <tr><td>Record is rejected</td><td>Read the rejection remark, correct the data, and use Resubmit for Approval.</td></tr>
  <tr><td>SMS not received</td><td>Confirm owner phone format, SMS provider environment/key, sender configuration, and simulator/provider logs.</td></tr>
  <tr><td>Page is blank or stuck loading</td><td>Refresh once, check network, then contact the Administrator to check API health and logs.</td></tr>
</table>
""".format(
    login_image=img("login-screen.jpg", "screenshot-half"),
    reset_image=img("reset-password-screen.jpg", "screenshot-half"),
)

users_body = """
<h2>1. Role and user list</h2>
<p>The following list describes the supported user accounts and the responsibilities attached to each role. Assign each person only the access needed for their work.</p>
<table>
  <tr><th>Role</th><th>Recommended user group</th><th>Scope</th><th>Key responsibilities</th></tr>
  <tr><td><strong>Administrator</strong></td><td>System administrator / MIS lead</td><td>All city data and configuration</td><td>Manage users, maintain setup data, monitor audit logs, manage records, and support all workflows.</td></tr>
  <tr><td><strong>City Officer</strong></td><td>City-level approval team</td><td>City-wide review and management visibility</td><td>Final approval/rejection, address generation, reports, user-management visibility, setup, and audit review.</td></tr>
  <tr><td><strong>Kebele Officer</strong></td><td>Kebele verification team</td><td>Assigned kebele operational review</td><td>Verify or reject submitted properties, review evidence, and maintain review accountability.</td></tr>
  <tr><td><strong>Enumerator</strong></td><td>Field collection team</td><td>Assigned data collection work</td><td>Register properties, capture GPS/photos, save offline drafts, submit, correct, and resubmit rejected records.</td></tr>
  <tr><td><strong>Viewer</strong></td><td>Read-only stakeholders</td><td>Read-only application view</td><td>Review dashboards, properties, maps, reports, and permitted setup views without changing records.</td></tr>
</table>

<h2>2. Permission matrix</h2>
<table>
  <tr><th>Function</th><th>Admin</th><th>City Officer</th><th>Kebele Officer</th><th>Enumerator</th><th>Viewer</th></tr>
  <tr><td>Sign in and view dashboard</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
  <tr><td>View/search properties</td><td>Full</td><td>Full</td><td>Operational</td><td>Own/assigned work</td><td>Read-only</td></tr>
  <tr><td>Create property</td><td>Yes</td><td>Review role</td><td>Review role</td><td>Yes</td><td>No</td></tr>
  <tr><td>Edit draft/rejected property</td><td>Yes</td><td>As authorized</td><td>As authorized</td><td>Yes</td><td>No</td></tr>
  <tr><td>Submit for verification</td><td>Yes</td><td>As authorized</td><td>As authorized</td><td>Yes</td><td>No</td></tr>
  <tr><td>Kebele verify</td><td>Yes</td><td>Yes</td><td>Yes</td><td>No</td><td>No</td></tr>
  <tr><td>Final approve and generate address</td><td>Yes</td><td>Yes</td><td>No</td><td>No</td><td>No</td></tr>
  <tr><td>Reject with remark</td><td>Yes</td><td>Yes</td><td>Yes</td><td>No</td><td>No</td></tr>
  <tr><td>Map and reports</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
  <tr><td>Maintain kebeles/streets/blocks</td><td>Yes</td><td>Yes</td><td>View/limited</td><td>No</td><td>View</td></tr>
  <tr><td>Manage users</td><td>Yes</td><td>Visible management view; creation policy should be governed by Administration</td><td>No</td><td>No</td><td>No</td></tr>
  <tr><td>Audit log review</td><td>Yes</td><td>Yes</td><td>Operational review</td><td>Operational review</td><td>No</td></tr>
  <tr><td>Mobile/offline collection</td><td>As needed</td><td>No</td><td>No</td><td>Yes</td><td>No</td></tr>
</table>

<h2>3. Demo/test users</h2>
<div class="danger"><strong>Demo-only:</strong> The credentials below are documented for controlled training and testing. Change or disable them before production use.</div>
<table>
  <tr><th>Username</th><th>Password</th><th>Role</th><th>Training purpose</th></tr>
  <tr><td><span class="code">admin</span></td><td><span class="code">admin123</span></td><td>Administrator</td><td>Full system demonstration</td></tr>
  <tr><td><span class="code">city_officer1</span></td><td><span class="code">admin123</span></td><td>City Officer</td><td>Final approval demonstration</td></tr>
  <tr><td><span class="code">kebele_officer1</span></td><td><span class="code">admin123</span></td><td>Kebele Officer</td><td>Kebele verification demonstration</td></tr>
  <tr><td><span class="code">enumerator1</span></td><td><span class="code">admin123</span></td><td>Enumerator</td><td>Online, mobile, and offline capture</td></tr>
  <tr><td><span class="code">viewer1</span></td><td><span class="code">admin123</span></td><td>Viewer</td><td>Read-only demonstration</td></tr>
</table>

<h2>4. New-user provisioning checklist</h2>
<ol>
  <li>Confirm the person, department, role, and kebele assignment where applicable.</li>
  <li>Use a unique username and collect a verified work email and phone number where notifications are required.</li>
  <li>Assign the least-privilege role; Kebele Officer and Enumerator accounts require a kebele assignment.</li>
  <li>Give the user a temporary password and require a password reset or secure change at first operational use.</li>
  <li>Test sign-in and one permitted action, then test one denied action.</li>
  <li>Record the provisioning decision in the approved administrative register.</li>
</ol>

<h2>5. User register template</h2>
<table>
  <tr><th>Full name</th><th>Department</th><th>Username</th><th>Role</th><th>Kebele</th><th>Phone/email verified</th><th>Active</th><th>Review date</th></tr>
  <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
  <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
  <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
</table>
"""

workflow_body = """
<h2>1. End-to-end property workflow</h2>
<p>The workflow separates field collection, Kebele verification, and City approval. Each state tells the next person what to do.</p>
<div class="flow">
  <div class="flow-box"><strong>Draft</strong><br>Enumerator saves work</div>
  <div class="flow-arrow">→</div>
  <div class="flow-box"><strong>Pending</strong><br>Submitted for review</div>
  <div class="flow-arrow">→</div>
  <div class="flow-box"><strong>Kebele Verified</strong><br>Local verification done</div>
  <div class="flow-arrow">→</div>
  <div class="flow-box"><strong>Approved</strong><br>Address code generated</div>
</div>
<div class="flow">
  <div class="flow-box" style="border-top-color:#c53030;"><strong>Rejected</strong><br>Reason required</div>
  <div class="flow-arrow">↺</div>
  <div class="flow-box"><strong>Correct and Resubmit</strong><br>Enumerator fixes data</div>
  <div class="flow-arrow">→</div>
  <div class="flow-box"><strong>Pending</strong><br>Review starts again</div>
</div>

<h2>2. Workflow by actor</h2>
<table>
  <tr><th>Actor</th><th>Inputs</th><th>Action</th><th>Output / handoff</th></tr>
  <tr><td>Enumerator</td><td>Owner information, property details, location, GPS, photos</td><td>Create a property, check duplicates, save online/offline, and submit for verification.</td><td>Pending property with evidence.</td></tr>
  <tr><td>Kebele Officer</td><td>Pending property, map point, photos, and field details</td><td>Review accuracy. Select Verify or Reject; rejection requires a useful remark.</td><td>Kebele Verified property or Rejected property.</td></tr>
  <tr><td>City Officer</td><td>Kebele Verified property and review history</td><td>Perform final quality and policy check. Select Approve or Reject.</td><td>Approved property with official address code or Rejected property.</td></tr>
  <tr><td>System</td><td>Approval decision and property address values</td><td>Persist approval history, generate code at final approval, write audit data, and attempt SMS notification.</td><td>Traceable record and owner notification event.</td></tr>
  <tr><td>Administrator</td><td>Operational configuration and user register</td><td>Maintain users, locations, service configuration, backups, and exception handling.</td><td>Healthy and governed service.</td></tr>
</table>

<h2>3. Decision rules</h2>
<ol>
  <li>A property should not be submitted until required location data and a front-view photo are present.</li>
  <li>A Kebele Officer verifies local facts and evidence; verification is not final approval.</li>
  <li>A City Officer performs the final approval decision and triggers official address code generation.</li>
  <li>A rejection must include a reason that the Enumerator can act on.</li>
  <li>A rejected record is corrected and resubmitted; the review history remains available.</li>
  <li>An owner SMS is attempted only when the owner phone exists and the SMS service is configured.</li>
  <li>Notification failure must not erase the property or approval decision; it is an operational exception to resolve.</li>
</ol>

<h2>4. Owner notification messages</h2>
<div class="grid">
  <div class="card"><h3>Message 1 — Kebele verification</h3><p>Confirms that the property has been verified by the Kebele Officer and is awaiting final City Office approval.</p><p class="small">Trigger: status changes to <span class="code">kebele_verified</span>.</p></div>
  <div class="card"><h3>Message 2 — City approval</h3><p>Confirms official approval and includes the generated address code for the owner’s records.</p><p class="small">Trigger: status changes to <span class="code">approved</span>.</p></div>
</div>

<h2>5. Address code generation</h2>
<p>At final approval, the system composes the official code from Kebele, street, block, and house number values:</p>
<div class="callout" style="text-align:center; font-size:13pt;"><span class="code">JIM-KB{KebeleCode}-ST{StreetCode}-BL{BlockCode}-HN{HouseNumber}</span></div>
<table>
  <tr><th>Component</th><th>Source</th><th>Example</th></tr>
  <tr><td>Prefix</td><td>System standard</td><td><span class="code">JIM</span></td></tr>
  <tr><td>Kebele</td><td>Selected property kebele/code</td><td><span class="code">KB01</span></td></tr>
  <tr><td>Street</td><td>Selected street/code</td><td><span class="code">ABAJIF</span></td></tr>
  <tr><td>Block</td><td>Selected or entered block code</td><td><span class="code">BL01</span></td></tr>
  <tr><td>House</td><td>House number</td><td><span class="code">HN101</span></td></tr>
</table>

<h2>6. Exception handling</h2>
<table>
  <tr><th>Exception</th><th>Immediate action</th><th>Owner</th></tr>
  <tr><td>Missing GPS</td><td>Return to Enumerator for field correction; do not approve incomplete location data.</td><td>Enumerator / Kebele Officer</td></tr>
  <tr><td>Missing front photo</td><td>Request evidence upload before submission or approval.</td><td>Enumerator / reviewer</td></tr>
  <tr><td>Duplicate warning</td><td>Compare existing record and confirm whether this is an update or a new property.</td><td>Enumerator / reviewer</td></tr>
  <tr><td>Wrong address hierarchy</td><td>Correct kebele/street/block setup or return the property for correction.</td><td>Administrator / City Officer</td></tr>
  <tr><td>SMS delivery failure</td><td>Keep the approved property; check phone format, provider mode, sender, key, and service logs.</td><td>Administrator</td></tr>
  <tr><td>Offline draft not syncing</td><td>Reconnect, open Drafts, retry sync, and preserve the local draft until server confirmation.</td><td>Enumerator / Administrator</td></tr>
</table>
"""


files = [
    render(
        "01-functional-and-non-functional-requirements.pdf",
        "Functional & Non-Functional Requirements",
        requirements_body,
        "Requirements baseline and acceptance reference",
        "MIS-REQ-001",
    ),
    render(
        "02-technology-and-deployment-strategy.pdf",
        "Technology & Deployment Strategy",
        technology_body + '<div class="page-break"></div>' + deployment_body,
        "Technical stack, operational model, release, and continuity guide",
        "MIS-OPS-002",
    ),
    render(
        "03-hands-on-user-manual-with-screenshots.pdf",
        "Hands-on User Manual",
        manual_body,
        "Step-by-step guide for registration, review, offline work, and notifications",
        "MIS-USER-003",
    ),
    render(
        "04-user-list-and-access-matrix.pdf",
        "User List & Access Matrix",
        users_body,
        "Role definitions, permissions, demo accounts, and user register template",
        "MIS-GOV-004",
    ),
    render(
        "05-property-registration-workflow.pdf",
        "Property Registration Workflow",
        workflow_body,
        "Actor responsibilities, status transitions, address codes, and exceptions",
        "MIS-FLOW-005",
    ),
]

print("Generated:")
for path in files:
    print(f"- {path} ({path.stat().st_size:,} bytes)")