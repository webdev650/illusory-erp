# ✨ Illusory ERP — Day 3 Monorepo

Custom Enterprise Resource Planning & Agency Operating System built for **Illusory Design Studios Pvt. Ltd.** (Bhubaneswar, Odisha, India).

---

## 🏗️ Architecture & Modules Overview

Illusory ERP is organized into **16 core modules** defined in a shared registry (`src/config/modules.js`):

| # | Module Key | Module Name | Day 3 Status | Primary Permission | Description |
|---|---|---|---|---|---|
| 1 | `home` | **Home** | 🟢 Live | Public (Auth) | Personal overview, live punch clock, leave balances, my open tasks, active projects, announcements |
| 2 | `hrms` | **HRMS (Employee Master)** | 🟢 Live | `employee.read` | Master employee records, onboarding wizard, document vault, masked statutory fields |
| 3 | `hr` | **HR Operations** | 🟢 Live | `hr.access` | Attendance tracking, check-in/out, leave approvals, Odisha holiday calendar, 30-day analytics |
| 4 | `projects` | **Projects** | 🟢 Live | `project.read` / `project.readOwn` | Client design & engineering contracts, milestone sign-offs, burn-rate tracking, team allocation |
| 5 | `tasks` | **Tasks** | 🟢 Live | `task.read` / `task.readOwn` | 6-column Kanban board, sprint priorities, checklist progress, comments with @mentions, subtasks |
| 6 | `clients` | **Clients** | 🟢 Live | `client.read` | Client directory, legal accounts, contact persons, GST numbers, and contracted project history |
| 7 | `payroll` | **Payroll** | 🟡 Soon | `payroll.viewAll` | Automated salary slip generation, TDS/EPF/ESI compliance, bank disbursement |
| 8 | `recruitment` | **Recruitment & ATS** | 🟡 Soon | `recruitment.read`| Job requisitions, applicant pipeline, candidate scorecards, offer letter generator |
| 9 | `crm` | **CRM & Pipeline** | 🟡 Soon | `crm.viewAll` | Lead qualification stages, deal values, proposal builder with revision tracking |
| 10 | `assets` | **Assets** | 🟡 Soon | `asset.read` | Studio hardware inventory (MacBooks/PCs), handover sign-offs, software license renewals |
| 11 | `travel_expense`| **Travel & Expense** | 🟡 Soon | `travel.read` | Client trip travel estimates, multi-currency expense claims, receipt uploads |
| 12 | `activity_tracker`| **Activity Tracker** | 🟡 Soon | `tracker.read` | Daily agency timesheet submissions, billable vs non-billable client hour tracking |
| 13 | `reports` | **Reports** | 🟡 Soon | `report.view` | Consolidated agency turnover, departmental cost analytics, custom CSV export |
| 14 | `support` | **Support Helpdesk** | 🟡 Soon | `support.read` | Internal ticketing system for IT, facilities, and HR queries with SLA escalation |
| 15 | `utilities` | **Utilities** | 🟡 Soon | `utility.read` | Meeting room bookings, official company policy handbook, contract templates |
| 16 | `configurations`| **Configurations** | 🟢 Live | `user.manage` | User management, password resets, dynamic RBAC permission keys, department CRUD |
| 17 | `finance` | **Finance** | 🟡 Soon | `finance.viewAll` | Client GST invoicing, vendor bills, P&L ledgers, and bank reconciliation |

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
- **Broadcast & Celebrations**: `announcement.create`, `announcement.read`
- **Departments & Users**: `department.read`, `department.manage`, `user.manage`, `document.manage`, `dashboard.read`
- **Roadmap Permissions**: `payroll.run`, `payroll.viewAll`, `recruitment.read`, `crm.viewAll`, `asset.read`, `travel.read`, `tracker.read`, `report.view`, `support.read`, `utility.read`, `finance.viewAll`

---

## 👥 Seed Roles & Credentials

Default password for all seeded accounts: `ChangeMe@123`

| Role | Email | Name & Title | Access Level |
|---|---|---|---|
| **Super Admin** | `superadmin1@illusorydesignstudios.com` | Aarav Mohapatra (Founder & CEO) | Complete master access (`*`) |
| **Super Admin** | `superadmin2@illusorydesignstudios.com` | Rohan Patnaik (Co-Founder & CTO) | Complete master access (`*`) |
| **Super Admin** | `superadmin3@illusorydesignstudios.com` | Ananya Dash (Co-Founder & COO) | Complete master access (`*`) |
| **HR Manager** | `hr@illusorydesignstudios.com` | Sunita Jena (Head of People) | Full HRMS, HR Ops, Approvals, Clients, Projects (no budget) |
| **Project Manager** | `pm@illusorydesignstudios.com` | Bikash Panda (Technical Project Lead) | Project creation, member management, budget view, task delegation |
| **Employee 1** | `employee1@illusorydesignstudios.com` | Debashis Tripathy (Senior UI/UX) | Own profile, check-in, assigned projects, my tasks |
| **Employee 2..8** | `employee2..8@illusorydesignstudios.com` | Designers & Developers | Own self-service, check-in, assigned projects, my tasks |

---

## 🚀 Setup & Execution Guide

### 1. Configure Server Environment (`server/.env`)
```powershell
cd server
copy .env.example .env
```
Fill in your MongoDB Atlas URI, JWT secret, and Cloudinary keys:
```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/illusory-erp
JWT_SECRET=your_32_character_secret_key_here
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
CLOUDINARY_CLOUD_NAME=your_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
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

### 3. Install Dependencies
```powershell
# Server dependencies
cd ../server
npm install

# Client dependencies
cd ../client
npm install
```

### 4. Run the Idempotent Seed Script
```powershell
cd ../server
npm run seed
```
Safe to run multiple times. Automatically seeds:
- 5 Roles (`super_admin`, `admin`, `hr`, `project_manager`, `employee`)
- 7 Agency Departments (Design, Dev, Marketing, Sales, HR, Finance, Admin)
- Default Shift (09:30 - 18:30 with 15-minute grace period)
- 5 Leave Types & 16 Odisha declared holidays for 2026
- 3 Clients (`Odisha Crafts & Tourism Corp`, `Kalinga Health Tech`, `Mayurbhanj Artisans Collective`)
- 4 Projects (`PRJ-2026-001` through `PRJ-2026-004`) with team rosters, budgets in paise, and milestones
- 25 Realistic Tasks across all 6 Kanban columns, with checklists, comments, `@mentions`, and overdue badges
- Auto-recalculated project progress percentages

### 5. Launch the Application
```powershell
# Terminal 1: Start Backend API (Port 5000)
cd server
npm run dev

# Terminal 2: Start Frontend Web App (Port 5173)
cd client
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 🧪 Testing Checklist (Day 3)

1. **Super Admin / Project Manager Testing**:
   - Log in as `superadmin1@illusorydesignstudios.com` or `pm@illusorydesignstudios.com`.
   - Open **Clients** (`/clients`): Click on any client to view their contracted projects in the detail drawer. Click "+ Add New Client" to register a client.
   - Open **Projects** (`/projects`): Toggle between Grid and Table views. Notice status pill filters and progress bars.
   - Click on **`PRJ-2026-001`** (Odisha Tourism Experience Portal):
     - **Board Tab**: Drag cards between columns (e.g. from `Todo` to `In Progress` or `Done`). Notice progress percentage auto-updates.
     - Click any task card to open the **Task Detail Drawer**: Add a step to the checklist, toggle checkmarks, or post a comment with `@mention`.
     - **Team Tab**: Add or remove project members.
     - **Milestones Tab**: Check off milestone deliverables.
     - **Files Tab**: Upload project attachments.
     - **Overview Tab**: Verify that the project budget (`₹7,50,000`) and hourly billing rates are visible.

2. **Employee Security & Budget Masking Testing**:
   - Log in as `employee1@illusorydesignstudios.com` (Debashis Tripathy).
   - In the sidebar, notice **Projects** and **Tasks** are accessible, while restricted administrative modules are hidden.
   - Open **`PRJ-2026-001`**:
     - Check the **Overview Tab**: Verify that the **Budget & Financials section is hidden**.
     - Verify on the API level: inspecting network response shows `budget` and `billingRatePerHour` are completely stripped from the response payload.
   - Open **`PRJ-2026-003`** (which Debashis is NOT a member of):
     - Attempting to load `/api/v1/projects/<PRJ-2026-003-ID>` returns `403 Forbidden` ("You do not have access to view this project").
   - Open **My Tasks** (`/tasks`):
     - Test the `Today`, `This Week`, `Overdue`, and `All` tabs.
     - One-click mark a task as `Done` and see KPI counters update instantly.
   - Open **Home** (`/`):
     - Inspect the "My Open Tasks" and "My Active Projects" dashboard widgets.
