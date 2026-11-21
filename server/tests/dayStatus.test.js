import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { calculateDayStatus, resolveEmployeeShift, toISTDateString, STATUS_CONFIG } from '../src/services/dayStatus.service.js';
import { Shift } from '../src/models/Shift.js';
import { ShiftAssignment } from '../src/models/ShiftAssignment.js';
import { AttendancePolicy } from '../src/models/AttendancePolicy.js';
import { AttendanceLog } from '../src/models/AttendanceLog.js';
import { Holiday } from '../src/models/Holiday.js';
import { LeaveRequest } from '../src/models/LeaveRequest.js';
import { LeaveType } from '../src/models/LeaveType.js';
import { RemoteWorkRequest } from '../src/models/RemoteWorkRequest.js';

describe('DAY-STATUS ATTENDANCE ENGINE (Single Source of Truth)', () => {
  const dummyEmpId = new mongoose.Types.ObjectId();
  let defaultShift;
  let policy;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    policy = await AttendancePolicy.findOne({ isDefault: true });
    if (!policy) {
      policy = await AttendancePolicy.create({
        name: 'Test Studio Policy',
        graceMinutes: 15,
        halfDayMinMinutes: 240,
        fullDayMinMinutes: 465,
        weekOffDays: [0], // Sunday
        autoCloseMissingClockOutAt: '19:00',
        isDefault: true,
      });
    }

    defaultShift = await Shift.findOne({ isDefault: true });
    if (!defaultShift) {
      defaultShift = await Shift.create({
        name: 'General Studio Shift',
        startTime: '10:00',
        endTime: '18:45',
        graceMinutes: 15,
        workingMinutes: 465,
        isDefault: true,
      });
    }
  });

  afterEach(async () => {
    await AttendanceLog.deleteMany({ employee: dummyEmpId });
    await ShiftAssignment.deleteMany({ employee: dummyEmpId });
    await LeaveRequest.deleteMany({ employee: dummyEmpId });
    await RemoteWorkRequest.deleteMany({ employee: dummyEmpId });
  });

  describe('1. Standard Working Day & Punch Calculations', () => {
    it('should resolve LOG_OK when clocked in on-time and worked full day', async () => {
      const testDate = '2026-11-04'; // Wednesday (Working day)
      // Clock-in at 09:55 AM IST
      await AttendanceLog.create({
        employee: dummyEmpId,
        date: testDate,
        type: 'in',
        time: new Date(`${testDate}T09:55:00+05:30`),
        source: 'web',
      });
      // Clock-out at 18:45 PM IST
      await AttendanceLog.create({
        employee: dummyEmpId,
        date: testDate,
        type: 'out',
        time: new Date(`${testDate}T18:45:00+05:30`),
        source: 'web',
      });

      const res = await calculateDayStatus(dummyEmpId, testDate, { policy });
      expect(res.status).toBe('LOG_OK');
      expect(res.label).toBe('Log Ok');
      expect(res.lateMinutes).toBe(0);
      expect(res.workedMinutes).toBeGreaterThanOrEqual(465);
    });

    it('should flag late arrival when clock-in exceeds 10:15 AM (grace period)', async () => {
      const testDate = '2026-11-04';
      // Clock-in at 10:28 AM IST (28 mins past 10:00)
      await AttendanceLog.create({
        employee: dummyEmpId,
        date: testDate,
        type: 'in',
        time: new Date(`${testDate}T10:28:00+05:30`),
        source: 'web',
      });
      await AttendanceLog.create({
        employee: dummyEmpId,
        date: testDate,
        type: 'out',
        time: new Date(`${testDate}T18:45:00+05:30`),
        source: 'web',
      });

      const res = await calculateDayStatus(dummyEmpId, testDate, { policy });
      expect(res.status).toBe('LOG_OK');
      expect(res.lateMinutes).toBe(28);
    });

    it('should flag LOG_ERROR for past dates with clock-in but missing clock-out', async () => {
      const testDate = '2026-11-04';
      await AttendanceLog.create({
        employee: dummyEmpId,
        date: testDate,
        type: 'in',
        time: new Date(`${testDate}T10:00:00+05:30`),
        source: 'web',
      });

      const res = await calculateDayStatus(dummyEmpId, testDate, { policy });
      expect(res.status).toBe('LOG_ERROR');
      expect(res.label).toBe('Log Error');
    });

    it('should mark CHANGED_LOG when any punch has source manual or regularized', async () => {
      const testDate = '2026-11-04';
      await AttendanceLog.create({
        employee: dummyEmpId,
        date: testDate,
        type: 'in',
        time: new Date(`${testDate}T10:00:00+05:30`),
        source: 'manual', // HR manual entry
        note: 'Forgot badge',
      });
      await AttendanceLog.create({
        employee: dummyEmpId,
        date: testDate,
        type: 'out',
        time: new Date(`${testDate}T18:45:00+05:30`),
        source: 'web',
      });

      const res = await calculateDayStatus(dummyEmpId, testDate, { policy });
      expect(res.status).toBe('CHANGED_LOG');
      expect(res.label).toBe('Changed Log');
    });
  });

  describe('2. Holidays, Week-Offs & Overtime', () => {
    it('should resolve HOLIDAY on declared company holidays with no punches', async () => {
      const holidayDate = '2026-11-10'; // Diwali
      const res = await calculateDayStatus(dummyEmpId, holidayDate, { policy });
      expect(res.status).toBe('HOLIDAY');
      expect(res.label).toBe('Holiday');
    });

    it('should resolve WEEK_OFF on Sundays with no punches', async () => {
      const sundayDate = '2026-11-08'; // Sunday
      const res = await calculateDayStatus(dummyEmpId, sundayDate, { policy });
      expect(res.status).toBe('WEEK_OFF');
      expect(res.label).toBe('Week Off');
    });

    it('should grant week-off Overtime when employee works on Sunday', async () => {
      const sundayDate = '2026-11-08';
      await AttendanceLog.create({
        employee: dummyEmpId,
        date: sundayDate,
        type: 'in',
        time: new Date(`${sundayDate}T10:00:00+05:30`),
        source: 'web',
      });
      await AttendanceLog.create({
        employee: dummyEmpId,
        date: sundayDate,
        type: 'out',
        time: new Date(`${sundayDate}T16:00:00+05:30`),
        source: 'web',
      });

      const res = await calculateDayStatus(dummyEmpId, sundayDate, { policy });
      expect(res.status).toBe('LOG_OK');
      expect(res.overtimeMinutes).toBe(360); // 6 hours OT
    });
  });

  describe('3. Leaves & Remote Work Precedence', () => {
    it('should resolve LEAVE when approved paid leave exists', async () => {
      const testDate = '2026-11-12';
      const clType = await LeaveType.findOne({ code: 'CL' }) || { _id: new mongoose.Types.ObjectId(), paid: true, name: 'Casual Leave' };

      await LeaveRequest.create({
        employee: dummyEmpId,
        leaveType: clType._id,
        fromDate: new Date(`${testDate}T00:00:00.000Z`),
        toDate: new Date(`${testDate}T23:59:59.999Z`),
        days: 1,
        status: 'approved',
        reason: 'Family function',
      });

      const res = await calculateDayStatus(dummyEmpId, testDate, { policy });
      expect(res.status).toBe('LEAVE');
      expect(res.label).toBe('Leave');
    });

    it('should resolve COMPANY_OUTSIDE_LEAVE when approved unpaid leave exists', async () => {
      const testDate = '2026-11-12';
      let lwpType = await LeaveType.findOne({ code: 'LWP' });
      if (!lwpType) {
        lwpType = await LeaveType.create({ name: 'Leave Without Pay', code: 'LWP', paid: false, yearlyQuota: 0 });
      }

      await LeaveRequest.create({
        employee: dummyEmpId,
        leaveType: lwpType._id,
        fromDate: new Date(`${testDate}T00:00:00.000Z`),
        toDate: new Date(`${testDate}T23:59:59.999Z`),
        days: 1,
        status: 'approved',
        reason: 'Unpaid personal absence',
      });

      const res = await calculateDayStatus(dummyEmpId, testDate, { policy });
      expect(res.status).toBe('COMPANY_OUTSIDE_LEAVE');
      expect(res.label).toBe('Company Outside Leave');
    });

    it('should resolve REMOTE_WORK when approved remote request exists', async () => {
      const testDate = '2026-11-13';
      await RemoteWorkRequest.create({
        employee: dummyEmpId,
        fromDate: new Date(`${testDate}T00:00:00.000Z`),
        toDate: new Date(`${testDate}T23:59:59.999Z`),
        days: 1,
        status: 'approved',
        reason: 'Client site work',
      });

      const res = await calculateDayStatus(dummyEmpId, testDate, { policy });
      expect(res.status).toBe('REMOTE_WORK');
      expect(res.label).toBe('Remote Work');
      expect(res.workedMinutes).toBe(465); // Credit standard working hours
    });

    it('should mark NOT_PA for past working days with 0 logs and no leave', async () => {
      const pastWorkingDay = '2026-11-02'; // Mon
      const res = await calculateDayStatus(dummyEmpId, pastWorkingDay, { policy });
      expect(res.status).toBe('NOT_PA');
      expect(res.label).toBe('NOT P/A');
    });
  });

  describe('4. Shift Assignment Hierarchy', () => {
    it('should prioritize special shift assignment over default shift', async () => {
      const testDate = '2026-11-16';
      const specialShift = await Shift.create({
        name: 'Night Studio Shift',
        startTime: '18:00',
        endTime: '02:00',
        workingMinutes: 480,
      });

      await ShiftAssignment.create({
        employee: dummyEmpId,
        shift: specialShift._id,
        startDate: new Date(`${testDate}T00:00:00.000Z`),
        endDate: new Date(`${testDate}T23:59:59.999Z`),
        type: 'special',
      });

      const resolved = await resolveEmployeeShift(dummyEmpId, testDate);
      expect(resolved.type).toBe('special');
      expect(resolved.shift.name).toBe('Night Studio Shift');
      expect(resolved.shift.startTime).toBe('18:00');
    });
  });
});
