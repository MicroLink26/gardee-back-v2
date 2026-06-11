import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Prestataire } from '../models/Prestataire';
import { serializeUser } from '../utils/serializeUser';
import { AuthRequest } from '../types';
import { validateEmail, validatePassword, validateTextField, validateNumber } from '../utils/validation';
import { logEmailError, logMessageActionError } from '../utils/logger';

const USER_EDITABLE_FIELDS = ['email', 'nom', 'prenom', 'telephone', 'consentDataProcessing'];

export async function registerClient(req: Request, res: Response): Promise<void> {
  if (!req.body?.email || !req.body?.password || !req.body?.nom || !req.body?.prenom || !req.body?.telephone) {
    res.status(400).json({ error: 'Champs obligatoires manquants' });
    return;
  }

  // Validate email
  const emailValidation = validateEmail(req.body.email);
  if (!emailValidation.valid) {
    res.status(400).json({ error: emailValidation.error });
    return;
  }

  // Validate password
  const passwordValidation = validatePassword(req.body.password);
  if (!passwordValidation.valid) {
    res.status(400).json({ error: passwordValidation.error });
    return;
  }

  // Validate nom
  const nomValidation = validateTextField(req.body.nom, 'Nom', 1, 100);
  if (!nomValidation.valid) {
    res.status(400).json({ error: nomValidation.error });
    return;
  }

  // Validate prenom
  const prenomValidation = validateTextField(req.body.prenom, 'Prénom', 1, 100);
  if (!prenomValidation.valid) {
    res.status(400).json({ error: prenomValidation.error });
    return;
  }

  // Validate telephone
  const phoneValidation = validateTextField(req.body.telephone, 'Téléphone', 1, 20);
  if (!phoneValidation.valid) {
    res.status(400).json({ error: phoneValidation.error });
    return;
  }

  const email = (req.body.email as string).toLowerCase();
  const password = req.body.password as string;
  const nom = (req.body.nom as string).trim();
  const prenom = (req.body.prenom as string).trim();
  const telephone = (req.body.telephone as string).trim();

  try {
    const exists = await User.findOne({ email });
    if (exists) {
      res.status(409).json({ error: 'Email déjà utilisé' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await User.create({
      email,
      passwordHash,
      role: 'user',
      nom,
      prenom,
      telephone,
      cgu: true,
      consentDataProcessing: req.body?.consentDataProcessing ?? false,
      is_validated: true,
    });

    res.status(201).json({ ok: true, detail: 'Compte créé.' });
  } catch (error) {
    logMessageActionError('registerClient: Failed to register', undefined, undefined, error);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
}

export async function getMyProfile(req: AuthRequest, res: Response): Promise<void> {
  res.json({ user: serializeUser(req.user!, req.prestataire) });
}

export async function updateMyProfile(req: AuthRequest, res: Response): Promise<void> {
  const user = req.user!;
  const body = req.body as Record<string, unknown>;

  try {
    if (body.email && body.email !== user.email) {
      const emailValidation = validateEmail(body.email);
      if (!emailValidation.valid) {
        res.status(400).json({ error: emailValidation.error });
        return;
      }

      const taken = await User.findOne({ email: (body.email as string).toLowerCase() });
      if (taken) {
        res.status(409).json({ error: 'Email déjà utilisé' });
        return;
      }
    }

    if (body.nom !== undefined) {
      const nomValidation = validateTextField(body.nom, 'Nom', 1, 100);
      if (!nomValidation.valid) {
        res.status(400).json({ error: nomValidation.error });
        return;
      }
    }

    if (body.prenom !== undefined) {
      const prenomValidation = validateTextField(body.prenom, 'Prénom', 1, 100);
      if (!prenomValidation.valid) {
        res.status(400).json({ error: prenomValidation.error });
        return;
      }
    }

    if (body.telephone !== undefined) {
      const phoneValidation = validateTextField(body.telephone, 'Téléphone', 1, 20);
      if (!phoneValidation.valid) {
        res.status(400).json({ error: phoneValidation.error });
        return;
      }
    }

    for (const field of USER_EDITABLE_FIELDS) {
      if (body[field] !== undefined) {
        if (field === 'email') {
          (user as unknown as Record<string, unknown>)[field] = (body[field] as string).toLowerCase();
        } else if (field === 'nom' || field === 'prenom' || field === 'telephone') {
          (user as unknown as Record<string, unknown>)[field] = (body[field] as string).trim();
        } else {
          (user as unknown as Record<string, unknown>)[field] = body[field];
        }
      }
    }
    await user.save();

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
  } catch (error) {
    logMessageActionError('updateMyProfile: Failed to update profile', undefined, user._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
}
