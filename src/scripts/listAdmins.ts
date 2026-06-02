import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';

async function run() {
  await connectDB();
  const db = mongoose.connection.db!;

  const admins = await db.collection('users').find({ role: { $in: ['admin', 'staff'] } }).toArray();
  console.log('Comptes admin/staff :');
  for (const u of admins) {
    const prest = await db.collection('prestataires').findOne({ userId: u._id });
    console.log(`  ${u.role.padEnd(6)} | ${u.email} | prestataire: ${prest ? 'OUI' : 'non'}`);
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
