# 🚀 Illusory ERP — Backend Architecture & Core Services

Enterprise Resource Planning (ERP) REST API and business logic engine built for **Illusory Design Studios Pvt. Ltd.** (Bhubaneswar, Odisha, India).

---

## 🏛️ 1. Global Architectural Rules

1. **Monetary Values**: All currency amounts are strictly stored as **integer paise** (`1 INR = 100 paise`). Floating-point arithmetic for currency is strictly prohibited.
2. **Date & Time Standards**: All timestamps in the MongoDB database are stored in **UTC**. Business day logic, shifts, and date boundaries are calculated in **`Asia/Kolkata` (IST)**.
3. **Defense in Depth**: Every protected route enforces `requireAuth` + `requirePermission(key)` + server-side ownership scoping (employees see only their own data; managers see direct reports; HR/admins see department/company records).
4. **Data Sanitization & Redaction**: Strict stripping of sensitive PII (Aadhaar, PAN, Bank Details, Passwords, License Keys, Secrets) from logs and non-privileged responses.
5. **Atomic Number Sequences**: High-concurrency codes (e.g. `AST-0001`, `EXP-2026-0001`, `INV-2026-0001`) are generated atomically via the MongoDB `Counter` collection.
6. **Audit Trail**: Every create, update, delete, approve, export, and sensitive field access is permanently logged in `AuditLog`.

---

## 🛡️ 2. Phase 0: Foundation Hardening

- **Startup Environment Validation**: `src/config/envValidator.js` validates all environment variables on boot and fails fast with actionable instructions if any key is missing.
- **Security Headers & Hardening**:
  - `helmet`: Protective HTTP response headers.
  - `cors`: Strict origin validation against `CLIENT_URL` with local dev support.
  - `mongoSanitizeMiddleware`: Recursive in-place stripping of prohibited MongoDB operators (`$` and `.`) compatible with Express 5 getters.
  - `hpp`: Protection against HTTP Parameter Pollution.
  - `compression`: Fast gzip/brotli payload compression.
- **Rate Limiting**:
  - `generalLimiter`: 300 requests / 15 minutes across general API endpoints.
  - `authLimiter`: 15 requests / 15 minutes on sensitive authentication routes (`/api/v1/auth/login`).
  - `publicFormLimiter`: 30 requests / 15 minutes for public forms (leads, careers).
- **Request Tracing**: `requestIdMiddleware` tags every incoming and outgoing request with a unique `X-Request-Id` UUID.
- **Structured Pino Logger**: JSON logger with automatic redaction of cookies, authorization headers, passwords, and PII.
- **Centralized Error Handler**: Handles Zod schemas, Mongoose validation, CastError, duplicate keys (code 11000), JWT expiry, and Multer file size limits with consistent `{ success: false, message, errors, requestId }`.
- **Liveness & Readiness Probes**:
  - `GET /api/v1/health`: Process status, uptime, and node environment.
  - `GET /api/v1/ready`: Live MongoDB ping probe. Returns `200 OK` when ready, `503 Service Unavailable` if database is down.

---

## ⚙️ 3. Core Foundation Services

| Service | File | Description |
|---|---|---|
| **Counter Service** | `src/services/counter.service.js` | Atomic sequential generator (`getNextSequence`) for format strings like `AST-0001`, `EXP-2026-0001`. |
| **PDF Service** | `src/services/pdf.service.js` | Pure Node.js `pdfkit` vector document generator for offer letters, invoices, and payslips. |
| **Export Service** | `src/services/export.service.js` | Styled `.xlsx` workbooks and `.csv` exports using `exceljs`. |
| **Template Engine** | `src/services/template.service.js` | `handlebars` engine with built-in `formatPaise` (INR currency) and `formatDate` (IST) helpers. |
| **Crypto Utility** | `src/utils/crypto.js` | AES-256 field-level encryption, decryption, and PII masking (`mask(pan)`). |
| **Pagination Helper** | `src/utils/pagination.js` | Standardized `page`, `limit`, `skip`, `sort` parsing and pagination meta builder. |
| **Email Service** | `src/services/email.service.js` | Outbound transactional dispatch via Nodemailer; safely skips when unconfigured. |
| **File Storage** | `src/services/upload.service.js` | Cloudinary upload stream and deletion helpers with type and size validation. |

---

## 🔐 4. Module-Level Permission Matrix

The system uses dynamic, assignable permission keys. Below is the master matrix across standard roles:

| Module / Scope | Permission Key | Super Admin | Admin | HR Manager | IT Admin | Project Manager | Employee |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Auth & Profile** | `auth.login`, `auth.changePassword` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Preferences** | `preferences.read`, `preferences.write` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Employee Master** | `employee.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| | `employee.readOwn` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `employee.create`, `employee.update` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | `employee.viewSalary`, `employee.viewSensitive` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Attendance & Leave** | `attendance.read` (Company) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | `attendance.readOwn`, `attendance.checkIn` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `attendance.break`, `attendance.remoteWork` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `attendance.regularize` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `leave.apply`, `leave.readOwn` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `leave.manage`, `leave.approve` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Projects & Tasks** | `project.read`, `task.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `project.create`, `project.update` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| | `task.create`, `task.update` | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Activity Tracker** | `activity.timer`, `timesheet.submit` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `timesheet.approve` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| | `activity.viewCost` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Assets & Hardware** | `asset.read` (All assets) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| | `asset.readOwn` (Assigned to me) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `asset.create`, `asset.update` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| | `asset.assign`, `asset.return` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| | `asset.request` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `asset.approveRequest` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| | `asset.maintain` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| | `asset.viewCost`, `asset.viewSecrets` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| | `license.read`, `license.manage` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Approval Engine** | `approval.readAssigned`, `approval.act` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Audit Logs** | `audit.view`, `audit.export` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 📦 5. Database Backup & Disaster Recovery

### Local / Self-Hosted Backup Command
Run the automated backup script to export all active collections to a timestamped JSON dump:
```bash
npm run backup
```
Backups are saved to `server/backups/backup-YYYY-MM-DD_HH-mm-ss/` with an accompanying `manifest.json`.

### Enabling Automated MongoDB Atlas Backups (Production)
1. Log into your [MongoDB Atlas Console](https://cloud.mongodb.com).
2. Select your production cluster (`Cluster0`).
3. Click on the **Backup** tab.
4. Enable **Cloud Backup** (continuous snapshots).
5. Set retention policy:
   - Hourly snapshots: Retain for 24 hours.
   - Daily snapshots: Retain for 7 days.
   - Weekly snapshots: Retain for 4 weeks.
6. Enable **Point-in-Time Restore (PITR)** to allow rollbacks to any specific minute within the last 7 days.

---

## 📖 6. API Documentation & Testing

- **Interactive Swagger UI**: Visit `http://localhost:5000/api/docs/` in your browser.
- **OpenAPI 3.0 Specification**: Available at `http://localhost:5000/api/docs.json`.
- **Postman Collection**: Import [Illusory-ERP.postman_collection.json](file:///d:/IDS%20COMPANY/illusory-erp/server/docs/Illusory-ERP.postman_collection.json) into Postman.
- **Run Automated Test Suite**:
  ```bash
  npm test
  ```
  Executes all 30 unit and integration tests across Phase 0 services and authentication routes.
