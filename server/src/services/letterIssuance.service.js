import crypto from 'crypto';
import mongoose from 'mongoose';
import { LetterCounter } from '../models/LetterCounter.js';
import { LetterTemplate } from '../models/LetterTemplate.js';
import { IssuedLetter } from '../models/IssuedLetter.js';
import { Employee } from '../models/Employee.js';
import { createApprovalRequest } from './approval.service.js';
import {
  renderTemplateBody,
  validateTemplateVariables,
  computeDocumentHash,
} from './letterTemplate.service.js';

/**
 * Atomically generates sequential reference number without gaps (e.g. IDS/HR/OFFER/26/0001)
 */
export const getNextLetterRefNo = async (category, customYear = null) => {
  const fullYear = customYear || new Date().getFullYear();
  const yy = String(fullYear).slice(-2);
  const catCode = category.toUpperCase().slice(0, 5);

  const counter = await LetterCounter.findOneAndUpdate(
    { category, year: fullYear },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const seqPadded = String(counter.sequence).padStart(4, '0');
  return `IDS/HR/${catCode}/${yy}/${seqPadded}`;
};

/**
 * Seed 8 Standard Starter Sample Letter Templates
 */
export const seedStandardTemplates = async (userId = null) => {
  const starters = [
    {
      name: 'Employment Offer Letter',
      code: 'OFFER_STD',
      category: 'offer',
      isSample: true,
      isReviewed: false,
      requiresApproval: true,
      body: `Dear {{employee.fullName}},\n\nWe are pleased to offer you the position of {{employee.designation}} with ILLUSORY DESIGN STUDIOS PVT. LTD. in the {{employee.department}} department.\n\nYour expected date of joining will be {{employee.dateOfJoining}}. Your annual compensation is {{salary.ctc}}.\n\nWe look forward to welcoming you aboard.\n\nSincerely,\n{{signatory.name}}\n{{signatory.designation}}`,
    },
    {
      name: 'Appointment Letter',
      code: 'APPT_STD',
      category: 'appointment',
      isSample: true,
      isReviewed: false,
      requiresApproval: true,
      body: `Dear {{employee.fullName}} (Employee Code: {{employee.code}}),\n\nSub: Letter of Appointment\n\nConsequent to your acceptance of our offer, we are pleased to appoint you as {{employee.designation}} effective from {{employee.dateOfJoining}}.\n\nYou will be on probation for a period of 6 months from the date of joining.\n\nWarm regards,\n{{signatory.name}}\n{{signatory.designation}}`,
    },
    {
      name: 'Probation Confirmation Letter',
      code: 'CONF_STD',
      category: 'confirmation',
      isSample: true,
      isReviewed: false,
      requiresApproval: true,
      body: `Dear {{employee.fullName}},\n\nSub: Confirmation of Employment\n\nFollowing the successful completion of your probation period, we are pleased to confirm your employment as {{employee.designation}} with ILLUSORY DESIGN STUDIOS PVT. LTD.\n\nAll other terms and conditions of your employment contract remain unchanged.\n\nBest wishes,\n{{signatory.name}}\n{{signatory.designation}}`,
    },
    {
      name: 'Experience Letter',
      code: 'EXP_STD',
      category: 'experience',
      isSample: true,
      isReviewed: false,
      requiresApproval: true,
      body: `TO WHOMSOEVER IT MAY CONCERN\n\nThis is to certify that {{employee.fullName}} (Employee Code: {{employee.code}}) was employed with ILLUSORY DESIGN STUDIOS PVT. LTD. from {{employee.dateOfJoining}} to {{employee.lastWorkingDay}}.\n\nDuring their tenure, they held the position of {{employee.designation}} in the {{employee.department}} division.\n\nWe wish them all the best in their future endeavors.\n\n{{signatory.name}}\n{{signatory.designation}}`,
    },
    {
      name: 'Relieving Letter',
      code: 'REL_STD',
      category: 'relieving',
      isSample: true,
      isReviewed: false,
      requiresApproval: true,
      body: `Dear {{employee.fullName}},\n\nSub: Relieving Letter\n\nWith reference to your resignation, we confirm that you have been relieved from your duties as {{employee.designation}} at ILLUSORY DESIGN STUDIOS PVT. LTD. at the close of business hours on {{employee.lastWorkingDay}}.\n\nAll company assets and clearances have been accounted for.\n\nSincerely,\n{{signatory.name}}\n{{signatory.designation}}`,
    },
    {
      name: 'Salary Certificate',
      code: 'SAL_CERT_STD',
      category: 'salary_certificate',
      isSample: true,
      isReviewed: false,
      requiresApproval: false,
      body: `TO WHOM IT MAY CONCERN\n\nThis is to certify that {{employee.fullName}} is currently employed as {{employee.designation}} with us since {{employee.dateOfJoining}}.\n\nTheir current annual gross compensation is {{salary.ctc}}.\n\nThis certificate is issued upon the employee's request for official purposes.\n\n{{signatory.name}}\n{{signatory.designation}}`,
    },
    {
      name: 'Address Proof Letter',
      code: 'ADDR_PROOF_STD',
      category: 'address_proof',
      isSample: true,
      isReviewed: false,
      requiresApproval: false,
      body: `TO WHOM IT MAY CONCERN\n\nThis is to verify that {{employee.fullName}} (Code: {{employee.code}}) is an active full-time employee with ILLUSORY DESIGN STUDIOS PVT. LTD., located at DLF Cybercity, Patia, Bhubaneswar, Odisha.\n\nThis letter is issued upon request to serve as proof of employment and office address.\n\n{{signatory.name}}\n{{signatory.designation}}`,
    },
    {
      name: 'Employment Verification Letter',
      code: 'EMP_VERIF_STD',
      category: 'employment_verification',
      isSample: true,
      isReviewed: false,
      requiresApproval: false,
      body: `TO WHOMSOEVER IT MAY CONCERN\n\nWe hereby confirm that {{employee.fullName}} is employed with ILLUSORY DESIGN STUDIOS PVT. LTD. as {{employee.designation}} in the {{employee.department}} department since {{employee.dateOfJoining}}.\n\nTheir employment status is active.\n\nFor ILLUSORY DESIGN STUDIOS PVT. LTD.\n\n{{signatory.name}}\n{{signatory.designation}}`,
    },
  ];

  for (const t of starters) {
    const existing = await LetterTemplate.findOne({ code: t.code });
    if (!existing) {
      await LetterTemplate.create({ ...t, createdBy: userId });
    }
  }
};

export const seedStarterTemplatesIfEmpty = seedStandardTemplates;
