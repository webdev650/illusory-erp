import { Holiday } from '../models/Holiday.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';

export const listHolidays = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const holidays = await Holiday.find({ year }).sort({ date: 1 });
    return sendSuccess(res, holidays);
  } catch (err) {
    next(err);
  }
};

export const getUpcomingHolidays = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const holidays = await Holiday.find({ date: { $gte: today } })
      .sort({ date: 1 })
      .limit(5);

    return sendSuccess(res, holidays);
  } catch (err) {
    next(err);
  }
};

export const createHoliday = async (req, res, next) => {
  try {
    const { name, date, type = 'festival', description } = req.body;
    const holidayDate = new Date(date);
    const year = holidayDate.getFullYear();

    const holiday = await Holiday.create({
      name,
      date: holidayDate,
      type,
      description,
      year,
    });

    await logAudit({
      req,
      action: 'CREATE_HOLIDAY',
      entity: 'Holiday',
      entityId: holiday._id,
      changes: req.body,
    });

    return sendSuccess(res, holiday, 'Holiday created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updateHoliday = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    if (updateData.date) {
      updateData.year = new Date(updateData.date).getFullYear();
    }

    const holiday = await Holiday.findByIdAndUpdate(id, updateData, { new: true });
    if (!holiday) return sendError(res, 'Holiday not found', 404);

    return sendSuccess(res, holiday, 'Holiday updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteHoliday = async (req, res, next) => {
  try {
    const { id } = req.params;
    const holiday = await Holiday.findByIdAndDelete(id);
    if (!holiday) return sendError(res, 'Holiday not found', 404);

    return sendSuccess(res, null, 'Holiday deleted successfully');
  } catch (err) {
    next(err);
  }
};

export const bulkImportHolidays = async (req, res, next) => {
  try {
    const { holidays } = req.body; // Array of { name, date, type, description }
    if (!Array.isArray(holidays) || holidays.length === 0) {
      return sendError(res, 'Provide a valid array of holiday items', 400);
    }

    const docs = holidays.map((h) => ({
      ...h,
      date: new Date(h.date),
      year: new Date(h.date).getFullYear(),
    }));

    const inserted = await Holiday.insertMany(docs);
    return sendSuccess(res, inserted, `Imported ${inserted.length} holidays`, 201);
  } catch (err) {
    next(err);
  }
};

