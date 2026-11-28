import { verifyReauthToken } from '../utils/jwt.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Middleware ensuring user has confirmed their password within the last 10 minutes
 * before performing sensitive actions (revealing statutory details, changing bank accounts, etc.).
 */
export const requireReAuth = (req, res, next) => {
  try {
    let reauthToken = req.headers['x-reauth-token'] || req.cookies?.reauthToken;

    if (!reauthToken) {
      return sendError(
        res,
        'Password verification required for this sensitive action. Please confirm your password.',
        403,
        'REAUTH_REQUIRED'
      );
    }

    try {
      const decoded = verifyReauthToken(reauthToken);
      // Ensure re-auth token belongs to the currently logged in user
      if (req.user && decoded.id.toString() !== req.user._id.toString()) {
        return sendError(
          res,
          'Re-authentication token does not match active session.',
          403,
          'REAUTH_REQUIRED'
        );
      }
      req.reauth = decoded;
      next();
    } catch {
      return sendError(
        res,
        'Your 10-minute re-authentication window has expired. Please confirm your password again.',
        403,
        'REAUTH_REQUIRED'
      );
    }
  } catch (err) {
    next(err);
  }
};
