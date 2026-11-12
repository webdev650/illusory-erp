import { Employee } from '../models/Employee.js';
import { Department } from '../models/Department.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const getDashboardSummary = async (req, res, next) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalEmployees,
      activeEmployees,
      onNoticeEmployees,
      probationEmployees,
      newJoinersThisMonth,
      totalDepartments,
      departmentStats,
      statusStats,
      recentJoiners,
    ] = await Promise.all([
      Employee.countDocuments({ isDeleted: false }),
      Employee.countDocuments({ status: 'active', isDeleted: false }),
      Employee.countDocuments({ status: 'notice', isDeleted: false }),
      Employee.countDocuments({ status: 'probation', isDeleted: false }),
      Employee.countDocuments({
        'employment.dateOfJoining': { $gte: startOfMonth },
        isDeleted: false,
      }),
      Department.countDocuments({ isDeleted: false }),
      Employee.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: '$employment.department',
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'departments',
            localField: '_id',
            foreignField: '_id',
            as: 'department',
          },
        },
        { $unwind: '$department' },
        {
          $project: {
            departmentId: '$_id',
            name: '$department.name',
            code: '$department.code',
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ]),
      Employee.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      Employee.find({ isDeleted: false })
        .populate('employment.department', 'name code')
        .sort({ 'employment.dateOfJoining': -1 })
        .limit(5)
        .select('personal.firstName personal.lastName personal.photo employment.designation employment.department employment.dateOfJoining employeeId status'),
    ]);

    return sendSuccess(res, {
      metrics: {
        totalEmployees,
        activeEmployees,
        onNoticeEmployees,
        probationEmployees,
        newJoinersThisMonth,
        totalDepartments,
      },
      departmentDistribution: departmentStats,
      statusDistribution: statusStats.map((s) => ({ status: s._id, count: s.count })),
      recentJoiners,
    });
  } catch (error) {
    next(error);
  }
};
