import cron from 'node-cron';
import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import Holiday from '../models/Holiday.js';
import AttendanceLog from '../models/AttendanceLog.js';
import Task from '../models/Task.js';
import Timesheet from '../models/Timesheet.js';
import Asset from '../models/Asset.js';
import AssetAssignment from '../models/AssetAssignment.js';
import SoftwareLicense from '../models/SoftwareLicense.js';
import MaintenanceRecord from '../models/MaintenanceRecord.js';
import CompOffCredit from '../models/CompOffCredit.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import User from '../models/User.js';
import { normalizeToKolkataMidnight } from '../utils/dateUtils.js';
import { toISTDateString } from './dayStatus.service.js';
import { getWeekBounds } from './activity.service.js';
import { notifyEmployee } from './notification.service.js';

export const initCronJobs = () => {
  // 0. Run daily at 19:00 Asia/Kolkata: Missing Clock-Out Auto-Alert
  cron.schedule(
    '0 19 * * *',
    async () => {
      console.log('⏰ [Cron] Running 19:00 IST Missing Clock-Out inspection...');
      try {
        const todayIST = toISTDateString(new Date());
        const activeEmployees = await Employee.find({
          status: 'active',
          isDeleted: false,
        }).populate('employment.reportingManager');

        for (const emp of activeEmployees) {
          const logs = await AttendanceLog.find({
            employee: emp._id,
            date: todayIST,
            isDeleted: false,
          });

          const hasIn = logs.some((l) => l.type === 'in');
          const hasOut = logs.some((l) => l.type === 'out');

          if (hasIn && !hasOut) {
            // Missing clock-out detected
            const notifPayload = {
              title: 'Attendance Alert: Missing Clock-Out',
              message: `You clocked in today (${todayIST}) but haven't clocked out. Please clock out or request log regularization.`,
              type: 'ATTENDANCE_REGULARIZATION',
              actionUrl: `/hrms/attendance/regularization?date=${todayIST}`,
            };

            await notifyEmployee(emp._id, notifPayload);

            // Also alert reporting manager if present
            if (emp.employment?.reportingManager?._id) {
              await notifyEmployee(emp.employment.reportingManager._id, {
                title: `Team Attendance Alert: ${emp.personal?.firstName} ${emp.personal?.lastName}`,
                message: `${emp.personal?.firstName} clocked in today (${todayIST}) with no clock-out recorded by 19:00 IST.`,
                type: 'ATTENDANCE_REGULARIZATION',
                actionUrl: `/hrms/attendance/manage-logs?employeeId=${emp._id}`,
              });
            }
          }
        }
      } catch (err) {
        console.error('❌ [Cron Error] 19:00 IST missing clock-out job failed:', err.message);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );

  // 1. Run daily at 23:59 Asia/Kolkata time for attendance reconciliation
  cron.schedule(
    '59 23 * * *',
    async () => {
      console.log('⏰ [Cron] Running daily attendance EOD reconciliation...');
      try {
        const today = normalizeToKolkataMidnight(new Date());
        const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          console.log('⏰ [Cron] Weekend detected, skipping auto-absentee job.');
          return;
        }

        // Check if today was a holiday
        const isHoliday = await Holiday.findOne({
          date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        });

        if (isHoliday) {
          console.log(`⏰ [Cron] Today is a declared holiday (${isHoliday.name}), skipping absentee job.`);
          return;
        }

        const activeEmployees = await Employee.find({
          status: 'active',
          isDeleted: false,
        }).select('_id');

        let absentCount = 0;
        for (const emp of activeEmployees) {
          const record = await Attendance.findOne({
            employee: emp._id,
            date: today,
          });

          // If no record exists, mark as absent
          if (!record) {
            await Attendance.create({
              employee: emp._id,
              date: today,
              status: 'absent',
              note: 'Auto-marked absent by system EOD check',
              source: 'manual',
            });
            absentCount += 1;
          }
        }

        console.log(`✅ [Cron] Daily attendance complete. ${absentCount} unrecorded employees marked absent.`);
      } catch (err) {
        console.error('❌ [Cron Error] Daily attendance job failed:', err.message);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  // Run daily at 09:00 AM Asia/Kolkata time for task reminders
  cron.schedule(
    '0 9 * * *',
    async () => {
      console.log('⏰ [Cron] Running daily 9:00 AM task deadline reminders...');
      try {
        const todayMidnight = normalizeToKolkataMidnight(new Date());
        const tomorrowMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);
        const dayAfterTomorrow = new Date(todayMidnight.getTime() + 48 * 60 * 60 * 1000);

        // 1. Overdue tasks
        const overdueTasks = await Task.find({
          status: { $ne: 'done' },
          dueDate: { $lt: todayMidnight },
          isDeleted: false,
        }).select('taskCode title dueDate assignees project');

        for (const task of overdueTasks) {
          for (const empId of task.assignees || []) {
            await notifyEmployee(empId, {
              title: `[Overdue] ${task.taskCode}: ${task.title}`,
              message: `This task was due on ${task.dueDate?.toLocaleDateString('en-IN')} and is currently overdue.`,
              link: `/projects/${task.project}?task=${task._id}`,
              type: 'task',
            });
          }
        }

        // 2. Tasks due tomorrow
        const tomorrowTasks = await Task.find({
          status: { $ne: 'done' },
          dueDate: { $gte: tomorrowMidnight, $lt: dayAfterTomorrow },
          isDeleted: false,
        }).select('taskCode title dueDate assignees project');

        for (const task of tomorrowTasks) {
          for (const empId of task.assignees || []) {
            await notifyEmployee(empId, {
              title: `[Due Tomorrow] ${task.taskCode}: ${task.title}`,
              message: `Reminder: This task is scheduled for completion tomorrow.`,
              link: `/projects/${task.project}?task=${task._id}`,
              type: 'task',
            });
          }
        }

        console.log(`✅ [Cron] Task deadline notifications dispatched (${overdueTasks.length} overdue, ${tomorrowTasks.length} due tomorrow).`);
      } catch (err) {
        console.error('❌ [Cron Error] Task reminder job failed:', err.message);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  // 3. Run weekly on Friday at 17:00 (5:00 PM) Asia/Kolkata time: Timesheet submission reminder
  cron.schedule(
    '0 17 * * 5',
    async () => {
      console.log('⏰ [Cron] Running Friday 5:00 PM timesheet submission reminder...');
      try {
        const { weekStart } = getWeekBounds();
        const activeEmployees = await Employee.find({ status: 'active', isDeleted: false }).select('_id');

        const submitted = await Timesheet.find({
          weekStart,
          status: { $in: ['submitted', 'approved'] },
        }).select('employee');
        const submittedSet = new Set(submitted.map((t) => t.employee.toString()));

        let reminderCount = 0;
        for (const emp of activeEmployees) {
          if (!submittedSet.has(emp._id.toString())) {
            await notifyEmployee(emp._id, {
              title: 'Weekly Timesheet Reminder',
              message: 'Friday check-in: Please review your daily time logs and submit your weekly timesheet.',
              link: '/tracker',
              type: 'timesheet',
            });
            reminderCount++;
          }
        }
        console.log(`✅ [Cron] Timesheet submission reminders dispatched to ${reminderCount} employees.`);
      } catch (err) {
        console.error('❌ [Cron Error] Friday timesheet reminder failed:', err.message);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  // 4. Run weekly on Monday at 10:00 AM Asia/Kolkata time: Pending timesheets review reminder for managers
  cron.schedule(
    '0 10 * * 1',
    async () => {
      console.log('⏰ [Cron] Running Monday 10:00 AM pending timesheets approver reminder...');
      try {
        const pendingTimesheets = await Timesheet.find({ status: 'submitted' })
          .populate('employee', 'personal.firstName personal.lastName employment.reportingManager')
          .lean();

        for (const ts of pendingTimesheets) {
          const managerId = ts.employee?.employment?.reportingManager;
          if (managerId) {
            await notifyEmployee(managerId, {
              title: `Pending Timesheet Approval: ${ts.employee?.personal?.firstName}`,
              message: `Reminder: Timesheet for ${ts.employee?.personal?.firstName} is pending your weekly review.`,
              link: '/tracker?tab=approvals',
              type: 'approval',
            });
          }
        }
        console.log(`✅ [Cron] Approver reminders sent for ${pendingTimesheets.length} pending timesheets.`);
      } catch (err) {
        console.error('❌ [Cron Error] Monday approver reminder failed:', err.message);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  // 5. Run daily at 09:00 AM Asia/Kolkata time: Asset & License expiry alerts
  cron.schedule(
    '0 9 * * *',
    async () => {
      console.log('⏰ [Cron] Running daily 9:00 AM asset & license alerts...');
      try {
        const now = new Date();
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        // 1. Warranties expiring in <= 30 days
        const expiringWarranties = await Asset.find({
          warrantyExpiry: { $gte: now, $lte: in30Days },
          isDeleted: false,
        }).select('name assetTag warrantyExpiry');

        // 2. Licenses renewing in <= 30 days
        const expiringLicenses = await SoftwareLicense.find({
          renewalDate: { $gte: now, $lte: in30Days },
          status: { $ne: 'cancelled' },
        }).select('name vendor renewalDate');

        // 3. Expected returns overdue
        const overdueAssignments = await AssetAssignment.find({
          status: 'active',
          expectedReturnDate: { $lt: now },
        })
          .populate('asset', 'name assetTag')
          .populate('employee', 'personal.firstName personal.lastName');

        // 4. Assets under repair > 14 days
        const longRepairAssets = await MaintenanceRecord.find({
          status: { $in: ['open', 'in_progress'] },
          startedAt: { $lt: fourteenDaysAgo },
        }).populate('asset', 'name assetTag');

        const totalAlerts =
          expiringWarranties.length +
          expiringLicenses.length +
          overdueAssignments.length +
          longRepairAssets.length;

        if (totalAlerts > 0) {
          // Find asset managers (IT & HR admins)
          const managers = await Employee.find({
            'employment.designation': { $regex: /IT|HR|Admin|Lead|Director/i },
          }).limit(5);

          for (const m of managers) {
            await notifyEmployee(m._id, {
              title: `Asset & License Alerts (${totalAlerts} items)`,
              message: `${expiringWarranties.length} warranties expiring, ${expiringLicenses.length} license renewals, ${overdueAssignments.length} overdue returns, and ${longRepairAssets.length} prolonged repairs need attention.`,
              link: '/assets?tab=overview',
              type: 'asset_alert',
            });
          }
          console.log(`✅ [Cron] Asset management alerts dispatched to ${managers.length} managers.`);
        }
      } catch (err) {
        console.error('❌ [Cron Error] Asset alert job failed:', err.message);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  // 6. Run daily at 01:00 AM Asia/Kolkata: Comp-Off Expiry & 7-Day Expiry Alert
  cron.schedule(
    '0 1 * * *',
    async () => {
      console.log('⏰ [Cron] Running 01:00 IST Comp-Off credit expiry & warning sweep...');
      try {
        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // A. Expire overdue active credits
        const expiredResult = await CompOffCredit.updateMany(
          {
            status: 'active',
            expiresAt: { $lt: now },
          },
          { $set: { status: 'expired' } }
        );
        if (expiredResult.modifiedCount > 0) {
          console.log(`⏰ [Cron] Expired ${expiredResult.modifiedCount} outdated comp-off credits.`);
        }

        // B. 7-Day Warning for credits expiring soon
        const expiringSoon = await CompOffCredit.find({
          status: 'active',
          expiresAt: { $gte: now, $lte: in7Days },
        });

        for (const credit of expiringSoon) {
          const daysLeft = Math.max(1, Math.ceil((new Date(credit.expiresAt) - now) / (1000 * 60 * 60 * 24)));
          const availableHours = ((credit.creditMinutes - credit.usedMinutes) / 60).toFixed(1);
          await notifyEmployee(credit.employee, {
            title: 'Comp-Off Credit Expiring Soon ⚠️',
            message: `You have ${availableHours} hrs of comp-off credit expiring in ${daysLeft} days (${new Date(credit.expiresAt).toLocaleDateString('en-IN')}). Apply for comp-off leave before it lapses!`,
            link: '/hrms/attendance/leave',
            type: 'comp_off_alert',
          });
        }
      } catch (err) {
        console.error('❌ [Cron Error] Comp-off expiry sweep failed:', err.message);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );

  // 7. Run daily at 09:30 AM Asia/Kolkata: Pending Approval 2-Day Reminder
  cron.schedule(
    '30 9 * * *',
    async () => {
      console.log('⏰ [Cron] Running 09:30 IST 2-day pending approval reminders...');
      try {
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        const overdueRequests = await ApprovalRequest.find({
          status: 'pending',
          createdAt: { $lte: twoDaysAgo },
        }).populate('requestedBy', 'personal.firstName personal.lastName');

        for (const reqItem of overdueRequests) {
          const stepIndex = reqItem.currentStep - 1;
          const currentStep = reqItem.steps[stepIndex];
          if (!currentStep || currentStep.status !== 'pending') continue;

          const requesterName = `${reqItem.requestedBy?.personal?.firstName || 'Employee'} ${reqItem.requestedBy?.personal?.lastName || ''}`.trim();
          const title = `Reminder: Pending Approval for ${reqItem.type.replace('_', ' ')}`;
          const message = `${requesterName}'s request "${reqItem.title}" has been waiting for review for over 48 hours. Please review.`;

          if (currentStep.approverEmployee) {
            await notifyEmployee(currentStep.approverEmployee, {
              title,
              message,
              link: '/hr?tab=approvals',
              type: 'approval_reminder',
            });
          } else if (currentStep.approverRole) {
            const roleUsers = await User.find({ isActive: true }).populate({
              path: 'role',
              match: { key: { $in: [currentStep.approverRole, 'super_admin'] } },
            });
            for (const u of roleUsers.filter((u) => u.role && u.employee)) {
              await notifyEmployee(u.employee, {
                title,
                message,
                link: '/hr?tab=approvals',
                type: 'approval_reminder',
              });
            }
          }
        }
      } catch (err) {
        console.error('❌ [Cron Error] Approver reminder job failed:', err.message);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );

  // Monthly Leave Accrual Cron: Runs on the 1st of every month at 00:10 Asia/Kolkata
  cron.schedule(
    '10 0 1 * *',
    async () => {
      console.log('⏰ [Cron] Running monthly leave accrual at 00:10 IST...');
      try {
        const { executeMonthlyLeaveAccrual } = await import('./leaveAccrual.service.js');
        const now = new Date();
        const res = await executeMonthlyLeaveAccrual({
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        });
        console.log(`✅ [Cron] Monthly leave accrual completed: Credited ${res.credited}, Skipped ${res.skippedAlreadyAccrued}`);
      } catch (err) {
        console.error('❌ [Cron Error] Monthly leave accrual failed:', err.message);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );

  console.log(
    '🕒 Node-Cron registered: Attendance (23:59 IST), Leave Accrual (1st 00:10 IST), Tasks & Assets (09:00 IST), Timesheet Reminders, Comp-Off Expiry (01:00 IST), Approver Reminders (09:30 IST)'
  );
};

