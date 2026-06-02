/**
 * Migration v2.2 → v3.0 : split User en User + Prestataire
 *
 * Pour chaque User avec role='prestataire' ou role='client' :
 *   - role='prestataire' → crée un document Prestataire + change role en 'user'
 *   - role='client'      → change role en 'user'
 *
 * Exécution : npx tsx src/scripts/migrate.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';

async function migrate() {
  await connectDB();

  // Use raw mongoose access to avoid model validation issues with old schema
  const db = mongoose.connection.db!;
  const usersCol = db.collection('users');
  const prestCol = db.collection('prestataires');

  const users = await usersCol.find({}).toArray();
  console.log(`Total users: ${users.length}`);

  let migratedPrestataires = 0;
  let migratedClients = 0;
  let skipped = 0;

  for (const user of users) {
    if (user.role === 'prestataire') {
      // Check if Prestataire doc already exists
      const exists = await prestCol.findOne({ userId: user._id });
      if (!exists) {
        await prestCol.insertOne({
          _id: new mongoose.Types.ObjectId(),
          userId: user._id,
          prestations: user.prestations ?? [],
          tarifHoraire: user.tarifHoraire,
          description: user.description,
          adresse: user.adresse,
          codePostal: user.codePostal,
          ville: user.ville,
          contactCom: user.contactCom ?? false,
          materielOK: user.materielOK ?? false,
          isEntrepreneur: user.isEntrepreneur ?? false,
          siret: user.siret,
          qualifElagage: user.qualifElagage ?? false,
          cgu: user.cgu ?? false,
          profil_image: user.profil_image,
          is_validated: user.is_validated ?? false,
          location: user.location,
          geocodeStatus: user.geocodeStatus ?? 'pending',
          geocodedAt: user.geocodedAt,
          averageRating: user.averageRating ?? 0,
          numberOfReviews: user.numberOfReviews ?? 0,
          createdAt: user.createdAt ?? new Date(),
          updatedAt: new Date(),
        });
        migratedPrestataires++;
        console.log(`  ✓ Prestataire créé pour ${user.email}`);
      } else {
        console.log(`  ~ Prestataire déjà existant pour ${user.email}`);
      }

      // Update user role
      await usersCol.updateOne({ _id: user._id }, { $set: { role: 'user' } });

    } else if (user.role === 'client') {
      await usersCol.updateOne({ _id: user._id }, { $set: { role: 'user' } });
      migratedClients++;
      console.log(`  ✓ Client → user : ${user.email}`);

    } else if (user.role === 'user' || user.role === 'staff' || user.role === 'admin') {
      skipped++;
    } else {
      console.log(`  ? Rôle inconnu pour ${user.email}: ${user.role}`);
    }
  }

  console.log('\n=== Migration terminée ===');
  console.log(`Prestataires créés : ${migratedPrestataires}`);
  console.log(`Clients migrés     : ${migratedClients}`);
  console.log(`Déjà migrés / admin: ${skipped}`);

  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
