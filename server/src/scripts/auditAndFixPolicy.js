import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { connectDB } from '../config/db.js';
import { Shift } from '../models/Shift.js';
import { ShiftAssignment } from '../models/ShiftAssignment.js';
import { LeaveType } from '../models/LeaveType.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { AttendancePolicy } from '../models/AttendancePolicy.js';
import { Employee } from '../models/Employee.js';
import { LeavePolicyYear } from '../models/LeavePolicyYear.js';
import { recalculatePolicyYearBalances } from '../services/settlement.service.js';

async function run() {
  await connectDB();
  console.log('🔍 Auditing and Fixing Attendance against REAL Illusory Policy...\n');

  // 1. Audit Shifts
  console.log('=== 1. SHIFTS AUDIT & FIX ===');
  const allShifts = await Shift.find();
  console.log(`Found ${allShifts.length} shifts in DB.`);
  for (const s of allShifts) {
    console.log(`  - ${s.name} (${s.startTime} - ${s.endTime}), isDefault: ${s.isDefault}`);
  }

  // Ensure General Studio Shift is correct
  let defaultShift = await Shift.findOne({ isDefault: true });
  if (!defaultShift) {
    defaultShift = await Shift.findOne({ name: /general/i });
  }

  if (defaultShift) {
    defaultShift.name = 'General Studio Shift';
    defaultShift.startTime = '10:00';
    defaultShift.endTime = '18:45';
    defaultShift.graceMinutes = 15;
    defaultShift.unpaidBreakMinutes = 60;
    defaultShift.workingMinutes = 465;
    defaultShift.workingDays = [1, 2, 3, 4, 5, 6]; // Monday to Saturday
    defaultShift.halfDayHours = 4;
    defaultShift.fullDayHours = 7.75;
    defaultShift.isDefault = true;
    await defaultShift.save();
    console.log(`✓ Updated Default Shift: ${defaultShift.name} (10:00 - 18:45, 465 working mins, Mon-Sat)`);
  } else {
    defaultShift = await Shift.create({
      name: 'General Studio Shift',
      startTime: '10:00',
      endTime: '18:45',
      graceMinutes: 15,
      unpaidBreakMinutes: 60,
      workingMinutes: 465,
      workingDays: [1, 2, 3, 4, 5, 6],
      halfDayHours: 4,
      fullDayHours: 7.75,
      isDefault: true,
    });
    console.log(`✓ Created Default Shift: ${defaultShift.name} (10:00 - 18:45)`);
  }

  // Remove any non-default shifts (Night, Evening, Late, Afternoon)
  const nonDefaultShifts = await Shift.find({ _id: { $ne: defaultShift._id } });
  console.log(`Removing ${nonDefaultShifts.length} non-default shifts (Night/Late/Afternoon)...`);
  for (const nds of nonDefaultShifts) {
    // Reassign any shift assignments pointing to this shift to defaultShift
    await ShiftAssignment.updateMany({ shift: nds._id }, { shift: defaultShift._id });
    await Shift.deleteOne({ _id: nds._id });
    console.log(`  ✓ Removed shift: ${nds.name} (${nds._id})`);
  }

  // Ensure all active employees have default shift assignment
  const activeEmployees = await Employee.find({ isDeleted: false });
  for (const emp of activeEmployees) {
    await ShiftAssignment.findOneAndUpdate(
      { employee: emp._id, type: 'default' },
      {
        employee: emp._id,
        shift: defaultShift._id,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: null,
        type: 'default',
        remarks: 'Studio Default Assignment',
      },
      { upsert: true }
    );
  }
  console.log(`✓ Confirmed default shift assignment for all ${activeEmployees.length} employees.`);

  // 2. Audit AttendancePolicy
  console.log('\n=== 2. ATTENDANCE POLICY AUDIT & FIX ===');
  let policy = await AttendancePolicy.findOne({ isDefault: true });
  if (!policy) {
    policy = await AttendancePolicy.findOne();
  }
  if (!policy) {
    policy = new AttendancePolicy();
  }
  policy.name = 'Default Studio Policy';
  policy.graceMinutes = 15;
  policy.lateAfter = 15; // Late after 10:15 AM
  policy.halfDayMinMinutes = 240;
  policy.fullDayMinMinutes = 465;
  policy.breakMinutes = 60;
  policy.autoCloseMissingClockOutAt = '19:00';
  policy.weekOffDays = [0]; // Sunday off, Saturday is working
  policy.isDefault = true;
  await policy.save();
  console.log('✓ AttendancePolicy verified: 15m grace (late after 10:15 AM), 240m half-day, 465m full-day, Sunday off.');

  // 3. Audit LeaveTypes
  console.log('\n=== 3. LEAVE TYPES AUDIT & FIX ===');
  // Target 7 Leave Types
  const targetLeaveTypes = [
    {
      name: 'Casual Leave',
      code: 'CL',
      yearlyQuota: 12,
      yearlyQuotaMinutes: 12 * 465, // 5580
      carryForward: false,
      maxCarry: 0,
      maxCarryMinutes: 0,
      forwardPercent: 0,
      encashable: false,
      paid: true,
      requiresDocument: false,
      allowHalfDay: true,
      isActive: true,
    },
    {
      name: 'Annual Leave',
      code: 'AL',
      yearlyQuota: 12,
      yearlyQuotaMinutes: 12 * 465, // 5580
      carryForward: true,
      maxCarry: 5,
      maxCarryMinutes: 5 * 465, // 2325
      forwardPercent: 100,
      encashable: true,
      paid: true,
      requiresDocument: false,
      allowHalfDay: true,
      isActive: true,
    },
    {
      name: 'Sick Leave',
      code: 'SL',
      yearlyQuota: 6,
      yearlyQuotaMinutes: 6 * 465, // 2790
      carryForward: false,
      maxCarry: 0,
      maxCarryMinutes: 0,
      forwardPercent: 0,
      encashable: false,
      paid: true,
      requiresDocument: true,
      allowHalfDay: true,
      isActive: true,
    },
    {
      name: 'Bereavement Leave',
      code: 'BL',
      yearlyQuota: 5,
      yearlyQuotaMinutes: 5 * 465, // 2325
      carryForward: false,
      maxCarry: 0,
      maxCarryMinutes: 0,
      forwardPercent: 0,
      encashable: false,
      paid: true,
      requiresDocument: false,
      allowHalfDay: false,
      isActive: true,
    },
    {
      name: 'Probation Leave',
      code: 'PL',
      yearlyQuota: 1,
      yearlyQuotaMinutes: 1 * 465, // 465
      carryForward: false,
      maxCarry: 0,
      maxCarryMinutes: 0,
      forwardPercent: 0,
      encashable: false,
      paid: true,
      requiresDocument: false,
      allowHalfDay: true,
      isActive: true,
    },
    {
      name: 'Leave Without Pay',
      code: 'LWP',
      yearlyQuota: 0,
      yearlyQuotaMinutes: 0,
      carryForward: false,
      maxCarry: 0,
      maxCarryMinutes: 0,
      forwardPercent: 0,
      encashable: false,
      paid: false,
      requiresDocument: false,
      allowHalfDay: true,
      isActive: true,
    },
    {
      name: 'Comp-Off',
      code: 'COMP_OFF',
      yearlyQuota: 0,
      yearlyQuotaMinutes: 0,
      carryForward: false,
      maxCarry: 0,
      maxCarryMinutes: 0,
      forwardPercent: 0,
      encashable: false,
      paid: true,
      requiresDocument: false,
      allowHalfDay: true,
      isActive: true,
    },
  ];

  const targetCodes = targetLeaveTypes.map(t => t.code);

  for (const tlt of targetLeaveTypes) {
    const doc = await LeaveType.findOneAndUpdate(
      { code: tlt.code },
      { $set: tlt },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Synced LeaveType: ${doc.name} (${doc.code}) -> Quota: ${doc.yearlyQuota} days (${doc.yearlyQuotaMinutes}m), CarryForward: ${doc.carryForward ? doc.maxCarry + ' days' : 'No'}`);
  }

  // Remove obsolete/invalid leave types: EL (Earned Leave), COMP (old code), Privilege Leave
  const obsoleteTypes = await LeaveType.find({
    $or: [
      { code: { $in: ['EL', 'COMP'] } },
      { name: /privilege/i },
      { code: { $nin: targetCodes } }
    ]
  });

  for (const ot of obsoleteTypes) {
    console.log(`  ⚠️ Found obsolete LeaveType: ${ot.name} (${ot.code})`);
    // Check if there are any balances or requests referencing it
    const balCount = await LeaveBalance.countDocuments({ leaveType: ot._id });
    const reqCount = await LeaveRequest.countDocuments({ leaveType: ot._id });
    console.log(`     Referenced by ${balCount} balances, ${reqCount} requests`);

    // If it's EL (Earned Leave), map references to AL (Annual Leave)
    if (ot.code === 'EL') {
      const alType = await LeaveType.findOne({ code: 'AL' });
      if (alType) {
        await LeaveBalance.deleteMany({ leaveType: ot._id }); // Balances will be recalculated cleanly
        await LeaveRequest.updateMany({ leaveType: ot._id }, { leaveType: alType._id });
        console.log(`     Migrated any requests from EL to AL (${alType._id})`);
      }
    } else if (ot.code === 'COMP') {
      const coType = await LeaveType.findOne({ code: 'COMP_OFF' });
      if (coType) {
        await LeaveBalance.deleteMany({ leaveType: ot._id });
        await LeaveRequest.updateMany({ leaveType: ot._id }, { leaveType: coType._id });
        console.log(`     Migrated any requests from COMP to COMP_OFF (${coType._id})`);
      }
    } else {
      await LeaveBalance.deleteMany({ leaveType: ot._id });
    }

    await LeaveType.deleteOne({ _id: ot._id });
    console.log(`  ✓ Deleted obsolete LeaveType: ${ot.name} (${ot.code})`);
  }

  // 4. Policy Year Audit
  console.log('\n=== 4. POLICY YEAR AUDIT ===');
  let py2026 = await LeavePolicyYear.findOne({ code: 'PY-2026' });
  if (!py2026) {
    py2026 = await LeavePolicyYear.create({
      code: 'PY-2026',
      name: 'Policy Year 2026',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T23:59:59.999Z'),
      status: 'open',
      isCurrent: true,
      minutesPerDay: 465,
      proRataJoiners: true,
      proRataCalculation: 'months',
      proRataLeavers: true,
    });
    console.log('✓ Created Policy Year 2026 (1 Jan 2026 - 31 Dec 2026, 465 mins/day).');
  } else {
    py2026.startDate = new Date('2026-01-01T00:00:00.000Z');
    py2026.endDate = new Date('2026-12-31T23:59:59.999Z');
    py2026.minutesPerDay = 465;
    py2026.status = 'open';
    await py2026.save();
    console.log('✓ Updated Policy Year 2026 (1 Jan 2026 - 31 Dec 2026, 465 mins/day).');
  }

  // 5. Clean up any invalid Probation Leave balances for confirmed employees
  console.log('\n=== 5. PROBATION LEAVE ISOLATION CLEANUP ===');
  const plType = await LeaveType.findOne({ code: 'PL' });
  const confirmedEmployees = await Employee.find({ isDeleted: false, status: { $ne: 'probation' } });
  if (plType) {
    const deletedPlBalances = await LeaveBalance.deleteMany({
      leaveType: plType._id,
      employee: { $in: confirmedEmployees.map(e => e._id) },
    });
    console.log(`✓ Removed ${deletedPlBalances.deletedCount} Probation Leave balance records from confirmed employees.`);
  }

  // 6. Recalculate Balances for Real Employees Idempotently
  console.log('\n=== 6. RECALCULATING BALANCES FOR REAL EMPLOYEES ===');
  await recalculatePolicyYearBalances(py2026._id);
  console.log('✓ Recalculation complete.');

  // Clean up any remaining PL rows for confirmed employees after recalculation
  if (plType) {
    await LeaveBalance.deleteMany({
      leaveType: plType._id,
      employee: { $in: confirmedEmployees.map(e => e._id) },
    });
  }

  // 7. Show Worked Example Balance Table for 2 Employees
  console.log('\n=== 7. WORKED EXAMPLE: 2 REAL EMPLOYEES BALANCE TABLE ===');
  // Pick one active/confirmed employee and one probation employee
  const empConfirmed = await Employee.findOne({ isDeleted: false, status: 'active' });
  const empProbation = await Employee.findOne({ isDeleted: false, status: 'probation' }) ||
                       await Employee.findOne({ isDeleted: false, _id: { $ne: empConfirmed._id } });

  const examples = [empConfirmed, empProbation].filter(Boolean);

  for (const emp of examples) {
    const empName = `${emp.firstName || emp.personal?.firstName} ${emp.lastName || emp.personal?.lastName}`;
    console.log(`\nEmployee: ${empName} (${emp.employeeCode || emp.employeeId}) | Status: ${emp.status}`);
    console.log('-------------------------------------------------------------------------------------------------');
    console.log('| Leave Type         | Opening (d) | Entitlement (d) | Taken (d) | Pending (d) | Closing (d) | Carry Fwd (d) |');
    console.log('-------------------------------------------------------------------------------------------------');

    const empBalances = await LeaveBalance.find({
      employee: emp._id,
      year: 2026,
    }).populate('leaveType');

    for (const b of empBalances) {
      if (!b.leaveType) continue;
      const ltName = b.leaveType.name.padEnd(18, ' ');
      const op = ((b.openingMinutes || 0) / 465).toFixed(2).padStart(11, ' ');
      const ent = ((b.entitlementMinutes || 0) / 465).toFixed(2).padStart(15, ' ');
      const tkn = ((b.takenMinutes || 0) / 465).toFixed(2).padStart(9, ' ');
      const pnd = ((b.pendingMinutes || 0) / 465).toFixed(2).padStart(11, ' ');
      const cls = ((b.closingMinutes || 0) / 465).toFixed(2).padStart(11, ' ');
      const cf = ((b.carriedForwardMinutes || 0) / 465).toFixed(2).padStart(13, ' ');
      console.log(`| ${ltName} | ${op} | ${ent} | ${tkn} | ${pnd} | ${cls} | ${cf} |`);
    }
    console.log('-------------------------------------------------------------------------------------------------');
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
