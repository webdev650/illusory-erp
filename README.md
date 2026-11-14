# ✨ Illusory ERP — Day 6 UI Redesign & Monorepo

Custom Enterprise Resource Planning & Agency Operating System built for **Illusory Design Studios Pvt. Ltd.** (Bhubaneswar, Odisha, India).

---

## 🎨 Day 6: Modern UI Redesign & Design System

### 1. Brand Theming & Color Variables
Change the brand identity across the entire ERP from a single location:
```css
/* client/src/index.css */
:root {
  --brand-50:  #f5f3ff;
  --brand-100: #ede9fe;
  --brand-500: #8b5cf6;   /* Primary Studio Accent */
  --brand-600: #7c3aed;   /* Primary Button / Active Pill */
  --brand-700: #6d28d9;
  --page-bg:   #F5F6FA;   /* Soft clean page background */
  --surface-card: #FFFFFF;
}
```

### 2. Collapsible Sidebar with Color-Coded Module Tiles
- **Fixed & Collapsible**: Collapse to icon-only mode with a single click (`preferences.sidebarCollapsed`).
- **Favourites Section**: Star/pin any module directly from the sidebar. Favourites persist in MongoDB per user (`UserPreference`).
- **Distinct Icon Tiles**: All 18 registered modules feature unique pastel rounded-square icon tiles.
- **Menu Filter Search**: Instant client-side search to filter sidebar items.

### 3. Top Navigation & Global Search
- **Quick-Access Tabs**: Role-aware tabs with active underlines (Home, HR, Tasks, Reports, Approvals, Meetings, and an overflow `...` dropdown).
- **Command Palette (`Ctrl+K` / `⌘K`)**: Fuzzy search employees, projects, tasks, and quick actions from anywhere in the app.
- **Studio Calendar Popover**: Mini interactive calendar highlighting holidays, leaves, and tasks due.
- **Apps-Grid Popover**: 3x3 / 4x4 app launcher grid of all agency modules.
- **Live Punch Timer**: Running activity timer pill in navbar synced with server state.

### 4. Modular Home Page & Drag-and-Drop Dashboard
- **Two-Column Grid**: Left wide stack for configurable widgets; right narrow stack for fixed Attendance Widget and celebrations.
- **Drag-to-Reorder**: Reorder widgets on the fly using `@dnd-kit`.
- **Customize Drawer**: Show/hide individual widgets and reset layout to studio default (`POST /api/v1/preferences/reset-layout`).
- **14 Permitted Widgets**: Welcome Banner with rotating daily greeting, KPI cards, My Open Tasks, Due Today / Overdue, My Active Projects, Weekly Hours, Leave Balances, Team on Leave, Pending Approvals, Studio Announcements, Odisha Holidays, Celebrations this week, and Recharts analytics.

### 5. Attendance & Work-From-Home (WFH) System
- **Break In / Break Out**: Auto-deducts break duration from net work hours and prevents overlapping breaks.
- **Date Navigation**: Previous/next day arrows to view historical logs.
- **Add Log / Regularization**: Opens approval request for missed check-in/out.
- **Apply Remote Work**: Requisition WFH dates and justification routed to manager review. Automatically marks attendance status as `wfh` upon approval.

---

## 🏗️ Architecture & Modules Overview

Illusory ERP is organized into **18 core modules** defined in a shared architectural registry (`src/config/modules.js`):

| # | Module Key | Module Name | Status | Primary Permissions | Description |
|---|---|---|---|---|---|
| 1 | `home` | **Home** | 🟢 Live | Public (Auth) | Personal overview, customizable widget grid, live punch clock, leave balances, my open tasks, active projects, studio announcements |
| 2 | `hrms` | **HRMS (Employee Master)** | 🟢 Live | `employee.read` | Master employee records, onboarding wizard, document vault, masked statutory fields, exit clearance checklist |
| 3 | `hr` | **HR Operations** | 🟢 Live | `hr.access` | Attendance tracking, check-in/out/break, remote work, leave approvals, Odisha holiday calendar, 30-day analytics |
| 4 | `projects` | **Projects** | 🟢 Live | `project.read` / `project.readOwn` | Client design & engineering contracts, milestone sign-offs, burn-rate tracking, team allocation |
| 5 | `tasks` | **Tasks** | 🟢 Live | `task.read` / `task.readOwn` | 6-column Kanban board, sprint priorities, checklist progress, comments with @mentions, subtasks |
| 6 | `clients` | **Clients** | 🟢 Live | `client.read` | Client directory, legal accounts, contact persons, GST numbers, and contracted project history |
| 7 | `activity_tracker`| **Activity Tracker** | 🟢 Live | `activity.logOwn` / `activity.readOwn` | Daily time logs, live timer with navbar clock, weekly timesheets with approvals, team capacity, and reports |
| 8 | `assets` | **Assets & Licenses** | 🟢 Live | `asset.read` / `asset.readOwn` | Hardware register (MacBooks/PCs), digital acknowledgement, maintenance tickets, software licenses with encrypted keys, QR labels, and exit clearance |
| 9 | `payroll` | **Payroll** | 🟡 Soon | `payroll.viewAll` | Automated salary slip generation, TDS/EPF/ESI compliance, bank disbursement |
| 10 | `recruitment` | **Recruitment & ATS** | 🟡 Soon | `recruitment.read`| Job requisitions, applicant pipeline, candidate scorecards, offer letter generator |
| 11 | `crm` | **CRM & Pipeline** | 🟡 Soon | `crm.viewAll` | Lead qualification stages, deal values, proposal builder with revision tracking |
| 12 | `travel_expense`| **Travel & Expense** | 🟡 Soon | `travel.read` | Client trip travel estimates, multi-currency expense claims, receipt uploads |
| 13 | `reports` | **Reports** | 🟡 Soon | `report.view` | Consolidated agency turnover, departmental cost analytics, custom CSV export |
| 14 | `support` | **Support Helpdesk** | 🟡 Soon | `support.read` | Internal ticketing system for IT, facilities, and HR queries with SLA escalation |
| 15 | `utilities` | **Utilities** | 🟡 Soon | `utility.read` | Meeting room bookings, official company policy handbook, contract templates |
| 16 | `configurations`| **Configurations** | 🟢 Live | `user.manage` | User management, password resets, dynamic RBAC permission keys, department CRUD |
| 17 | `meetings` | **Meetings** | 🟡 Soon | Public (Auth) | Studio syncs, sprint standups, Google Meet / Zoom links, room reservation |
| 18 | `finance` | **Finance** | 🟡 Soon | `finance.viewAll` | Client GST invoicing, vendor bills, P&L ledgers, and bank reconciliation |

---

## 💻 Day 5: Assets & Software Licenses Module Features

### 1. Data Models & Hardware Register
- **`AssetCategory`**: 13 standard categories (`Laptop`, `Desktop`, `Monitor`, `Mobile Phone`, `Tablet`, `Camera`, `Keyboard/Mouse`, `Headphones`, `Drawing Tablet`, `Software Licence`, `ID/Access Card`, `Furniture`, `Other`). Supports `customFields[{ label, type }]` (e.g. RAM, Processor, IMEI, Screen Size).
- **`Asset`**: Auto-incremented asset tags (`AST-0001` format), brand, model, unique serial number (sparse indexed), IMEI, purchase cost in integer paise, vendor, warranty expiry, condition (`new`, `good`, `fair`, `poor`), status (`available`, `assigned`, `under_repair`, `lost`, `retired`, `disposed`), current assignee reference, custom specs Map, photos, and QR sticker payload.
- **`AssetAssignment`**: Immutable custody history tracking assignee, issuing authority, issue date, condition at issue, return date, condition at return, return notes, and digital acknowledgement state.
- **`MaintenanceRecord`**: Repair/service ticketing tracking asset, ticket type (`repair`, `upgrade`, `maintenance`, `inspection`), issue description, vendor, cost in paise, ticket status (`open`, `in_progress`, `completed`), and downtime logs.
- **`SoftwareLicense`**: Enterprise licensing tracking software name, vendor, license type (`per_user`, `per_device`, `site`, `tier`), seat quota (`totalSeats`, `usedSeats`), renewal date, billing cycle, assigned users array, and AES-256 encrypted `licenseKey` at rest.
- **`AssetRequest`**: Self-service equipment requisition tracking employee, category, justification, needed-by date, workflow approval status (`pending`, `approved`, `rejected`, `fulfilled`, `cancelled`), and fulfilled asset reference.
- **`ExitClearance`**: Offboarding custody checklist tracking all hardware and software issued to an employee when they transition to `notice`, `resigned`, or `terminated`.

### 2. Business Rules & Custody Lifecycle
- **Exclusive Custody**: An asset can only be assigned to one employee at a time; must be in `available` status to assign.
- **Digital Handover Acknowledgement**: When equipment is assigned, the employee receives an in-app prompt on their Home dashboard and My Assets tab to review condition notes and formally acknowledge receipt.
- **Return Workflow**: When returned, asset status transitions back to `available` (or automatically to `under_repair` if condition at return is marked `poor`).
- **Two-Step Requisition & Fulfilment**: Employee requests equipment &rarr; manager reviews and approves &rarr; request lands in IT Fulfilment Queue &rarr; IT Admin assigns specific hardware tag and marks fulfilled.
- **Exit Clearance Enforcement**: Initiated automatically upon resignation or termination. The system **strictly blocks** marking exit clearance complete if any hardware item or software license is still pending return/revocation.
- **License Seat Tracking**: Auto-increments/decrements `usedSeats`. Prevents assigning seats beyond `totalSeats`.

### 3. Cryptographic Security & Financial Privacy
- **AES-256 License Key Encryption**: License keys are encrypted at rest using AES (`crypto-js`) with `ASSET_SECRET_KEY`. Keys are masked by default (`••••••••••••`).
- **Audit-Logged Key Reveal**: Users with `asset.viewSecrets` can reveal the plain key via `POST /api/v1/assets/licenses/:id/reveal-key`. Every key reveal is permanently logged in `AuditLog` with IP, timestamp, and user context.
- **Cost Privacy**: Hardware `purchaseCost` and maintenance `cost` are hidden from HR and employees unless the user explicitly possesses `asset.viewCost`.

### 4. QR Code & Label Generation
- **Printable Asset Sticker Card**: Every asset detail drawer features a live SVG/PNG QR code encoding the tag `AST-XXXX`, alongside asset specifications, company branding, and a print button formatted for standard thermal label printers.
- **Direct API QR Endpoint**: `GET /api/v1/assets/:id/qr` serves high-resolution QR PNGs directly for batch printing.

### 5. Scheduled Automations (node-cron)
- **Daily 9:00 AM IST Asset Health Audit**:
  - Alerts managers and IT Admin of hardware warranties expiring within 30 days.
  - Alerts managers of software license subscriptions renewing within 30 days.
  - Flags overdue hardware returns (past expected return date).
  - Flags unresolved maintenance tickets prolonged over 14 days.

### 6. CSV Bulk Import & Export
- **CSV Template Download**: `GET /api/v1/assets/template/csv` provides a pre-formatted template with standard headers (`name,category,brand,model,serialNumber,purchaseDate,purchaseCost,vendor,invoiceNumber,warrantyExpiry,condition,location,notes`).
- **Bulk Import Engine**: Upload CSV with real-time row-by-row validation, auto-generated tags, category name resolution, and detailed error feedback reporting row numbers and missing columns.
- **Full Inventory CSV Export**: `GET /api/v1/assets/export/csv` exports all fleet assets with current assignee names, condition, category, and masked costs based on permissions.

---

## 🔐 Complete Permission Keys

The system enforces permissions through `requirePermission(key)` middleware and dynamic client-side filtering:

- **Wildcard**: `*` (Full unrestricted master control)
- **Employee Master**: `employee.read`, `employee.create`, `employee.update`, `employee.delete`, `employee.status`, `employee.readSalary`, `employee.readStatutory`, `employee.readSelf`, `employee.updateSelf`
- **HR & Attendance**: `hr.access`, `attendance.read`, `attendance.record`, `attendance.manage`, `attendance.readSelf`
- **Leaves & Holidays**: `leave.apply`, `leave.approve`, `leave.manage`, `leave.readSelf`, `holiday.manage`
- **Approval Engine**: `approval.read`, `approval.act`, `approval.readSelf`
- **Clients**: `client.read`, `client.create`, `client.update`, `client.delete`
- **Projects**: `project.read`, `project.readOwn`, `project.create`, `project.update`, `project.delete`, `project.manageMembers`, `project.viewBudget`
- **Tasks**: `task.read`, `task.readOwn`, `task.create`, `task.update`, `task.delete`, `task.assign`, `task.comment`
- **Activity Tracker**: `activity.logOwn`, `activity.readOwn`, `activity.readTeam`, `activity.readAll`, `activity.approve`, `activity.editAll`, `activity.export`, `activity.viewCost`
- **Assets & Licensing**: `asset.read`, `asset.readOwn`, `asset.create`, `asset.update`, `asset.delete`, `asset.assign`, `asset.return`, `asset.maintain`, `asset.request`, `asset.approveRequest`, `license.read`, `license.manage`, `asset.viewSecrets`, `asset.viewCost`, `asset.export`
- **Broadcast & Celebrations**: `announcement.create`, `announcement.read`
- **Departments & Users**: `department.read`, `department.manage`, `user.manage`, `document.manage`, `dashboard.read`

---

## 👥 Seed Roles & Credentials

Default password for all seeded accounts: `ChangeMe@123`

| Role | Email | Name & Title | Access Level |
|---|---|---|---|
| **Super Admin** | `superadmin1@illusorydesignstudios.com` | Aarav Mohapatra (Founder & CEO) | Complete master access (`*`) |
| **Super Admin** | `superadmin2@illusorydesignstudios.com` | Rohan Patnaik (Co-Founder & CTO) | Complete master access (`*`) |
| **Super Admin** | `superadmin3@illusorydesignstudios.com` | Ananya Dash (Co-Founder & COO) | Complete master access (`*`) |
| **HR Manager** | `hr@illusorydesignstudios.com` | Sunita Jena (Head of People) | Full HRMS, HR Ops, Approvals, Asset read/requests (no secret keys or costs) |
| **IT Admin** | `itadmin@illusorydesignstudios.com` | Subrat Mohanty (IT Systems & Security) | Full Asset Register, Assign/Return, Maintenance, Licenses, Secrets & Exit Clearance |
| **Project Manager** | `pm@illusorydesignstudios.com` | Bikash Panda (Technical Project Lead) | Project management, task delegation, team timesheet approvals, asset request review |
| **Employee 1** | `employee1@illusorydesignstudios.com` | Debashis Tripathy (Senior UI/UX) | Own profile, check-in, assigned projects, my tasks, time logs, assigned assets & acknowledgement |
| **Employee 2..8** | `employee2..8@illusorydesignstudios.com` | Designers & Developers | Own self-service, check-in, assigned projects, my tasks, time logs, equipment requests |

---

## 🚀 Setup & Execution Guide

### 1. Configure Server Environment (`server/.env`)
```powershell
cd server
copy .env.example .env
```
Fill in your MongoDB Atlas URI, JWT secret, Cloudinary keys, and Asset encryption secret:
```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/illusory-erp
JWT_SECRET=your_32_character_secret_key_here
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
CLOUDINARY_CLOUD_NAME=your_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
ASSET_SECRET_KEY=illusory_studio_asset_encryption_secret_key_32_chars!
```

### 2. Configure Client Environment (`client/.env`)
```powershell
cd ../client
copy .env.example .env
```
Contains:
```env
# Enables quick-fill login buttons for easy local testing
VITE_SHOW_QUICK_LOGIN=true
```

### 3. Run the Monorepo
```powershell
# In terminal 1 (Backend API):
cd server
npm run dev

# In terminal 2 (Vite Frontend):
cd client
npm run dev

# Run Seed Script (Idempotent):
node server/src/seed/seed.js
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Day 5 Verification & Testing Checklist

1. **Asset Register & Custom Fields**:
   - Log in as **Super Admin** or **IT Admin** (`itadmin@illusorydesignstudios.com`).
   - Navigate to `/assets`. View the Overview KPI metrics and status distribution charts.
   - Click **Add Asset**. Select category `Laptop`. Notice dynamic custom fields (`RAM`, `Processor`, `Storage`) appear automatically. Fill in details and save.
   - Click on any asset to open the drilldown drawer. Verify specifications, custody history, and the printable QR sticker card.
2. **Assignment & Digital Acknowledgement**:
   - Assign an available monitor to **Employee 1** (`employee1@illusorydesignstudios.com`).
   - Log out and log in as **Employee 1**.
   - Check the **Home Dashboard**: Notice the yellow alert card *"Equipment Waiting for Your Acknowledgement"* for `AST-0006` (Apple MacBook Pro 16").
   - Click **Acknowledge Receipt**. Confirm that the status updates to accepted and the alert clears.
   - Open `/assets` &rarr; **My Assets** tab. Verify current assigned hardware, past history, and the **Report Issue** button.
3. **Equipment Requisition & IT Fulfilment Queue**:
   - As an Employee, click **Request Equipment**. Select a category and provide justification.
   - Submit request. Log in as **Project Manager** or **Super Admin** and approve the request in the Approval Engine.
   - Log in as **IT Admin** (`itadmin@illusorydesignstudios.com`).
   - Navigate to `/assets` &rarr; **Requests & To Fulfil** tab. Notice the approved request in the **To Fulfil** queue.
   - Click **Fulfil**. Select an available hardware tag from the dropdown and submit. Confirm asset is now assigned.
4. **Maintenance Lifecycle**:
   - Navigate to `/assets` &rarr; **Maintenance** tab.
   - Review active repair tickets for `AST-0028`, `AST-0029`, and `AST-0030`.
   - Update `AST-0028` ticket status to `completed`. Verify the asset returns to `available` status in the register.
5. **Software Licenses & Secret Key Decryption**:
   - Navigate to `/assets` &rarr; **Software Licenses** tab.
   - Verify 5 enterprise licenses (Figma, Adobe, Microsoft 365, GitHub, Slack) and seat utilization progress bars.
   - Notice the license key is masked (`••••••••••••`).
   - Click the eye icon next to Figma Enterprise. Confirm plain key is revealed.
   - In MongoDB / AuditLog, verify an audit entry `REVEAL_LICENSE_KEY` was recorded with user details and IP.
6. **Exit Clearance Guard**:
   - Go to **HRMS** (`/hrms`) &rarr; open an employee who has assigned hardware (e.g. Employee 1).
   - Change their status to `notice`.
   - Open their profile detail page &rarr; **Assets & Exit Clearance** tab.
   - Notice the pending checklist of unreturned items.
   - Click **Complete Exit Clearance**. Verify the system **strictly blocks** completion with an error listing the unreturned items.
   - Return all items, revoke software seats, and click **Complete Exit Clearance** again. Verify clearance succeeds.
7. **CSV Bulk Import & Export**:
   - In `/assets`, click **Export CSV**. Open the downloaded CSV and verify all 30 assets are exported with accurate status and serial numbers.
   - Click **Import CSV** &rarr; download sample CSV template &rarr; upload modified rows and verify real-time import summary and error reporting.
