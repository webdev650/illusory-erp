import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { Attendance } from '../models/Attendance.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import Task from '../models/Task.js';
import TimeEntry from '../models/TimeEntry.js';
import Timesheet from '../models/Timesheet.js';
import ActiveTimer from '../models/ActiveTimer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const DEMO_EMAIL_PATTERNS = [
  /^superadmin[1-9]@illusorydesignstudios\.com$/i,
  /^employee[1-9]@illusorydesignstudios\.com$/i,
  /^pm@illusorydesignstudios\.com$/i,
  /^itadmin@illusorydesignstudios\.com$/i,
];

const askConfirmation = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase());
    })
  );
};

const runCleanup = async () => {
  const args = process.argv.slice(2);
  const autoConfirm = args.includes('--confirm') || args.includes('--force') || args.includes('-y');

  console.log('\n🧹 =======================================================');
  console.log('🧹 Illusory ERP — Demo Data Cleanup Script');
  console.log('=======================================================\n');

  try {
    await connectDB();

    // 1. Safety Guard: Check if at least one real Super Admin exists
    const superAdminRole = await mongoose.model('Role').findOne({ key: 'super_admin' });
    const realSuperAdmins = await User.find({
      role: superAdminRole?._id,
      email: { $nin: ['superadmin1@illusorydesignstudios.com', 'superadmin2@illusorydesignstudios.com', 'superadmin3@illusorydesignstudios.com'] },
    });

    if (realSuperAdmins.length === 0) {
      console.warn('⚠️  SAFETY ALERT: No imported real Super Admin was found in the database!');
      console.warn('   (e.g., operations@illusorydesignstudios.com / Aparna Tripathy)');
      console.warn('   Deleting demo super admins now could lock you out of the system.');
      console.warn('   Please run `npm run import:employees -- --commit` first before running demo cleanup.\n');

      if (!autoConfirm) {
        const proceedAnyway = await askConfirmation('Do you still want to proceed with demo cleanup? (yes/no): ');
        if (proceedAnyway !== 'yes') {
          console.log('Cleanup aborted. Safe exit.');
          process.exit(0);
        }
      }
    } else {
      console.log(`✅ Real Super Admin confirmed: ${realSuperAdmins.map((u) => u.email).join(', ')}`);
    }

    // 2. Identify Demo Users & Employees
    const demoUsers = await User.find({
      $or: [
        { isDemo: true },
        { email: { $in: [
          'superadmin1@illusorydesignstudios.com',
          'superadmin2@illusorydesignstudios.com',
          'superadmin3@illusorydesignstudios.com',
          'pm@illusorydesignstudios.com',
          'itadmin@illusorydesignstudios.com',
          'employee1@illusorydesignstudios.com',
          'employee2@illusorydesignstudios.com',
          'employee3@illusorydesignstudios.com',
          'employee4@illusorydesignstudios.com',
          'employee5@illusorydesignstudios.com',
          'employee6@illusorydesignstudios.com',
          'employee7@illusorydesignstudios.com',
          'employee8@illusorydesignstudios.com',
        ] } },
      ],
    });

    const demoUserIds = demoUsers.map((u) => u._id);
    const demoEmployeeIds = demoUsers.map((u) => u.employee).filter(Boolean);

    // Also find employees with IDS001 - IDS014 or isDemo
    const demoEmployees = await Employee.find({
      $or: [
        { isDemo: true },
        { _id: { $in: demoEmployeeIds } },
        { employeeId: { $in: ['IDS001', 'IDS002', 'IDS003', 'IDS005', 'IDS006', 'IDS007', 'IDS008', 'IDS009', 'IDS010', 'IDS011', 'IDS012', 'IDS013', 'IDS014'] } },
      ],
    });
    const allDemoEmpIds = demoEmployees.map((e) => e._id);

    // Count associated fake entities
    const fakeAttendanceCount = await Attendance.countDocuments({ employee: { $in: allDemoEmpIds } });
    const fakeTimeEntriesCount = await TimeEntry.countDocuments({ employee: { $in: allDemoEmpIds } });
    const fakeTimesheetsCount = await Timesheet.countDocuments({ employee: { $in: allDemoEmpIds } });
    const fakeLeavesCount = await LeaveRequest.countDocuments({ employee: { $in: allDemoEmpIds } });
    const fakeLeaveBalancesCount = await LeaveBalance.countDocuments({ employee: { $in: allDemoEmpIds } });

    console.log('\n📊 DEMO RECORDS IDENTIFIED FOR REMOVAL:');
    console.log(`   - Demo User Accounts   : ${demoUsers.length}`);
    console.log(`   - Demo Employee Masters : ${demoEmployees.length}`);
    console.log(`   - Demo Attendance Logs  : ${fakeAttendanceCount}`);
    console.log(`   - Demo Timesheet Entries: ${fakeTimeEntriesCount} entries in ${fakeTimesheetsCount} sheets`);
    console.log(`   - Demo Leave Requests   : ${fakeLeavesCount}`);
    console.log(`   - Demo Leave Balances   : ${fakeLeaveBalancesCount}`);

    console.log('\nDemo User Emails to delete:');
    demoUsers.forEach((u) => console.log(`   • ${u.email}`));

    if (!autoConfirm) {
      console.log('\n⚠️  THIS ACTION CANNOT BE UNDONE.');
      const confirm = await askConfirmation('Type "delete" to permanently purge all demo records: ');
      if (confirm !== 'delete') {
        console.log('Cleanup cancelled by user.');
        process.exit(0);
      }
    }

    console.log('\n🗑️  Purging demo records from MongoDB...');

    await Attendance.deleteMany({ employee: { $in: allDemoEmpIds } });
    await TimeEntry.deleteMany({ employee: { $in: allDemoEmpIds } });
    await Timesheet.deleteMany({ employee: { $in: allDemoEmpIds } });
    await ActiveTimer.deleteMany({ employee: { $in: allDemoEmpIds } });
    await LeaveRequest.deleteMany({ employee: { $in: allDemoEmpIds } });
    await LeaveBalance.deleteMany({ employee: { $in: allDemoEmpIds } });
    await User.deleteMany({ _id: { $in: demoUserIds } });
    await Employee.deleteMany({ _id: { $in: allDemoEmpIds } });

    console.log('\n=======================================================');
    console.log('✅ DEMO DATA CLEANUP COMPLETED!');
    console.log('   All sample mock data has been removed.');
    console.log('   Real imported company employees remain untouched.');
    console.log('=======================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Demo cleanup failed:', err);
    process.exit(1);
  }
};

runCleanup();
