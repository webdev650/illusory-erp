import { LeaveRequest } from '../models/LeaveRequest.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { Attendance } from '../models/Attendance.js';
import { AttendanceRegularization } from '../models/AttendanceRegularization.js';
import { Holiday } from '../models/Holiday.js';

export const handleWorkflowCompletion = async (approval, finalStatus, actedByUser) => {
  if (approval.type === 'leave') {
    await handleLeaveCompletion(approval, finalStatus, actedByUser);
  } else if (approval.type === 'regularization') {
    await handleRegularizationCompletion(approval, finalStatus, actedByUser);
  }
};

const handleLeaveCompletion = async (approval, finalStatus, actedByUser) => {
  const leave = await LeaveRequest.findById(approval.referenceId);
  if (!leave) return;

  leave.status = finalStatus;
  await leave.save();

  const currentYear = new Date(leave.fromDate).getFullYear();
  const balance = await LeaveBalance.findOne({
    employee: leave.employee,
    leaveType: leave.leaveType,
    year: currentYear,
  });

  if (balance) {
    if (finalStatus === 'approved') {
      balance.pending = Math.max(0, balance.pending - leave.days);
      balance.used += leave.days;
      await balance.save();

      // Automatically update Attendance records to 'leave' for approved dates
      const start = new Date(leave.fromDate);
      const end = new Date(leave.toDate);

      const holidays = await Holiday.find({
        date: { $gte: start, $lte: end },
      });
      const holidayDates = new Set(holidays.map((h) => new Date(h.date).toDateString()));

      const cur = new Date(start);
      while (cur <= end) {
        const day = cur.getDay();
        const dateStr = cur.toDateString();

        // Skip weekends (Saturday=6, Sunday=0) and holidays
        if (day !== 0 && day !== 6 && !holidayDates.has(dateStr)) {
          const dateOnly = new Date(cur);
          dateOnly.setHours(0, 0, 0, 0);

          await Attendance.findOneAndUpdate(
            { employee: leave.employee, date: dateOnly },
            {
              $set: {
                status: 'leave',
                note: `Approved Leave (${approval.metadata?.leaveTypeName || 'Leave'})`,
                source: 'manual',
              },
            },
            { upsert: true, new: true }
          );
        }
        cur.setDate(cur.getDate() + 1);
      }
    } else if (finalStatus === 'rejected' || finalStatus === 'cancelled') {
      balance.pending = Math.max(0, balance.pending - leave.days);
      await balance.save();
    }
  }
};

const handleRegularizationCompletion = async (approval, finalStatus, actedByUser) => {
  const reg = await AttendanceRegularization.findById(approval.referenceId);
  if (!reg) return;

  reg.status = finalStatus;
  await reg.save();

  if (finalStatus === 'approved') {
    const attendance = await Attendance.findById(reg.attendance);
    if (attendance) {
      if (reg.requestedCheckIn) attendance.checkIn = reg.requestedCheckIn;
      if (reg.requestedCheckOut) attendance.checkOut = reg.requestedCheckOut;

      if (attendance.checkIn && attendance.checkOut) {
        const diffMs = new Date(attendance.checkOut) - new Date(attendance.checkIn);
        attendance.workHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
      }

      attendance.status = 'present';
      attendance.note = `Regularized: ${reg.reason}`;
      attendance.source = 'manual';
      await attendance.save();
    }
  }
};

