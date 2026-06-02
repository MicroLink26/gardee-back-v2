import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UploadedFile } from 'express-fileupload';
import { User } from '../models/User';
import { Prestataire } from '../models/Prestataire';
import { geocodeAddress } from '../utils/geocoding';
import { uploadProfileImage } from '../utils/fileUpload';
import { sendWelcomeEmail } from '../services/emailService';
import { serializeUser } from '../utils/serializeUser';
import { AuthRequest } from '../types';

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
    role: 'user',
    nom, prenom, telephone,
    cgu: body.cgu ?? false,
    consentDataProcessing: body.consentDataProcessing ?? false,
    is_validated: true,
  });

  const prestataire = await Prestataire.create({
    userId: user._id,
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
    is_validated: false,
  });

  if ((req as Request & { files?: Record<string, unknown> }).files?.photo) {
    const file = ((req as Request & { files?: Record<string, unknown> }).files as Record<string, UploadedFile>).photo;
    try {
      prestataire.profil_image = await uploadProfileImage(file, user._id.toString());
      await prestataire.save();
    } catch {
      // Photo upload failure is non-blocking
    }
  }

  geocodeAddress(prestataire.adresse, prestataire.codePostal, prestataire.ville).then(async (geo) => {
    if (geo) {
      prestataire.location = { type: 'Point', coordinates: [geo.lng, geo.lat] };
      prestataire.geocodeStatus = 'ok';
      prestataire.geocodedAt = new Date();
      await prestataire.save();
    }
  });

  await sendWelcomeEmail(user).catch(() => {});
  res.status(201).json({ ok: true, detail: 'Prestataire créé, en attente de validation.' });
}

export async function addPrestataireProfile(req: AuthRequest, res: Response): Promise<void> {
  if (req.prestataire) {
    res.status(409).json({ error: 'Vous avez déjà un profil prestataire' });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const prestataire = await Prestataire.create({
    userId: req.user!._id,
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
    is_validated: false,
  });
  res.status(201).json({ ok: true, prestataire, detail: 'Profil prestataire créé, en attente de validation.' });
}

export async function updateMyPrestataire(req: AuthRequest, res: Response): Promise<void> {
  if (!req.prestataire) {
    res.status(404).json({ error: 'Profil prestataire introuvable' });
    return;
  }
  const EDITABLE = ['prestations', 'tarifHoraire', 'description', 'adresse', 'codePostal',
    'ville', 'contactCom', 'materielOK', 'isEntrepreneur', 'siret', 'qualifElagage'];
  const body = req.body as Record<string, unknown>;
  const prest = req.prestataire;

  for (const field of EDITABLE) {
    if (body[field] !== undefined) {
      (prest as unknown as Record<string, unknown>)[field] = body[field];
    }
  }

  if ((req as Request & { files?: Record<string, unknown> }).files?.photo) {
    const file = ((req as Request & { files?: Record<string, unknown> }).files as Record<string, UploadedFile>).photo;
    prest.profil_image = await uploadProfileImage(file, req.user!._id.toString());
  }

  await prest.save();
  res.json({ user: serializeUser(req.user!, prest) });
}

export async function getPublicProfile(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'Prestataire introuvable' });
    return;
  }
  const prestataire = await Prestataire.findOne({ userId: user._id });
  if (!prestataire) {
    res.status(404).json({ error: 'Prestataire introuvable' });
    return;
  }
  const { passwordHash: _pw, ...safeUser } = user.toObject();
  res.json({ user: { ...safeUser, isPrestataire: true, prestataire: prestataire.toObject() } });
}

export async function searchPrestataires(req: Request, res: Response): Promise<void> {
  const { q, page = '1', pageSize = '20', sort, lat, lng, prestation, ville } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);

  const prestFilter: Record<string, unknown> = { is_validated: true };
  if (prestation) prestFilter.prestations = prestation;
  if (ville) prestFilter.ville = new RegExp(ville, 'i');

  if (sort === 'distance' && lat && lng) {
    prestFilter.location = {
      $near: {
        $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
      },
    };
  }

  let mongoSort: Record<string, 1 | -1> | undefined;
  if (sort === 'rating') mongoSort = { averageRating: -1, numberOfReviews: -1 };
  else if (sort === 'price_asc') mongoSort = { tarifHoraire: 1 };

  const baseQuery = Prestataire.find(prestFilter).populate<{ userId: { _id: string; nom: string; prenom: string; email: string } }>('userId', 'nom prenom email');

  // Text search on user fields is handled post-population (simple approach)
  let query = baseQuery;
  if (mongoSort) query = query.sort(mongoSort);

  const all = await query;

  const filtered = q
    ? all.filter(p => {
        const u = p.userId as { nom: string; prenom: string };
        const regex = new RegExp(q, 'i');
        return regex.test(u.nom) || regex.test(u.prenom) || regex.test(p.ville ?? '') || p.prestations.some(s => regex.test(s));
      })
    : all;

  const total = filtered.length;
  const items = filtered.slice(skip, skip + parseInt(pageSize)).map(p => {
    const u = p.userId as { _id: string; nom: string; prenom: string };
    return {
      _id: u._id,
      nom: u.nom,
      prenom: u.prenom,
      ville: p.ville,
      prestations: p.prestations,
      tarifHoraire: p.tarifHoraire,
      profil_image: p.profil_image,
      averageRating: p.averageRating,
      numberOfReviews: p.numberOfReviews,
      location: p.location,
    };
  });

  res.json({ items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
}

export async function getRanking(req: Request, res: Response): Promise<void> {
  const { prestation, ville, page = '1', pageSize = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);

  const filter: Record<string, unknown> = { is_validated: true };
  if (prestation) filter.prestations = prestation;
  if (ville) filter.ville = new RegExp(ville, 'i');

  const [prests, total] = await Promise.all([
    Prestataire.find(filter)
      .populate<{ userId: { _id: string; nom: string; prenom: string } }>('userId', 'nom prenom')
      .sort({ averageRating: -1, numberOfReviews: -1 })
      .skip(skip)
      .limit(parseInt(pageSize)),
    Prestataire.countDocuments(filter),
  ]);

  const items = prests.map(p => {
    const u = p.userId as { _id: string; nom: string; prenom: string };
    return {
      _id: u._id,
      nom: u.nom,
      prenom: u.prenom,
      ville: p.ville,
      prestations: p.prestations,
      tarifHoraire: p.tarifHoraire,
      profil_image: p.profil_image,
      averageRating: p.averageRating,
      numberOfReviews: p.numberOfReviews,
    };
  });

  res.json({ items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
}

export async function getReviews(req: Request, res: Response): Promise<void> {
  const { ServiceRequest } = await import('../models/ServiceRequest');
  const { id } = req.params;
  const { page = '1', pageSize = '10' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);

  const prestataire = await Prestataire.findOne({ userId: id })
    .populate<{ userId: { _id: string; nom: string; prenom: string } }>('userId', 'nom prenom');
  if (!prestataire) {
    res.status(404).json({ error: 'Prestataire introuvable' });
    return;
  }

  const filter = { prestataireId: id, ratingDetails: { $exists: true } };
  const [items, total] = await Promise.all([
    ServiceRequest.find(filter)
      .select('ratingDetails ratingComment recommend ratingGivenAt desiredAt prestations requesterPrenom requesterNom')
      .sort({ ratingGivenAt: -1 })
      .skip(skip)
      .limit(parseInt(pageSize)),
    ServiceRequest.countDocuments(filter),
  ]);

  const u = prestataire.userId as { _id: string; nom: string; prenom: string };
  res.json({
    prestataire: { _id: u._id, nom: u.nom, prenom: u.prenom, averageRating: prestataire.averageRating, numberOfReviews: prestataire.numberOfReviews },
    items, total, page: parseInt(page), pageSize: parseInt(pageSize),
  });
}

export async function geocodePrestataire(req: Request, res: Response): Promise<void> {
  const prestataire = await Prestataire.findOne({ userId: req.params.id });
  if (!prestataire) {
    res.status(404).json({ error: 'Prestataire introuvable' });
    return;
  }
  const geo = await geocodeAddress(prestataire.adresse, prestataire.codePostal, prestataire.ville);
  if (geo) {
    prestataire.location = { type: 'Point', coordinates: [geo.lng, geo.lat] };
    prestataire.geocodeStatus = 'ok';
  } else {
    prestataire.geocodeStatus = 'not_found';
  }
  prestataire.geocodedAt = new Date();
  await prestataire.save();
  res.json({ ok: true, id: prestataire.userId, location: prestataire.location });
}
