# ✨ Illusory ERP — Day 2 Monorepo

Custom Enterprise Resource Planning & HRMS platform built for **Illusory Design Studios Pvt. Ltd.** (Bhubaneswar, Odisha, India).

---

## 🏗️ Architecture & Modules Overview

Illusory ERP is organized into **16 core modules** defined in a shared registry (`src/config/modules.js`):

| # | Module Key | Module Name | Day 2 Status | Primary Permission | Description |
|---|---|---|---|---|---|
| 1 | `home` | **Home** | 🟢 Live | Public (Auth) | Personal overview, live web punch clock, leave balances, announcements, celebrations |
| 2 | `hrms` | **HRMS (Employee Master)** | 🟢 Live | `employee.read` | Master employee records, onboarding wizard, document vault, masked statutory fields |
| 3 | `hr` | **HR Operations** | 🟢 Live | `hr.access` | Attendance tracking, check-in/out, leave approvals, Odisha holiday calendar, 30-day analytics |
| 4 | `tasks` | **Tasks** | 🟡 Soon | `task.read` | Kanban boards, sprint task assignments, milestone checklists |
| 5 | `payroll` | **Payroll** | 🟡 Soon | `payroll.viewAll` | Automated salary slip generation, TDS/EPF/ESI compliance, bank disbursement |
| 6 | `projects` | **Projects** | 🟡 Soon | `project.read` | Client design & engineering contracts, milestone sign-offs, burn-rate tracking |
| 7 | `recruitment` | **Recruitment & ATS** | 🟡 Soon | `recruitment.read`| Job requisitions, applicant pipeline, candidate scorecards, offer letter generator |
| 8 | `crm` | **CRM & Pipeline** | 🟡 Soon | `crm.viewAll` | Lead qualification stages, deal values, proposal builder with revision tracking |
| 9 | `assets` | **Assets** | 🟡 Soon | `asset.read` | Studio hardware inventory (MacBooks/PCs), handover sign-offs, software license renewals |
| 10 | `travel_expense`| **Travel & Expense** | 🟡 Soon | `travel.read` | Client trip travel estimates, multi-currency expense claims, receipt uploads |
| 11 | `activity_tracker`| **Activity Tracker** | 🟡 Soon | `tracker.read` | Daily agency timesheet submissions, billable vs non-billable client hour tracking |
| 12 | `reports` | **Reports** | 🟡 Soon | `report.view` | Consolidated agency turnover, departmental cost analytics, custom CSV export |
| 13 | `support` | **Support Helpdesk** | 🟡 Soon | `support.read` | Internal ticketing system for IT, facilities, and HR queries with SLA escalation |
| 14 | `utilities` | **Utilities** | 🟡 Soon | `utility.read` | Meeting room bookings, official company policy handbook, contract templates |
| 15 | `configurations`| **Configurations** | 🟢 Live | `user.manage` | User management, password resets, dynamic RBAC permission keys, department CRUD |
| 16 | `finance` | **Finance** | 🟡 Soon | `finance.viewAll` | Client GST invoicing, vendor bills, P&L ledgers, and bank reconciliation |

---

## 🔐 Complete Permission Keys

The system enforces permissions through `requirePermission(key)` middleware and dynamic client-side filtering:

- **Wildcard**: `*` (Full unrestricted master control)
- **Employee Master**: `employee.read`, `employee.create`, `employee.update`, `employee.delete`, `employee.status`, `employee.readSalary`, `employee.readStatutory`, `employee.readSelf`, `employee.updateSelf`
- **HR & Attendance**: `hr.access`, `attendance.read`, `attendance.record`, `attendance.manage`, `attendance.readSelf`
- **Leaves & Holidays**: `leave.apply`, `leave.approve`, `leave.manage`, `leave.readSelf`, `holiday.manage`
- **Approval Engine**: `approval.read`, `approval.act`, `approval.readSelf`
- **Broadcast & Celebrations**: `announcement.create`, `announcement.read`
- **Departments & Users**: `department.read`, `department.manage`, `user.manage`, `document.manage`, `dashboard.read`
- **Roadmap Permissions**: `task.read`, `payroll.run`, `payroll.viewAll`, `project.read`, `recruitment.read`, `crm.viewAll`, `asset.read`, `travel.read`, `tracker.read`, `report.view`, `support.read`, `utility.read`, `finance.viewAll`

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
# Server dependencies (includes node-cron, nodemailer, etc.)
cd ../server
npm install

# Client dependencies (includes recharts, lucide-react, etc.)
cd ../client
npm install
```

### 4. Run the Idempotent Seed Script
```powershell
cd ../server
npm run seed
```
Safe to run multiple times. Automatically seeds:
- 4 Roles with full Day 2 permission matrices
- 7 Agency Departments (Design, Dev, Marketing, Sales, HR, Finance, Admin)
- Default Shift (09:30 - 18:30 with 15-minute grace period)
- 5 Leave Types (Casual, Sick, Earned, Comp-Off, Unpaid)
- 16 Odisha declared holidays for 2026
- 3 Super Admins, 1 HR Manager, 8 Employees with linked profile accounts
- 14 Days of demo attendance records
- Demo leave request & approval chain

### 5. Launch Both Servers
Open two terminal windows:

**Terminal 1 (Backend API on port 5000):**
```powershell
cd server
npm run dev
```

**Terminal 2 (Frontend on port 5173):**
```powershell
cd client
npm run dev
```

Open your browser at 👉 **`http://localhost:5173`**

---

## 👥 Seed Test Logins (Password: `ChangeMe@123`)

| Role | Email | Capabilities on Day 2 |
|---|---|---|
| **Super Admin** | `superadmin1@illusorydesignstudios.com` | Unrestricted access across all 16 modules, manage users & departments, act on any approval step |
| **HR Manager** | `hr@illusorydesignstudios.com` | Full access to HR Operations (`/hr`): Attendance, Leaves, Approvals, Holidays, Announcements, CSV export, Employee Master |
| **Employee** | `employee1@illusorydesignstudios.com` | Live Punch Clock (Check-in/out), Apply for Leave, Request Attendance Regularization, My Profile, Studio announcements feed |

---

## 🧪 Testing Day 2 Features

1. **Web Attendance Punch Clock**:
   - Log in as any employee (`employee1@...`).
   - On the Home screen, view live server time & click **Web Check-In**.
   - If checked in after 09:45 AM, it is automatically marked as **Late Arrival**.
   - Later in the day, click **Check-Out** &rarr; work hours are computed.
2. **Apply for Leave & Approval Engine**:
   - As an employee, click **Apply for Leave** on Home.
   - Select Casual Leave, pick dates, enter reason, and submit.
   - Weekends and official Odisha holidays are **excluded** automatically.
   - Log in as HR (`hr@...`) &rarr; Click the notification bell or go to `/hr?tab=approvals` or `/approvals`.
   - Click **Approve & Advance** &rarr; The employee's leave balance is automatically updated and calendar records marked `leave`.
3. **Attendance Regularization**:
   - An employee can submit a punch correction request for any past day.
   - On approval, the attendance record is updated to `present` with new work hours.
4. **Odisha Holiday Calendar & Studio Announcements**:
   - View 16 official holidays under HR Operations (`/hr?tab=holidays`).
   - HR/Admin can post pinned studio announcements which instantly notify the team and display on the Home feed.
5. **Attendance Trend Visualization**:
   - Go to `/hr` as HR/Admin to inspect the **30-Day Attendance Trend chart** powered by Recharts.
