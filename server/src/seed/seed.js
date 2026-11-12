import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Role } from '../models/Role.js';
import { Department } from '../models/Department.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';

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

    // 1. Roles & Permissions Seed
    console.log('\n--- Seeding Roles & Permissions ---');
    const rolesData = [
      {
        name: 'Super Admin',
        key: 'super_admin',
        description: 'Complete unrestricted control over the entire system, users, and settings',
        permissions: ['*'],
        isSystem: true,
      },
      {
        name: 'Admin',
        key: 'admin',
        description: 'Full operational control over employees, departments, and user accounts',
        permissions: [
          'employee.read',
          'employee.create',
          'employee.update',
          'employee.delete',
          'employee.readSalary',
          'employee.readStatutory',
          'department.manage',
          'user.manage',
          'document.manage',
          'dashboard.read',
        ],
        isSystem: true,
      },
      {
        name: 'HR Manager',
        key: 'hr',
        description: 'HR administrative access for managing employees, onboarding, and documents',
        permissions: [
          'employee.read',
          'employee.create',
          'employee.update',
          'employee.status',
          'employee.readSalary',
          'employee.readStatutory',
          'department.read',
          'document.manage',
          'dashboard.read',
        ],
        isSystem: true,
      },
      {
        name: 'Employee',
        key: 'employee',
        description: 'Standard employee access to personal profile and company directory',
        permissions: ['employee.readSelf', 'employee.updateSelf'],
        isSystem: true,
      },
    ];

    const rolesMap = {};
    for (const r of rolesData) {
      let roleDoc = await Role.findOne({ key: r.key });
      if (!roleDoc) {
        roleDoc = await Role.create(r);
        console.log(`  + Created role: ${r.name} (${r.key})`);
      } else {
        roleDoc.permissions = r.permissions;
        await roleDoc.save();
        console.log(`  = Updated role: ${r.name} (${r.key})`);
      }
      rolesMap[r.key] = roleDoc._id;
    }

    // 2. Departments Seed
    console.log('\n--- Seeding Departments ---');
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
      let deptDoc = await Department.findOne({ code: d.code });
      if (!deptDoc) {
        deptDoc = await Department.create(d);
        console.log(`  + Created department: ${d.name} (${d.code})`);
      } else {
        console.log(`  = Found department: ${d.name} (${d.code})`);
      }
      deptsMap[d.code] = deptDoc._id;
    }

    // Default password for all seeded users
    const defaultPassword = 'ChangeMe@123';
    const passwordHash = await User.hashPassword(defaultPassword);

    console.log('\n--- Seeding Users and Employee Records ---');

    // 3. Exactly 3 Super Admins
    const superAdmins = [
      {
        firstName: 'Aarav',
        lastName: 'Mohapatra',
        email: 'superadmin1@illusorydesignstudios.com',
        phone: '+91 98765 43210',
        designation: 'Managing Director & CEO',
        deptCode: 'ADM',
      },
      {
        firstName: 'Rohan',
        lastName: 'Patnaik',
        email: 'superadmin2@illusorydesignstudios.com',
        phone: '+91 98765 43211',
        designation: 'Co-Founder & Chief Technology Officer',
        deptCode: 'DEV',
      },
      {
        firstName: 'Ananya',
        lastName: 'Dash',
        email: 'superadmin3@illusorydesignstudios.com',
        phone: '+91 98765 43212',
        designation: 'Co-Founder & Chief Operating Officer',
        deptCode: 'ADM',
      },
    ];

    // 4. Exactly 1 HR User
    const hrUsers = [
      {
        firstName: 'Sunita',
        lastName: 'Jena',
        email: 'hr@illusorydesignstudios.com',
        phone: '+91 98765 43213',
        designation: 'Head of People & Culture',
        deptCode: 'HRD',
      },
    ];

    // 5. Exactly 8 Employee Users
    const employeeUsers = [
      {
        firstName: 'Debashis',
        lastName: 'Tripathy',
        email: 'employee1@illusorydesignstudios.com',
        phone: '+91 98765 43214',
        designation: 'Senior UI/UX Designer',
        deptCode: 'DES',
      },
      {
        firstName: 'Priya',
        lastName: 'Mishra',
        email: 'employee2@illusorydesignstudios.com',
        phone: '+91 98765 43215',
        designation: 'Lead Brand Strategist',
        deptCode: 'DES',
      },
      {
        firstName: 'Subham',
        lastName: 'Sahoo',
        email: 'employee3@illusorydesignstudios.com',
        phone: '+91 98765 43216',
        designation: 'Full Stack Engineer',
        deptCode: 'DEV',
      },
      {
        firstName: 'Ipsita',
        lastName: 'Rout',
        email: 'employee4@illusorydesignstudios.com',
        phone: '+91 98765 43217',
        designation: 'Frontend React Developer',
        deptCode: 'DEV',
      },
      {
        firstName: 'Abhishek',
        lastName: 'Nayak',
        email: 'employee5@illusorydesignstudios.com',
        phone: '+91 98765 43218',
        designation: 'Growth Marketer',
        deptCode: 'MKT',
      },
      {
        firstName: 'Sweta',
        lastName: 'Pradhan',
        email: 'employee6@illusorydesignstudios.com',
        phone: '+91 98765 43219',
        designation: 'Enterprise Sales Executive',
        deptCode: 'SLS',
      },
      {
        firstName: 'Manoj',
        lastName: 'Panda',
        email: 'employee7@illusorydesignstudios.com',
        phone: '+91 98765 43220',
        designation: 'Financial Analyst',
        deptCode: 'FIN',
      },
      {
        firstName: 'Pooja',
        lastName: 'Behera',
        email: 'employee8@illusorydesignstudios.com',
        phone: '+91 98765 43221',
        designation: 'Operations Specialist',
        deptCode: 'ADM',
      },
    ];

    const allSeedUsers = [
      ...superAdmins.map((u) => ({ ...u, roleKey: 'super_admin' })),
      ...hrUsers.map((u) => ({ ...u, roleKey: 'hr' })),
      ...employeeUsers.map((u) => ({ ...u, roleKey: 'employee' })),
    ];

    const results = [];

    for (let i = 0; i < allSeedUsers.length; i++) {
      const u = allSeedUsers[i];
      let emp = await Employee.findOne({ 'personal.officialEmail': u.email });

      if (!emp) {
        emp = await Employee.create({
          personal: {
            firstName: u.firstName,
            lastName: u.lastName,
            gender: i % 2 === 0 ? 'Male' : 'Female',
            dob: new Date('1994-05-18'),
            bloodGroup: 'B+',
            maritalStatus: 'Single',
            phone: u.phone,
            personalEmail: `${u.firstName.toLowerCase()}.${u.lastName.toLowerCase()}@gmail.com`,
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
              name: 'Emergency Contact',
              relation: 'Family',
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
        console.log(`  + Created Employee: [${emp.employeeId}] ${emp.personal.firstName} ${emp.personal.lastName}`);
      }

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
      }

      results.push({
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        role: u.roleKey,
        employeeId: emp.employeeId,
      });
    }

    console.log('\n================================================================');
    console.log('🎉 SEEDING COMPLETED SUCCESSFULLY! ILLUSORY ERP CREDENTIALS:');
    console.log('================================================================');
    console.log(`Default Password for all accounts: ${defaultPassword}`);
    console.log(`(Each account is flagged with mustChangePassword = true)\n`);

    console.log('👑 SUPER ADMIN ACCOUNTS (Full System Access):');
    results.filter((r) => r.role === 'super_admin').forEach((r) => {
      console.log(`  - ${r.name.padEnd(20)} | ID: ${r.employeeId} | ${r.email}`);
    });

    console.log('\n📋 HR MANAGER ACCOUNTS (Employee Master & Operations):');
    results.filter((r) => r.role === 'hr').forEach((r) => {
      console.log(`  - ${r.name.padEnd(20)} | ID: ${r.employeeId} | ${r.email}`);
    });

    console.log('\n💼 EMPLOYEE ACCOUNTS (Self-Service Profile):');
    results.filter((r) => r.role === 'employee').forEach((r) => {
      console.log(`  - ${r.name.padEnd(20)} | ID: ${r.employeeId} | ${r.email}`);
    });

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
