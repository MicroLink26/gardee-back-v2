import mongoose from 'mongoose';
import { Category } from '../src/models/Category';
import * as dotenv from 'dotenv';

dotenv.config();

const CATEGORIES = [
  { _id: '68cbf2631d630ebaab3e9235', name: 'Entretien des espaces vert',                              description: 'Entretien des espaces vert' },
  { _id: '68cbf2631d630ebaab3e9236', name: 'Nettoyage et entretien de piscine',                       description: '' },
  { _id: '68cbf2631d630ebaab3e9237', name: 'Travaux légers de bricolage',                             description: '' },
  { _id: '68cbf2631d630ebaab3e9238', name: 'Nettoyage spécialisé (inclut le néttoyage haute pression)', description: '' },
  { _id: '68cbf2631d630ebaab3e9239', name: 'Élagage',                                                  description: '' },
  { _id: '68cbf2631d630ebaab3e923a', name: 'Paysagiste',                                               description: '' },
  { _id: '68cbf2631d630ebaab3e923b', name: 'Jardinage entre voisins (hors professionnel)',             description: '' },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URL!);
  console.log('Connected to MongoDB');

  let inserted = 0;
  let skipped = 0;

  for (const cat of CATEGORIES) {
    const exists = await Category.findById(cat._id);
    if (exists) {
      console.log(`  SKIP  ${cat.name}`);
      skipped++;
    } else {
      await Category.create({ _id: new mongoose.Types.ObjectId(cat._id), name: cat.name, description: cat.description });
      console.log(`  INSERT ${cat.name}`);
      inserted++;
    }
  }

  console.log(`\nDone — ${inserted} inserted, ${skipped} skipped`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
