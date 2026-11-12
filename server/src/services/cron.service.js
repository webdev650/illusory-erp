import cron from 'node-cron';
import { Attendance } from '../models/Attendance.js';
import { Employee } from '../models/Employee.js';
import { Holiday } from '../models/Holiday.js';
import { normalizeToKolkataMidnight } from '../utils/dateUtils.js';

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

  console.log('🕒 Node-Cron daily attendance job registered for 23:59 IST');
};
