import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_illusory_erp_dev_mode_12345';
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes short-lived access token
const REAUTH_TOKEN_EXPIRY = '10m'; // 10 minutes sensitive action re-auth token

export const signAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

// Legacy alias for compatibility with existing tests
export const signToken = (payload) => signAccessToken(payload);
export const verifyToken = (token) => verifyAccessToken(token);

export const signReauthToken = (payload) => {
  return jwt.sign({ ...payload, reauth: true }, JWT_SECRET, { expiresIn: REAUTH_TOKEN_EXPIRY });
};

export const verifyReauthToken = (token) => {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (!decoded.reauth) throw new Error('Invalid re-authentication token');
  return decoded;
};

export const generateRefreshToken = () => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
};

export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const getCookieOptions = (maxAgeMs) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'lax' : 'lax', // Use 'lax' for first-party / parent domain
    maxAge: maxAgeMs,
    path: '/',
  };

  // Support parent cookie domain across subdomains (e.g. mobile Safari)
  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  return options;
};

export const setAuthCookies = (res, { accessToken, refreshToken, refreshExpiresAt }) => {
  // 15-minute access token cookie
  res.cookie('token', accessToken, getCookieOptions(15 * 60 * 1000));
  res.cookie('accessToken', accessToken, getCookieOptions(15 * 60 * 1000));

  // Sliding refresh token cookie
  if (refreshToken && refreshExpiresAt) {
    const maxAgeMs = Math.max(0, new Date(refreshExpiresAt).getTime() - Date.now());
    res.cookie('refreshToken', refreshToken, getCookieOptions(maxAgeMs));
  }
};

export const clearAuthCookies = (res) => {
  const clearOptions = {
    ...getCookieOptions(0),
    expires: new Date(0),
  };
  res.cookie('token', '', clearOptions);
  res.cookie('accessToken', '', clearOptions);
  res.cookie('refreshToken', '', clearOptions);
  res.cookie('reauthToken', '', clearOptions);
};

export const setReauthCookie = (res, reauthToken) => {
  res.cookie('reauthToken', reauthToken, getCookieOptions(10 * 60 * 1000));
};

// Legacy cookie aliases
export const setTokenCookie = (res, token) => {
  res.cookie('token', token, getCookieOptions(15 * 60 * 1000));
};

export const clearTokenCookie = (res) => {
  clearAuthCookies(res);
};
