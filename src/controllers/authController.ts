import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { User } from '../models/User';
import { Prestataire } from '../models/Prestataire';
import { RefreshToken } from '../models/RefreshToken';
import { PasswordReset } from '../models/PasswordReset';
import { signAccessToken, createRefreshToken } from '../utils/tokens';
import { sendForgotPasswordEmail, sendWelcomeClientEmail, sendEmailVerificationCode } from '../services/emailService';
import { serializeUser } from '../utils/serializeUser';
import { AuthRequest } from '../types';
import { validateEmail, validatePassword, validateTextField, validateToken } from '../utils/validation';
import { logEmailError, logMessageActionError } from '../utils/logger';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'development',
  sameSite: 'none' as const,
  maxAge: parseInt(process.env.REFRESH_TTL_DAYS ?? '30', 10) * 86400 * 1000,
};

export async function checkEmail(req: Request, res: Response): Promise<void> {
  const emailValidation = validateEmail(req.query?.email);
  if (!emailValidation.valid) {
    res.status(400).json({ error: emailValidation.error });
    return;
  }

  const email = ((req.query?.email as string).toLowerCase());
  const user = await User.findOne({ email }).select('_id bannedPermanently');
  res.json({ exists: !!user, bannedPermanently: user?.bannedPermanently ?? false });
}

export async function register(req: Request, res: Response): Promise<void> {
  // Validate email
  const emailValidation = validateEmail(req.body?.email);
  if (!emailValidation.valid) {
    res.status(400).json({ error: emailValidation.error });
    return;
  }

  // Validate password
  const passwordValidation = validatePassword(req.body?.password);
  if (!passwordValidation.valid) {
    res.status(400).json({ error: passwordValidation.error });
    return;
  }

  // Validate nom
  const nomValidation = validateTextField(req.body?.nom, 'Nom', 1, 100);
  if (!nomValidation.valid) {
    res.status(400).json({ error: nomValidation.error });
    return;
  }

  // Validate prenom
  const prenomValidation = validateTextField(req.body?.prenom, 'Prénom', 1, 100);
  if (!prenomValidation.valid) {
    res.status(400).json({ error: prenomValidation.error });
    return;
  }

  const email = (req.body?.email as string).toLowerCase();
  const password = req.body?.password as string;
  const nom = (req.body?.nom as string).trim();
  const prenom = (req.body?.prenom as string).trim();

  const existing = await User.findOne({ email });
  if (existing?.bannedPermanently) {
    res.status(403).json({ error: 'Cette adresse email ne peut plus être utilisée sur Gardee.' });
    return;
  }
  if (existing) {
    res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const user = await User.create({
      email,
      passwordHash,
      nom,
      prenom,
      role: 'user',
      emailVerified: false,
      emailVerificationCode: code,
      emailVerificationExpiresAt: expiresAt,
    });

    await sendEmailVerificationCode(user, code).catch((err) => {
      logEmailError('register: Failed to send verification code', user._id.toString(), user._id.toString(), email, err);
    });

    res.status(201).json({ requiresVerification: true, userId: user._id.toString() });
  } catch (error) {
    logMessageActionError('register: Failed to create user', undefined, undefined, error);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { userId, code } = req.body as { userId: string; code: string };
  if (!userId || !code) { res.status(400).json({ error: 'Paramètres manquants' }); return; }

  const user = await User.findById(userId);
  if (!user) { res.status(404).json({ error: 'Compte introuvable' }); return; }
  if (user.emailVerified) { res.status(400).json({ error: 'Compte déjà vérifié' }); return; }
  if (!user.emailVerificationCode || user.emailVerificationCode !== code) {
    res.status(400).json({ error: 'Code invalide' });
    return;
  }
  if (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < new Date()) {
    res.status(400).json({ error: 'Code expiré. Demandez un nouveau code.' });
    return;
  }

  user.emailVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpiresAt = undefined;
  await user.save();

  sendWelcomeClientEmail(user).catch(() => {});

  const accessToken = signAccessToken(user._id, user.role, user.email);
  const refreshToken = await createRefreshToken(user._id);
  res.cookie('refresh_token', refreshToken, COOKIE_OPTS);
  res.json({ user: serializeUser(user, null), accessToken });
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  const { userId } = req.body as { userId: string };
  if (!userId) { res.status(400).json({ error: 'userId manquant' }); return; }

  const user = await User.findById(userId);
  if (!user || user.emailVerified) { res.status(400).json({ error: 'Compte introuvable ou déjà vérifié' }); return; }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  user.emailVerificationCode = code;
  user.emailVerificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  sendEmailVerificationCode(user, code).catch(() => {});
  res.json({ ok: true });
}

export async function login(req: Request, res: Response): Promise<void> {
  // Validate email
  const emailValidation = validateEmail(req.body?.email);
  if (!emailValidation.valid) {
    res.status(401).json({ error: 'Identifiants invalides' });
    return;
  }

  // Validate password exists
  const password = req.body?.password;
  if (!password || typeof password !== 'string' || password.length === 0) {
    res.status(401).json({ error: 'Identifiants invalides' });
    return;
  }

  const email = (req.body?.email as string).toLowerCase();

  try {
    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Identifiants invalides' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Identifiants invalides' });
      return;
    }

    if (!user.emailVerified) {
      // Renew verification code if expired
      if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        user.emailVerificationCode = code;
        user.emailVerificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();
        await sendEmailVerificationCode(user, code).catch((err) => {
          logEmailError('login: Failed to send verification code', user._id.toString(), user._id.toString(), email, err);
        });
      }
      res.status(403).json({ requiresVerification: true, userId: user._id.toString() });
      return;
    }

    user.last_login = new Date();
    await user.save();

    const prestataire = await Prestataire.findOne({ userId: user._id });
    const accessToken = signAccessToken(user._id, user.role, user.email);
    const refreshToken = await createRefreshToken(user._id);

    res.cookie('refresh_token', refreshToken, COOKIE_OPTS);
    res.json({ user: serializeUser(user, prestataire), accessToken });
  } catch (error) {
    logMessageActionError('login: Failed to authenticate', undefined, undefined, error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refresh_token as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Token manquant' });
    return;
  }
  const record = await RefreshToken.findOne({ token });
  if (!record || record.expiresAt < new Date()) {
    res.status(401).json({ error: 'Token invalide ou expiré' });
    return;
  }
  await record.deleteOne();

  const user = await User.findById(record.user);
  if (!user) {
    res.status(401).json({ error: 'Utilisateur introuvable' });
    return;
  }

  const accessToken = signAccessToken(user._id, user.role, user.email);
  const newRefreshToken = await createRefreshToken(user._id);

  res.cookie('refresh_token', newRefreshToken, COOKIE_OPTS);
  res.json({ accessToken });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refresh_token as string | undefined;
  if (token) await RefreshToken.deleteOne({ token });
  res.clearCookie('refresh_token');
  res.json({ ok: true });
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  res.json({ user: serializeUser(req.user!, req.prestataire) });
}

export async function getRoles(req: AuthRequest, res: Response): Promise<void> {
  res.json({ role: req.user!.role, isPrestataire: !!req.prestataire });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  // Validate email
  const emailValidation = validateEmail(req.body?.email);
  if (!emailValidation.valid) {
    res.status(400).json({ error: emailValidation.error });
    return;
  }

  const email = (req.body?.email as string).toLowerCase();

  try {
    const user = await User.findOne({ email });
    if (user) {
      const token = nanoid(32);
      await PasswordReset.create({
        user: user._id,
        token,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      });
      await sendForgotPasswordEmail(user.email, token).catch((err) => {
        logEmailError('forgotPassword: Failed to send reset email', undefined, user._id.toString(), email, err);
      });
    }
    // Always return success to avoid email enumeration
    res.json({ ok: true });
  } catch (error) {
    logMessageActionError('forgotPassword: Failed to process', undefined, undefined, error);
    res.status(500).json({ error: 'Erreur lors du traitement' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  // Validate token
  const tokenValidation = validateToken(req.body?.token);
  if (!tokenValidation.valid) {
    res.status(400).json({ error: tokenValidation.error });
    return;
  }

  const token = (req.body?.token as string).trim();

  try {
    // Check token first before validating password
    const record = await PasswordReset.findOne({ token, used: false });
    if (!record || record.expiresAt < new Date()) {
      res.status(400).json({ error: 'Token invalide ou expiré' });
      return;
    }

    // Then validate password
    const passwordValidation = validatePassword(req.body?.password);
    if (!passwordValidation.valid) {
      res.status(400).json({ error: passwordValidation.error });
      return;
    }

    const password = req.body?.password as string;
    const hash = await bcrypt.hash(password, 12);
    await User.findByIdAndUpdate(record.user, { passwordHash: hash });
    await RefreshToken.deleteMany({ user: record.user });
    record.used = true;
    await record.save();

    res.json({ ok: true });
  } catch (error) {
    logMessageActionError('resetPassword: Failed to reset', undefined, undefined, error);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
  }
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  // Validate current password
  const currentPassword = req.body?.currentPassword;
  if (!currentPassword || typeof currentPassword !== 'string' || currentPassword.length === 0) {
    res.status(400).json({ error: 'Champs requis manquants' });
    return;
  }

  // Validate new password
  const newPassword = req.body?.newPassword;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length === 0) {
    res.status(400).json({ error: 'Champs requis manquants' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    return;
  }

  if (newPassword.length > 128) {
    res.status(400).json({ error: 'Le mot de passe ne peut pas dépasser 128 caractères' });
    return;
  }

  try {
    const user = req.user!;
    const valid = await bcrypt.compare(currentPassword, user.passwordHash!);
    if (!valid) {
      res.status(401).json({ error: 'Mot de passe actuel incorrect' });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    // Invalidate all existing refresh tokens for security
    await RefreshToken.deleteMany({ user: user._id });

    res.json({ ok: true });
  } catch (error) {
    logMessageActionError('changePassword: Failed to change password', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
  }
}
