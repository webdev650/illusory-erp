// tests/auth.test.js
// Basic integration tests for the auth routes.
// Run with: npm test
// These tests use supertest to make real HTTP requests against the app.
// They require a test MongoDB instance (set TEST_MONGODB_URI in .env or use in-memory).

import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { User } from '../src/modules/auth/User.model.js';

// Use the same DB as dev for now (in a real project, use a separate test DB)
const MONGODB_URI = process.env.MONGODB_URI;

beforeAll(async () => {
  await mongoose.connect(MONGODB_URI);
});

afterAll(async () => {
  // Clean up test users created during tests
  await User.deleteMany({ email: /testauth@/ });
  await mongoose.disconnect();
});

describe('POST /api/auth/register', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test Auth User',
        email: 'testauth@example.com',
        password: 'Test@1234',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('email', 'testauth@example.com');
  });

  it('should reject duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test Auth User',
        email: 'testauth@example.com',
        password: 'Test@1234',
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should reject weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Weak Pass',
        email: 'testauth2@example.com',
        password: 'weak',
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/login', () => {
  it('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'testauth@example.com',
        password: 'Test@1234',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    // Refresh token should be in a cookie, not the body
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'testauth@example.com',
        password: 'WrongPass@1',
      });

    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('should return user info with valid token', async () => {
    // First login to get a token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testauth@example.com', password: 'Test@1234' });

    const token = loginRes.body.data.accessToken;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('email', 'testauth@example.com');
  });

  it('should reject request without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/health', () => {
  it('should return 200 OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
