/**
 * Phase 1 Attendance Seeder
 * Seeds:
 *  1. Default AttendancePolicy
 *  2. Default Shift (10:00 - 18:45, 60m break = 465 mins) & assignments for all 9 real employees
 *  3. Standardized 6 LeaveTypes with integer minute quotas
 *  4. November 2026 Odisha Holidays (Diwali on Nov 10 marked sample)
 *  5. 2 weeks of realistic logs for all 9 real employees in November 2026
 */

import 'dotenv/config';
import { connectDB } from '../config/db.js';
import { AttendancePolicy } from '../models/AttendancePolicy.js';
import { Shift } from '../models/Shift.js';
import { ShiftAssignment } from '../models/ShiftAssignment.js';
import { LeaveType } from '../models/LeaveType.js';
import { Holiday } from '../models/Holiday.js';
import { Employee } from '../models/Employee.js';
import { AttendanceLog } from '../models/AttendanceLog.js';
import { Attendance } from '../models/Attendance.js';
import { recordPunch } from '../services/dayStatus.service.js';

async function seedPhase1() {
  await connectDB();
  console.log('🌱 Starting Phase 1 Attendance Seeding...');

  // 1. Attendance Policy
  let policy = await AttendancePolicy.findOne({ isDefault: true });
  if (!policy) {
    policy = await AttendancePolicy.create({
      name: 'Default Studio Policy',
      graceMinutes: 15,
      lateAfter: 15,
      halfDayMinMinutes: 240,
      fullDayMinMinutes: 465,
      autoCloseMissingClockOutAt: '19:00',
      maxBackdateDays: 15,
      weekOffDays: [0], // Sunday
      breakMinutes: 60,
      isDefault: true,
    });
    console.log('✓ Created Default AttendancePolicy');
  } else {
    policy.graceMinutes = 15;
    policy.halfDayMinMinutes = 240;
    policy.fullDayMinMinutes = 465;
    policy.autoCloseMissingClockOutAt = '19:00';
    policy.weekOffDays = [0];
    await policy.save();
    console.log('✓ Updated Default AttendancePolicy');
  }

  // 2. Default Shift (10:00 - 18:45)
  let shift = await Shift.findOne({ isDefault: true });
  if (!shift) {
    shift = await Shift.create({
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
    console.log('✓ Created Default Shift (10:00 - 18:45, 465 mins)');
  } else {
    shift.name = 'General Studio Shift';
    shift.startTime = '10:00';
    shift.endTime = '18:45';
    shift.graceMinutes = 15;
    shift.unpaidBreakMinutes = 60;
    shift.workingMinutes = 465;
    shift.workingDays = [1, 2, 3, 4, 5, 6];
    await shift.save();
    console.log('✓ Updated Default Shift (10:00 - 18:45, 465 mins)');
  }

  // Assign shift to all 9 real employees
  const employees = await Employee.find({ isDeleted: false });
  console.log(`Found ${employees.length} active employees.`);

  for (const emp of employees) {
    const existing = await ShiftAssignment.findOne({
      employee: emp._id,
      shift: shift._id,
      type: 'default',
    });

    if (!existing) {
      await ShiftAssignment.create({
        employee: emp._id,
        shift: shift._id,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: null,
        type: 'default',
        remarks: 'Studio Default Assignment',
      });
    }
  }
  console.log(`✓ Default Shift assigned to all ${employees.length} employees.`);

  // 3. Leave Types
  const leaveTypesData = [
    {
      name: 'Casual Leave',
      code: 'CL',
      yearlyQuota: 12,
      yearlyQuotaMinutes: 12 * 465,
      carryForward: false,
      maxCarry: 0,
      paid: true,
      allowHalfDay: true,
    },
    {
      name: 'Annual Leave',
      code: 'AL',
      yearlyQuota: 12,
      yearlyQuotaMinutes: 12 * 465,
      carryForward: true,
      maxCarry: 5,
      maxCarryMinutes: 5 * 465,
      forwardPercent: 100,
      encashable: true,
      paid: true,
      allowHalfDay: true,
    },
    {
      name: 'Sick Leave',
      code: 'SL',
      yearlyQuota: 6,
      yearlyQuotaMinutes: 6 * 465,
      carryForward: false,
      maxCarry: 0,
      paid: true,
      requiresDocument: true,
      allowHalfDay: true,
    },
    {
      name: 'Bereavement Leave',
      code: 'BL',
      yearlyQuota: 5,
      yearlyQuotaMinutes: 5 * 465,
      carryForward: false,
      maxCarry: 0,
      paid: true,
      allowHalfDay: false,
    },
    {
      name: 'Probation Leave',
      code: 'PL',
      yearlyQuota: 1,
      yearlyQuotaMinutes: 1 * 465,
      carryForward: false,
      maxCarry: 0,
      paid: true,
      allowHalfDay: true,
    },
    {
      name: 'Leave Without Pay',
      code: 'LWP',
      yearlyQuota: 0,
      yearlyQuotaMinutes: 0,
      carryForward: false,
      maxCarry: 0,
      paid: false,
      allowHalfDay: true,
    },
  ];

  for (const lt of leaveTypesData) {
    await LeaveType.findOneAndUpdate({ code: lt.code }, lt, { upsert: true, new: true });
  }
  console.log(`✓ Seeded/updated 6 standardized Leave Types (CL, AL, SL, BL, PL, LWP).`);

  // 4. November 2026 Odisha Holidays
  const holidaysNov2026 = [
    {
      name: 'Diwali (Festival of Lights)',
      date: new Date('2026-11-10T00:00:00.000Z'),
      type: 'festival',
      year: 2026,
      description: 'Diwali celebration (Sample holiday as in design reference)',
      isDemo: true,
      isSample: true,
    },
    {
      name: 'Rasa Purnima / Boita Bandana',
      date: new Date('2026-11-24T00:00:00.000Z'),
      type: 'festival',
      year: 2026,
      description: 'Odisha maritime heritage festival (Sample - verify with HR)',
      isDemo: true,
      isSample: true,
    },
    {
      name: 'Guru Nanak Jayanti',
      date: new Date('2026-11-25T00:00:00.000Z'),
      type: 'restricted',
      year: 2026,
      description: 'Guru Nanak Prakash Parv (Restricted / Optional - Sample - verify with HR)',
      isDemo: true,
      isSample: true,
    },
  ];

  for (const h of holidaysNov2026) {
    await Holiday.findOneAndUpdate(
      { name: h.name, year: h.year },
      h,
      { upsert: true, new: true }
    );
  }
  console.log(`✓ Seeded November 2026 holidays (including Diwali 10 Nov).`);

  // 5. Seed realistic logs for 2 weeks in November 2026 (Nov 2 to Nov 13, 2026)
  // Clean existing logs in this test window first to avoid duplicates
  await AttendanceLog.deleteMany({
    date: { $gte: '2026-11-01', $lte: '2026-11-15' },
  });

  console.log('Seeding 2 weeks of realistic attendance logs for all 9 employees...');

  // Weekdays: Nov 2 (Mon) to Nov 6 (Fri), Nov 9 (Mon) to Nov 13 (Fri, with Nov 10 Diwali holiday)
  const sampleDates = [
    '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06',
    '2026-11-09', /* Nov 10 Diwali Holiday */ '2026-11-11', '2026-11-12', '2026-11-13',
  ];

  for (const dateStr of sampleDates) {
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];

      // Introduce realistic variations across staff:
      // Employee 0 (Barsha Jena): Prompt on-time arrival
      // Employee 1 (Pallabi Kar): Occasional late arrival
      // Employee 2 (Rahul Mohanty): One missing clock out on Nov 6 for testing LOG_ERROR
      let inHour = 9, inMin = 50 + (i % 10);
      let outHour = 18, outMin = 48 + (i % 10);

      // Late arrival variation for Pallabi Kar on Nov 4
      if (emp.personal?.firstName?.toLowerCase().includes('pallabi') && dateStr === '2026-11-04') {
        inHour = 10;
        inMin = 28; // Late by 13 mins past 10:15
      }

      // Missing clock-out for testing LOG_ERROR on Nov 6 for Rahul Mohanty
      const isMissingOut = emp.personal?.firstName?.toLowerCase().includes('rahul') && dateStr === '2026-11-06';

      const inTime = new Date(`${dateStr}T${String(inHour).padStart(2, '0')}:${String(inMin).padStart(2, '0')}:00+05:30`);
      await recordPunch({
        employeeId: emp._id,
        type: 'in',
        time: inTime,
        source: 'web',
        note: 'Biometric Web Punch',
        isDemo: true,
      });

      // Break in / Break out
      const breakInTime = new Date(`${dateStr}T13:30:00+05:30`);
      const breakOutTime = new Date(`${dateStr}T14:15:00+05:30`);
      await recordPunch({
        employeeId: emp._id,
        type: 'break_in',
        time: breakInTime,
        source: 'web',
        note: 'Studio Lunch Break',
        isDemo: true,
      });
      await recordPunch({
        employeeId: emp._id,
        type: 'break_out',
        time: breakOutTime,
        source: 'web',
        note: 'Resumed from Lunch',
        isDemo: true,
      });

      if (!isMissingOut) {
        const outTime = new Date(`${dateStr}T${String(outHour).padStart(2, '0')}:${String(outMin).padStart(2, '0')}:00+05:30`);
        await recordPunch({
          employeeId: emp._id,
          type: 'out',
          time: outTime,
          source: 'web',
          note: 'EOD Sign Off',
          isDemo: true,
        });
      }
    }
  }

  console.log('✅ Phase 1 Attendance seeding completed successfully!\n');
  process.exit(0);
}

seedPhase1().catch((err) => {
  console.error('❌ Seeding error:', err);
  process.exit(1);
});
