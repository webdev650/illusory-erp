import { LeaveRequest } from '../models/LeaveRequest.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { LeaveType } from '../models/LeaveType.js';
import { Attendance } from '../models/Attendance.js';
import { AttendanceLog } from '../models/AttendanceLog.js';
import { AttendanceRegularization } from '../models/AttendanceRegularization.js';
import { Holiday } from '../models/Holiday.js';
import { CompOffRequest } from '../models/CompOffRequest.js';
import { CompOffCredit } from '../models/CompOffCredit.js';
import { PartialDayRequest } from '../models/PartialDayRequest.js';
import Timesheet from '../models/Timesheet.js';
import TimeEntry from '../models/TimeEntry.js';
import AssetRequest from '../models/AssetRequest.js';
import RemoteWorkRequest from '../models/RemoteWorkRequest.js';
import Employee from '../models/Employee.js';
import { recalculateTaskAndProjectTime } from './activity.service.js';
import { notifyEmployee } from './notification.service.js';
import { calculateDayStatus } from './dayStatus.service.js';

export const handleWorkflowCompletion = async (approval, finalStatus, actedByUser) => {
  if (approval.type === 'leave') {
    await handleLeaveCompletion(approval, finalStatus, actedByUser);
  } else if (approval.type === 'regularization') {
    await handleRegularizationCompletion(approval, finalStatus, actedByUser);
  } else if (approval.type === 'timesheet') {
    await handleTimesheetCompletion(approval, finalStatus, actedByUser);
  } else if (approval.type === 'asset_request') {
    await handleAssetRequestCompletion(approval, finalStatus, actedByUser);
  } else if (approval.type === 'remote_work') {
    await handleRemoteWorkCompletion(approval, finalStatus, actedByUser);
  } else if (approval.type === 'partial_day') {
    await handlePartialDayCompletion(approval, finalStatus, actedByUser);
  } else if (approval.type === 'comp_off') {
    await handleCompOffCompletion(approval, finalStatus, actedByUser);
  }
};

const handleLeaveCompletion = async (approval, finalStatus, actedByUser) => {
  const leave = await LeaveRequest.findById(approval.referenceId);
  if (!leave) return;

  const previousStatus = leave.status;
  leave.status = finalStatus;
  await leave.save();

  const leaveTypeDoc = await LeaveType.findById(leave.leaveType);
  const isCompOff = leaveTypeDoc?.code === 'COMP_OFF';

  const currentYear = new Date(leave.fromDate).getFullYear();
  const balance = await LeaveBalance.findOne({
    employee: leave.employee,
    leaveType: leave.leaveType,
    year: currentYear,
  });

  if (finalStatus === 'approved') {
    if (balance) {
      balance.pending = Math.max(0, balance.pending - leave.days);
      balance.used += leave.days;
      await balance.save();
    }

    // If it's a comp-off leave, consume CompOffCredit records FIFO
    if (isCompOff) {
      let remainingToDeduct = leave.minutes || (leave.days * 465);
      const activeCredits = await CompOffCredit.find({
        employee: leave.employee,
        status: 'active',
        expiresAt: { $gte: new Date() },
      }).sort({ earnedDate: 1 });

      for (const credit of activeCredits) {
        if (remainingToDeduct <= 0) break;
        const available = credit.creditMinutes - credit.usedMinutes;
        const deduct = Math.min(available, remainingToDeduct);
        credit.usedMinutes += deduct;
        if (credit.usedMinutes >= credit.creditMinutes) {
          credit.status = 'used';
        }
        await credit.save();
        remainingToDeduct -= deduct;
      }
    }

    // Automatically update Attendance records to 'leave' for approved dates (skipping Sundays and holidays)
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

      // Skip Sunday (0) and holidays
      if (day !== 0 && !holidayDates.has(dateStr)) {
        const dateOnly = new Date(cur);
        dateOnly.setHours(0, 0, 0, 0);

        await Attendance.findOneAndUpdate(
          { employee: leave.employee, date: dateOnly },
          {
            $set: {
              status: 'leave',
              note: `Approved Leave (${leaveTypeDoc?.name || 'Leave'})`,
              source: 'manual',
            },
          },
          { upsert: true, new: true }
        );
      }
      cur.setDate(cur.getDate() + 1);
    }
  } else if (finalStatus === 'rejected') {
    if (balance) {
      balance.pending = Math.max(0, balance.pending - leave.days);
      await balance.save();
    }
  } else if (finalStatus === 'cancelled') {
    // If was previously approved, restore balance and comp-off credits
    if (previousStatus === 'approved') {
      if (balance) {
        balance.used = Math.max(0, balance.used - leave.days);
        await balance.save();
      }

      if (isCompOff) {
        let remainingToRestore = leave.minutes || (leave.days * 465);
        const credits = await CompOffCredit.find({
          employee: leave.employee,
          usedMinutes: { $gt: 0 },
        }).sort({ earnedDate: -1 });

        for (const credit of credits) {
          if (remainingToRestore <= 0) break;
          const restore = Math.min(credit.usedMinutes, remainingToRestore);
          credit.usedMinutes -= restore;
          if (credit.usedMinutes < credit.creditMinutes && credit.status === 'used') {
            credit.status = 'active';
          }
          await credit.save();
          remainingToRestore -= restore;
        }
      }

      // Revert Attendance records back
      const start = new Date(leave.fromDate);
      const end = new Date(leave.toDate);
      const cur = new Date(start);
      while (cur <= end) {
        const dateOnly = new Date(cur);
        dateOnly.setHours(0, 0, 0, 0);
        await Attendance.deleteOne({
          employee: leave.employee,
          date: dateOnly,
          status: 'leave',
        });
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      // Was pending, release pending balance
      if (balance) {
        balance.pending = Math.max(0, balance.pending - leave.days);
        await balance.save();
      }
    }
  }
};

const handleRegularizationCompletion = async (approval, finalStatus, actedByUser) => {
  const reg = await AttendanceRegularization.findById(approval.referenceId);
  if (!reg) return;

  reg.status = finalStatus;
  await reg.save();

  if (finalStatus === 'approved') {
    const punchTime = reg.requestedTime || reg.requestedCheckIn || reg.requestedCheckOut || new Date(reg.date);
    const punchType = reg.punchType || (reg.requestedCheckOut && !reg.requestedCheckIn ? 'out' : 'in');

    // Create an AttendanceLog with source 'regularized'
    await AttendanceLog.create({
      employee: reg.employee,
      timestamp: punchTime,
      punchType,
      source: 'regularized',
      note: `Regularized: ${reg.reason}`,
      isDemo: reg.isDemo || false,
    });

    // Recalculate day status so it resolves to Changed Log
    await calculateDayStatus(reg.employee, reg.date);

    // Also update legacy Attendance model if referenced
    if (reg.attendance) {
      const attendance = await Attendance.findById(reg.attendance);
      if (attendance) {
        if (punchType === 'in') attendance.checkIn = punchTime;
        if (punchType === 'out') attendance.checkOut = punchTime;
        attendance.note = `Regularized: ${reg.reason}`;
        attendance.source = 'regularized';
        await attendance.save();
      }
    }
  }
};

const handleRemoteWorkCompletion = async (approval, finalStatus, actedByUser) => {
  const req = await RemoteWorkRequest.findById(approval.referenceId);
  if (!req) return;

  req.status = finalStatus;
  await req.save();

  if (finalStatus === 'approved') {
    const start = new Date(req.fromDate);
    const end = new Date(req.toDate);
    const cur = new Date(start);

    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0) {
        const dateOnly = new Date(cur);
        dateOnly.setHours(0, 0, 0, 0);

        await Attendance.findOneAndUpdate(
          { employee: req.employee, date: dateOnly },
          {
            $set: {
              status: 'wfh',
              note: `Approved Remote Work: ${req.reason || 'WFH'}`,
              location: 'Remote / Work From Home',
              source: 'manual',
            },
          },
          { upsert: true, new: true }
        );
      }
      cur.setDate(cur.getDate() + 1);
    }

    await notifyEmployee(req.employee, {
      title: 'Remote Work Approved ✅',
      message: `Your remote work request from ${new Date(req.fromDate).toLocaleDateString()} to ${new Date(req.toDate).toLocaleDateString()} has been approved.`,
      link: '/hrms/attendance/remote-work',
      type: 'approval',
    });
  } else if (finalStatus === 'rejected') {
    const comment = approval.steps?.find((s) => s.status === 'rejected')?.comment || '';
    await notifyEmployee(req.employee, {
      title: 'Remote Work Request Rejected',
      message: `Your remote work request was not approved. ${comment ? `Note: "${comment}"` : ''}`,
      link: '/hrms/attendance/remote-work',
      type: 'approval',
    });
  }
};

const handlePartialDayCompletion = async (approval, finalStatus, actedByUser) => {
  const req = await PartialDayRequest.findById(approval.referenceId);
  if (!req) return;

  req.status = finalStatus;
  await req.save();

  if (finalStatus === 'approved') {
    const dateOnly = new Date(req.date);
    dateOnly.setHours(0, 0, 0, 0);

    const typeLabel = req.type === 'late_coming' ? 'Late Coming' : req.type === 'early_leaving' ? 'Early Leaving' : 'Short Leave';

    await Attendance.findOneAndUpdate(
      { employee: req.employee, date: dateOnly },
      {
        $set: {
          note: `Partial Day Approved (${req.minutes}m - ${typeLabel}): ${req.reason}`,
        },
      },
      { upsert: true }
    );

    await notifyEmployee(req.employee, {
      title: 'Partial Day Approved ✅',
      message: `Your ${typeLabel} request for ${new Date(req.date).toLocaleDateString('en-IN')} (${req.minutes} mins) has been approved and excused.`,
      link: '/hrms/attendance/partial-day',
      type: 'approval',
    });
  } else if (finalStatus === 'rejected') {
    const comment = approval.steps?.find((s) => s.status === 'rejected')?.comment || '';
    await notifyEmployee(req.employee, {
      title: 'Partial Day Request Rejected',
      message: `Your partial day request was rejected. ${comment ? `Note: "${comment}"` : ''}`,
      link: '/hrms/attendance/partial-day',
      type: 'approval',
    });
  }
};

const handleCompOffCompletion = async (approval, finalStatus, actedByUser) => {
  const req = await CompOffRequest.findById(approval.referenceId);
  if (!req) return;

  req.status = finalStatus;
  await req.save();

  if (finalStatus === 'approved') {
    const workedDate = new Date(req.workedDate);
    const expiresAt = new Date(workedDate.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days validity

    await CompOffCredit.create({
      employee: req.employee,
      compOffRequest: req._id,
      earnedDate: workedDate,
      expiresAt,
      creditMinutes: req.creditMinutes || 465,
      usedMinutes: 0,
      status: 'active',
      isDemo: req.isDemo || false,
    });

    await notifyEmployee(req.employee, {
      title: 'Comp-Off Credit Approved 🎯',
      message: `Your comp-off credit of ${((req.creditMinutes || 465) / 60).toFixed(1)} hrs for ${workedDate.toLocaleDateString('en-IN')} has been approved and credited. Valid for 60 days.`,
      link: '/hrms/attendance/comp-off',
      type: 'approval',
    });
  } else if (finalStatus === 'rejected') {
    const comment = approval.steps?.find((s) => s.status === 'rejected')?.comment || '';
    await notifyEmployee(req.employee, {
      title: 'Comp-Off Request Rejected',
      message: `Your comp-off credit request was not approved. ${comment ? `Note: "${comment}"` : ''}`,
      link: '/hrms/attendance/comp-off',
      type: 'approval',
    });
  }
};

const handleTimesheetCompletion = async (approval, finalStatus, actedByUser) => {
  const timesheet = await Timesheet.findById(approval.referenceId);
  if (!timesheet) return;

  timesheet.status = finalStatus;
  timesheet.reviewedBy = actedByUser?.employee || null;
  timesheet.reviewedAt = new Date();

  const lastStep = approval.steps?.find((s) => s.actedBy);
  if (lastStep?.comment) {
    timesheet.reviewComment = lastStep.comment;
  }

  await timesheet.save();

  const entryStatus = finalStatus === 'approved' ? 'approved' : 'rejected';
  await TimeEntry.updateMany(
    { timesheet: timesheet._id, isDeleted: false },
    { status: entryStatus }
  );

  const entries = await TimeEntry.find({ timesheet: timesheet._id, isDeleted: false }).select('task project');
  const taskIds = new Set(entries.map((e) => e.task?.toString()).filter(Boolean));
  const projectIds = new Set(entries.map((e) => e.project?.toString()).filter(Boolean));

  for (const tId of taskIds) {
    await recalculateTaskAndProjectTime(tId, null);
  }
  for (const pId of projectIds) {
    await recalculateTaskAndProjectTime(null, pId);
  }

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
    await notifyEmployee(request.employee, {
      title: 'Asset Request Approved',
      message: `Your request for "${request.category?.name || 'Equipment'}" was approved by management. IT will fulfill and assign your device shortly.`,
      link: '/assets?tab=my_assets',
      type: 'asset',
    });

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
    const comment = approval.steps?.find((s) => s.status === 'rejected')?.comment || '';
    await notifyEmployee(request.employee, {
      title: 'Asset Request Rejected',
      message: `Your request for "${request.category?.name || 'Equipment'}" was rejected. Note: "${comment || 'Request was not approved by management'}"`,
      link: '/assets?tab=my_assets',
      type: 'asset',
    });
  }
};
