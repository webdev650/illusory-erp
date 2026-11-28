import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Role } from '../src/models/Role.js';
import { Employee } from '../src/models/Employee.js';
import { Department } from '../src/models/Department.js';
import { Session } from '../src/models/Session.js';
import { ClockInIntent } from '../src/models/ClockInIntent.js';
import { AttendanceLog } from '../src/models/AttendanceLog.js';
import { AttendancePolicy } from '../src/models/AttendancePolicy.js';
import { Holiday } from '../src/models/Holiday.js';
import { LeaveRequest } from '../src/models/LeaveRequest.js';
import {
  checkClockInLateness,
  initiateClockIn,
  submitLateClockIn,
  seedLateReasons,
} from '../src/services/clockIn.service.js';
import { rotateSession, createSession } from '../src/services/session.service.js';
import { signAccessToken } from '../src/utils/jwt.js';

describe('FIRST LOGIN, PERSISTENT SESSIONS & CLOCK-IN SUITE', () => {
  let employeeUser, superAdminUser, testEmployee, testDept, empRole;
  const tempPassword = 'TempPassword@123';
  const newPassword = 'NewSecretPassword@2026';

  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (mongoose.connection.readyState === 0 && mongoUri) {
      await mongoose.connect(mongoUri);
    }

    await seedLateReasons();

    await AttendancePolicy.updateMany(
      {},
      { lateAfterTime: '10:00', lateAfter: 0, graceMinutes: 0, reportingWindowStart: '09:45' },
      { upsert: true }
    );

    testDept = await Department.findOne({ isDeleted: false });
    if (!testDept) {
      testDept = await Department.create({ name: 'Engineering', code: 'ENG' });
    }

    empRole = await Role.findOne({ key: 'employee' });
    if (!empRole) {
      empRole = await Role.create({
        name: 'Employee',
        key: 'employee',
        permissions: ['employee.readSelf', 'session.viewOwn', 'session.revoke', 'attendance.clockIn'],
      });
    }

    // Create test employee
    testEmployee = await Employee.create({
      employeeId: 'IDS-TEST-0099',
      personal: {
        firstName: 'Tester',
        lastName: 'Agent',
        officialEmail: 'test-agent@illusorydesignstudios.com',
        phone: '9876543210',
        gender: 'Prefer not to say',
      },
      employment: {
        department: testDept._id,
        designation: 'QA Engineer',
        attendanceTracked: true,
      },
    });

    // Create user with mustChangePassword = true
    const hash = await User.hashPassword(tempPassword);
    employeeUser = await User.create({
      email: 'test-agent@illusorydesignstudios.com',
      passwordHash: hash,
      role: empRole._id,
      employee: testEmployee._id,
      isActive: true,
      mustChangePassword: true,
    });
  });

  afterAll(async () => {
    if (employeeUser) {
      await Session.deleteMany({ user: employeeUser._id });
      await User.deleteOne({ _id: employeeUser._id });
    }
    if (testEmployee) {
      await AttendanceLog.deleteMany({ employee: testEmployee._id });
      await ClockInIntent.deleteMany({ employee: testEmployee._id });
      await Employee.deleteOne({ _id: testEmployee._id });
    }
  });

  describe('1. First Login & Mandatory Password Change Guard', () => {
    let token;

    beforeAll(async () => {
      token = signAccessToken({
        id: employeeUser._id,
        role: 'employee',
        mustChangePassword: true,
      });
    });

    it('blocks general APIs with 403 PASSWORD_CHANGE_REQUIRED when mustChangePassword is true', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/punch')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'in' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('allows access to /auth/me and /auth/change-password while mustChangePassword is true', async () => {
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.mustChangePassword).toBe(true);
    });

    it('rejects password change if new password equals temporary password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: tempPassword,
          newPassword: tempPassword,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('temporary password');
    });

    it('rejects password change if password does not meet complexity (missing symbol)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: tempPassword,
          newPassword: 'Password1234', // No symbol
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('symbol');
    });

    it('successfully changes password, clears mustChangePassword, records passwordChangedAt, and sends essential email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: tempPassword,
          newPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await User.findById(employeeUser._id).select('+passwordHistory');
      expect(updated.mustChangePassword).toBe(false);
      expect(updated.passwordChangedAt).toBeDefined();
      expect(updated.passwordHistory.length).toBe(1); // Old temp password saved in history
    });

    it('rejects reusing the previous password from password history', async () => {
      const freshToken = signAccessToken({ id: employeeUser._id, role: 'employee' });

      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({
          currentPassword: newPassword,
          newPassword: tempPassword, // In history
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('last 5 passwords');
    });
  });

  describe('2. Persistent Login, Token Rotation & Reuse Detection', () => {
    let sessionObj, initialRefreshToken;

    it('creates a session with sliding expiry on login', async () => {
      const result = await createSession({
        user: employeeUser,
        roleKey: 'employee',
        req: { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0' }, ip: '10.0.0.1' },
      });

      expect(result.session).toBeDefined();
      expect(result.session.deviceLabel).toContain('Chrome on Windows');
      expect(result.rawRefreshToken).toBeDefined();

      sessionObj = result.session;
      initialRefreshToken = result.rawRefreshToken;
    });

    it('rotates refresh token and returns a fresh session', async () => {
      const rotated = await rotateSession({
        rawRefreshToken: initialRefreshToken,
        req: { headers: { 'user-agent': 'Chrome on Windows' } },
      });

      expect(rotated.newSession).toBeDefined();
      expect(rotated.rawRefreshToken).toBeDefined();
      expect(rotated.rawRefreshToken).not.toBe(initialRefreshToken);

      // Old session marked rotated
      const oldSession = await Session.findById(sessionObj._id);
      expect(oldSession.revokedAt).toBeDefined();
      expect(oldSession.revokedReason).toBe('rotated');
    });

    it('detects reuse of previously rotated token and revokes entire family', async () => {
      // Re-using initialRefreshToken that was already rotated
      await expect(
        rotateSession({
          rawRefreshToken: initialRefreshToken,
          req: { headers: { 'user-agent': 'Chrome on Windows' } },
        })
      ).rejects.toThrow('Session reuse detected');

      // Verify all sessions in that family were revoked
      const familySessions = await Session.find({ familyId: sessionObj.familyId });
      expect(familySessions.every((s) => s.revokedAt !== null)).toBe(true);
    });
  });

  describe('3. Clock In & Late Reason Popup Engine', () => {
    it('treats 09:50 AM as on-time (within reporting window)', async () => {
      const morningTime = new Date('2026-11-28T09:50:00+05:30');
      const check = await checkClockInLateness(testEmployee._id, morningTime);
      expect(check.isLate).toBe(false);
      expect(check.lateMinutes).toBe(0);
    });

    it('treats 10:00 AM as on-time (cutoff boundary)', async () => {
      const cutoffTime = new Date('2026-11-28T10:00:00+05:30');
      const check = await checkClockInLateness(testEmployee._id, cutoffTime);
      expect(check.isLate).toBe(false);
      expect(check.lateMinutes).toBe(0);
    });

    it('detects 10:01 AM as late and calculates lateMinutes accurately', async () => {
      const lateTime = new Date('2026-11-28T10:01:00+05:30');
      const check = await checkClockInLateness(testEmployee._id, lateTime);
      expect(check.isLate).toBe(true);
      expect(check.lateMinutes).toBe(1);
    });

    it('creates a ClockInIntent and returns 409 LATE_REASON_REQUIRED on late clock-in', async () => {
      const lateTime = new Date('2026-11-28T10:15:00+05:30'); // 15 min late

      try {
        await initiateClockIn({
          employeeId: testEmployee._id,
          userId: employeeUser._id,
          req: { headers: { 'user-agent': 'Desktop Chrome' }, ip: '127.0.0.1' },
          forceServerTime: lateTime,
        });
        throw new Error('Should have thrown 409');
      } catch (err) {
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe('LATE_REASON_REQUIRED');
        expect(err.data.intentId).toBeDefined();
        expect(err.data.lateMinutes).toBe(15);
        expect(err.data.reasons.length).toBeGreaterThanOrEqual(8);
      }
    });

    it('submits late reason and records punch using the frozen first-press server time', async () => {
      const lateTime = new Date('2026-11-28T10:20:00+05:30');

      let intentId;
      try {
        await initiateClockIn({
          employeeId: testEmployee._id,
          userId: employeeUser._id,
          req: { headers: { 'user-agent': 'Desktop Chrome' }, ip: '127.0.0.1' },
          forceServerTime: lateTime,
        });
      } catch (err) {
        intentId = err.data.intentId;
      }

      // Submit late reason
      const result = await submitLateClockIn({
        intentId,
        reasonKey: 'transport_issue',
        note: 'Bus breakdown on highway',
        userId: employeeUser._id,
        req: { ip: '127.0.0.1' },
      });

      expect(result.status).toBe('clocked_in');
      expect(result.log).toBeDefined();
      // Frozen time preserved
      expect(new Date(result.log.time).getTime()).toBe(lateTime.getTime());
      expect(result.log.lateReasonKey).toBe('transport_issue');
      expect(result.log.lateReasonLabel).toContain('Transport issue');
      expect(result.log.lateNote).toBe('Bus breakdown on highway');
    });

    it('enforces note requirement for "Other" late reason', async () => {
      const intent = await ClockInIntent.create({
        intentId: 'test-intent-other',
        employee: testEmployee._id,
        user: employeeUser._id,
        date: '2026-11-29',
        serverTime: new Date('2026-11-29T10:15:00+05:30'),
        lateMinutes: 15,
        expiresAt: new Date(Date.now() + 600000),
      });

      await expect(
        submitLateClockIn({
          intentId: intent.intentId,
          reasonKey: 'other',
          note: '', // Empty note
          userId: employeeUser._id,
          req: {},
        })
      ).rejects.toThrow('note is required');

      await ClockInIntent.deleteOne({ intentId: intent.intentId });
    });

    it('rejects expired clock-in intent with 410 INTENT_EXPIRED', async () => {
      const expiredIntent = await ClockInIntent.create({
        intentId: 'test-intent-expired',
        employee: testEmployee._id,
        user: employeeUser._id,
        date: '2026-11-29',
        serverTime: new Date('2026-11-29T10:05:00+05:30'),
        lateMinutes: 5,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      await expect(
        submitLateClockIn({
          intentId: expiredIntent.intentId,
          reasonKey: 'weather',
          note: 'Heavy rain',
          userId: employeeUser._id,
          req: {},
        })
      ).rejects.toThrow('expired');
    });

    it('blocks double clock-in on the same day (idempotent)', async () => {
      // testEmployee already has a clock-in log recorded above for 2026-11-28
      await expect(
        initiateClockIn({
          employeeId: testEmployee._id,
          userId: employeeUser._id,
          req: {},
          forceServerTime: new Date('2026-11-28T11:00:00+05:30'),
        })
      ).rejects.toThrow('already clocked in');
    });
  });

  describe('4. Re-Authentication Middleware for Sensitive Actions', () => {
    it('returns 403 REAUTH_REQUIRED when accessing sensitive action without reauth token', async () => {
      const freshToken = signAccessToken({ id: employeeUser._id, role: 'employee' });

      // Call re-authenticate endpoint with wrong password
      const badPassRes = await request(app)
        .post('/api/v1/auth/re-authenticate')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ password: 'WrongPassword' });

      expect(badPassRes.status).toBe(401);

      // Call re-authenticate with correct password
      const goodPassRes = await request(app)
        .post('/api/v1/auth/re-authenticate')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ password: newPassword });

      expect(goodPassRes.status).toBe(200);
      expect(goodPassRes.body.data.reauthToken).toBeDefined();
    });
  });
});
