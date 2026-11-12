// src/modules/auth/auth.controller.js
// Controllers handle HTTP: read the request, call the service, send the response.
// They are thin — no business logic lives here.
import { registerSchema, loginSchema } from './auth.validator.js';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
} from './auth.service.js';
import { User } from './User.model.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { AppError } from '../../middleware/error.js';

export const register = async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body); // Throws ZodError if invalid
    const user = await registerUser(data);
    sendSuccess(res, user, 'Registration successful', 201);
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await loginUser(data, res); // res is passed to set the cookie
    sendSuccess(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    const result = await refreshAccessToken(token, res);
    sendSuccess(res, result, 'Token refreshed');
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    await logoutUser(token, res);
    sendSuccess(res, {}, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    // req.user is set by the auth middleware
    const user = await User.findById(req.user.id).populate('employeeRef', 'personal.fullName employment.employeeId employment.designation');
    if (!user) throw new AppError('User not found', 404);
    sendSuccess(res, {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeRef: user.employeeRef,
      lastLogin: user.lastLogin,
    });
  } catch (err) {
    next(err);
  }
};
