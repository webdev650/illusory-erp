import request from 'supertest';
import mongoose from 'mongoose';
import '../src/config/envValidator.js';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Role } from '../src/models/Role.js';
import { Employee } from '../src/models/Employee.js';
import { signToken } from '../src/utils/jwt.js';

describe('HRMS Dashboard Aggregations & RBAC Test Suite', () => {
  let superAdminToken;
  let employeeToken;
  let superAdminUser;
  let employeeUser;

  beforeAll(async () => {
    await connectDB();

    // Fetch existing superadmin and employee users
    superAdminUser = await User.findOne({ email: 'superadmin1@illusorydesignstudios.com' }).populate('role');
    if (!superAdminUser) {
      superAdminUser = await User.findOne({}).populate('role');
    }
    superAdminToken = signToken({ id: superAdminUser._id, role: superAdminUser.role?.key || 'super_admin' });

    employeeUser = await User.findOne({ email: 'employee1@illusorydesignstudios.com' }).populate('role');
    if (!employeeUser) {
      // Find any user with role employee
      const empRole = await Role.findOne({ key: 'employee' });
      if (empRole) {
        employeeUser = await User.findOne({ role: empRole._id }).populate('role');
      }
    }
    if (employeeUser) {
      employeeToken = signToken({ id: employeeUser._id, role: 'employee' });
    }
  });

  describe('1. Permission Enforcement', () => {
    it('should return 403 Forbidden when a standard employee requests HRMS dashboard metrics', async () => {
      if (!employeeToken) return;
      const res = await request(app)
        .get('/api/v1/hrms/dashboard/status-summary')
        .set('Cookie', [`token=${employeeToken}`]);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow Super Admin or HR to view the status summary', async () => {
      const res = await request(app)
        .get('/api/v1/hrms/dashboard/status-summary')
        .set('Cookie', [`token=${superAdminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('composition');
      expect(Array.isArray(res.body.data.composition)).toBe(true);
    });
  });

  describe('2. Headcount, Growth & Overview Statistics', () => {
    it('should return 4 overview KPI stat tiles with delta calculations', async () => {
      const res = await request(app)
        .get('/api/v1/hrms/dashboard/overview-stats')
        .set('Cookie', [`token=${superAdminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalEmployees');
      expect(res.body.data).toHaveProperty('newJoiners');
      expect(res.body.data).toHaveProperty('exitedEmployees');
      expect(res.body.data).toHaveProperty('employeesOnPip');
      expect(typeof res.body.data.totalEmployees.value).toBe('number');
    });

    it('should return 12-month strength trends with highest/lowest/current summary', async () => {
      const res = await request(app)
        .get('/api/v1/hrms/dashboard/strength?months=12')
        .set('Cookie', [`token=${superAdminToken}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.series)).toBe(true);
      expect(res.body.data.series.length).toBe(12);
      expect(res.body.data.summary).toHaveProperty('highest');
      expect(res.body.data.summary).toHaveProperty('lowest');
      expect(res.body.data.summary).toHaveProperty('current');
    });

    it('should return monthly net growth with joiners minus leavers', async () => {
      const res = await request(app)
        .get('/api/v1/hrms/dashboard/net-growth?months=12')
        .set('Cookie', [`token=${superAdminToken}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.series)).toBe(true);
      if (res.body.data.series.length > 0) {
        expect(res.body.data.series[0]).toHaveProperty('joiners');
        expect(res.body.data.series[0]).toHaveProperty('leavers');
        expect(res.body.data.series[0]).toHaveProperty('net');
      }
    });

    it('should return employee distribution by group and cross categories', async () => {
      const res = await request(app)
        .get('/api/v1/hrms/dashboard/distribution?groupBy=department&crossBy=gender')
        .set('Cookie', [`token=${superAdminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('categories');
      expect(Array.isArray(res.body.data.data)).toBe(true);
    });
  });

  describe('3. Attendance, Leaves & Mood Analytics', () => {
    it('should return leave types distribution summary', async () => {
      const res = await request(app)
        .get('/api/v1/hrms/dashboard/leave-types')
        .set('Cookie', [`token=${superAdminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('totalDays');
    });

    it('should return late reasons breakdown', async () => {
      const res = await request(app)
        .get('/api/v1/hrms/dashboard/late-reasons')
        .set('Cookie', [`token=${superAdminToken}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data).toHaveProperty('totalLateCount');
    });

    it('should return late attendance KPIs and ranked employee list', async () => {
      const res = await request(app)
        .get('/api/v1/hrms/dashboard/late-attendance')
        .set('Cookie', [`token=${superAdminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('kpis');
      expect(res.body.data.kpis).toHaveProperty('lateToday');
      expect(res.body.data.kpis).toHaveProperty('totalLateEmployees');
      expect(res.body.data.kpis).toHaveProperty('averageLateMinutes');
      expect(Array.isArray(res.body.data.ranked)).toBe(true);
    });

    it('should return employees with zero leave this month', async () => {
      const res = await request(app)
        .get('/api/v1/hrms/dashboard/no-leave')
        .set('Cookie', [`token=${superAdminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('count');
      expect(Array.isArray(res.body.data.employees)).toBe(true);
    });

    it('should return mood summary and allow recording daily mood', async () => {
      const getRes = await request(app)
        .get('/api/v1/hrms/dashboard/mood-summary')
        .set('Cookie', [`token=${superAdminToken}`]);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data).toHaveProperty('distribution');
      expect(Array.isArray(getRes.body.data.distribution)).toBe(true);

      // Record a mood checkin
      const postRes = await request(app)
        .post('/api/v1/hrms/dashboard/mood-checkin')
        .set('Cookie', [`token=${superAdminToken}`])
        .send({ mood: 'Good', note: 'Productive sprint' });

      expect(postRes.status).toBe(200);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.data.mood).toBe('Good');
    });
  });

  describe('4. Warnings & PIP Management CRUD', () => {
    let createdWarningId;

    it('should allow Super Admin or HR to create a formal warning', async () => {
      const sampleEmp = await Employee.findOne({ isDeleted: false });
      if (!sampleEmp) return;

      const res = await request(app)
        .post('/api/v1/hrms/warnings')
        .set('Cookie', [`token=${superAdminToken}`])
        .send({
          employee: sampleEmp._id,
          type: 'pip',
          title: '30-Day Performance Improvement Plan',
          reason: 'Continuous late arrivals and missed sprint deadlines',
          improvementPlan: 'Daily standup punctuality and deliverable reviews',
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('pip');
      createdWarningId = res.body.data._id;
    });

    it('should list active warnings and PIPs', async () => {
      const res = await request(app)
        .get('/api/v1/hrms/warnings')
        .set('Cookie', [`token=${superAdminToken}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should allow closing an active warning with a resolution note', async () => {
      if (!createdWarningId) return;

      const res = await request(app)
        .patch(`/api/v1/hrms/warnings/${createdWarningId}/close`)
        .set('Cookie', [`token=${superAdminToken}`])
        .send({ resolutionNote: 'Goals achieved successfully' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('closed');
    });
  });
});
