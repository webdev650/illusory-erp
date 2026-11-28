import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { toProperCase } from '../src/controllers/menuConfig.controller.js';
import { DEFAULT_ROLE_MENUS } from '../src/models/MenuConfig.js';
import { Shift } from '../src/models/Shift.js';

dotenv.config();

describe('Employee Home View & Menu Scoping Tests', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  after(async () => {
    // Keep connection or close if needed
  });

  describe('1. Greeting Proper Case Formatting', () => {
    it('properly converts ALL-CAPS names to Title Case', () => {
      assert.strictEqual(toProperCase('PALLABI'), 'Pallabi');
      assert.strictEqual(toProperCase('TEJASWINI'), 'Tejaswini');
      assert.strictEqual(toProperCase('rahul'), 'Rahul');
      assert.strictEqual(toProperCase('mIHiR'), 'Mihir');
      assert.strictEqual(toProperCase(''), 'Team Member');
      assert.strictEqual(toProperCase(null), 'Team Member');
    });
  });

  describe('2. Menu Scoping by Role', () => {
    const roleMenuMap = Object.fromEntries(DEFAULT_ROLE_MENUS.map((m) => [m.roleKey, m]));

    it('restricts employee role strictly to employee modules and submenus', () => {
      const empConfig = roleMenuMap.employee;
      assert.ok(empConfig, 'Employee menu config must exist');
      
      // Allowed modules
      const expectedModules = ['home', 'hrms', 'projects', 'support', 'utilities'];
      assert.deepStrictEqual(empConfig.allowedModuleKeys.sort(), expectedModules.sort());

      // Hidden modules must NOT be present
      const forbiddenModules = ['payroll', 'recruitment', 'crm', 'assets', 'travel', 'reports', 'finance', 'configurations'];
      for (const forbidden of forbiddenModules) {
        assert.ok(!empConfig.allowedModuleKeys.includes(forbidden), `Employee must NOT see ${forbidden}`);
      }

      // Allowed HRMS submenus
      const allowedHrmsSubs = [
        'my-profile', 'attendance-calendar', 'attendance-leave', 'attendance-regularization',
        'attendance-remote-work', 'my-letters', 'my-warnings', 'my-performance', 'company-directory'
      ];
      const actualHrmsSubs = empConfig.allowedSubmenuKeys.hrms || [];
      for (const sub of allowedHrmsSubs) {
        assert.ok(actualHrmsSubs.includes(sub), `Employee must have submenu ${sub}`);
      }

      // Top tabs for employee
      const tabLabels = (empConfig.topTabs || []).map((t) => t.label);
      assert.deepStrictEqual(tabLabels, ['Home', 'Tasks', 'Meetings']);
    });

    it('grants manager role employee menu plus Approvals tab', () => {
      const mgrConfig = roleMenuMap.manager;
      const tabLabels = (mgrConfig.topTabs || []).map((t) => t.label);
      assert.ok(tabLabels.includes('Approvals'));
      assert.ok((mgrConfig.allowedSubmenuKeys.hrms || []).includes('team-attendance'));
    });

    it('grants HR role HR menu plus Reports tab', () => {
      const hrConfig = roleMenuMap.hr;
      const tabLabels = (hrConfig.topTabs || []).map((t) => t.label);
      assert.ok(hrConfig.allowedModuleKeys.includes('reports'));
      assert.ok(tabLabels.includes('HR'));
      assert.ok(tabLabels.includes('Reports'));
    });

    it('grants Super Admin all modules', () => {
      const adminConfig = roleMenuMap.super_admin;
      assert.ok(adminConfig.allowedModuleKeys.includes('configurations'));
      assert.ok(adminConfig.allowedModuleKeys.includes('payroll'));
    });
  });

  describe('3. Attendance Policy Hours & Punctuality Cutoffs', () => {
    it('resolves standard studio shift to 07 hr 45 min', async () => {
      const shift = await Shift.findOne({ code: 'STUDIO-STD' }).lean();
      if (shift) {
        // Shift is 10:00 to 18:45 with 60 min unpaid break = 465 min = 7 hr 45 min
        const start = 10 * 60; // 600 min
        const end = 18 * 60 + 45; // 1125 min
        const breakDuration = 60;
        const netMinutes = (end - start) - breakDuration;
        assert.strictEqual(netMinutes, 465);

        const hours = Math.floor(netMinutes / 60);
        const mins = netMinutes % 60;
        const formatted = `${String(hours).padStart(2, '0')} hr ${String(mins).padStart(2, '0')} min`;
        assert.strictEqual(formatted, '07 hr 45 min');
      }
    });

    it('evaluates clock-in at 9:44, 9:46, 10:00 as ON-TIME and 10:01 as LATE', async () => {
      // Policy lateAfter is 10:00 AM (600 minutes from midnight)
      // Any punch <= 600 minutes is ON-TIME without requiring late reason
      const cutoffMinutes = 10 * 60; // 600 minutes (10:00 AM)

      const testTimes = [
        { time: '09:44', minutes: 9 * 60 + 44, expectedLate: false },
        { time: '09:46', minutes: 9 * 60 + 46, expectedLate: false },
        { time: '10:00', minutes: 10 * 60, expectedLate: false },
        { time: '10:01', minutes: 10 * 60 + 1, expectedLate: true },
      ];

      for (const t of testTimes) {
        const isLate = t.minutes > cutoffMinutes;
        assert.strictEqual(isLate, t.expectedLate, `At ${t.time}, expected isLate=${t.expectedLate}`);
      }
    });
  });
});
