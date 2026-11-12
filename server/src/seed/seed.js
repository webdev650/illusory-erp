import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Role } from '../models/Role.js';
import { Department } from '../models/Department.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Shift } from '../models/Shift.js';
import { WorkflowConfig } from '../models/WorkflowConfig.js';
import { LeaveType } from '../models/LeaveType.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { Attendance } from '../models/Attendance.js';
import { Holiday } from '../models/Holiday.js';
import { Announcement } from '../models/Announcement.js';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import Client from '../models/Client.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import TaskComment from '../models/TaskComment.js';
import TaskActivity from '../models/TaskActivity.js';
import TimeEntry from '../models/TimeEntry.js';
import Timesheet from '../models/Timesheet.js';
import ActiveTimer from '../models/ActiveTimer.js';
import {
  toKolkataDateOnly,
  getWeekBounds,
  recalculateTaskAndProjectTime,
} from '../services/activity.service.js';
import { ROLE_PERMISSIONS } from '../config/modules.js';

dotenv.config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ MONGO_URI missing in .env');
  process.exit(1);
}

const seedDatabase = async () => {
  try {
    console.log('🔄 Connecting to MongoDB for seeding...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    // 1. Update/Upsert Roles with Full Module Permission Keys
    console.log('\n--- 1. Syncing Roles & Dynamic Permissions ---');
    const rolesData = [
      {
        name: 'Super Admin',
        key: 'super_admin',
        description: 'Complete unrestricted control over the entire system, users, and settings',
        permissions: ROLE_PERMISSIONS.super_admin,
        isSystem: true,
      },
      {
        name: 'Admin',
        key: 'admin',
        description: 'Full operational control over employees, departments, and user accounts',
        permissions: ROLE_PERMISSIONS.admin,
        isSystem: true,
      },
      {
        name: 'HR Manager',
        key: 'hr',
        description: 'HR administrative access for managing employees, attendance, leaves, and approvals',
        permissions: ROLE_PERMISSIONS.hr,
        isSystem: true,
      },
      {
        name: 'Project Manager',
        key: 'project_manager',
        description: 'Project lead with full control over assigned client projects, task delegation, and milestones',
        permissions: ROLE_PERMISSIONS.project_manager,
        isSystem: true,
      },
      {
        name: 'Employee',
        key: 'employee',
        description: 'Employee self-service access to personal profile, attendance, leaves, and requests',
        permissions: ROLE_PERMISSIONS.employee,
        isSystem: true,
      },
    ];

    const rolesMap = {};
    for (const r of rolesData) {
      const roleDoc = await Role.findOneAndUpdate(
        { key: r.key },
        { $set: { name: r.name, description: r.description, permissions: r.permissions, isSystem: true } },
        { upsert: true, new: true }
      );
      console.log(`  ✓ Synced Role: ${r.name} (${r.key}) [${roleDoc.permissions.length} permissions]`);
      rolesMap[r.key] = roleDoc._id;
    }

    // 2. Departments
    console.log('\n--- 2. Syncing Departments ---');
    const departmentsData = [
      { name: 'Design', code: 'DES', description: 'UI/UX, Product Design, and Visual Identity' },
      { name: 'Development', code: 'DEV', description: 'Full-stack engineering, mobile, and cloud' },
      { name: 'Marketing', code: 'MKT', description: 'Digital marketing, SEO, and brand growth' },
      { name: 'Sales', code: 'SLS', description: 'Business development and client partnerships' },
      { name: 'HR', code: 'HRD', description: 'Human resources, talent acquisition, and culture' },
      { name: 'Finance', code: 'FIN', description: 'Financial planning, payroll, and accounting' },
      { name: 'Admin', code: 'ADM', description: 'Executive administration and studio operations' },
    ];

    const deptsMap = {};
    for (const d of departmentsData) {
      const deptDoc = await Department.findOneAndUpdate(
        { code: d.code },
        { $set: { name: d.name, description: d.description, isDeleted: false } },
        { upsert: true, new: true }
      );
      console.log(`  ✓ Synced Department: ${d.name} (${d.code})`);
      deptsMap[d.code] = deptDoc._id;
    }

    // 3. Shifts
    console.log('\n--- 3. Setting Up Default Shift ---');
    const defaultShift = await Shift.findOneAndUpdate(
      { isDefault: true },
      {
        $set: {
          name: 'General Studio Shift',
          startTime: '09:30',
          endTime: '18:30',
          graceMinutes: 15,
          workingDays: [1, 2, 3, 4, 5],
          halfDayHours: 4,
          fullDayHours: 8,
          isDefault: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Shift active: ${defaultShift.name} (${defaultShift.startTime} - ${defaultShift.endTime})`);

    // 4. Approval Workflows
    console.log('\n--- 4. Setting Up Approval Workflows ---');
    await WorkflowConfig.findOneAndUpdate(
      { type: 'leave' },
      {
        $set: {
          name: 'Standard Leave Approval',
          description: 'Two-tier verification: Reporting Manager -> HR',
          steps: [
            { order: 1, name: 'Reporting Manager Review', approverType: 'manager' },
            { order: 2, name: 'HR Administration Review', approverType: 'role', roleKey: 'hr' },
          ],
          isActive: true,
        },
      },
      { upsert: true }
    );

    await WorkflowConfig.findOneAndUpdate(
      { type: 'regularization' },
      {
        $set: {
          name: 'Attendance Regularization',
          description: 'Direct HR verification for missed check-in/out',
          steps: [
            { order: 1, name: 'HR Verification', approverType: 'role', roleKey: 'hr' },
          ],
          isActive: true,
        },
      },
      { upsert: true }
    );
    console.log('  ✓ Leave & Attendance workflows registered');

    // 5. Leave Types
    console.log('\n--- 5. Syncing Leave Types ---');
    const leaveTypesData = [
      { name: 'Casual Leave', code: 'CL', yearlyQuota: 12, paid: true, allowHalfDay: true },
      { name: 'Sick Leave', code: 'SL', yearlyQuota: 8, paid: true, requiresDocument: true, allowHalfDay: true },
      { name: 'Earned Leave', code: 'EL', yearlyQuota: 15, paid: true, carryForward: true, maxCarry: 30, allowHalfDay: false },
      { name: 'Compensatory Off', code: 'COMP', yearlyQuota: 0, paid: true, allowHalfDay: true },
      { name: 'Unpaid Leave (LWP)', code: 'LWP', yearlyQuota: 365, paid: false, allowHalfDay: true },
    ];

    const leaveTypeMap = {};
    for (const lt of leaveTypesData) {
      const typeDoc = await LeaveType.findOneAndUpdate(
        { code: lt.code },
        { $set: lt },
        { upsert: true, new: true }
      );
      console.log(`  ✓ Leave Type: ${typeDoc.name} (${typeDoc.code}) — Quota: ${typeDoc.yearlyQuota} days`);
      leaveTypeMap[lt.code] = typeDoc._id;
    }

    // 6. Users & Employees (Idempotent: matches by email)
    console.log('\n--- 6. Syncing Users & Employees ---');
    const defaultPassword = 'ChangeMe@123';
    const passwordHash = await User.hashPassword(defaultPassword);

    const seedEmployees = [
      // 3 Super Admins
      {
        firstName: 'Aarav',
        lastName: 'Mohapatra',
        email: 'superadmin1@illusorydesignstudios.com',
        phone: '+91 98765 43210',
        designation: 'Managing Director & CEO',
        deptCode: 'ADM',
        roleKey: 'super_admin',
      },
      {
        firstName: 'Rohan',
        lastName: 'Patnaik',
        email: 'superadmin2@illusorydesignstudios.com',
        phone: '+91 98765 43211',
        designation: 'Co-Founder & CTO',
        deptCode: 'DEV',
        roleKey: 'super_admin',
      },
      {
        firstName: 'Ananya',
        lastName: 'Dash',
        email: 'superadmin3@illusorydesignstudios.com',
        phone: '+91 98765 43212',
        designation: 'Co-Founder & COO',
        deptCode: 'ADM',
        roleKey: 'super_admin',
      },
      // 1 HR
      {
        firstName: 'Sunita',
        lastName: 'Jena',
        email: 'hr@illusorydesignstudios.com',
        phone: '+91 98765 43213',
        designation: 'Head of People & Culture',
        deptCode: 'HRD',
        roleKey: 'hr',
      },
      // 1 Project Manager
      {
        firstName: 'Bikash',
        lastName: 'Panda',
        email: 'pm@illusorydesignstudios.com',
        phone: '+91 98765 43219',
        designation: 'Technical Project Lead',
        deptCode: 'DEV',
        roleKey: 'project_manager',
      },
      // 8 Employees
      {
        firstName: 'Debashis',
        lastName: 'Tripathy',
        email: 'employee1@illusorydesignstudios.com',
        phone: '+91 98765 43214',
        designation: 'Senior UI/UX Designer',
        deptCode: 'DES',
        roleKey: 'employee',
      },
      {
        firstName: 'Priya',
        lastName: 'Mishra',
        email: 'employee2@illusorydesignstudios.com',
        phone: '+91 98765 43215',
        designation: 'Lead Brand Strategist',
        deptCode: 'DES',
        roleKey: 'employee',
      },
      {
        firstName: 'Subham',
        lastName: 'Sahoo',
        email: 'employee3@illusorydesignstudios.com',
        phone: '+91 98765 43216',
        designation: 'Full Stack Engineer',
        deptCode: 'DEV',
        roleKey: 'employee',
      },
      {
        firstName: 'Ipsita',
        lastName: 'Rout',
        email: 'employee4@illusorydesignstudios.com',
        phone: '+91 98765 43217',
        designation: 'Frontend React Developer',
        deptCode: 'DEV',
        roleKey: 'employee',
      },
      {
        firstName: 'Abhishek',
        lastName: 'Nayak',
        email: 'employee5@illusorydesignstudios.com',
        phone: '+91 98765 43218',
        designation: 'Growth Marketer',
        deptCode: 'MKT',
        roleKey: 'employee',
      },
      {
        firstName: 'Sweta',
        lastName: 'Pradhan',
        email: 'employee6@illusorydesignstudios.com',
        phone: '+91 98765 43219',
        designation: 'Enterprise Sales Executive',
        deptCode: 'SLS',
        roleKey: 'employee',
      },
      {
        firstName: 'Manoj',
        lastName: 'Panda',
        email: 'employee7@illusorydesignstudios.com',
        phone: '+91 98765 43220',
        designation: 'Financial Analyst',
        deptCode: 'FIN',
        roleKey: 'employee',
      },
      {
        firstName: 'Pooja',
        lastName: 'Behera',
        email: 'employee8@illusorydesignstudios.com',
        phone: '+91 98765 43221',
        designation: 'Operations Specialist',
        deptCode: 'ADM',
        roleKey: 'employee',
      },
    ];

    const currentYear = new Date().getFullYear();
    const createdEmployeeDocs = [];

    for (let i = 0; i < seedEmployees.length; i++) {
      const u = seedEmployees[i];
      let emp = await Employee.findOne({ 'personal.officialEmail': u.email });

      if (!emp) {
        emp = await Employee.create({
          personal: {
            firstName: u.firstName,
            lastName: u.lastName,
            gender: i % 2 === 0 ? 'Male' : 'Female',
            dob: new Date('1995-05-18'),
            bloodGroup: 'B+',
            maritalStatus: 'Single',
            phone: u.phone,
            personalEmail: `${u.firstName.toLowerCase()}@gmail.com`,
            officialEmail: u.email,
            currentAddress: {
              line1: 'Infocity Road, Patia',
              city: 'Bhubaneswar',
              state: 'Odisha',
              pincode: '751024',
              country: 'India',
            },
            permanentAddress: {
              line1: 'Infocity Road, Patia',
              city: 'Bhubaneswar',
              state: 'Odisha',
              pincode: '751024',
              country: 'India',
            },
          },
          employment: {
            dateOfJoining: new Date(2024, 0, 15 + i),
            employeeType: 'Full-Time',
            department: deptsMap[u.deptCode],
            designation: u.designation,
            workMode: 'Hybrid',
            noticePeriodDays: 30,
          },
          emergencyContacts: [
            {
              name: 'Family Contact',
              relation: 'Emergency',
              phone: '+91 98765 00000',
            },
          ],
          statutory: {
            aadhaar: '987654321098',
            pan: 'ABCDE1234F',
            uan: '100987654321',
            esiNumber: '21000987650000001',
          },
          bank: {
            accountHolder: `${u.firstName} ${u.lastName}`,
            bankName: 'HDFC Bank',
            accountNumber: `501000${String(100000 + i)}`,
            ifsc: 'HDFC0001234',
          },
          salary: {
            ctc: 900000 + i * 150000,
            basic: 450000 + i * 75000,
            hra: 225000 + i * 37500,
            allowances: 225000 + i * 37500,
          },
          status: 'active',
        });
        console.log(`  + Created Employee: [${emp.employeeId}] ${u.firstName} ${u.lastName}`);
      }

      createdEmployeeDocs.push(emp);

      // User account
      let user = await User.findOne({ email: u.email });
      if (!user) {
        user = await User.create({
          email: u.email,
          passwordHash,
          role: rolesMap[u.roleKey],
          employee: emp._id,
          mustChangePassword: true,
          isActive: true,
        });
        console.log(`  + Created User: ${u.email} (${u.roleKey})`);
      } else {
        // Update role if changed
        user.role = rolesMap[u.roleKey];
        user.employee = emp._id;
        await user.save();
      }

      // Initialize Leave Balances
      for (const [code, typeId] of Object.entries(leaveTypeMap)) {
        const typeData = leaveTypesData.find((l) => l.code === code);
        await LeaveBalance.findOneAndUpdate(
          { employee: emp._id, leaveType: typeId, year: currentYear },
          {
            $setOnInsert: {
              allocated: typeData?.yearlyQuota || 0,
              used: 0,
              pending: 0,
              carried: 0,
            },
          },
          { upsert: true }
        );
      }
    }

    // Assign reporting managers: Aarav (IDS001) manages Sunita, Sunita manages employees
    const ceo = createdEmployeeDocs.find((e) => e.personal.officialEmail.includes('superadmin1'));
    const hr = createdEmployeeDocs.find((e) => e.personal.officialEmail.includes('hr@'));

    if (ceo && hr) {
      await Employee.findByIdAndUpdate(hr._id, { 'employment.reportingManager': ceo._id });
      for (const e of createdEmployeeDocs) {
        if (e.personal.officialEmail.includes('employee')) {
          await Employee.findByIdAndUpdate(e._id, { 'employment.reportingManager': hr._id });
        }
      }
      console.log('  ✓ Reporting hierarchy mapped: CEO -> HR -> Employees');
    }

    // 7. Seed Sample Odisha Holidays
    console.log('\n--- 7. Syncing Sample Odisha Holidays (2026) ---');
    const holidays2026 = [
      { name: "New Year's Day", date: new Date(2026, 0, 1), type: 'national', description: 'Universal Holiday' },
      { name: 'Republic Day', date: new Date(2026, 0, 26), type: 'national', description: 'National Holiday' },
      { name: 'Maha Shivaratri', date: new Date(2026, 1, 16), type: 'festival', description: 'Odisha State Holiday' },
      { name: 'Holi', date: new Date(2026, 2, 4), type: 'festival', description: 'Festival of Colors' },
      { name: 'Utkala Dibasa (Odisha Day)', date: new Date(2026, 3, 1), type: 'festival', description: 'Formation of Odisha State' },
      { name: 'Id-ul-Fitr', date: new Date(2026, 2, 20), type: 'festival', description: 'Religious Holiday' },
      { name: 'Raja Sankranti', date: new Date(2026, 5, 15), type: 'festival', description: 'Famous Odisha Agricultural Festival' },
      { name: 'Ratha Yatra (Puri)', date: new Date(2026, 6, 16), type: 'festival', description: 'Car Festival of Lord Jagannath' },
      { name: 'Independence Day', date: new Date(2026, 7, 15), type: 'national', description: 'National Holiday' },
      { name: 'Janmashtami', date: new Date(2026, 8, 4), type: 'festival', description: 'Birth of Lord Krishna' },
      { name: 'Ganesh Puja', date: new Date(2026, 8, 14), type: 'festival', description: 'Vinayaka Chaturthi' },
      { name: 'Gandhi Jayanti', date: new Date(2026, 9, 2), type: 'national', description: 'Mahatma Gandhi Birthday' },
      { name: 'Durga Puja (Maha Ashtami)', date: new Date(2026, 9, 19), type: 'festival', description: 'Autumn Festival' },
      { name: 'Vijaya Dashami (Dussehra)', date: new Date(2026, 9, 20), type: 'festival', description: 'Victory of Good over Evil' },
      { name: 'Diwali (Kali Puja)', date: new Date(2026, 10, 8), type: 'festival', description: 'Festival of Lights' },
      { name: 'Christmas Day', date: new Date(2026, 11, 25), type: 'national', description: 'Universal Holiday' },
    ];

    for (const h of holidays2026) {
      await Holiday.findOneAndUpdate(
        { name: h.name, year: 2026 },
        { $set: { ...h, year: 2026 } },
        { upsert: true }
      );
    }
    console.log(`  ✓ Synced ${holidays2026.length} sample holidays for Odisha (2026)`);

    // 8. Seed Demo Announcements
    console.log('\n--- 8. Syncing Announcements ---');
    const adminUser = await User.findOne({ email: 'superadmin1@illusorydesignstudios.com' });
    if (adminUser) {
      await Announcement.findOneAndUpdate(
        { title: 'Welcome to Illusory Studio ERP Day 2 — HR Operations & Attendance Live' },
        {
          $set: {
            title: 'Welcome to Illusory Studio ERP Day 2 — HR Operations & Attendance Live',
            body: 'Today our agency launches live web check-in, automated work-hour calculations, leave management with multi-tier approvals, and team calendars. Please test your daily check-in.',
            audience: 'all',
            pinned: true,
            createdBy: adminUser._id,
          },
        },
        { upsert: true }
      );

      await Announcement.findOneAndUpdate(
        { title: 'Quarterly Creative & Tech Showcase — Infocity Hub' },
        {
          $set: {
            title: 'Quarterly Creative & Tech Showcase — Infocity Hub',
            body: 'Design and engineering teams will present Q4 client prototypes this Friday at 4:00 PM in the studio amphitheatre. Beverages and snacks will be served.',
            audience: 'all',
            pinned: false,
            createdBy: adminUser._id,
          },
        },
        { upsert: true }
      );
      console.log('  ✓ 2 studio announcements published');
    }

    // 9. Seed 14 Days of Demo Attendance for Employees
    console.log('\n--- 9. Generating 14 Days of Demo Attendance ---');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attCount = 0;
    for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
      const attDate = new Date(today);
      attDate.setDate(attDate.getDate() - dayOffset);
      const dayOfWeek = attDate.getDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

      for (let eIdx = 0; eIdx < createdEmployeeDocs.length; eIdx++) {
        const emp = createdEmployeeDocs[eIdx];

        // Pseudo-random realistic distribution
        const isLate = (eIdx + dayOffset) % 5 === 0;
        const isLeave = (eIdx + dayOffset) % 13 === 0;

        let status = 'present';
        if (isLeave) status = 'leave';
        else if (isLate) status = 'late';

        const checkIn = new Date(attDate);
        checkIn.setHours(isLate ? 9 : 9, isLate ? 52 : 22, 0);

        const checkOut = new Date(attDate);
        checkOut.setHours(18, 35, 0);

        const workHours = isLeave ? 0 : 8.5;

        await Attendance.findOneAndUpdate(
          { employee: emp._id, date: attDate },
          {
            $set: {
              checkIn: isLeave ? null : checkIn,
              checkOut: isLeave ? null : checkOut,
              workHours,
              status,
              source: 'web',
              location: 'Studio (Bhubaneswar)',
              note: isLate ? 'Slight traffic on Infocity road' : '',
            },
          },
          { upsert: true }
        );
        attCount++;
      }
    }
    console.log(`  ✓ Generated ${attCount} realistic attendance records across 14 working days`);

    // 10. Seed Demo Leave Request in Pending State for Approval Engine Testing
    console.log('\n--- 10. Generating Demo Leave Requests & Approvals ---');
    const sampleEmp = createdEmployeeDocs.find((e) => e.personal.officialEmail.includes('employee1'));
    const clType = await LeaveType.findOne({ code: 'CL' });

    if (sampleEmp && clType && hr) {
      const leaveStart = new Date(today);
      leaveStart.setDate(leaveStart.getDate() + 5);
      const leaveEnd = new Date(leaveStart);
      leaveEnd.setDate(leaveEnd.getDate() + 1);

      let demoLeave = await LeaveRequest.findOne({ employee: sampleEmp._id, status: 'pending' });
      if (!demoLeave) {
        demoLeave = await LeaveRequest.create({
          employee: sampleEmp._id,
          leaveType: clType._id,
          fromDate: leaveStart,
          toDate: leaveEnd,
          days: 2,
          reason: 'Family ceremony in Cuttack',
          status: 'pending',
        });

        const approval = await ApprovalRequest.create({
          type: 'leave',
          referenceModel: 'LeaveRequest',
          referenceId: demoLeave._id,
          requestedBy: sampleEmp._id,
          title: `Casual Leave Request (2 days)`,
          metadata: {
            leaveTypeName: 'Casual Leave',
            days: 2,
            fromDate: leaveStart,
            toDate: leaveEnd,
            reason: 'Family ceremony in Cuttack',
          },
          steps: [
            {
              order: 1,
              title: 'Reporting Manager Review',
              approverEmployee: hr._id,
              status: 'pending',
            },
            {
              order: 2,
              title: 'HR Final Sign-off',
              approverRole: 'hr',
              status: 'pending',
            },
          ],
          currentStep: 1,
          status: 'pending',
        });

        demoLeave.approvalRequest = approval._id;
        await demoLeave.save();

        console.log(`  ✓ Created sample pending leave request for ${sampleEmp.personal.firstName} ${sampleEmp.personal.lastName} (Waiting for HR / Manager approval)`);
      }
    }

    // 12. Seed Clients (Day 3)
    console.log('\n--- 12. Syncing Clients ---');
    const ceoUser = await User.findOne({ email: 'superadmin1@illusorydesignstudios.com' });
    const clientsData = [
      {
        name: 'Odisha Crafts & Tourism Corp',
        companyName: 'Odisha Crafts & Tourism Corporation Ltd.',
        contactPerson: 'Manas Ranjan Mohapatra',
        email: 'manas.mohapatra@odishatourism.gov.in',
        phone: '+91 674 2432177',
        address: 'Paryatan Bhawan, Lewis Road, Bhubaneswar, Odisha 751014',
        gstNumber: '21AAACG1234A1Z5',
        industry: 'Tourism & Public Sector',
        status: 'active',
        notes: 'State tourism and heritage promotions body. Key accounts for annual digital festivals.',
      },
      {
        name: 'Kalinga Health Tech Pvt Ltd',
        companyName: 'Kalinga Health Technologies Pvt. Ltd.',
        contactPerson: 'Dr. Ananya Pattnaik',
        email: 'ananya.p@kalingahealth.io',
        phone: '+91 94370 12345',
        address: 'Infocity Tech Park, Patia, Bhubaneswar, Odisha 751024',
        gstNumber: '21AABCK5678B1Z2',
        industry: 'Healthcare SaaS',
        status: 'active',
        notes: 'Series-A funded health-tech startup. Monthly retainer for app & portal development.',
      },
      {
        name: 'Mayurbhanj Artisans Collective',
        companyName: 'Mayurbhanj Indigenous Crafts & Handloom Producer Co.',
        contactPerson: 'Rakesh Bhanja',
        email: 'crafts@mayurbhanjartisans.org',
        phone: '+91 98610 98765',
        address: 'Station Road, Baripada, Mayurbhanj, Odisha 757001',
        gstNumber: '21AABCM9012C1Z8',
        industry: 'E-commerce & Handicrafts',
        status: 'active',
        notes: 'Artisan co-op enterprise connecting tribal dokra and sabai craftspersons with direct buyers.',
      },
    ];

    const clientsMap = {};
    for (const c of clientsData) {
      const clientDoc = await Client.findOneAndUpdate(
        { gstNumber: c.gstNumber },
        { $set: { ...c, createdBy: ceoUser?._id, isDeleted: false } },
        { upsert: true, new: true }
      );
      console.log(`  ✓ Synced Client: ${clientDoc.name} (${clientDoc.industry})`);
      clientsMap[c.name] = clientDoc._id;
    }

    // 13. Seed Projects (Day 3)
    console.log('\n--- 13. Syncing Projects ---');
    const ceoEmp = await Employee.findOne({ officialEmail: 'superadmin1@illusorydesignstudios.com' });
    const ctoEmp = await Employee.findOne({ officialEmail: 'superadmin2@illusorydesignstudios.com' });
    const pmEmp = await Employee.findOne({ officialEmail: 'pm@illusorydesignstudios.com' }) || ctoEmp;
    const emp1 = await Employee.findOne({ officialEmail: 'employee1@illusorydesignstudios.com' });
    const emp2 = await Employee.findOne({ officialEmail: 'employee2@illusorydesignstudios.com' });
    const emp3 = await Employee.findOne({ officialEmail: 'employee3@illusorydesignstudios.com' });
    const emp4 = await Employee.findOne({ officialEmail: 'employee4@illusorydesignstudios.com' });
    const emp5 = await Employee.findOne({ officialEmail: 'employee5@illusorydesignstudios.com' });
    const emp6 = await Employee.findOne({ officialEmail: 'employee6@illusorydesignstudios.com' });
    const emp7 = await Employee.findOne({ officialEmail: 'employee7@illusorydesignstudios.com' });
    const emp8 = await Employee.findOne({ officialEmail: 'employee8@illusorydesignstudios.com' });

    const projectsData = [
      {
        projectCode: 'PRJ-2026-001',
        name: 'Odisha Tourism Experience Portal',
        client: clientsMap['Odisha Crafts & Tourism Corp'],
        description: 'Interactive cultural web portal showcasing eco-retreats, temple circuits, and tribal artisan experiences with 3D walkthroughs.',
        type: 'website',
        status: 'active',
        priority: 'high',
        startDate: new Date('2026-01-15'),
        dueDate: new Date('2026-05-30'),
        projectManager: ceoEmp?._id,
        members: [
          { employee: emp1?._id, roleInProject: 'Lead UI/UX Designer', allocationPercent: 100, billingRatePerHour: 60000 },
          { employee: emp3?._id, roleInProject: 'Full-Stack Developer', allocationPercent: 100, billingRatePerHour: 55000 },
          { employee: emp4?._id, roleInProject: 'Frontend Specialist', allocationPercent: 80, billingRatePerHour: 50000 },
        ],
        budget: { amount: 75000000, currency: 'INR', estimatedHours: 420 },
        milestones: [
          { name: 'Wireframes & Information Architecture', dueDate: new Date('2026-02-10'), status: 'done', amount: 20000000 },
          { name: 'Frontend Interactive Prototypes', dueDate: new Date('2026-03-25'), status: 'pending', amount: 30000000 },
          { name: 'CMS Integration & Production Launch', dueDate: new Date('2026-05-30'), status: 'pending', amount: 25000000 },
        ],
        tags: ['React', 'Tourism', 'Govt', '3D UI'],
      },
      {
        projectCode: 'PRJ-2026-002',
        name: 'Kalinga Clinic Management Mobile App',
        client: clientsMap['Kalinga Health Tech Pvt Ltd'],
        description: 'Cross-platform clinician and patient application for EHR, teleconsultation, instant digital prescriptions, and follow-ups.',
        type: 'app',
        status: 'active',
        priority: 'urgent',
        startDate: new Date('2026-02-01'),
        dueDate: new Date('2026-06-15'),
        projectManager: pmEmp?._id,
        members: [
          { employee: emp3?._id, roleInProject: 'Backend Lead', allocationPercent: 100, billingRatePerHour: 65000 },
          { employee: emp4?._id, roleInProject: 'React Native Developer', allocationPercent: 100, billingRatePerHour: 55000 },
          { employee: emp5?._id, roleInProject: 'QA & Compliance Lead', allocationPercent: 60, billingRatePerHour: 40000 },
          { employee: emp1?._id, roleInProject: 'Mobile UI Designer', allocationPercent: 50, billingRatePerHour: 60000 },
        ],
        budget: { amount: 120000000, currency: 'INR', estimatedHours: 650 },
        milestones: [
          { name: 'FHIR/HIPAA Backend API Specification', dueDate: new Date('2026-02-28'), status: 'done', amount: 35000000 },
          { name: 'Doctor & Patient App Core Workflows', dueDate: new Date('2026-04-15'), status: 'pending', amount: 55000000 },
          { name: 'Hospital Pilot & Production Rollout', dueDate: new Date('2026-06-15'), status: 'pending', amount: 30000000 },
        ],
        tags: ['React Native', 'Node.js', 'Healthcare', 'SaaS'],
      },
      {
        projectCode: 'PRJ-2026-003',
        name: 'Mayurbhanj E-Commerce Revamp',
        client: clientsMap['Mayurbhanj Artisans Collective'],
        description: 'D2C artisan marketplace for handcrafted Dokra metalcrafts, Sabai grass baskets, and natural dyed handlooms with artisan storytelling.',
        type: 'branding',
        status: 'planning',
        priority: 'medium',
        startDate: new Date('2026-03-01'),
        dueDate: new Date('2026-07-20'),
        projectManager: pmEmp?._id,
        members: [
          { employee: emp2?._id, roleInProject: 'Brand Strategist', allocationPercent: 100, billingRatePerHour: 50000 },
          { employee: emp6?._id, roleInProject: 'Graphic & Packaging Designer', allocationPercent: 80, billingRatePerHour: 45000 },
          { employee: emp7?._id, roleInProject: 'Content & Photography', allocationPercent: 50, billingRatePerHour: 35000 },
        ],
        budget: { amount: 42000000, currency: 'INR', estimatedHours: 280 },
        milestones: [
          { name: 'Brand Story & Packaging Identity', dueDate: new Date('2026-03-30'), status: 'pending', amount: 15000000 },
          { name: 'Shopify Custom Theme & Payment Gateways', dueDate: new Date('2026-07-20'), status: 'pending', amount: 27000000 },
        ],
        tags: ['E-Commerce', 'Branding', 'Artisans', 'D2C'],
      },
      {
        projectCode: 'PRJ-2026-004',
        name: 'Utkal Fintech Brand Identity',
        client: clientsMap['Kalinga Health Tech Pvt Ltd'],
        description: 'Complete visual identity redesign, logo system, design tokens, design system component library, and corporate deck.',
        type: 'branding',
        status: 'completed',
        priority: 'low',
        startDate: new Date('2025-11-01'),
        dueDate: new Date('2026-01-30'),
        completedAt: new Date('2026-01-28'),
        projectManager: ceoEmp?._id,
        members: [
          { employee: emp1?._id, roleInProject: 'Design Director', allocationPercent: 100, billingRatePerHour: 80000 },
          { employee: emp2?._id, roleInProject: 'Brand Strategist', allocationPercent: 100, billingRatePerHour: 50000 },
        ],
        budget: { amount: 28000000, currency: 'INR', estimatedHours: 180 },
        milestones: [
          { name: 'Logo Concepts & Color Palette', dueDate: new Date('2025-11-30'), status: 'done', amount: 12000000 },
          { name: 'Brand Book & Design Token Export', dueDate: new Date('2026-01-28'), status: 'done', amount: 16000000 },
        ],
        tags: ['Branding', 'Design Tokens', 'Fintech'],
      },
    ];

    const projectsMap = {};
    for (const p of projectsData) {
      const projDoc = await Project.findOneAndUpdate(
        { projectCode: p.projectCode },
        { $set: { ...p, isDeleted: false } },
        { upsert: true, new: true }
      );
      console.log(`  ✓ Synced Project: [${projDoc.projectCode}] ${projDoc.name} (${projDoc.status})`);
      projectsMap[p.projectCode] = projDoc._id;
    }

    // 14. Seed 25 Realistic Tasks (Day 3)
    console.log('\n--- 14. Syncing 25 Tasks Across Projects ---');
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const inTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const tasksSeed = [
      // PRJ-2026-001 (Odisha Tourism Experience Portal) - 8 tasks
      {
        taskCode: 'TSK-0001',
        title: 'Information architecture and site map for Odisha heritage circuits',
        description: 'Group temple circuits, Chilika eco-tourism, and tribal art tours into intuitive visitor journeys.',
        project: projectsMap['PRJ-2026-001'],
        assignees: [emp1?._id],
        reporter: ceoEmp?._id,
        status: 'done',
        priority: 'high',
        type: 'design',
        startDate: new Date('2026-01-16'),
        dueDate: new Date('2026-01-28'),
        estimatedHours: 24,
        loggedHours: 24,
        labels: ['UX', 'Architecture', 'Sitemap'],
        checklist: [
          { text: 'Audit legacy odishatourism pages', done: true },
          { text: 'Card sorting with tourism officers', done: true },
          { text: 'Finalize top-level menu hierarchy', done: true },
        ],
        order: 0,
      },
      {
        taskCode: 'TSK-0002',
        title: 'High-fidelity Figma mockups for Homepage & Eco-Retreat booking',
        description: 'Design responsive desktop and mobile screens matching the new warm earthen color palette.',
        project: projectsMap['PRJ-2026-001'],
        assignees: [emp1?._id, emp2?._id],
        reporter: ceoEmp?._id,
        status: 'done',
        priority: 'urgent',
        type: 'design',
        startDate: new Date('2026-01-29'),
        dueDate: new Date('2026-02-15'),
        estimatedHours: 40,
        loggedHours: 38,
        labels: ['UI Design', 'Figma', 'EcoRetreat'],
        checklist: [
          { text: 'Create reusable button & card components', done: true },
          { text: 'Hero banner video showcase layout', done: true },
          { text: 'Booking calendar date-range selector', done: true },
        ],
        order: 1,
      },
      {
        taskCode: 'TSK-0003',
        title: 'Develop interactive Mapbox 3D tour map component',
        description: 'Integrate Mapbox GL JS with custom temple 3D markers and elevation relief for Similipal & Daringbadi.',
        project: projectsMap['PRJ-2026-001'],
        assignees: [emp3?._id, emp4?._id],
        reporter: ceoEmp?._id,
        status: 'in_progress',
        priority: 'high',
        type: 'development',
        startDate: new Date('2026-02-16'),
        dueDate: tomorrow,
        estimatedHours: 36,
        loggedHours: 20,
        labels: ['React', 'Mapbox', '3D'],
        checklist: [
          { text: 'Setup Mapbox token and studio style', done: true },
          { text: 'Custom geojson coordinates for 30 key sites', done: true },
          { text: 'Smooth camera fly-to on location click', done: false },
          { text: 'Mobile touch gesture optimization', done: false },
        ],
        order: 0,
      },
      {
        taskCode: 'TSK-0004',
        title: 'Build search and filter engine for heritage monuments',
        description: 'Fast client-side indexing with fuse.js or backend elastic search query for 200+ protected monuments.',
        project: projectsMap['PRJ-2026-001'],
        assignees: [emp4?._id],
        reporter: ceoEmp?._id,
        status: 'in_progress',
        priority: 'medium',
        type: 'development',
        startDate: new Date('2026-02-18'),
        dueDate: nextWeek,
        estimatedHours: 28,
        loggedHours: 12,
        labels: ['Search', 'API', 'Frontend'],
        checklist: [
          { text: 'Filter by district (Puri, Khordha, Mayurbhanj)', done: true },
          { text: 'Filter by era/century', done: false },
          { text: 'Instant autocomplete dropdown', done: false },
        ],
        order: 1,
      },
      {
        taskCode: 'TSK-0005',
        title: 'Write multilingual copy in Odia and English for major attractions',
        description: 'Translate and review official Odia descriptions for Konark Sun Temple, Lingaraj, and Raghurajpur.',
        project: projectsMap['PRJ-2026-001'],
        assignees: [emp2?._id],
        reporter: ceoEmp?._id,
        status: 'in_review',
        priority: 'medium',
        type: 'content',
        startDate: new Date('2026-02-20'),
        dueDate: nextWeek,
        estimatedHours: 20,
        loggedHours: 19,
        labels: ['Odia', 'Copywriting', 'Content'],
        checklist: [
          { text: 'English source descriptions drafted', done: true },
          { text: 'Odia translations verified by native proofreader', done: true },
          { text: 'Uploaded to headless CMS preview', done: false },
        ],
        order: 0,
      },
      {
        taskCode: 'TSK-0006',
        title: 'Implement Razorpay & SBI ePay payment gateway for tour bookings',
        description: 'Secure webhook handling, double-entry transaction record, and instant SMS confirmation dispatch.',
        project: projectsMap['PRJ-2026-001'],
        assignees: [emp3?._id],
        reporter: ceoEmp?._id,
        status: 'todo',
        priority: 'urgent',
        type: 'development',
        startDate: new Date('2026-03-01'),
        dueDate: inTwoWeeks,
        estimatedHours: 32,
        loggedHours: 0,
        labels: ['Payments', 'Razorpay', 'Security'],
        checklist: [
          { text: 'Generate sandbox API keys', done: false },
          { text: 'Webhook verification signature check', done: false },
          { text: 'Refund processing handler', done: false },
        ],
        order: 0,
      },
      {
        taskCode: 'TSK-0007',
        title: 'Performance optimization for Lighthouse 95+ score',
        description: 'Next-gen AVIF/WebP image compression, script deferment, and critical CSS inlining.',
        project: projectsMap['PRJ-2026-001'],
        assignees: [emp4?._id],
        reporter: ceoEmp?._id,
        status: 'todo',
        priority: 'low',
        type: 'task',
        startDate: new Date('2026-03-10'),
        dueDate: new Date('2026-04-15'),
        estimatedHours: 16,
        loggedHours: 0,
        labels: ['SEO', 'Performance', 'Lighthouse'],
        checklist: [
          { text: 'Compress all hero background videos', done: false },
          { text: 'Add blur-up placeholders for imagery', done: false },
        ],
        order: 1,
      },
      {
        taskCode: 'TSK-0008',
        title: 'Virtual VR walkthrough integration for Jagannath Temple corridor',
        description: 'Embed 360-degree panoramic viewer for Parikrama project exterior walkways.',
        project: projectsMap['PRJ-2026-001'],
        assignees: [emp1?._id, emp3?._id],
        reporter: ceoEmp?._id,
        status: 'backlog',
        priority: 'low',
        type: 'task',
        startDate: null,
        dueDate: new Date('2026-05-15'),
        estimatedHours: 40,
        loggedHours: 0,
        labels: ['VR', '360', 'Experimental'],
        checklist: [],
        order: 0,
      },

      // PRJ-2026-002 (Kalinga Clinic Management Mobile App) - 9 tasks
      {
        taskCode: 'TSK-0009',
        title: 'Setup React Native Expo project structure with TypeScript & Tailwind',
        description: 'Configure standard architecture with clean state management, modular navigation, and offline cache.',
        project: projectsMap['PRJ-2026-002'],
        assignees: [emp4?._id],
        reporter: pmEmp?._id,
        status: 'done',
        priority: 'high',
        type: 'development',
        startDate: new Date('2026-02-01'),
        dueDate: new Date('2026-02-08'),
        estimatedHours: 16,
        loggedHours: 16,
        labels: ['ReactNative', 'Setup', 'Mobile'],
        checklist: [
          { text: 'Initialize Expo SDK 52 with NativeWind', done: true },
          { text: 'Setup React Navigation tab and stack router', done: true },
          { text: 'Configure secure token keychain storage', done: true },
        ],
        order: 0,
      },
      {
        taskCode: 'TSK-0010',
        title: 'HIPAA & DISHA compliant patient data encryption at rest',
        description: 'Implement field-level AES-256 encryption for patient medical history and prescription records.',
        project: projectsMap['PRJ-2026-002'],
        assignees: [emp3?._id],
        reporter: pmEmp?._id,
        status: 'done',
        priority: 'urgent',
        type: 'development',
        startDate: new Date('2026-02-05'),
        dueDate: new Date('2026-02-18'),
        estimatedHours: 30,
        loggedHours: 32,
        labels: ['Security', 'Encryption', 'HIPAA'],
        checklist: [
          { text: 'Create cryptographic key rotation service', done: true },
          { text: 'Audit logging for any record decryption', done: true },
        ],
        order: 1,
      },
      {
        taskCode: 'TSK-0011',
        title: 'Fix iOS camera permission crash on prescription scanner (OVERDUE)',
        description: 'App crashes immediately on iPhone 15 Pro when opening OCR camera module without prior permission grant.',
        project: projectsMap['PRJ-2026-002'],
        assignees: [emp4?._id],
        reporter: pmEmp?._id,
        status: 'in_progress',
        priority: 'urgent',
        type: 'bug',
        startDate: threeDaysAgo,
        dueDate: yesterday, // Intentionally overdue for testing
        estimatedHours: 8,
        loggedHours: 6,
        labels: ['Bug', 'iOS', 'Camera', 'Crash'],
        checklist: [
          { text: 'Update Info.plist NSCameraUsageDescription', done: true },
          { text: 'Add graceful runtime permission denial alert', done: false },
          { text: 'Test on physical iOS 17 device', done: false },
        ],
        order: 0,
      },
      {
        taskCode: 'TSK-0012',
        title: 'Doctor appointment slot booking and recurrence logic',
        description: 'Engine allowing clinicians to define custom consultation slots, breaks, and auto-buffer times.',
        project: projectsMap['PRJ-2026-002'],
        assignees: [emp3?._id, emp4?._id],
        reporter: pmEmp?._id,
        status: 'in_progress',
        priority: 'high',
        type: 'development',
        startDate: new Date('2026-02-20'),
        dueDate: tomorrow,
        estimatedHours: 24,
        loggedHours: 14,
        labels: ['Scheduling', 'Doctors', 'Algorithm'],
        checklist: [
          { text: 'Conflict detection algorithm', done: true },
          { text: 'Instant push notification on appointment booking', done: true },
          { text: 'Cancellation and refund calculation', done: false },
        ],
        order: 1,
      },
      {
        taskCode: 'TSK-0013',
        title: 'Digital prescription canvas with stylus signature capture',
        description: 'Allow doctors on iPad / Android tablets to write notes or sign official digital prescriptions.',
        project: projectsMap['PRJ-2026-002'],
        assignees: [emp1?._id],
        reporter: pmEmp?._id,
        status: 'in_review',
        priority: 'high',
        type: 'development',
        startDate: new Date('2026-02-22'),
        dueDate: nextWeek,
        estimatedHours: 20,
        loggedHours: 20,
        labels: ['Canvas', 'Signature', 'Prescription'],
        checklist: [
          { text: 'Signature pad component implemented', done: true },
          { text: 'Export high-res vector PDF with digital timestamp', done: true },
          { text: 'Sign-off from medical legal advisor', done: false },
        ],
        order: 0,
      },
      {
        taskCode: 'TSK-0014',
        title: 'SMS Gateway integration with NIC / DLT header for OTP verification',
        description: 'Configure Airtel IQ / Twilio DLT templates for 100% deliverability of login OTPs.',
        project: projectsMap['PRJ-2026-002'],
        assignees: [emp3?._id],
        reporter: pmEmp?._id,
        status: 'blocked',
        priority: 'urgent',
        type: 'task',
        startDate: new Date('2026-02-15'),
        dueDate: nextWeek,
        estimatedHours: 12,
        loggedHours: 4,
        labels: ['DLT', 'SMS', 'Blocked', 'Govt'],
        checklist: [
          { text: 'DLT Entity ID and Sender Header approved', done: true },
          { text: 'Template verification pending with telecom operator', done: false },
        ],
        order: 0,
      },
      {
        taskCode: 'TSK-0015',
        title: 'Automated test suite for end-to-end patient booking flow',
        description: 'Write Jest and Detox automated tests covering patient onboarding, slot selection, and checkout.',
        project: projectsMap['PRJ-2026-002'],
        assignees: [emp5?._id],
        reporter: pmEmp?._id,
        status: 'todo',
        priority: 'medium',
        type: 'task',
        startDate: new Date('2026-03-05'),
        dueDate: inTwoWeeks,
        estimatedHours: 24,
        loggedHours: 0,
        labels: ['QA', 'Detox', 'Automation'],
        checklist: [
          { text: 'Mock backend server with MSW', done: false },
          { text: 'E2E test suite running on CI pipeline', done: false },
        ],
        order: 0,
      },
      {
        taskCode: 'TSK-0016',
        title: 'In-app video consultation via WebRTC and Agora SDK',
        description: 'HD encrypted 1-on-1 audio/video consultation with screen sharing and chat panel.',
        project: projectsMap['PRJ-2026-002'],
        assignees: [emp3?._id, emp4?._id],
        reporter: pmEmp?._id,
        status: 'todo',
        priority: 'high',
        type: 'development',
        startDate: new Date('2026-03-15'),
        dueDate: new Date('2026-04-10'),
        estimatedHours: 48,
        loggedHours: 0,
        labels: ['WebRTC', 'Agora', 'Teleconsultation'],
        checklist: [],
        order: 1,
      },
      {
        taskCode: 'TSK-0017',
        title: 'Bluetooth IoT integration with Omron blood pressure monitors',
        description: 'Auto-sync vitals from BLE medical devices into patient timeline.',
        project: projectsMap['PRJ-2026-002'],
        assignees: [emp4?._id],
        reporter: pmEmp?._id,
        status: 'backlog',
        priority: 'low',
        type: 'task',
        startDate: null,
        dueDate: new Date('2026-05-30'),
        estimatedHours: 32,
        loggedHours: 0,
        labels: ['IoT', 'Bluetooth', 'Hardware'],
        checklist: [],
        order: 0,
      },

      // PRJ-2026-003 (Mayurbhanj E-Commerce Revamp) - 5 tasks
      {
        taskCode: 'TSK-0018',
        title: 'On-site documentary photography of Baripada brass Dokra casting (OVERDUE)',
        description: 'Field visit to Kuliana village in Mayurbhanj for artisan portraits and product hero stills.',
        project: projectsMap['PRJ-2026-003'],
        assignees: [emp7?._id, emp2?._id],
        reporter: pmEmp?._id,
        status: 'in_progress',
        priority: 'high',
        type: 'content',
        startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        dueDate: threeDaysAgo, // Intentionally overdue for testing
        estimatedHours: 24,
        loggedHours: 18,
        labels: ['Photography', 'FieldVisit', 'Artisans'],
        checklist: [
          { text: 'Travel approval to Baripada signed off', done: true },
          { text: 'Raw photo ingest (500+ RAW images)', done: true },
          { text: 'Color grading and retouching for catalogue', done: false },
        ],
        order: 0,
      },
      {
        taskCode: 'TSK-0019',
        title: 'Design packaging boxes and authenticity certification cards',
        description: 'Eco-friendly kraft paper box designs with foil stamped collective logo and GI tag certification.',
        project: projectsMap['PRJ-2026-003'],
        assignees: [emp6?._id],
        reporter: pmEmp?._id,
        status: 'todo',
        priority: 'medium',
        type: 'design',
        startDate: new Date('2026-03-01'),
        dueDate: nextWeek,
        estimatedHours: 20,
        loggedHours: 0,
        labels: ['Packaging', 'PrintDesign', 'PrintReady'],
        checklist: [
          { text: 'Dieline template from printer', done: true },
          { text: 'Story booklet copy on lost-wax casting', done: false },
        ],
        order: 0,
      },
      {
        taskCode: 'TSK-0020',
        title: 'Brand tone of voice and artisan heritage story guide',
        description: 'Guidelines on communicating cultural equity, fair compensation, and preservation of indigenous craft.',
        project: projectsMap['PRJ-2026-003'],
        assignees: [emp2?._id],
        reporter: pmEmp?._id,
        status: 'todo',
        priority: 'medium',
        type: 'content',
        startDate: new Date('2026-03-05'),
        dueDate: inTwoWeeks,
        estimatedHours: 18,
        loggedHours: 0,
        labels: ['BrandStory', 'Copywriting', 'Handloom'],
        checklist: [],
        order: 1,
      },
      {
        taskCode: 'TSK-0021',
        title: 'Custom Shopify theme architecture with story-first PDP layout',
        description: 'Product detail page featuring artisan video snippet, material provenance, and dimension scale.',
        project: projectsMap['PRJ-2026-003'],
        assignees: [emp4?._id],
        reporter: pmEmp?._id,
        status: 'backlog',
        priority: 'high',
        type: 'development',
        startDate: null,
        dueDate: new Date('2026-06-15'),
        estimatedHours: 40,
        loggedHours: 0,
        labels: ['Shopify', 'Liquid', 'Frontend'],
        checklist: [],
        order: 0,
      },
      {
        taskCode: 'TSK-0022',
        title: 'Domestic logistics integration with Shiprocket & India Post SpeedPost',
        description: 'Fragile handling rates for brass figurines and parcel insurance API setup.',
        project: projectsMap['PRJ-2026-003'],
        assignees: [emp3?._id],
        reporter: pmEmp?._id,
        status: 'backlog',
        priority: 'medium',
        type: 'task',
        startDate: null,
        dueDate: new Date('2026-06-30'),
        estimatedHours: 16,
        loggedHours: 0,
        labels: ['Logistics', 'Shipping', 'APIs'],
        checklist: [],
        order: 1,
      },

      // PRJ-2026-004 (Utkal Fintech Brand Identity) - 3 tasks (completed project)
      {
        taskCode: 'TSK-0023',
        title: 'Competitive visual audit of Indian fintech and wealth management apps',
        description: 'Comprehensive benchmark of Zerodha, Groww, INDmoney, and Dezerv visual languages.',
        project: projectsMap['PRJ-2026-004'],
        assignees: [emp2?._id],
        reporter: ceoEmp?._id,
        status: 'done',
        priority: 'medium',
        type: 'design',
        startDate: new Date('2025-11-02'),
        dueDate: new Date('2025-11-15'),
        estimatedHours: 20,
        loggedHours: 20,
        labels: ['Audit', 'Fintech', 'Research'],
        checklist: [
          { text: 'Color and typography matrix', done: true },
          { text: 'Iconography and whitespace comparison', done: true },
        ],
        order: 0,
      },
      {
        taskCode: 'TSK-0024',
        title: 'Logo mark design with geometric symbol & dynamic gradient system',
        description: 'Crafted modern emblem evoking momentum, mathematical precision, and wealth appreciation.',
        project: projectsMap['PRJ-2026-004'],
        assignees: [emp1?._id],
        reporter: ceoEmp?._id,
        status: 'done',
        priority: 'high',
        type: 'design',
        startDate: new Date('2025-11-16'),
        dueDate: new Date('2025-12-10'),
        estimatedHours: 35,
        loggedHours: 35,
        labels: ['LogoDesign', 'Vector', 'Identity'],
        checklist: [
          { text: 'Vector grid alignments', done: true },
          { text: 'Monochrome and dark mode inverted test', done: true },
          { text: 'Trademark availability check', done: true },
        ],
        order: 1,
      },
      {
        taskCode: 'TSK-0025',
        title: 'Brand Guidelines deliverable & Figma design tokens library release',
        description: 'Comprehensive 68-page brand manual covering typography scale, color tokens, and motion guidelines.',
        project: projectsMap['PRJ-2026-004'],
        assignees: [emp1?._id, emp2?._id],
        reporter: ceoEmp?._id,
        status: 'done',
        priority: 'urgent',
        type: 'design',
        startDate: new Date('2025-12-11'),
        dueDate: new Date('2026-01-28'),
        estimatedHours: 45,
        loggedHours: 45,
        labels: ['BrandBook', 'FigmaTokens', 'Release'],
        checklist: [
          { text: 'Typography pairing specs', done: true },
          { text: 'Figma Token studio plugin sync', done: true },
          { text: 'Client executive sign-off meeting', done: true },
        ],
        order: 2,
      },
    ];

    const tasksMap = {};
    for (const t of tasksSeed) {
      const taskDoc = await Task.findOneAndUpdate(
        { taskCode: t.taskCode },
        { $set: { ...t, isDeleted: false } },
        { upsert: true, new: true }
      );
      tasksMap[t.taskCode] = taskDoc;
    }
    console.log(`  ✓ Synced ${tasksSeed.length} Tasks across all 4 projects (with 2 overdue tasks for testing warnings).`);

    // 15. Seed Sample Task Comments with @Mentions & Activity
    console.log('\n--- 15. Syncing Task Comments & Activity Timeline ---');
    const sampleTask1 = tasksMap['TSK-0003'];
    if (sampleTask1) {
      await TaskComment.findOneAndUpdate(
        { task: sampleTask1._id, body: { $regex: 'Mapbox style' } },
        {
          $set: {
            task: sampleTask1._id,
            author: ceoUser?._id,
            body: 'Mapbox style looks stunning! Please ensure 60fps frame rate on Android mid-range devices.',
            mentions: [emp3?._id],
            createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          },
        },
        { upsert: true }
      );

      await TaskActivity.create({
        task: sampleTask1._id,
        actor: ceoUser?._id,
        action: 'STATUS_CHANGE',
        from: 'todo',
        to: 'in_progress',
        createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      });
    }

    const sampleTask2 = tasksMap['TSK-0011'];
    if (sampleTask2) {
      await TaskComment.findOneAndUpdate(
        { task: sampleTask2._id, body: { $regex: 'Crash log shows' } },
        {
          $set: {
            task: sampleTask2._id,
            author: ceoUser?._id,
            body: 'Crash log shows null pointer on camera permission callback. @employee4 please patch this today.',
            mentions: [emp4?._id],
            createdAt: yesterday,
          },
        },
        { upsert: true }
      );
    }
    console.log('  ✓ Sample comments with @mentions and activity history created.');

    // 16. Recalculate Project Progress
    console.log('\n--- 16. Recalculating Project Progress Percentages ---');
    for (const pCode of ['PRJ-2026-001', 'PRJ-2026-002', 'PRJ-2026-003', 'PRJ-2026-004']) {
      const pId = projectsMap[pCode];
      if (pId) {
        const total = await Task.countDocuments({ project: pId, isDeleted: false });
        const done = await Task.countDocuments({ project: pId, status: 'done', isDeleted: false });
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        await Project.findByIdAndUpdate(pId, { progressPercent: progress });
        console.log(`  ✓ Project ${pCode}: ${done}/${total} tasks completed (${progress}%)`);
      }
    }

    // 17. Seed Activity Tracker: TimeEntries, Timesheets, and Active Timers (Day 4)
    console.log('\n--- 17. Syncing Activity Tracker Data (Day 4) ---');
    const todayDate = toKolkataDateOnly(new Date());
    const currentWeek = getWeekBounds(todayDate);

    // Calculate previous week bounds
    const prevWeekMonday = new Date(currentWeek.weekStart);
    prevWeekMonday.setDate(prevWeekMonday.getDate() - 7);
    const prevWeek = getWeekBounds(prevWeekMonday);

    // 17.1 Seed Previous Week Time Entries for Employee 1 (Submitted Timesheet)
    const p1Id = projectsMap['PRJ-2026-001'];
    const p2Id = projectsMap['PRJ-2026-002'];
    const t1Id = tasksMap['TSK-0001']?._id;
    const t2Id = tasksMap['TSK-0002']?._id;
    const t3Id = tasksMap['TSK-0003']?._id;

    if (emp1) {
      let prevWeekTotalMin = 0;
      let prevWeekBillableMin = 0;

      // 5 Days of work (Mon-Fri) in previous week
      for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
        const entryDate = new Date(prevWeek.weekStart);
        entryDate.setDate(entryDate.getDate() + dayIdx);

        // Morning entry: Design / Development work
        const morningDesc = `Client design system components & layout for screen set ${dayIdx + 1}`;
        await TimeEntry.findOneAndUpdate(
          { employee: emp1._id, date: entryDate, description: morningDesc },
          {
            $set: {
              employee: emp1._id,
              date: entryDate,
              project: p1Id,
              task: t1Id,
              category: 'project_work',
              description: morningDesc,
              durationMinutes: 270, // 4.5 hours
              isBillable: true,
              source: 'manual',
              status: 'submitted',
              isDeleted: false,
            },
          },
          { upsert: true }
        );
        prevWeekTotalMin += 270;
        prevWeekBillableMin += 270;

        // Afternoon entry: Internal sprint sync & code review
        const afternoonDesc = `Studio sprint sync and code reviews (Day ${dayIdx + 1})`;
        await TimeEntry.findOneAndUpdate(
          { employee: emp1._id, date: entryDate, description: afternoonDesc },
          {
            $set: {
              employee: emp1._id,
              date: entryDate,
              project: p1Id,
              task: t2Id,
              category: dayIdx % 2 === 0 ? 'meeting' : 'review',
              description: afternoonDesc,
              durationMinutes: 210, // 3.5 hours
              isBillable: true,
              source: 'manual',
              status: 'submitted',
              isDeleted: false,
            },
          },
          { upsert: true }
        );
        prevWeekTotalMin += 210;
        prevWeekBillableMin += 210;
      }

      // Upsert Previous Week Timesheet for Employee 1 (Submitted)
      let tsEmp1 = await Timesheet.findOne({ employee: emp1._id, weekStart: prevWeek.weekStart });
      if (!tsEmp1) {
        tsEmp1 = new Timesheet({
          employee: emp1._id,
          weekStart: prevWeek.weekStart,
          weekEnd: prevWeek.weekEnd,
        });
      }
      tsEmp1.totalMinutes = prevWeekTotalMin;
      tsEmp1.billableMinutes = prevWeekBillableMin;
      tsEmp1.status = 'submitted';
      tsEmp1.submittedAt = new Date(prevWeek.weekEnd);
      await tsEmp1.save();

      // Create or update ApprovalRequest for Employee 1's timesheet
      let approvalReq = await ApprovalRequest.findOne({
        type: 'timesheet',
        referenceId: tsEmp1._id,
      });

      if (!approvalReq) {
        approvalReq = await ApprovalRequest.create({
          type: 'timesheet',
          referenceModel: 'Timesheet',
          referenceId: tsEmp1._id,
          requestedBy: emp1._id,
          title: `Timesheet (40.0 hrs) - Week of ${prevWeek.weekStart.toLocaleDateString('en-IN')}`,
          metadata: {
            totalHours: '40.0',
            expectedHours: 40,
            isUnderExpected: false,
            billableHours: '40.0',
            weekStart: prevWeek.weekStart,
            weekEnd: prevWeek.weekEnd,
          },
          steps: [
            {
              order: 1,
              title: 'Manager Timesheet Review',
              approverEmployee: pmEmp?._id || ceoEmp?._id,
              status: 'pending',
            },
          ],
          currentStep: 1,
          status: 'pending',
        });
      }

      tsEmp1.approvalRequest = approvalReq._id;
      await tsEmp1.save();

      // Attach timesheet reference to previous week's entries
      await TimeEntry.updateMany(
        { employee: emp1._id, date: { $gte: prevWeek.weekStart, $lte: prevWeek.weekEnd } },
        { $set: { timesheet: tsEmp1._id, status: 'submitted' } }
      );

      console.log(`  ✓ Employee 1: Seeded 40h submitted timesheet with pending approval request.`);

      // 17.2 Seed Current Week Time Entries for Employee 1 (Draft Entries for My Time page)
      const currentWeekDaysToSeed = Math.min(4, new Date().getDay() || 4); // Mon to today
      for (let dayIdx = 0; dayIdx < currentWeekDaysToSeed; dayIdx++) {
        const entryDate = new Date(currentWeek.weekStart);
        entryDate.setDate(entryDate.getDate() + dayIdx);

        const currentDesc = `Current sprint UX layout and Mapbox navigation flow (Step ${dayIdx + 1})`;
        await TimeEntry.findOneAndUpdate(
          { employee: emp1._id, date: entryDate, description: currentDesc },
          {
            $set: {
              employee: emp1._id,
              date: entryDate,
              project: p1Id,
              task: t3Id,
              category: 'project_work',
              description: currentDesc,
              durationMinutes: 450, // 7.5 hours
              isBillable: true,
              source: dayIdx === 0 ? 'timer' : 'manual',
              status: 'draft',
              isDeleted: false,
            },
          },
          { upsert: true }
        );
      }
      console.log(`  ✓ Employee 1: Seeded ${currentWeekDaysToSeed} days of draft entries for current week.`);
    }

    // 17.3 Seed Approved Timesheet for Employee 2 (Previous Week)
    if (emp2) {
      let emp2TotalMin = 0;
      for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
        const entryDate = new Date(prevWeek.weekStart);
        entryDate.setDate(entryDate.getDate() + dayIdx);

        const desc = `Backend API routing and microservices schema (Day ${dayIdx + 1})`;
        await TimeEntry.findOneAndUpdate(
          { employee: emp2._id, date: entryDate, description: desc },
          {
            $set: {
              employee: emp2._id,
              date: entryDate,
              project: p2Id,
              task: tasksMap['TSK-0009']?._id || null,
              category: 'project_work',
              description: desc,
              durationMinutes: 480, // 8.0 hours
              isBillable: true,
              source: 'manual',
              status: 'approved',
              isDeleted: false,
            },
          },
          { upsert: true }
        );
        emp2TotalMin += 480;
      }

      let tsEmp2 = await Timesheet.findOne({ employee: emp2._id, weekStart: prevWeek.weekStart });
      if (!tsEmp2) {
        tsEmp2 = new Timesheet({
          employee: emp2._id,
          weekStart: prevWeek.weekStart,
          weekEnd: prevWeek.weekEnd,
        });
      }
      tsEmp2.totalMinutes = emp2TotalMin;
      tsEmp2.billableMinutes = emp2TotalMin;
      tsEmp2.status = 'approved';
      tsEmp2.submittedAt = new Date(prevWeek.weekEnd);
      tsEmp2.reviewedBy = pmEmp?._id || ceoEmp?._id;
      tsEmp2.reviewedAt = new Date();
      tsEmp2.reviewComment = 'Great execution on the backend deliverables.';
      await tsEmp2.save();

      await TimeEntry.updateMany(
        { employee: emp2._id, date: { $gte: prevWeek.weekStart, $lte: prevWeek.weekEnd } },
        { $set: { timesheet: tsEmp2._id, status: 'approved' } }
      );

      console.log(`  ✓ Employee 2: Seeded 40h approved timesheet with manager review.`);
    }

    // 17.4 Seed an Active Running Timer for Employee 4
    if (emp4) {
      await ActiveTimer.findOneAndUpdate(
        { employee: emp4._id },
        {
          $set: {
            employee: emp4._id,
            project: p2Id,
            task: tasksMap['TSK-0011']?._id || null,
            category: 'project_work',
            description: 'Fixing camera permission callback on Android SDK 34',
            startedAt: new Date(Date.now() - 45 * 60 * 1000), // Running for 45 minutes
          },
        },
        { upsert: true }
      );
      console.log(`  ✓ Employee 4: Active running timer seeded.`);
    }

    // 17.5 Recalculate Task & Project loggedHours and costToDate
    console.log('\n--- 18. Recalculating Task & Project Burn Rates ---');
    for (const t of Object.values(tasksMap)) {
      await recalculateTaskAndProjectTime(t._id, t.project);
    }
    console.log(`  ✓ Completed recalculation of logged hours and costToDate across all projects.`);

    console.log('\n================================================================');
    console.log('🎉 DAY 4 SEED & RECONCILIATION COMPLETED SUCCESSFULLY!');
    console.log('================================================================');
    console.log('Default Password for all accounts: ChangeMe@123');
    console.log('  👑 Super Admins   : superadmin1..3@illusorydesignstudios.com');
    console.log('  📋 HR Manager    : hr@illusorydesignstudios.com');
    console.log('  🎯 Project Manager: pm@illusorydesignstudios.com');
    console.log('  💼 Employees     : employee1..8@illusorydesignstudios.com');
    console.log('================================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedDatabase();
