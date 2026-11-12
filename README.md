# ✨ Illusory ERP — Day 1 Monorepo

Custom Enterprise Resource Planning & HRMS platform built for **Illusory Design Studios Pvt. Ltd.** (Bhubaneswar, Odisha, India).

---

## 🏗️ Architecture & Tech Stack

- **Backend**: Node.js + Express.js (ES Modules, REST API at `/api/v1`)
- **Database**: MongoDB Atlas via Mongoose
- **Authentication**: JWT with `httpOnly` secure cookies & bcrypt password hashing
- **Authorization**: Dynamic Role-Based Access Control (RBAC) with permission keys (`*`, `employee.read`, `employee.create`, `employee.update`, `employee.delete`, `employee.readSalary`, `employee.readStatutory`, `department.manage`, `user.manage`, `dashboard.read`)
- **Security**: Helmet, CORS with credentials, Express rate-limit, sensitive field masking
- **Storage**: Cloudinary (Multer + Cloudinary SDK for photos and PDF/JPG documents up to 5 MB)
- **Frontend**: React 18 + Vite + Tailwind CSS + Lucide Icons + React Router + Axios

---

## 📁 Monorepo Structure

```
illusory-erp/
├── server/
│   ├── src/
│   │   ├── config/             # db.js, cloudinary.js
│   │   ├── models/             # Role, User, Department, Employee, AuditLog
│   │   ├── middleware/         # requireAuth, requirePermission, errorHandler, upload, audit
│   │   ├── controllers/        # auth, employee, department, role, user, dashboard
│   │   ├── routes/             # index.js (/api/v1/*)
│   │   ├── utils/              # apiResponse, jwt, masking
│   │   ├── seed/               # seed.js (3 Super Admins, 1 HR, 8 Employees)
│   │   ├── app.js              # Express app wiring
│   │   └── server.js           # Server entry point
│   ├── .env.example
│   └── package.json
├── client/                     # Vite + React + Tailwind CSS
│   ├── src/
│   │   ├── api/axios.js        # Axios instance with credentials
│   │   ├── context/            # AuthContext (user, role, permissions, login/logout)
│   │   ├── components/         # Layout, Sidebar (16 modules), Navbar, ProtectedRoute
│   │   └── pages/              # Login, ChangePassword, Home, HRMS, EmployeeDetail, MyProfile, Configurations, ComingSoon
│   ├── vite.config.js          # Proxy setup to backend (/api -> localhost:5000)
│   └── package.json
└── README.md
```

---

## 🚀 Step-by-Step Setup Guide for Beginners

### Step 1: Clone or Navigate to Project
Open your terminal (PowerShell, Command Prompt, or VS Code terminal):
```powershell
cd "d:\IDS COMPANY\illusory-erp"
```

---

### Step 2: Configure Backend Environment Variables (`.env`)

1. Go to the `server` folder:
   ```powershell
   cd server
   copy .env.example .env
   ```
2. Open `server/.env` in your editor and fill in your values:

| Variable | Description | Where to Get It |
|---|---|---|
| `PORT` | Backend port (default `5000`) | Leave as `5000` |
| `MONGO_URI` | MongoDB Atlas connection string | [cloud.mongodb.com](https://cloud.mongodb.com) &rarr; Database &rarr; Connect &rarr; Drivers |
| `JWT_SECRET` | Secret key for signing tokens | Any long random string (e.g. 32+ characters) |
| `JWT_EXPIRES_IN` | Token lifespan | `7d` |
| `CLIENT_URL` | Allowed frontend origin | `http://localhost:5173` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | [cloudinary.com](https://cloudinary.com) &rarr; Dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | Cloudinary Dashboard |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret | Cloudinary Dashboard |

---

### Step 3: Install Dependencies

1. **Install backend dependencies**:
   ```powershell
   cd "d:\IDS COMPANY\illusory-erp\server"
   npm install
   ```

2. **Install frontend dependencies**:
   ```powershell
   cd "d:\IDS COMPANY\illusory-erp\client"
   npm install
   ```

---

### Step 4: Seed the Database

Run the seed script from the `server` folder:
```powershell
cd "d:\IDS COMPANY\illusory-erp\server"
npm run seed
```

This will automatically create:
- **4 System Roles**: `super_admin`, `admin`, `hr`, `employee`
- **7 Agency Departments**: Design (`DES`), Development (`DEV`), Marketing (`MKT`), Sales (`SLS`), HR (`HRD`), Finance (`FIN`), Admin (`ADM`)
- **Exactly 3 Super Admins, 1 HR Manager, and 8 Employees** with linked profile records!

---

### Step 5: Start Backend and Frontend Servers

Open two terminal windows:

**Terminal 1 (Backend Server):**
```powershell
cd "d:\IDS COMPANY\illusory-erp\server"
npm run dev
```
*(Runs on `http://localhost:5000` with hot-reloading)*

**Terminal 2 (Frontend Client):**
```powershell
cd "d:\IDS COMPANY\illusory-erp\client"
npm run dev
```
*(Runs on `http://localhost:5173`)*

Now open your browser and go to:
👉 **`http://localhost:5173`**

---

## 👥 Seed Accounts for Testing

All seeded accounts have the initial temporary password:
🔑 **`ChangeMe@123`**
*(The system automatically triggers a password update on first login if `mustChangePassword` is active).*

### 👑 Super Admin Accounts (Full System & RBAC Access)
- `superadmin1@illusorydesignstudios.com` (Aarav Mohapatra — CEO)
- `superadmin2@illusorydesignstudios.com` (Rohan Patnaik — CTO)
- `superadmin3@illusorydesignstudios.com` (Ananya Dash — COO)

### 📋 HR Manager Account (Employee Master & Onboarding)
- `hr@illusorydesignstudios.com` (Sunita Jena — Head of People)

### 💼 Employee Accounts (Self-Service Profile)
- `employee1@illusorydesignstudios.com` (Debashis Tripathy — Senior Designer)
- `employee2@illusorydesignstudios.com` (Priya Mishra — Brand Strategist)
- `employee3@illusorydesignstudios.com` (Subham Sahoo — Full Stack Engineer)
- `employee4@illusorydesignstudios.com` (Ipsita Rout — Frontend Developer)
- `employee5@illusorydesignstudios.com` (Abhishek Nayak — Growth Marketer)
- `employee6@illusorydesignstudios.com` (Sweta Pradhan — Sales Executive)
- `employee7@illusorydesignstudios.com` (Manoj Panda — Financial Analyst)
- `employee8@illusorydesignstudios.com` (Pooja Behera — Operations Specialist)

---

## 🧪 Testing Role Boundaries

1. **Login as Super Admin (`superadmin1@...`)**:
   - Access **Configurations** (`/configurations`): manage users, view dynamic role permissions matrix, add departments.
   - Access **HRMS** (`/hrms`): full search, filter, Add Employee multi-step wizard, soft delete, and unmasked salary data.
2. **Login as HR (`hr@...`)**:
   - Access **HRMS**: view/edit all employees, onboard new employees, transition statuses, upload Cloudinary documents.
   - Cannot access administrative user password resets or demote Super Admins.
3. **Login as Employee (`employee1@...`)**:
   - Only sees **Home** and **My Profile** (`/my-profile`).
   - Can edit personal mobile, residential address, emergency contact, and profile avatar.
   - Attempting to access `/api/v1/employees` or other profiles directly returns `403 Forbidden`.
   - Salary and statutory data are strictly masked/hidden.
