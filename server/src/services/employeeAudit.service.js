import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { Department } from '../models/Department.js';
import { calculateProfileCompleteness } from '../utils/completeness.js';

/**
 * Builds organization chart hierarchy tree
 */
export const getOrgChartTree = async () => {
  const employees = await Employee.find({ isDeleted: false, status: { $ne: 'inactive' } })
    .populate('employment.department', 'name code')
    .populate('employment.reportingManager', 'personal.firstName personal.lastName employeeId')
    .select('employeeId personal.firstName personal.lastName personal.photo employment status');

  const employeeMap = new Map();
  const unassigned = [];

  // Map by ID
  employees.forEach((emp) => {
    employeeMap.set(String(emp._id), {
      id: emp._id,
      code: emp.employeeId,
      name: `${emp.personal?.firstName} ${emp.personal?.lastName}`,
      designation: emp.employment?.designation || 'Staff',
      department: emp.employment?.department?.name || 'General',
      departmentCode: emp.employment?.department?.code || 'GEN',
      photo: emp.personal?.photo?.url || '',
      status: emp.status,
      managerId: emp.employment?.reportingManager ? String(emp.employment.reportingManager._id || emp.employment.reportingManager) : null,
      children: [],
    });
  });

  const roots = [];

  employeeMap.forEach((node) => {
    if (!node.managerId) {
      roots.push(node);
    } else {
      const parent = employeeMap.get(node.managerId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Manager reference does not point to an active employee
        unassigned.push(node);
        roots.push(node);
      }
    }
  });

  return { roots, unassigned };
};

/**
 * Data Quality and Duplicates Auditor
 */
export const auditEmployeeDataQuality = async () => {
  const employees = await Employee.find({ isDeleted: false })
    .populate('employment.department', 'name code');

  const missingDocuments = [];
  const missingManagers = [];
  const probationEndingSoon = [];
  const missingShifts = [];
  const incompleteProfiles = [];

  const panMap = new Map();
  const aadhaarMap = new Map();
  const duplicatePans = [];
  const duplicateAadhaars = [];

  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000);

  for (const emp of employees) {
    const completeness = calculateProfileCompleteness(emp);
    if (completeness.percentage < 80) {
      incompleteProfiles.push({
        id: emp._id,
        code: emp.employeeId,
        name: `${emp.personal?.firstName} ${emp.personal?.lastName}`,
        completeness: completeness.percentage,
        missingFields: completeness.missingFields,
      });
    }

    if (!emp.employment?.reportingManager && emp.status !== 'inactive') {
      missingManagers.push({
        id: emp._id,
        code: emp.employeeId,
        name: `${emp.personal?.firstName} ${emp.personal?.lastName}`,
        department: emp.employment?.department?.name || 'General',
      });
    }

    if (!emp.employment?.shift) {
      missingShifts.push({
        id: emp._id,
        code: emp.employeeId,
        name: `${emp.personal?.firstName} ${emp.personal?.lastName}`,
      });
    }

    if (emp.status === 'probation' && emp.employment?.probationEndDate) {
      const pEnd = new Date(emp.employment.probationEndDate);
      if (pEnd >= now && pEnd <= thirtyDaysLater) {
        probationEndingSoon.push({
          id: emp._id,
          code: emp.employeeId,
          name: `${emp.personal?.firstName} ${emp.personal?.lastName}`,
          probationEndDate: pEnd,
        });
      }
    }

    if ((emp.documents || []).length < 2) {
      missingDocuments.push({
        id: emp._id,
        code: emp.employeeId,
        name: `${emp.personal?.firstName} ${emp.personal?.lastName}`,
        documentCount: (emp.documents || []).length,
      });
    }

    // Duplicate detection
    const pan = (emp.statutory?.pan || '').trim().toUpperCase();
    if (pan) {
      if (panMap.has(pan)) {
        duplicatePans.push({ pan, employees: [panMap.get(pan), emp.employeeId] });
      } else {
        panMap.set(pan, emp.employeeId);
      }
    }

    const aadhaar = (emp.statutory?.aadhaar || '').trim();
    if (aadhaar) {
      if (aadhaarMap.has(aadhaar)) {
        duplicateAadhaars.push({ aadhaar, employees: [aadhaarMap.get(aadhaar), emp.employeeId] });
      } else {
        aadhaarMap.set(aadhaar, emp.employeeId);
      }
    }
  }

  return {
    totalEmployees: employees.length,
    incompleteProfiles,
    missingManagers,
    missingShifts,
    probationEndingSoon,
    missingDocuments,
    duplicates: {
      pan: duplicatePans,
      aadhaar: duplicateAadhaars,
    },
  };
};
