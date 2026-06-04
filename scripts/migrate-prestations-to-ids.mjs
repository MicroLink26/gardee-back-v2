/**
 * Migration : convertit les prestations stockées comme noms en ObjectIds de catégories.
 */
import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '../.env'), 'utf8');
const MONGO_URL = env.match(/^MONGO_URL=(.+)$/m)?.[1]?.trim();

if (!MONGO_URL) { console.error('MONGO_URL not found in .env'); process.exit(1); }

const client = new MongoClient(MONGO_URL);
await client.connect();
const db = client.db();

// 1. Charger toutes les catégories et construire le mapping nom → _id
const categories = await db.collection('categories').find().toArray();
const nameToId = {};
for (const cat of categories) {
  nameToId[cat.name] = cat._id.toString();
}
console.log(`${categories.length} catégories chargées`);

// 2. Trouver tous les prestataires avec au moins une prestation en nom
const prestataires = await db.collection('prestataires').find().toArray();
let migrated = 0;

for (const prest of prestataires) {
  const prestations = prest.prestations ?? [];
  const hasNames = prestations.some(p => nameToId[p]);
  if (!hasNames) continue;

  const converted = prestations.map(p => {
    if (nameToId[p]) return nameToId[p];   // nom → id
    return p;                               // déjà un id, conserver
  });

  await db.collection('prestataires').updateOne(
    { _id: prest._id },
    { $set: { prestations: converted } }
  );

  console.log(`  MIGRATED  ${prest._id}  ${JSON.stringify(prestations)} → ${JSON.stringify(converted)}`);
  migrated++;
}

console.log(`\nMigration terminée — ${migrated} prestataires mis à jour`);
await client.close();
