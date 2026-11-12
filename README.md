# ✨ Illusory ERP — Day 4 Monorepo

Custom Enterprise Resource Planning & Agency Operating System built for **Illusory Design Studios Pvt. Ltd.** (Bhubaneswar, Odisha, India).

---

## 🏗️ Architecture & Modules Overview

Illusory ERP is organized into **16 core modules** defined in a shared architectural registry (`src/config/modules.js`):

| # | Module Key | Module Name | Status | Primary Permissions | Description |
|---|---|---|---|---|---|
| 1 | `home` | **Home** | 🟢 Live | Public (Auth) | Personal overview, live punch clock, leave balances, my open tasks, active projects, studio announcements |
| 2 | `hrms` | **HRMS (Employee Master)** | 🟢 Live | `employee.read` | Master employee records, onboarding wizard, document vault, masked statutory fields |
| 3 | `hr` | **HR Operations** | 🟢 Live | `hr.access` | Attendance tracking, check-in/out, leave approvals, Odisha holiday calendar, 30-day analytics |
| 4 | `projects` | **Projects** | 🟢 Live | `project.read` / `project.readOwn` | Client design & engineering contracts, milestone sign-offs, burn-rate tracking, team allocation |
| 5 | `tasks` | **Tasks** | 🟢 Live | `task.read` / `task.readOwn` | 6-column Kanban board, sprint priorities, checklist progress, comments with @mentions, subtasks |
| 6 | `clients` | **Clients** | 🟢 Live | `client.read` | Client directory, legal accounts, contact persons, GST numbers, and contracted project history |
| 7 | `activity_tracker`| **Activity Tracker** | 🟢 Live | `activity.logOwn` / `activity.readOwn` | Daily time logs, live timer with navbar clock, weekly timesheets with approvals, team capacity, and reports |
| 8 | `payroll` | **Payroll** | 🟡 Soon | `payroll.viewAll` | Automated salary slip generation, TDS/EPF/ESI compliance, bank disbursement |
| 9 | `recruitment` | **Recruitment & ATS** | 🟡 Soon | `recruitment.read`| Job requisitions, applicant pipeline, candidate scorecards, offer letter generator |
| 10 | `crm` | **CRM & Pipeline** | 🟡 Soon | `crm.viewAll` | Lead qualification stages, deal values, proposal builder with revision tracking |
| 11 | `assets` | **Assets** | 🟡 Soon | `asset.read` | Studio hardware inventory (MacBooks/PCs), handover sign-offs, software license renewals |
| 12 | `travel_expense`| **Travel & Expense** | 🟡 Soon | `travel.read` | Client trip travel estimates, multi-currency expense claims, receipt uploads |
| 13 | `reports` | **Reports** | 🟡 Soon | `report.view` | Consolidated agency turnover, departmental cost analytics, custom CSV export |
| 14 | `support` | **Support Helpdesk** | 🟡 Soon | `support.read` | Internal ticketing system for IT, facilities, and HR queries with SLA escalation |
| 15 | `utilities` | **Utilities** | 🟡 Soon | `utility.read` | Meeting room bookings, official company policy handbook, contract templates |
| 16 | `configurations`| **Configurations** | 🟢 Live | `user.manage` | User management, password resets, dynamic RBAC permission keys, department CRUD |
| 17 | `finance` | **Finance** | 🟡 Soon | `finance.viewAll` | Client GST invoicing, vendor bills, P&L ledgers, and bank reconciliation |

---

## ⏱️ Day 4: Activity Tracker Module Features

### 1. Data Models & Financial Accuracy
- **`TimeEntry`**: Employee, date (day in IST), project, task, category (`project_work`, `meeting`, `review`, `learning`, `admin`, `internal`, `support`, `other`), description, startTime, endTime, durationMinutes (integer 5 to 960), isBillable, source (`manual` or `timer`), timesheet reference, status (`draft`, `submitted`, `approved`, `rejected`), `isDeleted`.
- **`Timesheet`**: Employee, weekStart (Monday 00:00:00 IST), weekEnd (Sunday 23:59:59 IST), totalMinutes, billableMinutes, status (`draft`, `submitted`, `approved`, `rejected`, `reopened`), submittedAt, approvalRequest, reviewedBy, reviewedAt, reviewComment. Compound unique index: `{ employee: 1, weekStart: 1 }`.
- **`ActiveTimer`**: Employee (unique), project, task, category, description, startedAt. Strictly one active timer per employee. Forgotten timers (>12h) flagged automatically.
- **Dynamic Project & Task Recalculation**: Tasks dynamically update `loggedHours`. Projects dynamically track `loggedHours` and `costToDate` calculated strictly in integer paise (`Math.round((durationMinutes / 60) * memberBillingRatePerHour)`).

### 2. Business Rules & Timesheet Lifecycle
- **Daily Limits**: Minimum 5 minutes, maximum 16 hours (960 minutes) per day across entries.
- **Backdating**: Backdating &le; 14 days allowed by default; entries older than 14 days require `activity.editAll` or reopening the timesheet. Future dates are strictly rejected.
- **Submission Window**: Weekly timesheet can be submitted from Friday 00:00 IST onward or anytime after the week closes.
- **Capacity Warnings**: If logged hours are under 80% of expected hours (Shift hours &minus; holidays &minus; approved leaves), a warning modal is presented before submission.
- **Entry Locking**: When a timesheet is submitted or approved, all associated daily time entries are locked from modification or deletion. Reopening unlocks them.

### 3. Live Running Timer
- **Navbar Timer**: Compact running pill in the top header displaying a pulsing status dot, live `HH:MM:SS` ticking clock, project tag, and quick stop button.
- **Task Integration**: TaskModal displays logged vs estimated hours alongside a "Play/Stop Timer" button that launches the active timer with the task and project pre-attached.

### 4. Timesheet Approvals & Team Capacity
- **Approval Workflow**: Integrated with the system `ApprovalRequest` engine (`type: 'timesheet'`). Routed to the reporting manager (or project manager / HR).
- **Inspect Entries Drawer**: Approvers can drill down into all 7 days of entries before approving or rejecting with mandatory comments.
- **Missing Timesheets Report**: Highlights team members who have not submitted their previous week's timesheet.

### 5. Visual Reports & Analytics
- **Recharts Analytics**: Interactive bar charts for hours by project and employee, and donut charts for category distributions.
- **Cost Privacy**: Agency costs (`costToDate`) are strictly masked unless the requesting user possesses `activity.viewCost`.
- **CSV Export**: Full export of all time entries within any date range formatted for external accounting or audit.

### 6. Scheduled Automations (node-cron)
- **Friday 17:00 IST**: Automated reminder to team members with pending draft entries to submit their weekly timesheet.
- **Monday 10:00 IST**: Automated notification reminder to managers to review pending timesheet submissions.

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
| **HR Manager** | `hr@illusorydesignstudios.com` | Sunita Jena (Head of People) | Full HRMS, HR Ops, Approvals, Clients, Projects, Activity Tracker |
| **Project Manager** | `pm@illusorydesignstudios.com` | Bikash Panda (Technical Project Lead) | Project management, task delegation, team timesheet approvals |
| **Employee 1** | `employee1@illusorydesignstudios.com` | Debashis Tripathy (Senior UI/UX) | Own profile, check-in, assigned projects, my tasks, time logging |
| **Employee 2..8** | `employee2..8@illusorydesignstudios.com` | Designers & Developers | Own self-service, check-in, assigned projects, my tasks, time logging |

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
