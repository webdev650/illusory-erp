import Counter from '../models/Counter.js';

/**
 * Atomic sequence generator for standardized business codes.
 * Examples:
 * - AST-0001 (Assets)
 * - EXP-2026-0001 (Expenses)
 * - INV-2026-0001 (Invoices)
 * - TKT-0001 (Support Tickets)
 * - CAN-0001 (Candidates)
 * - LED-0001 (CRM Leads)
 *
 * @param {string} counterKey - Identifier for the counter (e.g. 'asset', 'expense')
 * @param {object} options
 * @param {string} options.prefix - Prefix like 'AST', 'EXP', 'INV'
 * @param {number} [options.pad=4] - Zero-pad length
 * @param {boolean} [options.includeYear=false] - Whether to include year in counter key & code
 * @param {number} [options.year] - Custom year (defaults to current UTC year)
 * @param {ClientSession} [options.session] - Optional Mongoose transaction session
 * @returns {Promise<string>} Formatted sequence code
 */
export const getNextSequence = async (
  counterKey,
  {
    prefix = '',
    pad = 4,
    includeYear = false,
    year = new Date().getFullYear(),
    session = null,
  } = {}
) => {
  const actualKey = includeYear ? `${counterKey}_${year}` : counterKey;
  const actualPrefix = prefix || counterKey.toUpperCase().slice(0, 3);

  const queryOptions = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  };
  if (session) queryOptions.session = session;

  const counter = await Counter.findOneAndUpdate(
    { _id: actualKey },
    {
      $inc: { seq: 1 },
      $setOnInsert: {
        prefix: actualPrefix,
        year: includeYear ? year : null,
      },
    },
    queryOptions
  );

  const paddedSeq = String(counter.seq).padStart(pad, '0');
  if (includeYear) {
    return `${actualPrefix}-${year}-${paddedSeq}`;
  }
  return `${actualPrefix}-${paddedSeq}`;
};

/**
 * Peek at the current sequence value without incrementing.
 */
export const peekSequence = async (counterKey, { includeYear = false, year = new Date().getFullYear() } = {}) => {
  const actualKey = includeYear ? `${counterKey}_${year}` : counterKey;
  const counter = await Counter.findById(actualKey);
  return counter ? counter.seq : 0;
};

export default {
  getNextSequence,
  peekSequence,
};
