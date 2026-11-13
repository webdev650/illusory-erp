import { LeaveRequest } from '../models/LeaveRequest.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { Attendance } from '../models/Attendance.js';
import { AttendanceRegularization } from '../models/AttendanceRegularization.js';
import { Holiday } from '../models/Holiday.js';
import Timesheet from '../models/Timesheet.js';
import TimeEntry from '../models/TimeEntry.js';
import AssetRequest from '../models/AssetRequest.js';
import Employee from '../models/Employee.js';
import { recalculateTaskAndProjectTime } from './activity.service.js';
import { notifyEmployee } from './notification.service.js';

export const handleWorkflowCompletion = async (approval, finalStatus, actedByUser) => {
  if (approval.type === 'leave') {
    await handleLeaveCompletion(approval, finalStatus, actedByUser);
  } else if (approval.type === 'regularization') {
    await handleRegularizationCompletion(approval, finalStatus, actedByUser);
  } else if (approval.type === 'timesheet') {
    await handleTimesheetCompletion(approval, finalStatus, actedByUser);
  } else if (approval.type === 'asset_request') {
    await handleAssetRequestCompletion(approval, finalStatus, actedByUser);
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

const handleTimesheetCompletion = async (approval, finalStatus, actedByUser) => {
  const timesheet = await Timesheet.findById(approval.referenceId);
  if (!timesheet) return;

  timesheet.status = finalStatus;
  timesheet.reviewedBy = actedByUser?.employee || null;
  timesheet.reviewedAt = new Date();

  // Pick reviewer comment from last acted step
  const lastStep = approval.steps?.find((s) => s.actedBy);
  if (lastStep?.comment) {
    timesheet.reviewComment = lastStep.comment;
  }

  await timesheet.save();

  // Update associated TimeEntry records
  const entryStatus = finalStatus === 'approved' ? 'approved' : 'rejected';
  await TimeEntry.updateMany(
    { timesheet: timesheet._id, isDeleted: false },
    { status: entryStatus }
  );

  // Recalculate tasks and projects
  const entries = await TimeEntry.find({ timesheet: timesheet._id, isDeleted: false }).select('task project');
  const taskIds = new Set(entries.map((e) => e.task?.toString()).filter(Boolean));
  const projectIds = new Set(entries.map((e) => e.project?.toString()).filter(Boolean));

  for (const tId of taskIds) {
    await recalculateTaskAndProjectTime(tId, null);
  }
  for (const pId of projectIds) {
    await recalculateTaskAndProjectTime(null, pId);
  }

  // Notify the employee
  const weekStartStr = new Date(timesheet.weekStart).toLocaleDateString('en-IN');
  await notifyEmployee(timesheet.employee, {
    title: `Timesheet ${finalStatus.toUpperCase()}: Week of ${weekStartStr}`,
    message:
      finalStatus === 'approved'
        ? `Your weekly timesheet (${(timesheet.totalMinutes / 60).toFixed(1)} hrs) was approved.`
        : `Your weekly timesheet was rejected. Reviewer notes: "${timesheet.reviewComment || 'Please revise entries and re-submit'}"`,
    link: `/tracker`,
    type: 'timesheet',
  });
};

const handleAssetRequestCompletion = async (approval, finalStatus, actedByUser) => {
  const request = await AssetRequest.findById(approval.referenceId).populate('category');
  if (!request) return;

  request.status = finalStatus === 'approved' ? 'approved' : 'rejected';
  await request.save();

  if (finalStatus === 'approved') {
    // Notify requesting employee
    await notifyEmployee(request.employee, {
      title: 'Asset Request Approved',
      message: `Your request for "${request.category?.name || 'Equipment'}" was approved by management. IT will fulfill and assign your device shortly.`,
      link: '/assets?tab=my_assets',
      type: 'asset',
    });

    // Notify HR & IT to fulfill from "To fulfil" queue
    const itOrHr = await Employee.find({
      'employment.designation': { $regex: /IT|HR|Admin/i },
    }).limit(5);

    for (const staff of itOrHr) {
      await notifyEmployee(staff._id, {
        title: 'New Asset Request to Fulfil',
        message: `An approved asset request for "${request.category?.name}" is ready to be fulfilled.`,
        link: '/assets?tab=to_fulfil',
        type: 'asset_fulfil',
      });
    }
  } else {
    // Notify requesting employee of rejection
    const comment = approval.steps?.find((s) => s.status === 'rejected')?.comment || '';
    await notifyEmployee(request.employee, {
      title: 'Asset Request Rejected',
      message: `Your request for "${request.category?.name || 'Equipment'}" was rejected. Note: "${comment || 'Request was not approved by management'}"`,
      link: '/assets?tab=my_assets',
      type: 'asset',
    });
  }
};


