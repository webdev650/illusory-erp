import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const COLLECTIONS_TO_BACKUP = [
  'users',
  'roles',
  'employees',
  'departments',
  'shifts',
  'attendances',
  'leaverequests',
  'leavebalances',
  'holidays',
  'announcements',
  'clients',
  'projects',
  'tasks',
  'timeentries',
  'timesheets',
  'assets',
  'assetcategories',
  'assetassignments',
  'assetrequests',
  'maintenancerecords',
  'softwarelicenses',
  'userpreferences',
  'workflowconfigs',
  'approvalrequests',
  'counters',
  'auditlogs',
];

const runBackup = async () => {
  console.log('\n📦 ====================================================');
  console.log('📦 Starting Illusory ERP Database Backup Process...');
  console.log('📦 ====================================================\n');

  try {
    await connectDB();

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19);

    const backupDir = path.resolve(__dirname, `../../backups/backup-${timestamp}`);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const db = mongoose.connection.db;
    const stats = [];
    let totalDocs = 0;

    for (const collName of COLLECTIONS_TO_BACKUP) {
      try {
        const collection = db.collection(collName);
        const docs = await collection.find({}).toArray();

        const filePath = path.join(backupDir, `${collName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');

        stats.push({ collection: collName, count: docs.length });
        totalDocs += docs.length;
        console.log(`  ✓ Exported ${collName.padEnd(22)}: ${docs.length} document(s)`);
      } catch (collErr) {
        console.warn(`  ⚠️ Could not export ${collName}: ${collErr.message}`);
      }
    }

    // Write metadata manifest
    const manifest = {
      backupDate: new Date().toISOString(),
      timestamp,
      environment: process.env.NODE_ENV || 'production',
      database: db.databaseName,
      totalCollections: stats.length,
      totalDocuments: totalDocs,
      collections: stats,
      atlasBackupInstructions: {
        title: 'How to Enable Automated Backups in MongoDB Atlas (Recommended for Production)',
        steps: [
          '1. Log into your MongoDB Atlas Console at https://cloud.mongodb.com',
          '2. Navigate to your cluster (e.g. Cluster0)',
          '3. Click on the "Backup" tab on your Cluster dashboard',
          '4. Enable "Cloud Backup" (Continuous cloud provider snapshots)',
          '5. Configure your Snapshot Schedule (e.g., Every 6 Hours, Retain 7 Days) and Point-In-Time Restore (PITR)',
          '6. Test a point-in-time snapshot restore on a staging cluster every quarter.',
        ],
      },
    };

    fs.writeFileSync(
      path.join(backupDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    console.log('\n====================================================');
    console.log(`✅ Backup successfully completed!`);
    console.log(`📁 Directory: ${backupDir}`);
    console.log(`📊 Total Documents Saved: ${totalDocs}`);
    console.log('====================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Backup failed with error:', err);
    process.exit(1);
  }
};

runBackup();
