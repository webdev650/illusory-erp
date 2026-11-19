/**
 * Standardized pagination parser and response builder.
 */

export const getPagination = (query = {}, defaultLimit = 20, maxLimit = 100) => {
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) page = 1;

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const skip = (page - 1) * limit;

  // Sorting parser: support e.g. sort='createdAt' or sort='-createdAt' or sortBy='name'&sortOrder='asc'
  let sort = { createdAt: -1 };
  if (query.sort && typeof query.sort === 'string') {
    const isDesc = query.sort.startsWith('-');
    const field = isDesc ? query.sort.slice(1) : query.sort;
    sort = { [field]: isDesc ? -1 : 1 };
  } else if (query.sortBy && typeof query.sortBy === 'string') {
    const order = (query.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    sort = { [query.sortBy]: order };
  }

  return {
    page,
    limit,
    skip,
    sort,
  };
};

export const buildPaginationResult = ({ page, limit, totalItems, items }) => {
  const total = Number(totalItems) || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems: total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

export default {
  getPagination,
  buildPaginationResult,
};
