import cron from 'node-cron';
import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import Holiday from '../models/Holiday.js';
import Task from '../models/Task.js';
import { normalizeToKolkataMidnight } from '../utils/dateUtils.js';
import { notifyEmployee } from './notification.service.js';

export const initCronJobs = () => {
  // Run daily at 23:59 Asia/Kolkata time
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

  console.log('🕒 Node-Cron registered: Attendance (23:59 IST) & Task Reminders (09:00 IST)');
};

