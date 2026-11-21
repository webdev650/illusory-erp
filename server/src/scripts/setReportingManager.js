/**
 * Illusory ERP - Set Reporting Manager Helper
 * 
 * Usage:
 *   node src/scripts/setReportingManager.js --list
 *   node src/scripts/setReportingManager.js --emp <empCodeOrId> --mgr <mgrCodeOrId>
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Employee } from '../models/Employee.js';
import '../models/Department.js';

async function main() {
  await connectDB();

  const args = process.argv.slice(2);
  const isList = args.includes('--list') || args.length === 0;

  const empArgIdx = args.indexOf('--emp');
  const mgrArgIdx = args.indexOf('--mgr');

  if (isList && empArgIdx === -1) {
    console.log('\n📋 EMPLOYEES AND THEIR REPORTING MANAGERS:\n');
    const employees = await Employee.find({ isDeleted: false })
      .populate('employment.department', 'name')
      .populate('employment.reportingManager', 'personal.firstName personal.lastName employeeId');

    const unassigned = [];
    employees.forEach((emp) => {
      const mgr = emp.employment?.reportingManager;
      const mgrText = mgr ? `✓ [${mgr.employeeId}] ${mgr.personal?.firstName} ${mgr.personal?.lastName}` : '⚠️  EMPTY / UNASSIGNED';
      if (!mgr) unassigned.push(emp);
      console.log(`  • [${emp.employeeId}] ${emp.personal?.firstName} ${emp.personal?.lastName} (${emp.employment?.department?.name || 'No Dept'}) -> Manager: ${mgrText}`);
    });

    console.log(`\n⚠️  UNASSIGNED MANAGERS (${unassigned.length}):`);
    unassigned.forEach((u) => {
      console.log(`  - [${u.employeeId}] ${u.personal?.firstName} ${u.personal?.lastName} (${u.contact?.officialEmail || u.contact?.personalEmail || 'No Email'})`);
    });

    console.log('\nTo assign a manager:');
    console.log('  node src/scripts/setReportingManager.js --emp <EMPLOYEE_CODE> --mgr <MANAGER_CODE>\n');
    process.exit(0);
  }

  const empIdentifier = args[empArgIdx + 1];
  const mgrIdentifier = args[mgrArgIdx + 1];

  if (!empIdentifier || !mgrIdentifier) {
    console.error('❌ Error: Both --emp and --mgr must be provided.');
    console.log('Example: node src/scripts/setReportingManager.js --emp IDS-E26-MR001 --mgr IDS-E24-EX002');
    process.exit(1);
  }

  // Find target employee
  const employee = await Employee.findOne({
    $or: [
      { employeeId: empIdentifier },
      { _id: mongoose.isValidObjectId(empIdentifier) ? empIdentifier : null },
    ],
    isDeleted: false,
  });

  if (!employee) {
    console.error(`❌ Employee not found for identifier: ${empIdentifier}`);
    process.exit(1);
  }

  // Find target manager
  const manager = await Employee.findOne({
    $or: [
      { employeeId: mgrIdentifier },
      { _id: mongoose.isValidObjectId(mgrIdentifier) ? mgrIdentifier : null },
    ],
    isDeleted: false,
  });

  if (!manager) {
    console.error(`❌ Manager not found for identifier: ${mgrIdentifier}`);
    process.exit(1);
  }

  if (String(employee._id) === String(manager._id)) {
    console.error('❌ An employee cannot report to themselves.');
    process.exit(1);
  }

  employee.employment.reportingManager = manager._id;
  await employee.save();

  console.log(`\n✅ Successfully assigned [${manager.employeeId}] ${manager.personal?.firstName} ${manager.personal?.lastName} as reporting manager for [${employee.employeeId}] ${employee.personal?.firstName} ${employee.personal?.lastName}!\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Error in script:', err);
  process.exit(1);
});
