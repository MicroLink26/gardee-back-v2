import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UploadedFile } from 'express-fileupload';
import { User } from '../models/User';
import { geocodeAddress } from '../utils/geocoding';
import { uploadProfileImage } from '../utils/fileUpload';
import { sendWelcomeEmail } from '../services/emailService';
import { AuthRequest } from '../types';

const PRESTATAIRE_EDITABLE_FIELDS = [
  'email', 'nom', 'prenom', 'telephone', 'prestations', 'tarifHoraire',
  'description', 'adresse', 'codePostal', 'ville', 'contactCom',
  'materielOK', 'isEntrepreneur', 'siret', 'qualifElagage', 'consentDataProcessing',
];

const CLIENT_EDITABLE_FIELDS = ['nom', 'prenom', 'telephone', 'consentDataProcessing'];

export async function registerPrestataire(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const { email, password, nom, prenom, telephone } = body;

  if (!email || !password || !nom || !prenom || !telephone) {
    res.status(400).json({ error: 'Champs obligatoires manquants' });
    return;
  }

  const exists = await User.findOne({ email: (email as string).toLowerCase() });
  if (exists) {
    res.status(409).json({ error: 'Email déjà utilisé' });
    return;
  }

  const passwordHash = await bcrypt.hash(password as string, 12);
  const user = await User.create({
    email: (email as string).toLowerCase(),
    passwordHash,
    role: 'prestataire',
    nom, prenom, telephone,
    prestations: body.prestations ?? [],
    tarifHoraire: body.tarifHoraire,
    description: body.description,
    adresse: body.adresse,
    codePostal: body.codePostal,
    ville: body.ville,
    contactCom: body.contactCom ?? false,
    materielOK: body.materielOK ?? false,
    isEntrepreneur: body.isEntrepreneur ?? false,
    siret: body.siret,
    qualifElagage: body.qualifElagage ?? false,
    cgu: body.cgu ?? false,
    consentDataProcessing: body.consentDataProcessing ?? false,
    is_validated: false,
  });

  if (req.files?.photo) {
    const file = req.files.photo as UploadedFile;
    try {
      user.profil_image = await uploadProfileImage(file, user._id.toString());
      await user.save();
    } catch {
      // Photo upload failure is non-blocking
    }
  }

  // Geocode asynchronously
  geocodeAddress(user.adresse, user.codePostal, user.ville).then(async (geo) => {
    if (geo) {
      user.location = { type: 'Point', coordinates: [geo.lng, geo.lat] };
      user.geocodeStatus = 'ok';
      user.geocodedAt = new Date();
      await user.save();
    }
  });

  await sendWelcomeEmail(user).catch(() => {});
  res.status(201).json({ ok: true, detail: 'Prestataire créé.' });
}

export async function registerClient(req: Request, res: Response): Promise<void> {
  const { email, password, nom, prenom, telephone } = req.body as Record<string, string>;

  if (!email || !password || !nom || !prenom || !telephone) {
    res.status(400).json({ error: 'Champs obligatoires manquants' });
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
    role: 'client',
    nom, prenom, telephone,
    is_validated: true,
    cgu: true,
    consentDataProcessing: req.body.consentDataProcessing ?? false,
  });

  res.status(201).json({ ok: true, detail: 'Compte client créé.' });
}

export async function getMyProfile(req: AuthRequest, res: Response): Promise<void> {
  const { passwordHash: _pw, ...safe } = req.user!.toObject();
  res.json({ user: safe });
}

export async function updateMyProfile(req: AuthRequest, res: Response): Promise<void> {
  const user = req.user!;
  const body = req.body as Record<string, unknown>;
  const allowedFields = user.role === 'prestataire' ? PRESTATAIRE_EDITABLE_FIELDS : CLIENT_EDITABLE_FIELDS;

  if (body.email && body.email !== user.email) {
    const taken = await User.findOne({ email: (body.email as string).toLowerCase() });
    if (taken) {
      res.status(409).json({ error: 'Email déjà utilisé' });
      return;
    }
  }

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      (user as unknown as Record<string, unknown>)[field] = field === 'email'
        ? (body[field] as string).toLowerCase()
        : body[field];
    }
  }

  if (req.files?.photo) {
    const file = req.files.photo as UploadedFile;
    user.profil_image = await uploadProfileImage(file, user._id.toString());
  }

  await user.save();
  const { passwordHash: _pw, ...safe } = user.toObject();
  res.json({ user: safe });
}

export async function getPublicProfile(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.params.id).select('-passwordHash');
  if (!user) {
    res.status(404).json({ error: 'Prestataire introuvable' });
    return;
  }
  res.json({ user });
}

export async function searchPrestataires(req: Request, res: Response): Promise<void> {
  const { q, page = '1', pageSize = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);

  const filter: Record<string, unknown> = { role: 'prestataire', is_validated: true };
  if (q) {
    const regex = new RegExp(q, 'i');
    filter.$or = [{ nom: regex }, { prenom: regex }, { ville: regex }, { prestations: regex }];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select('nom prenom ville prestations tarifHoraire profil_image averageRating numberOfReviews location')
      .skip(skip)
      .limit(parseInt(pageSize)),
    User.countDocuments(filter),
  ]);

  res.json({ items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
}

export async function getRanking(req: Request, res: Response): Promise<void> {
  const { prestation, ville, page = '1', pageSize = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);

  const filter: Record<string, unknown> = { role: 'prestataire', is_validated: true };
  if (prestation) filter.prestations = prestation;
  if (ville) filter.ville = new RegExp(ville, 'i');

  const [items, total] = await Promise.all([
    User.find(filter)
      .select('nom prenom ville prestations tarifHoraire profil_image averageRating numberOfReviews location')
      .sort({ averageRating: -1, numberOfReviews: -1 })
      .skip(skip)
      .limit(parseInt(pageSize)),
    User.countDocuments(filter),
  ]);

  res.json({ items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
}

export async function getReviews(req: Request, res: Response): Promise<void> {
  const { ServiceRequest } = await import('../models/ServiceRequest');
  const { id } = req.params;
  const { page = '1', pageSize = '10' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);

  const prestataire = await User.findById(id).select('nom prenom averageRating numberOfReviews');
  if (!prestataire) {
    res.status(404).json({ error: 'Prestataire introuvable' });
    return;
  }

  const filter = { prestataireId: id, 'ratingDetails': { $exists: true } };
  const [items, total] = await Promise.all([
    ServiceRequest.find(filter)
      .select('ratingDetails ratingComment recommend ratingGivenAt desiredAt prestations')
      .sort({ ratingGivenAt: -1 })
      .skip(skip)
      .limit(parseInt(pageSize)),
    ServiceRequest.countDocuments(filter),
  ]);

  res.json({ prestataire, items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
}

export async function geocodeUser(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  const geo = await geocodeAddress(user.adresse, user.codePostal, user.ville);
  if (geo) {
    user.location = { type: 'Point', coordinates: [geo.lng, geo.lat] };
    user.geocodeStatus = 'ok';
  } else {
    user.geocodeStatus = 'not_found';
  }
  user.geocodedAt = new Date();
  await user.save();
  res.json({ ok: true, id: user._id, location: user.location });
}
