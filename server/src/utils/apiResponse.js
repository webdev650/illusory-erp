export const sendSuccess = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (res, message = 'Something went wrong', statusCode = 500, errors = null, code = null) => {
  const body = {
    success: false,
    message,
  };
  if (typeof errors === 'string') {
    body.code = errors;
  } else if (errors) {
    body.errors = errors;
  }
  if (code) {
    body.code = code;
  }
  return res.status(statusCode).json(body);
};
