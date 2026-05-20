import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '../.env'), 'utf8');
const MONGO_URL = env.match(/^MONGO_URL=(.+)$/m)?.[1]?.trim();

if (!MONGO_URL) { console.error('MONGO_URL not found in .env'); process.exit(1); }

const CATEGORIES = [
  { _id: '68cbf2631d630ebaab3e9235', name: 'Entretien des espaces vert',                               description: 'Entretien des espaces vert' },
  { _id: '68cbf2631d630ebaab3e9236', name: 'Nettoyage et entretien de piscine',                        description: '' },
  { _id: '68cbf2631d630ebaab3e9237', name: 'Travaux légers de bricolage',                              description: '' },
  { _id: '68cbf2631d630ebaab3e9238', name: 'Nettoyage spécialisé (inclut le néttoyage haute pression)', description: '' },
  { _id: '68cbf2631d630ebaab3e9239', name: 'Élagage',                                                   description: '' },
  { _id: '68cbf2631d630ebaab3e923a', name: 'Paysagiste',                                                description: '' },
  { _id: '68cbf2631d630ebaab3e923b', name: 'Jardinage entre voisins (hors professionnel)',              description: '' },
];

const client = new MongoClient(MONGO_URL);
await client.connect();
console.log('Connected to MongoDB\n');

const db = client.db();
const col = db.collection('categories');

let inserted = 0, skipped = 0;

for (const cat of CATEGORIES) {
  const id = new ObjectId(cat._id);
  const exists = await col.findOne({ _id: id });
  if (exists) {
    console.log(`  SKIP    ${cat.name}`);
    skipped++;
  } else {
    await col.insertOne({ _id: id, name: cat.name, description: cat.description, createdAt: new Date(), updatedAt: new Date() });
    console.log(`  INSERT  ${cat.name}`);
    inserted++;
  }
}

console.log(`\nDone — ${inserted} inserted, ${skipped} already present`);
await client.close();
