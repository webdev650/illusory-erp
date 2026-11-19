import Handlebars from 'handlebars';

// Register standard helpers
Handlebars.registerHelper('formatPaise', (paise) => {
  if (paise === null || paise === undefined) return '₹0.00';
  const rupees = Number(paise) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(rupees);
});

Handlebars.registerHelper('formatDate', (date, format = 'short') => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const options =
    format === 'long'
      ? { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }
      : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' };
  return new Intl.DateTimeFormat('en-IN', options).format(d);
});

Handlebars.registerHelper('upper', (str) => (str ? String(str).toUpperCase() : ''));
Handlebars.registerHelper('lower', (str) => (str ? String(str).toLowerCase() : ''));
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('neq', (a, b) => a !== b);

/**
 * Standard letter templates for HR/Recruitment
 */
const SYSTEM_TEMPLATES = {
  OFFER_LETTER: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; padding: 24px;">
      <h2 style="color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">ILLUSORY DESIGN STUDIOS PVT. LTD.</h2>
      <p><strong>Date:</strong> {{formatDate date 'long'}}</p>
      <p>Dear <strong>{{candidateName}}</strong>,</p>
      <p>We are pleased to offer you the position of <strong>{{jobTitle}}</strong> at Illusory Design Studios Pvt. Ltd. (Bhubaneswar, Odisha).</p>
      <p>Your Annual CTC will be <strong>{{formatPaise ctcPaise}}</strong>.</p>
      <p>Expected Date of Joining: <strong>{{formatDate joiningDate 'long'}}</strong>.</p>
      <p>Please review and sign this offer letter within <strong>{{validDays}} days</strong> to confirm acceptance.</p>
      <br/>
      <p>Warm regards,<br/><strong>Human Resources</strong><br/>Illusory Design Studios Pvt. Ltd.</p>
    </div>
  `,
  APPOINTMENT_LETTER: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; padding: 24px;">
      <h2 style="color: #4f46e5;">ILLUSORY DESIGN STUDIOS PVT. LTD.</h2>
      <h3>APPOINTMENT LETTER</h3>
      <p><strong>Employee Code:</strong> {{employeeCode}}</p>
      <p>Dear <strong>{{employeeName}}</strong>,</p>
      <p>This is with reference to your acceptance of our offer. We are pleased to formally appoint you as <strong>{{designation}}</strong> in the <strong>{{department}}</strong> department effective <strong>{{formatDate joiningDate 'long'}}</strong>.</p>
      <br/>
      <p>Sincerely,<br/><strong>Authorized Signatory</strong></p>
    </div>
  `,
  RELIEVING_LETTER: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; padding: 24px;">
      <h2 style="color: #4f46e5;">ILLUSORY DESIGN STUDIOS PVT. LTD.</h2>
      <h3>RELIEVING LETTER & SERVICE CERTIFICATE</h3>
      <p>Dear <strong>{{employeeName}}</strong> (Employee Code: {{employeeCode}}),</p>
      <p>This letter certifies that you were employed with Illusory Design Studios Pvt. Ltd. as <strong>{{designation}}</strong> from <strong>{{formatDate joiningDate 'long'}}</strong> to <strong>{{formatDate relievingDate 'long'}}</strong>.</p>
      <p>All company assets, keys, and clearances have been duly verified and accounted for. We wish you the very best in your future endeavors.</p>
      <br/>
      <p>Sincerely,<br/><strong>HR Operations</strong></p>
    </div>
  `,
};

/**
 * Compile and render a Handlebars template string.
 */
export const renderTemplate = (templateString, data = {}) => {
  if (!templateString) return '';
  const compiled = Handlebars.compile(templateString);
  return compiled(data);
};

/**
 * Render a predefined system template.
 */
export const renderNamedTemplate = (templateName, data = {}) => {
  const templateStr = SYSTEM_TEMPLATES[templateName];
  if (!templateStr) {
    throw new Error(`Template "${templateName}" does not exist in system templates.`);
  }
  return renderTemplate(templateStr, data);
};

export default {
  renderTemplate,
  renderNamedTemplate,
  SYSTEM_TEMPLATES,
};
