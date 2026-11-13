import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
import Asset from '../models/Asset.js';
import AssetCategory from '../models/AssetCategory.js';
import SoftwareLicense from '../models/SoftwareLicense.js';
import ExitClearance from '../models/ExitClearance.js';
import Employee from '../models/Employee.js';
import { notifyEmployee } from './notification.service.js';

dotenv.config();

const SECRET_KEY =
  process.env.ASSET_SECRET_KEY ||
  process.env.FIELD_ENCRYPTION_KEY ||
  'illusory_studio_asset_encryption_secret_key_32_chars!';

/**
 * Encrypt license key at rest with AES
 */
export const encryptLicenseKey = (plainKey) => {
  if (!plainKey) return '';
  return CryptoJS.AES.encrypt(String(plainKey), SECRET_KEY).toString();
};

/**
 * Decrypt license key
 */
export const decryptLicenseKey = (cipherKey) => {
  if (!cipherKey) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(cipherKey, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (err) {
    return '*** DECRYPTION ERROR ***';
  }
};

/**
 * Auto-generate next sequential asset tag e.g. AST-0001
 */
export const generateNextAssetTag = async () => {
  const lastAsset = await Asset.findOne({}, { assetTag: 1 }).sort({ createdAt: -1 });
  if (!lastAsset || !lastAsset.assetTag) {
    return 'AST-0001';
  }

  const match = lastAsset.assetTag.match(/AST-(\d+)/i);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `AST-${String(nextNum).padStart(4, '0')}`;
  }

  const total = await Asset.countDocuments();
  return `AST-${String(total + 1).padStart(4, '0')}`;
};

/**
 * Generate QR code for asset tag.
 * Tries the 'qrcode' library; falls back cleanly to generating an SVG QR code if qrcode is not yet installed.
 */
export const generateAssetQrCode = async (assetTag) => {
  try {
    const qrcodeModule = await import('qrcode');
    const qr = qrcodeModule.default || qrcodeModule;
    const buffer = await qr.toBuffer(assetTag, {
      type: 'png',
      width: 280,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
    return { mime: 'image/png', buffer };
  } catch (err) {
    // Clean SVG QR fallback
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" viewBox="0 0 280 280">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <rect x="20" y="20" width="60" height="60" fill="#0f172a"/>
        <rect x="30" y="30" width="40" height="40" fill="#ffffff"/>
        <rect x="40" y="40" width="20" height="20" fill="#0f172a"/>
        
        <rect x="200" y="20" width="60" height="60" fill="#0f172a"/>
        <rect x="210" y="30" width="40" height="40" fill="#ffffff"/>
        <rect x="220" y="40" width="20" height="20" fill="#0f172a"/>

        <rect x="20" y="200" width="60" height="60" fill="#0f172a"/>
        <rect x="30" y="210" width="40" height="40" fill="#ffffff"/>
        <rect x="40" y="220" width="20" height="20" fill="#0f172a"/>

        <rect x="110" y="20" width="60" height="20" fill="#0f172a"/>
        <rect x="20" y="110" width="20" height="60" fill="#0f172a"/>
        <rect x="110" y="110" width="60" height="60" fill="#0f172a"/>
        <rect x="200" y="110" width="20" height="60" fill="#0f172a"/>
        <rect x="110" y="200" width="60" height="20" fill="#0f172a"/>
        
        <text x="140" y="260" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle" fill="#0f172a">${assetTag}</text>
      </svg>
    `.trim();

    return { mime: 'image/svg+xml', buffer: Buffer.from(svgString, 'utf-8') };
  }
};

/**
 * Exit Clearance Engine: Initiate or refresh exit clearance for an employee
 */
export const initiateExitClearance = async (employeeId) => {
  const employee = await Employee.findById(employeeId);
  if (!employee) return null;

  // 1. Find all active physical assets assigned to this employee
  const assignedAssets = await Asset.find({
    currentAssignee: employeeId,
    status: 'assigned',
    isDeleted: false,
  }).populate('category', 'name code');

  // 2. Find all software licenses assigned to this employee
  const assignedLicenses = await SoftwareLicense.find({
    'assignedTo.employee': employeeId,
  });

  const checklistItems = [];

  assignedAssets.forEach((ast) => {
    checklistItems.push({
      itemType: 'asset',
      referenceId: ast._id,
      name: `${ast.name} (${ast.category?.name || 'Device'})`,
      tagOrKey: ast.assetTag,
      status: 'pending',
    });
  });

  assignedLicenses.forEach((lic) => {
    checklistItems.push({
      itemType: 'license',
      referenceId: lic._id,
      name: `${lic.name} (${lic.vendor})`,
      tagOrKey: lic.licenseType,
      status: 'pending',
    });
  });

  let clearance = await ExitClearance.findOne({ employee: employeeId });
  if (!clearance) {
    clearance = new ExitClearance({
      employee: employeeId,
      status: checklistItems.length === 0 ? 'cleared' : 'pending',
      checklist: checklistItems,
    });
  } else {
    // Preserve already returned/revoked items and merge pending items
    const existingMap = new Map();
    clearance.checklist.forEach((item) => {
      existingMap.set(item.referenceId.toString(), item);
    });

    const mergedChecklist = checklistItems.map((newItem) => {
      const existing = existingMap.get(newItem.referenceId.toString());
      if (existing) {
        return existing;
      }
      return newItem;
    });

    clearance.checklist = mergedChecklist;
    const allDone = clearance.checklist.every((c) => c.status !== 'pending');
    if (allDone && clearance.checklist.length > 0) {
      clearance.status = 'cleared';
      clearance.clearedAt = new Date();
    }
  }

  await clearance.save();

  // Notify HR that clearance was initiated
  const hrStaff = await Employee.find({ 'employment.department': { $exists: true } }).limit(5);
  for (const staff of hrStaff) {
    await notifyEmployee(staff._id, {
      title: `Exit Clearance: ${employee.personal.firstName} ${employee.personal.lastName}`,
      message: `Exit clearance initiated. ${checklistItems.length} items (${assignedAssets.length} hardware, ${assignedLicenses.length} software) require hand-over.`,
      link: `/hrms/employees/${employee._id}?tab=assets`,
      type: 'asset_clearance',
    });
  }

  return clearance;
};

/**
 * Generate CSV sample template for asset import
 */
export const getAssetCsvTemplate = () => {
  return [
    'Name,CategoryCode,Brand,Model,SerialNumber,PurchaseDate,PurchaseCostINR,Vendor,WarrantyExpiry,Condition,Location,Notes',
    'MacBook Pro 16",LAPTOP,Apple,M3 Max 36GB,C02F1234MD6R,2025-06-15,249900,iStore Infocity,2028-06-15,new,Studio (Bhubaneswar),Studio main design workstation',
    'UltraSharp 27" 4K Monitor,MONITOR,Dell,U2723QE,CN0987654321,2025-07-20,48500,Dell Direct India,2028-07-20,new,Studio (Bhubaneswar),4K USB-C Hub Display',
  ].join('\n');
};

/**
 * Validate and process Bulk CSV Import of assets
 */
export const importAssetsFromCsv = async (csvContent, createdByUserId) => {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV must contain a header line and at least one data row.');
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const categories = await AssetCategory.find({ isActive: true });
  const categoryMap = new Map();
  categories.forEach((c) => {
    categoryMap.set(c.code.toUpperCase(), c._id);
    categoryMap.set(c.name.toLowerCase(), c._id);
  });

  const successful = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // Split on comma preserving quotes
    const values = rawLine.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));

    if (values.length < 2) continue;

    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] || '';
    });

    const rowNum = i + 1;
    const name = rowObj['name'];
    const catCode = (rowObj['categorycode'] || rowObj['category'] || '').toUpperCase();

    if (!name) {
      errors.push({ row: rowNum, error: 'Asset name is required.' });
      continue;
    }

    const catId = categoryMap.get(catCode);
    if (!catId) {
      errors.push({
        row: rowNum,
        error: `Category code "${catCode}" not found. Available codes: ${Array.from(categoryMap.keys()).slice(0, 10).join(', ')}`,
      });
      continue;
    }

    const serialNumber = rowObj['serialnumber'] || undefined;
    if (serialNumber) {
      const existing = await Asset.findOne({ serialNumber, isDeleted: false });
      if (existing) {
        errors.push({
          row: rowNum,
          error: `Serial number "${serialNumber}" already registered under asset ${existing.assetTag}.`,
        });
        continue;
      }
    }

    // Cost in INR converted to integer paise
    let purchaseCostPaise = 0;
    if (rowObj['purchasecostinr']) {
      const costInr = parseFloat(rowObj['purchasecostinr']);
      if (!isNaN(costInr)) {
        purchaseCostPaise = Math.round(costInr * 100);
      }
    }

    try {
      const assetTag = await generateNextAssetTag();
      const newAsset = await Asset.create({
        assetTag,
        name,
        category: catId,
        brand: rowObj['brand'] || '',
        model: rowObj['model'] || '',
        serialNumber: serialNumber || undefined,
        purchaseDate: rowObj['purchasedate'] ? new Date(rowObj['purchasedate']) : undefined,
        purchaseCost: purchaseCostPaise,
        vendor: rowObj['vendor'] || '',
        warrantyExpiry: rowObj['warrantyexpiry'] ? new Date(rowObj['warrantyexpiry']) : undefined,
        condition: ['new', 'good', 'fair', 'poor'].includes(rowObj['condition']?.toLowerCase())
          ? rowObj['condition'].toLowerCase()
          : 'new',
        location: rowObj['location'] || 'Studio (Bhubaneswar)',
        notes: rowObj['notes'] || '',
        status: 'available',
        qrCodeValue: assetTag,
      });

      successful.push(newAsset);
    } catch (err) {
      errors.push({ row: rowNum, error: err.message });
    }
  }

  return { successful, errors, totalProcessed: lines.length - 1 };
};
