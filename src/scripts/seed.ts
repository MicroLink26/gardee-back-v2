import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';

async function seed() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    console.error('MONGO_URL manquant dans .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  console.log('Connecté à MongoDB');

  // Admin
  const existingAdmin = await User.findOne({ email: 'admin@gardee.fr' });
  if (!existingAdmin) {
    await User.create({
      email: 'admin@gardee.fr',
      passwordHash: await bcrypt.hash('Admin123!', 10),
      role: 'admin',
      nom: 'Admin',
      prenom: 'Gardee',
      telephone: '0600000000',
      prestations: [],
      contactCom: false,
      materielOK: false,
      is_validated: true,
      cgu: true,
    });
    console.log('✓ Admin créé : admin@gardee.fr / Admin123!');
  } else {
    console.log('→ Admin existe déjà');
  }

  // Client test
  const existingClient = await User.findOne({ email: 'client@test.fr' });
  if (!existingClient) {
    await User.create({
      email: 'client@test.fr',
      passwordHash: await bcrypt.hash('Client123!', 10),
      role: 'client',
      nom: 'Dupont',
      prenom: 'Jean',
      telephone: '0611111111',
      prestations: [],
      contactCom: false,
      materielOK: false,
      is_validated: true,
      cgu: true,
    });
    console.log('✓ Client test créé : client@test.fr / Client123!');
  } else {
    console.log('→ Client test existe déjà');
  }

  // Prestataire test (pré-validé)
  const existingPrest = await User.findOne({ email: 'prest@test.fr' });
  if (!existingPrest) {
    await User.create({
      email: 'prest@test.fr',
      passwordHash: await bcrypt.hash('Prest123!', 10),
      role: 'prestataire',
      nom: 'Martin',
      prenom: 'Pierre',
      telephone: '0622222222',
      prestations: ['Tonte', 'Taille de haies', 'Débroussaillage'],
      tarifHoraire: 35,
      description: 'Jardinier professionnel avec 10 ans d\'expérience.',
      ville: 'Lyon',
      codePostal: '69001',
      adresse: '1 place Bellecour',
      contactCom: true,
      materielOK: true,
      is_validated: true,
      cgu: true,
    });
    console.log('✓ Prestataire test créé : prest@test.fr / Prest123!');
  } else {
    console.log('→ Prestataire test existe déjà');
  }

  await mongoose.disconnect();
  console.log('\nSeed terminé !');
}

seed().catch(err => { console.error(err); process.exit(1); });
