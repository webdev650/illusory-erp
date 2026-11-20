import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import {
  previewEmployeeImport,
  commitEmployeeImport,
} from '../services/employeeImport.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const runCLI = async () => {
  const args = process.argv.slice(2);
  let filePath = '';
  let isDryRun = false;
  let isCommit = false;
  let isOverwrite = false;

  args.forEach((arg) => {
    if (arg.startsWith('--file=')) {
      filePath = arg.replace('--file=', '').trim();
    } else if (arg === '--dry-run') {
      isDryRun = true;
    } else if (arg === '--commit') {
      isCommit = true;
    } else if (arg === '--overwrite') {
      isOverwrite = true;
    }
  });

  // Default file fallback
  if (!filePath) {
    const candidates = [
      path.resolve(__dirname, '../../data/imports/CRM_IDS_EMPLOYEE_DATA.xlsx'),
      path.resolve(__dirname, '../../../CRM IDS EPMLOYEE DATA.xlsx'),
      path.resolve(__dirname, '../../data/imports/CRM IDS EPMLOYEE DATA.xlsx'),
    ];
    for (const c of candidates) {
      if (import('fs').then((fs) => fs.existsSync(c))) {
        filePath = c;
        break;
      }
    }
  }

  if (!filePath) {
    filePath = path.resolve(__dirname, '../../data/imports/CRM_IDS_EMPLOYEE_DATA.xlsx');
  }

  if (!isDryRun && !isCommit) {
    console.log('\n❌ Please specify either --dry-run or --commit');
    console.log('Usage: npm run import:employees -- --file=<path> --dry-run');
    console.log('       npm run import:employees -- --file=<path> --commit [--overwrite]\n');
    process.exit(1);
  }

  console.log('\n📂 =======================================================');
  console.log(`📂 Illusory ERP — Employee Excel Import CLI`);
  console.log(`📁 File Target : ${filePath}`);
  console.log(`⚙️ Mode        : ${isCommit ? 'COMMIT (Write to Database)' : 'DRY RUN (Preview Only)'}`);
  console.log('=======================================================\n');

  try {
    await connectDB();

    if (isDryRun) {
      console.log('🔍 Analyzing workbook sheets and row validations...\n');
      const preview = await previewEmployeeImport(filePath);

      console.log('📊 IMPORT SUMMARY:');
      console.log(`   - Total Rows Found     : ${preview.totalRows}`);
      console.log(`   - Will Create (New)    : ${preview.willCreateCount}`);
      console.log(`   - Will Update (Exists) : ${preview.willUpdateCount}`);
      console.log(`   - Skipped / Errors     : ${preview.skippedCount}`);
      console.log(`   - Total Warnings       : ${preview.warningsCount}`);
      console.log(`   - Total Fatal Errors   : ${preview.errorsCount}\n`);

      console.log('📑 PER-SHEET BREAKDOWN:');
      preview.sheets.forEach((sheet) => {
        console.log(`\n  Sheet: [${sheet.sheetName}] (Mapped Role: ${sheet.role}) — ${sheet.rows.length} row(s)`);
        console.log('  ' + '-'.repeat(75));
        sheet.rows.forEach((r) => {
          console.log(
            `   Row ${String(r.rowNumber).padEnd(2)} | Action: ${r.action.padEnd(7)} | Code: ${(r.employeeCode || '-').padEnd(16)} | Name: ${(r.displayName || '-').padEnd(20)} | Email: ${r.officialEmail}`
          );
          if (r.warnings && r.warnings.length) {
            r.warnings.forEach((w) => console.log(`         ⚠️  ${w}`));
          }
          if (r.errors && r.errors.length) {
            r.errors.forEach((e) => console.log(`         ❌  ${e}`));
          }
        });
      });

      console.log('\n=======================================================');
      console.log('✅ DRY RUN FINISHED. No changes were saved to the database.');
      console.log('👉 To write changes, re-run with: npm run import:employees -- --file=<path> --commit');
      console.log('=======================================================\n');
      process.exit(0);
    }

    if (isCommit) {
      console.log('💾 Processing import & generating secure credentials...\n');
      const result = await commitEmployeeImport(filePath, { overwrite: isOverwrite });

      console.log('\n=======================================================');
      console.log('🎉 EMPLOYEE IMPORT COMPLETED SUCCESSFULLY!');
      console.log('=======================================================');
      console.log(`  ✓ Employees Created (New) : ${result.createdCount}`);
      console.log(`  ✓ Employees Updated       : ${result.updatedCount}`);
      console.log(`  ✓ Skipped Records         : ${result.skippedCount}`);
      console.log(`  ✓ Total Processed         : ${result.totalProcessed}`);

      if (result.managersNotFound.length > 0) {
        console.log('\n⚠️  MANAGERS NOT FOUND IN IMPORT (Set manually in HRMS):');
        result.managersNotFound.forEach((m) => {
          console.log(`   - Employee: ${m.employeeName} (${m.employeeCode}) -> Requested Manager: "${m.managerName}"`);
        });
      }

      console.log('\n🔐 SECURITY & CREDENTIALS:');
      console.log(`  📄 Output Credentials Report: ${result.reportFilePath}`);
      console.log('  ⚠️  Note: Passwords and sensitive PII are never printed to terminal logs.');
      console.log('  🔑 Temporary passwords have been generated with mustChangePassword = true.');
      console.log('=======================================================\n');

      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Import process failed:', error);
    process.exit(1);
  }
};

runCLI();
