import { Request, Response } from 'express';

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
import bcrypt from 'bcryptjs';
import { UploadedFile } from 'express-fileupload';
import { User } from '../models/User';
import { Prestataire } from '../models/Prestataire';
import { geocodeAddress } from '../utils/geocoding';
import { uploadProfileImage } from '../utils/fileUpload';
import { sendEmailVerificationCode } from '../services/emailService';
import { serializeUser } from '../utils/serializeUser';
import { AuthRequest } from '../types';
import { validateEmail, validateTextField } from '../utils/validation';
import { logEmailError, logMessageActionError } from '../utils/logger';

function toArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  return [String(v)];
}

export async function registerPrestataire(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;

  if (!body.email || !body.password || !body.nom || !body.prenom || !body.telephone) {
    res.status(400).json({ error: 'Champs obligatoires manquants' });
    return;
  }

  const emailValidation = validateEmail(body.email);
  if (!emailValidation.valid) {
    res.status(400).json({ error: emailValidation.error });
    return;
  }

  const nomValidation = validateTextField(body.nom, 'Nom', 1, 100);
  if (!nomValidation.valid) {
    res.status(400).json({ error: nomValidation.error });
    return;
  }

  const prenomValidation = validateTextField(body.prenom, 'Prénom', 1, 100);
  if (!prenomValidation.valid) {
    res.status(400).json({ error: prenomValidation.error });
    return;
  }

  const phoneValidation = validateTextField(body.telephone, 'Téléphone', 1, 20);
  if (!phoneValidation.valid) {
    res.status(400).json({ error: phoneValidation.error });
    return;
  }

  try {
    const email = (body.email as string).toLowerCase();
    const exists = await User.findOne({ email });
    if (exists?.bannedPermanently) {
      res.status(403).json({ error: 'Cette adresse email ne peut plus être utilisée sur Gardee.' });
      return;
    }
    if (exists) {
      res.status(409).json({ error: 'Email déjà utilisé' });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password as string, 12);
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const user = await User.create({
      email,
      passwordHash,
      role: 'user',
      nom: (body.nom as string).trim(),
      prenom: (body.prenom as string).trim(),
      telephone: (body.telephone as string).trim(),
      cgu: body.cgu ?? false,
      consentDataProcessing: body.consentDataProcessing ?? false,
      is_validated: true,
      emailVerified: false,
      emailVerificationCode: verificationCode,
      emailVerificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const prestataire = await Prestataire.create({
      userId: user._id,
      prestations: toArray(body.prestations),
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

    await sendEmailVerificationCode(user, verificationCode).catch((err) => {
      logEmailError('registerPrestataire: Failed to send verification code', user._id.toString(), user._id.toString(), email, err);
    });
    res.status(201).json({ ok: true, requiresVerification: true, userId: user._id.toString(), detail: 'Prestataire créé — vérifiez votre email.' });
  } catch (error) {
    logMessageActionError('registerPrestataire: Failed to register', undefined, undefined, error);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
}

export async function addPrestataireProfile(req: AuthRequest, res: Response): Promise<void> {
  if (req.prestataire) {
    res.status(409).json({ error: 'Vous avez déjà un profil prestataire' });
    return;
  }

  try {
    const body = req.body as Record<string, unknown>;
    const prestataire = await Prestataire.create({
      userId: req.user!._id,
      prestations: toArray(body.prestations),
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
  } catch (error) {
    logMessageActionError('addPrestataireProfile: Failed to create prestataire profile', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la création du profil' });
  }
}

export async function updateMyPrestataire(req: AuthRequest, res: Response): Promise<void> {
  if (!req.prestataire) {
    res.status(404).json({ error: 'Profil prestataire introuvable' });
    return;
  }

  try {
    const EDITABLE = ['prestations', 'tarifHoraire', 'description', 'adresse', 'codePostal',
      'ville', 'contactCom', 'materielOK', 'isEntrepreneur', 'siret', 'qualifElagage'];
    const REVALIDATION_FIELDS = ['prestations', 'tarifHoraire', 'description', 'isEntrepreneur', 'siret', 'qualifElagage'];
    const body = req.body as Record<string, unknown>;
    const prest = req.prestataire;

    let needsRevalidation = false;
    for (const field of EDITABLE) {
      if (body[field] !== undefined) {
        const value = field === 'prestations' ? toArray(body[field]) : body[field];
        (prest as unknown as Record<string, unknown>)[field] = value;
        if (REVALIDATION_FIELDS.includes(field)) needsRevalidation = true;
      }
    }

    if ((req as Request & { files?: Record<string, unknown> }).files?.photo) {
      const file = ((req as Request & { files?: Record<string, unknown> }).files as Record<string, UploadedFile>).photo;
      prest.profil_image = await uploadProfileImage(file, req.user!._id.toString());
      needsRevalidation = true;
    }

    if (needsRevalidation && prest.is_validated) {
      prest.is_validated = false;
    }

    await prest.save();
    res.json({ user: serializeUser(req.user!, prest), revalidationRequired: needsRevalidation });
  } catch (error) {
    logMessageActionError('updateMyPrestataire: Failed to update prestataire profile', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
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
  if (prestation) {
    const { Category } = await import('../models/Category');
    const cat = await Category.findById(prestation).select('name');
    prestFilter.prestations = cat ? { $in: [prestation, cat.name] } : prestation;
  }
  if (ville) prestFilter.ville = new RegExp(escapeRegExp(ville), 'i');

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

  let query = Prestataire.find(prestFilter)
    .populate<{ userId: { _id: string; nom: string; prenom: string; email: string } }>('userId', 'nom prenom email');

  if (mongoSort) query = query.sort(mongoSort);

  // Count total before pagination
  const total = await Prestataire.countDocuments(prestFilter);

  // Apply pagination at database level for performance
  query = query.skip(skip).limit(parseInt(pageSize));

  const all = await query;

  const filtered = q
    ? all.filter(p => {
        const u = p.userId as { nom: string; prenom: string };
        const regex = new RegExp(q, 'i');
        return regex.test(u.nom) || regex.test(u.prenom) || regex.test(p.ville ?? '') || p.prestations.some(s => regex.test(s));
      })
    : all;

  const items = filtered.map(p => {
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
  if (prestation) {
    const { Category } = await import('../models/Category');
    const cat = await Category.findById(prestation).select('name');
    filter.prestations = cat ? { $in: [prestation, cat.name] } : prestation;
  }
  if (ville) filter.ville = new RegExp(escapeRegExp(ville), 'i');

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
      location: p.location,
    };
  });

  res.json({ items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
}

export async function getReviews(req: Request, res: Response): Promise<void> {
  try {
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

    const filter = { prestataireId: id, ratingDetails: { $exists: true }, reviewApproved: { $ne: false } };
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
  } catch (error) {
    logMessageActionError('getReviews: Failed to fetch reviews', undefined, undefined, error);
    res.status(500).json({ error: 'Erreur lors de la récupération des avis' });
  }
}

export async function deleteMyPrestataire(req: AuthRequest, res: Response): Promise<void> {
  if (!req.prestataire) {
    res.status(404).json({ error: 'Profil prestataire introuvable' });
    return;
  }
  await req.prestataire.deleteOne();
  res.json({ ok: true, detail: 'Profil prestataire supprimé.' });
}

export async function getAllPrestataireIds(req: Request, res: Response): Promise<void> {
  const prests = await Prestataire.find({ is_validated: true })
    .populate<{ userId: { _id: string } }>('userId', '_id')
    .select('userId');
  const ids = prests.map(p => (p.userId as unknown as { _id: string })._id.toString());
  res.json({ ids });
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
