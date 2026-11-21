import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { Attendance } from '../models/Attendance.js';
import { AttendanceLog } from '../models/AttendanceLog.js';
import { Holiday } from '../models/Holiday.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Client from '../models/Client.js';
import TimeEntry from '../models/TimeEntry.js';
import Timesheet from '../models/Timesheet.js';
import ActiveTimer from '../models/ActiveTimer.js';
import Notification from '../models/Notification.js';
import { AuditLog } from '../models/AuditLog.js';
import { RemoteWorkRequest } from '../models/RemoteWorkRequest.js';
import { AttendanceRegularization } from '../models/AttendanceRegularization.js';
import { PartialDayRequest } from '../models/PartialDayRequest.js';
import { CompOffRequest } from '../models/CompOffRequest.js';
import { CompOffCredit } from '../models/CompOffCredit.js';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import '../models/Role.js';
import '../models/Department.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// The 9 real company employees from the Excel sheet
const REAL_EMAILS = [
  'operations@illusorydesignstudios.com',
  'hr@illusorydesignstudios.com',
  'mihirdash@illusorydesignstudios.com',
  'pallabikar@illusorydesignstudios.com',
  'tejaswinibishoyi@illusorydesignstudios.com',
  'shresthamohanty@illusorydesignstudios.com',
  'rahulmohanty@illusorydesignstudios.com',
  'laxmipriya@illusorydesignstudios.com',
  'aryanbiswal@illusorydesignstudios.com',
];

export const runCleanup = async () => {
  console.log('\n🧹 =======================================================');
  console.log('🧹 Illusory ERP — Demo & Mock Data Removal');
  console.log('=======================================================\n');

  try {
    await connectDB();

    // 1. Verify Real Super Admin and HR Admin are active
    const aparna = await User.findOne({ email: 'operations@illusorydesignstudios.com' }).populate('role employee');
    const barsha = await User.findOne({ email: 'hr@illusorydesignstudios.com' }).populate('role employee');

    if (!aparna || !aparna.isActive) {
      throw new Error('SAFETY CHECK FAILED: Real Super Admin (operations@illusorydesignstudios.com) not found or inactive!');
    }
    if (!barsha || !barsha.isActive) {
      throw new Error('SAFETY CHECK FAILED: Real HR Admin (hr@illusorydesignstudios.com) not found or inactive!');
    }

    console.log('✅ Safety verification passed:');
    console.log(`   - Super Admin : ${aparna.email} (Active: ${aparna.isActive})`);
    console.log(`   - HR Admin    : ${barsha.email} (Active: ${barsha.isActive})`);

    // 2. Locate all demo users and employees
    const demoUsers = await User.find({ email: { $nin: REAL_EMAILS } });
    const demoUserIds = demoUsers.map((u) => u._id);

    const demoEmployees = await Employee.find({ 'personal.officialEmail': { $nin: REAL_EMAILS } });
    const demoEmpIds = demoEmployees.map((e) => e._id);

    console.log(`\n📋 Target Demo Accounts to Purge:`);
    console.log(`   - Demo Users     : ${demoUsers.length}`);
    console.log(`   - Demo Employees : ${demoEmployees.length}`);

    // Ask for user confirmation if not bypassed with --yes
    const autoConfirm = process.argv.includes('--yes') || process.argv.includes('-y');
    if (!autoConfirm) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise((resolve) => {
        rl.question('⚠️  Are you sure you want to permanently delete all demo data and sample seeded logs? (yes/no): ', (ans) => {
          rl.close();
          resolve(ans.trim().toLowerCase());
        });
      });

      if (answer !== 'yes' && answer !== 'y') {
        console.log('🛑 Cleanup aborted by user. No data was deleted.');
        process.exit(0);
      }
    }

    // 3. Purge associated synthetic logs & sample seed records
    const attLogRes = await AttendanceLog.deleteMany({ isDemo: true });
    const demoAttRes = await Attendance.deleteMany({ isDemo: true });
    const holidayRes = await Holiday.deleteMany({ isDemo: true });
    const demoRemoteRes = await RemoteWorkRequest.deleteMany({ isDemo: true });
    const demoRegRes = await AttendanceRegularization.deleteMany({ isDemo: true });
    const demoPdRes = await PartialDayRequest.deleteMany({ isDemo: true });
    const demoCompOffReqRes = await CompOffRequest.deleteMany({ isDemo: true });
    const demoCompOffCreditRes = await CompOffCredit.deleteMany({ isDemo: true });
    const demoApprovalRes = await ApprovalRequest.deleteMany({ isDemo: true });

    const attRes = await Attendance.deleteMany({
      $or: [{ employee: { $in: demoEmpIds } }, { employee: { $nin: (await Employee.find({ 'personal.officialEmail': { $in: REAL_EMAILS } }, '_id')).map(e => e._id) } }],
    });
    const leaveReqRes = await LeaveRequest.deleteMany({ $or: [{ isDemo: true }, { employee: { $in: demoEmpIds } }] });
    const leaveBalRes = await LeaveBalance.deleteMany({ employee: { $in: demoEmpIds } });
    const timeEntryRes = await TimeEntry.deleteMany({ employee: { $in: demoEmpIds } });
    const timesheetRes = await Timesheet.deleteMany({ employee: { $in: demoEmpIds } });
    const timerRes = await ActiveTimer.deleteMany({ employee: { $in: demoEmpIds } });
    const clientRes = await Client.deleteMany({ $or: [{ isDemo: true }, { createdBy: { $in: demoUserIds } }] });
    const taskRes = await Task.deleteMany({ $or: [{ isDemo: true }, { createdBy: { $in: demoUserIds } }, { assignee: { $in: demoEmpIds } }] });
    const projRes = await Project.deleteMany({ $or: [{ isDemo: true }, { createdBy: { $in: demoUserIds } }] });
    const notifRes = await Notification.deleteMany({ user: { $in: demoUserIds } });
    const auditRes = await AuditLog.deleteMany({ user: { $in: demoUserIds } });

    // 4. Delete demo Users and Employees
    const userRes = await User.deleteMany({ _id: { $in: demoUserIds } });
    const empRes = await Employee.deleteMany({ _id: { $in: demoEmpIds } });

    console.log('\n🗑️  Deletion Summary:');
    console.log(`   ✓ Users deleted            : ${userRes.deletedCount}`);
    console.log(`   ✓ Employees deleted        : ${empRes.deletedCount}`);
    console.log(`   ✓ Seeded demo punches      : ${attLogRes.deletedCount}`);
    console.log(`   ✓ Seeded demo attendance   : ${demoAttRes.deletedCount + attRes.deletedCount}`);
    console.log(`   ✓ Sample holidays purged   : ${holidayRes.deletedCount}`);
    console.log(`   ✓ Demo leave requests      : ${leaveReqRes.deletedCount}`);
    console.log(`   ✓ Demo remote work reqs    : ${demoRemoteRes.deletedCount}`);
    console.log(`   ✓ Leave balances deleted   : ${leaveBalRes.deletedCount}`);
    console.log(`   ✓ Time entries deleted     : ${timeEntryRes.deletedCount}`);
    console.log(`   ✓ Timesheets deleted       : ${timesheetRes.deletedCount}`);
    console.log(`   ✓ Active timers deleted    : ${timerRes.deletedCount}`);
    console.log(`   ✓ Demo clients deleted     : ${clientRes.deletedCount}`);
    console.log(`   ✓ Demo tasks deleted       : ${taskRes.deletedCount}`);
    console.log(`   ✓ Demo projects deleted    : ${projRes.deletedCount}`);
    console.log(`   ✓ Demo notifications purged: ${notifRes.deletedCount}`);
    console.log(`   ✓ Demo audit logs purged   : ${auditRes.deletedCount}`);

    // 5. Orphan integrity check
    console.log('\n🔍 Verifying zero orphan records remain...');
    const realEmpIds = (await Employee.find({ 'personal.officialEmail': { $in: REAL_EMAILS } }, '_id')).map((e) => e._id);
    const realUserIds = (await User.find({ email: { $in: REAL_EMAILS } }, '_id')).map((u) => u._id);

    const orphanAttendance = await Attendance.countDocuments({ employee: { $nin: realEmpIds } });
    const orphanLeaves = await LeaveRequest.countDocuments({ employee: { $nin: realEmpIds } });
    const orphanTimeEntries = await TimeEntry.countDocuments({ employee: { $nin: realEmpIds } });
    const orphanTasks = await Task.countDocuments({ assignee: { $exists: true, $ne: null, $nin: realEmpIds } });

    console.log(`   - Orphan Attendance   : ${orphanAttendance}`);
    console.log(`   - Orphan Leaves       : ${orphanLeaves}`);
    console.log(`   - Orphan Time Entries : ${orphanTimeEntries}`);
    console.log(`   - Orphan Tasks        : ${orphanTasks}`);

    if (orphanAttendance > 0) await Attendance.deleteMany({ employee: { $nin: realEmpIds } });
    if (orphanLeaves > 0) await LeaveRequest.deleteMany({ employee: { $nin: realEmpIds } });
    if (orphanTimeEntries > 0) await TimeEntry.deleteMany({ employee: { $nin: realEmpIds } });

    // 6. Remaining verification
    const remainingUsers = await User.countDocuments();
    const remainingEmployees = await Employee.countDocuments();
    console.log(`\n=======================================================`);
    console.log(`✅ CLEANUP COMPLETE: Exactly ${remainingUsers} Users and ${remainingEmployees} Employees in database.`);
    console.log(`=======================================================\n`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Demo cleanup failed:', err);
    process.exit(1);
  }
};

runCleanup();
