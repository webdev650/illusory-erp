import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Role } from '../src/models/Role.js';

describe('AUTH API INTEGRATION TESTS', () => {
  const testEmail = 'test-auth-runner@illusorydesignstudios.com';
  const testPassword = 'TestPassword@123';

  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (mongoose.connection.readyState === 0 && mongoUri) {
      await mongoose.connect(mongoUri);
    }

    const superAdminRole = await Role.findOne({ key: 'super_admin' });
    const passwordHash = await User.hashPassword(testPassword);

    await User.deleteMany({ email: testEmail });
    await User.create({
      email: testEmail,
      passwordHash,
      role: superAdminRole?._id || new mongoose.Types.ObjectId(),
      isActive: true,
      mustChangePassword: false,
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: testEmail });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should authenticate valid user and return token + user profile', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(testEmail);
    });

    it('should reject invalid password with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword@999',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should reject malformed email with 400 validation error', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'not-an-email',
          password: 'ChangeMe@123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return session profile when valid Bearer token provided', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      const token = loginRes.body.data.token;

      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.email).toBe(testEmail);
      expect(meRes.body.data.role).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should clear authentication cookies and return success', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
