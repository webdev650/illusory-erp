import { Holiday } from '../models/Holiday.js';

/**
 * Normalizes a date to start of day (00:00:00.000) in Asia/Kolkata
 */
export const normalizeToKolkataMidnight = (dateInput = new Date()) => {
  const d = new Date(dateInput);
  // Using UTC representation adjusted for IST (+5:30)
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 60 * 60000;
  const istDate = new Date(utc + istOffset);

  istDate.setHours(0, 0, 0, 0);
  return istDate;
};

/**
 * Calculates number of working days between two dates, excluding weekends and official holidays
 */
export const countWorkingDays = async (fromDate, toDate, isHalfDay = false) => {
  if (isHalfDay) return 0.5;

  const start = new Date(fromDate);
  const end = new Date(toDate);

  if (start > end) return 0;

  // Retrieve holidays within the interval
  const holidays = await Holiday.find({
    date: { $gte: start, $lte: end },
  });
  const holidayDates = new Set(holidays.map((h) => new Date(h.date).toDateString()));

  let count = 0;
  const cur = new Date(start);

  while (cur <= end) {
    const day = cur.getDay(); // 0 is Sunday, 6 is Saturday
    const dateStr = cur.toDateString();

    if (day !== 0 && day !== 6 && !holidayDates.has(dateStr)) {
      count += 1;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return count;
};

/**
 * Checks if a punch time is late compared to Shift startTime + graceMinutes
 */
export const isPunchLate = (punchDate, shiftStartTime = '09:30', graceMinutes = 15) => {
  const punch = new Date(punchDate);
  const [hours, minutes] = shiftStartTime.split(':').map(Number);

  const expectedTime = new Date(punch);
  expectedTime.setHours(hours, minutes + graceMinutes, 0, 0);

  return punch > expectedTime;
};
