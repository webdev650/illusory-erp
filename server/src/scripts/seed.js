// src/scripts/seed.js
// Run with: npm run seed
// Creates the initial CEO / SUPER_ADMIN account from your .env values.
// Safe to run multiple times — it checks if the user already exists.
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User, ROLES } from '../modules/auth/User.model.js';
import { env } from '../config/env.js';

const seed = async () => {
  await connectDB();

  const existing = await User.findOne({ email: env.ceo.email });
  if (existing) {
    console.log(`ℹ️  CEO account already exists: ${env.ceo.email}`);
    await mongoose.disconnect();
    return;
  }

  const ceo = await User.create({
    name: env.ceo.name,
    email: env.ceo.email,
    password: env.ceo.password,
    role: ROLES.SUPER_ADMIN,
  });

  console.log(`✅  CEO account created!`);
  console.log(`    Email: ${ceo.email}`);
  console.log(`    Role : ${ceo.role}`);
  console.log(`    ID   : ${ceo._id}`);
  console.log(`\n⚠️  Change CEO_PASSWORD in .env immediately after first login!`);

  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
