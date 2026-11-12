import { Attendance } from '../models/Attendance.js';
import { Employee } from '../models/Employee.js';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import { Holiday } from '../models/Holiday.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { normalizeToKolkataMidnight } from '../utils/dateUtils.js';

export const getHRDashboardMetrics = async (req, res, next) => {
  try {
    const today = normalizeToKolkataMidnight(new Date());

    const [
      totalActiveEmployees,
      todayAttendance,
      pendingApprovalsCount,
      upcomingHolidays,
    ] = await Promise.all([
      Employee.countDocuments({ status: 'active', isDeleted: false }),
      Attendance.find({ date: today }),
      ApprovalRequest.countDocuments({ status: 'pending' }),
      Holiday.find({ date: { $gte: today } }).sort({ date: 1 }).limit(3),
    ]);

    const presentCount = todayAttendance.filter((a) => a.status === 'present').length;
    const lateCount = todayAttendance.filter((a) => a.status === 'late').length;
    const halfDayCount = todayAttendance.filter((a) => a.status === 'half_day').length;
    const leaveCount = todayAttendance.filter((a) => a.status === 'leave').length;

    const recordedCount = presentCount + lateCount + halfDayCount + leaveCount;
    const absentCount = Math.max(0, totalActiveEmployees - recordedCount);

    // 30-day attendance trend for Recharts
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    const historicalRecords = await Attendance.find({
      date: { $gte: thirtyDaysAgo, $lte: today },
    });

    // Group by date
    const trendMap = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      const label = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
      trendMap[key] = {
        date: label,
        rawDate: key,
        present: 0,
        late: 0,
        leave: 0,
        absent: 0,
      };
    }

    for (const r of historicalRecords) {
      const key = new Date(r.date).toISOString().split('T')[0];
      if (trendMap[key]) {
        if (r.status === 'present') trendMap[key].present += 1;
        else if (r.status === 'late') trendMap[key].late += 1;
        else if (r.status === 'leave') trendMap[key].leave += 1;
        else if (r.status === 'absent') trendMap[key].absent += 1;
      }
    }

    const attendanceTrend = Object.values(trendMap);

    return sendSuccess(res, {
      metrics: {
        totalActiveEmployees,
        present: presentCount,
        late: lateCount,
        halfDay: halfDayCount,
        leave: leaveCount,
        absent: absentCount,
        pendingApprovals: pendingApprovalsCount,
      },
      attendanceTrend,
      upcomingHolidays,
    });
  } catch (err) {
    next(err);
  }
};
