import { Announcement } from '../models/Announcement.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { notifyUser } from '../services/notification.service.js';
import { logAudit } from '../middleware/audit.js';

export const listAnnouncements = async (req, res, next) => {
  try {
    const today = new Date();
    const query = {
      $or: [{ expiresAt: null }, { expiresAt: { $gte: today } }],
    };

    // Audience filtering based on user
    const userRole = req.user.role?._id;
    const userDept = req.user.employee?.employment?.department;

    if (req.userRole !== 'super_admin' && req.userRole !== 'admin') {
      query.$and = [
        {
          $or: [
            { audience: 'all' },
            { audience: 'department', department: userDept },
            { audience: 'role', role: userRole },
          ],
        },
      ];
    }

    const announcements = await Announcement.find(query)
      .populate('createdBy', 'email')
      .sort({ pinned: -1, createdAt: -1 })
      .limit(20);

    return sendSuccess(res, announcements);
  } catch (err) {
    next(err);
  }
};

export const createAnnouncement = async (req, res, next) => {
  try {
    const { title, body, audience = 'all', department, role, pinned = false, expiresAt } = req.body;

    const announcement = await Announcement.create({
      title,
      body,
      audience,
      department: department || null,
      role: role || null,
      pinned,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.user._id,
    });

    // Notify users
    let targetUsers = [];
    if (audience === 'all') {
      targetUsers = await User.find({ isActive: true }).select('_id');
    } else if (audience === 'role' && role) {
      targetUsers = await User.find({ role, isActive: true }).select('_id');
    }

    for (const u of targetUsers) {
      if (String(u._id) !== String(req.user._id)) {
        await notifyUser({
          userId: u._id,
          title: `Announcement: ${title}`,
          message: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
          link: '/',
          type: 'announcement',
        });
      }
    }

    await logAudit({
      req,
      action: 'CREATE_ANNOUNCEMENT',
      entity: 'Announcement',
      entityId: announcement._id,
      changes: req.body,
    });

    return sendSuccess(res, announcement, 'Announcement published successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const deleteAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByIdAndDelete(id);
    if (!announcement) return sendError(res, 'Announcement not found', 404);

    return sendSuccess(res, null, 'Announcement deleted successfully');
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/hr/announcements/celebrations
// Discovers birthdays & work anniversaries within the current week!
export const getCelebrations = async (req, res, next) => {
  try {
    const employees = await Employee.find({
      status: 'active',
      isDeleted: false,
    }).select('personal.firstName personal.lastName personal.dob personal.photo employment.dateOfJoining employment.designation employeeId');

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    const birthdaysThisWeek = [];
    const anniversariesThisWeek = [];

    for (const emp of employees) {
      const name = `${emp.personal?.firstName} ${emp.personal?.lastName}`;

      // Check birthday (within +/- 5 days of current date)
      if (emp.personal?.dob) {
        const dob = new Date(emp.personal.dob);
        if (dob.getMonth() === currentMonth) {
          const diffDays = Math.abs(dob.getDate() - currentDay);
          if (diffDays <= 4) {
            birthdaysThisWeek.push({
              employeeId: emp.employeeId,
              name,
              designation: emp.employment?.designation,
              date: `${dob.getDate()} ${dob.toLocaleString('default', { month: 'short' })}`,
              isToday: dob.getDate() === currentDay,
            });
          }
        }
      }

      // Check anniversary
      if (emp.employment?.dateOfJoining) {
        const doj = new Date(emp.employment.dateOfJoining);
        const yearsCompleted = now.getFullYear() - doj.getFullYear();
        if (yearsCompleted > 0 && doj.getMonth() === currentMonth) {
          const diffDays = Math.abs(doj.getDate() - currentDay);
          if (diffDays <= 4) {
            anniversariesThisWeek.push({
              employeeId: emp.employeeId,
              name,
              designation: emp.employment?.designation,
              yearsCompleted,
              date: `${doj.getDate()} ${doj.toLocaleString('default', { month: 'short' })}`,
              isToday: doj.getDate() === currentDay,
            });
          }
        }
      }
    }

    return sendSuccess(res, {
      birthdays: birthdaysThisWeek,
      anniversaries: anniversariesThisWeek,
    });
  } catch (err) {
    next(err);
  }
};

