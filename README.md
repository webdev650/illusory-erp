# Illusory ERP — API Reference (Day 1)

Built for **Illusory Design Studios Pvt. Ltd.**, Bhubaneswar, India.

## Quick Start

```bash
# 1. Copy the example env file and fill in your values
cp server/.env.example server/.env

# 2. Install dependencies
cd server && npm install

# 3. Seed the CEO account (run once)
npm run seed

# 4. Start the dev server
npm run dev
```

The server starts on `http://localhost:5000`.

## Environment Variables

| Variable | Description | Where to Get It |
|---|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string | Atlas Dashboard → Connect → Drivers |
| `JWT_ACCESS_SECRET` | Min 32-char random string | Use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | Min 32-char random string | Same as above |
| `FIELD_ENCRYPTION_KEY` | 32-char key for AES encryption | Same as above |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name | cloudinary.com → Dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary API key | cloudinary.com → Dashboard → API Keys |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | cloudinary.com → Dashboard → API Keys |
| `CEO_NAME` | Full name of the CEO account | Your name |
| `CEO_EMAIL` | CEO login email | Your email |
| `CEO_PASSWORD` | CEO initial password (change after first login!) | Pick a strong password |

## Routes

### Health
| Method | URL | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | Check if server is running |

### Auth
| Method | URL | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Register first user (becomes SUPER_ADMIN) |
| POST | `/api/auth/login` | None | Login, get access token + refresh cookie |
| POST | `/api/auth/refresh` | Cookie | Get a new access token |
| POST | `/api/auth/logout` | Cookie | Logout and invalidate refresh token |
| GET | `/api/auth/me` | Bearer | Get current user profile |

### HRMS — Employees
| Method | URL | Auth | Description |
|---|---|---|---|
| GET | `/api/hrms/employees` | Bearer | List all employees (paginated, searchable) |
| POST | `/api/hrms/employees` | Bearer + SUPER_ADMIN/HR_ADMIN | Create employee |
| GET | `/api/hrms/employees/:id` | Bearer | Get one employee |
| PUT | `/api/hrms/employees/:id` | Bearer + SUPER_ADMIN/HR_ADMIN | Update employee |
| DELETE | `/api/hrms/employees/:id` | Bearer + SUPER_ADMIN | Soft-delete employee |
| POST | `/api/hrms/employees/:id/photo` | Bearer + SUPER_ADMIN/HR_ADMIN | Upload profile photo |
| POST | `/api/hrms/employees/:id/documents` | Bearer + SUPER_ADMIN/HR_ADMIN | Upload document |

## Example Requests (copy-paste into Thunder Client or curl)

### 1. Health check
```bash
curl http://localhost:5000/api/health
```

### 2. Register first user (becomes SUPER_ADMIN)
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Admin","email":"test@example.com","password":"Test@1234"}'
```

### 3. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"ceo@illusorydesignstudios.com","password":"ChangeMe@123"}'
```

### 4. Get current user (replace TOKEN with the access token from login)
```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

### 5. Create employee
```bash
curl -X POST http://localhost:5000/api/hrms/employees \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "personal": {
      "fullName": "Priya Sharma",
      "gender": "FEMALE",
      "dob": "1995-06-15"
    },
    "contact": {
      "officialEmail": "priya@illusorydesignstudios.com",
      "personalMobile": "9876543210"
    },
    "employment": {
      "joiningDate": "2024-01-15",
      "department": "Design",
      "designation": "UI/UX Designer",
      "employeeType": "FULL_TIME"
    }
  }'
```

### 6. List employees with search
```bash
curl "http://localhost:5000/api/hrms/employees?search=priya&page=1&limit=10" \
  -H "Authorization: Bearer TOKEN"
```

### 7. Refresh token (uses the httpOnly cookie)
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -b cookies.txt
```

## Roles

| Role | Permissions |
|---|---|
| `SUPER_ADMIN` | Full access to everything, including delete and salary/statutory data |
| `HR_ADMIN` | Create/edit employees, view salary/statutory data |
| `FINANCE` | View salary/statutory data, cannot create/edit employees |
| `MANAGER` | View team employees, cannot see salary/statutory |
| `SALES` | View own profile only |
| `EMPLOYEE` | View own profile only, no salary/statutory of others |

## Project Structure

```
server/
  src/
    config/        # db.js, cloudinary.js, env.js
    middleware/    # auth.js, role.js, error.js, upload.js, audit.js
    modules/
      auth/        # User model, auth service/controller/routes/validator
      users/       # Users routes (placeholder, expand later)
      hrms/        # Employee model, AuditLog model, HRMS service/controller/routes
    utils/         # apiResponse.js, encrypt.js
    scripts/       # seed.js
    app.js
    server.js
  tests/
    auth.test.js
  .env.example
  .gitignore
  package.json
  README.md
```
