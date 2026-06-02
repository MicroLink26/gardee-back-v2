import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Prestataire } from '../models/Prestataire';
import { serializeUser } from '../utils/serializeUser';
import { AuthRequest } from '../types';

const USER_EDITABLE_FIELDS = ['email', 'nom', 'prenom', 'telephone', 'consentDataProcessing'];

export async function registerClient(req: Request, res: Response): Promise<void> {
  const { email, password, nom, prenom, telephone } = req.body as Record<string, string>;

  if (!email || !password || !nom || !prenom || !telephone) {
    res.status(400).json({ error: 'Champs obligatoires manquants' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    return;
  }
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    res.status(409).json({ error: 'Email déjà utilisé' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({
    email: email.toLowerCase(),
    passwordHash,
    role: 'user',
    nom, prenom, telephone,
    cgu: true,
    consentDataProcessing: req.body.consentDataProcessing ?? false,
    is_validated: true,
  });

  res.status(201).json({ ok: true, detail: 'Compte créé.' });
}

export async function getMyProfile(req: AuthRequest, res: Response): Promise<void> {
  res.json({ user: serializeUser(req.user!, req.prestataire) });
}

export async function updateMyProfile(req: AuthRequest, res: Response): Promise<void> {
  const user = req.user!;
  const body = req.body as Record<string, unknown>;

  if (body.email && body.email !== user.email) {
    const taken = await User.findOne({ email: (body.email as string).toLowerCase() });
    if (taken) {
      res.status(409).json({ error: 'Email déjà utilisé' });
      return;
    }
  }

  for (const field of USER_EDITABLE_FIELDS) {
    if (body[field] !== undefined) {
      (user as unknown as Record<string, unknown>)[field] = field === 'email'
        ? (body[field] as string).toLowerCase()
        : body[field];
    }
  }
  await user.save();

  // Also update prestataire fields if the user has a prestataire profile
  if (req.prestataire) {
    const PREST_EDITABLE = ['prestations', 'tarifHoraire', 'description', 'adresse', 'codePostal',
      'ville', 'contactCom', 'materielOK', 'isEntrepreneur', 'siret', 'qualifElagage'];
    const prest = req.prestataire;
    let changed = false;
    for (const field of PREST_EDITABLE) {
      if (body[field] !== undefined) {
        (prest as unknown as Record<string, unknown>)[field] = body[field];
        changed = true;
      }
    }
    if (changed) await prest.save();
  }

  const updatedPrestataire = req.prestataire
    ? await Prestataire.findOne({ userId: user._id })
    : null;
  res.json({ user: serializeUser(user, updatedPrestataire) });
}
