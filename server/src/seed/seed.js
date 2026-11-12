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

    console.log('\n================================================================');
    console.log('🎉 DAY 2 SEED & RECONCILIATION COMPLETED SUCCESSFULLY!');
    console.log('================================================================');
    console.log('Default Password for all accounts: ChangeMe@123');
    console.log('  👑 Super Admins: superadmin1..3@illusorydesignstudios.com');
    console.log('  📋 HR Manager : hr@illusorydesignstudios.com');
    console.log('  💼 Employees  : employee1..8@illusorydesignstudios.com');
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
