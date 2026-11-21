import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { LeaveType } from '../models/LeaveType.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { RemoteWorkRequest } from '../models/RemoteWorkRequest.js';
import { PartialDayRequest } from '../models/PartialDayRequest.js';
import { CompOffRequest } from '../models/CompOffRequest.js';
import { CompOffCredit } from '../models/CompOffCredit.js';
import { AttendanceRegularization } from '../models/AttendanceRegularization.js';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import { createApprovalRequest } from '../services/approval.service.js';

const seedPhase2Demo = async () => {
  console.log('🌱 Starting Phase 2 Sample Requests Seed (marked isDemo: true)...');
  await connectDB();

  // Find real staff
  const barsha = await Employee.findOne({ 'personal.officialEmail': 'hr@illusorydesignstudios.com' });
  const aparna = await Employee.findOne({ 'personal.officialEmail': 'operations@illusorydesignstudios.com' });
  const staff = await Employee.findOne({ 'personal.officialEmail': { $nin: ['hr@illusorydesignstudios.com', 'operations@illusorydesignstudios.com'] } });

  if (!barsha || !aparna) {
    console.error('❌ Required staff (Barsha or Aparna) not found.');
    process.exit(1);
  }

  const barshaUser = await User.findOne({ employee: barsha._id });
  const aparnaUser = await User.findOne({ employee: aparna._id });
  const targetEmp = staff || barsha;
  const targetUser = staff ? await User.findOne({ employee: staff._id }) : barshaUser;

  // Clean old demo requests
  await ApprovalRequest.deleteMany({ isDemo: true });
  await AttendanceRegularization.deleteMany({ isDemo: true });
  await LeaveRequest.deleteMany({ isDemo: true });
  await RemoteWorkRequest.deleteMany({ isDemo: true });
  await PartialDayRequest.deleteMany({ isDemo: true });
  await CompOffRequest.deleteMany({ isDemo: true });
  await CompOffCredit.deleteMany({ isDemo: true });

  console.log('🧹 Cleaned existing sample demo requests.');

  // 1. Sample Log Regularization
  const regDate = new Date();
  regDate.setDate(regDate.getDate() - 2);
  regDate.setHours(10, 5, 0, 0);

  const sampleReg = await AttendanceRegularization.create({
    employee: targetEmp._id,
    date: regDate,
    punchType: 'in',
    requestedTime: regDate,
    requestedCheckIn: regDate,
    reason: 'Biometric device scanner failed to recognize fingerprint at entry door',
    status: 'pending',
    isDemo: true,
  });

  const regApproval = await createApprovalRequest({
    type: 'regularization',
    referenceModel: 'AttendanceRegularization',
    referenceId: sampleReg._id,
    requestedByEmployeeId: targetEmp._id,
    requesterUserId: targetUser?._id,
    title: `Log Regularization (IN) - ${regDate.toLocaleDateString('en-IN')}`,
    metadata: {
      punchType: 'in',
      requestedTime: regDate,
      reason: sampleReg.reason,
    },
    isDemo: true,
  });
  sampleReg.approvalRequest = regApproval._id;
  await sampleReg.save();
  console.log('✅ Seeded sample Regularization request');

  // 2. Sample Leave Request
  const clType = await LeaveType.findOne({ code: 'CL' }) || await LeaveType.findOne();
  if (clType) {
    const leaveFrom = new Date();
    leaveFrom.setDate(leaveFrom.getDate() + 7);
    const leaveTo = new Date(leaveFrom);
    leaveTo.setDate(leaveTo.getDate() + 1);

    const sampleLeave = await LeaveRequest.create({
      employee: targetEmp._id,
      leaveType: clType._id,
      fromDate: leaveFrom,
      toDate: leaveTo,
      isHalfDay: false,
      days: 2,
      minutes: 2 * 465,
      reason: 'Attending family cultural ceremony and function out of station',
      status: 'pending',
      isDemo: true,
    });

    const leaveApproval = await createApprovalRequest({
      type: 'leave',
      referenceModel: 'LeaveRequest',
      referenceId: sampleLeave._id,
      requestedByEmployeeId: targetEmp._id,
      requesterUserId: targetUser?._id,
      title: `${clType.name} Application (2 days)`,
      metadata: {
        leaveTypeName: clType.name,
        days: 2,
        fromDate: leaveFrom,
        toDate: leaveTo,
      },
      isDemo: true,
    });
    sampleLeave.approvalRequest = leaveApproval._id;
    await sampleLeave.save();
    console.log('✅ Seeded sample Leave request');
  }

  // 3. Sample Remote Work Request
  const rwFrom = new Date();
  rwFrom.setDate(rwFrom.getDate() + 4);
  const sampleRw = await RemoteWorkRequest.create({
    employee: targetEmp._id,
    fromDate: rwFrom,
    toDate: rwFrom,
    days: 1,
    reason: 'Client presentation follow-up and fiber optic connectivity installation at residence',
    contactPhone: '+91 98765 43210',
    status: 'pending',
    isDemo: true,
  });

  const rwApproval = await createApprovalRequest({
    type: 'remote_work',
    referenceModel: 'RemoteWorkRequest',
    referenceId: sampleRw._id,
    requestedByEmployeeId: targetEmp._id,
    requesterUserId: targetUser?._id,
    title: 'Remote Work (WFH) - 1 day',
    metadata: {
      fromDate: rwFrom,
      toDate: rwFrom,
      days: 1,
    },
    isDemo: true,
  });
  sampleRw.approvalRequest = rwApproval._id;
  await sampleRw.save();
  console.log('✅ Seeded sample Remote Work request');

  // 4. Sample Partial Day Request
  const pdDate = new Date();
  pdDate.setDate(pdDate.getDate() + 3);
  const samplePd = await PartialDayRequest.create({
    employee: targetEmp._id,
    date: pdDate,
    type: 'late_coming',
    minutes: 45,
    reason: 'Scheduled diagnostic health checkup and blood testing at hospital',
    status: 'pending',
    isDemo: true,
  });

  const pdApproval = await createApprovalRequest({
    type: 'partial_day',
    referenceModel: 'PartialDayRequest',
    referenceId: samplePd._id,
    requestedByEmployeeId: targetEmp._id,
    requesterUserId: targetUser?._id,
    title: `Partial Day (Late Coming) - 45m on ${pdDate.toLocaleDateString('en-IN')}`,
    metadata: {
      date: pdDate,
      type: 'late_coming',
      minutes: 45,
    },
    isDemo: true,
  });
  samplePd.approvalRequest = pdApproval._id;
  await samplePd.save();
  console.log('✅ Seeded sample Partial Day request');

  // 5. Sample Comp-Off Credit & Request
  const pastSunday = new Date();
  pastSunday.setDate(pastSunday.getDate() - 6);
  pastSunday.setHours(0, 0, 0, 0);

  const sampleCompOffReq = await CompOffRequest.create({
    employee: targetEmp._id,
    workedDate: pastSunday,
    workedMinutes: 480,
    creditDays: 1,
    creditMinutes: 465,
    reason: 'Special weekend design sprint and brand identity launch delivery',
    status: 'approved',
    isDemo: true,
  });

  const creditExpiry = new Date(pastSunday.getTime() + 60 * 24 * 60 * 60 * 1000);
  await CompOffCredit.create({
    employee: targetEmp._id,
    compOffRequest: sampleCompOffReq._id,
    earnedDate: pastSunday,
    expiresAt: creditExpiry,
    creditMinutes: 465,
    usedMinutes: 0,
    status: 'active',
    isDemo: true,
  });
  console.log('✅ Seeded sample approved Comp-Off Credit (60 days validity)');

  console.log('✨ Phase 2 Sample Requests Seed Completed successfully!');
  process.exit(0);
};

seedPhase2Demo().catch((err) => {
  console.error('❌ Error during Phase 2 demo seed:', err);
  process.exit(1);
});
