import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { PasswordReset } from '../models/PasswordReset';
import { signAccessToken, createRefreshToken } from '../utils/tokens';
import { sendForgotPasswordEmail } from '../services/emailService';
import { AuthRequest } from '../types';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'development',
  sameSite: 'none' as const,
  maxAge: parseInt(process.env.REFRESH_TTL_DAYS ?? '30', 10) * 86400 * 1000,
};

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  const user = await User.findOne({ email: email?.toLowerCase() });
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: 'Identifiants invalides' });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Identifiants invalides' });
    return;
  }
  user.last_login = new Date();
  await user.save();

  const accessToken = signAccessToken(user._id);
  const refreshToken = await createRefreshToken(user._id);

  res.cookie('refresh_token', refreshToken, COOKIE_OPTS);
  res.json({ user: { id: user._id, email: user.email, nom: user.nom, prenom: user.prenom, role: user.role }, accessToken });
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

  const accessToken = signAccessToken(user._id);
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
  const user = req.user!;
  const { passwordHash: _pw, ...safeUser } = user.toObject();
  res.json({ user: safeUser });
}

export async function getRoles(req: AuthRequest, res: Response): Promise<void> {
  res.json({ role: req.user!.role });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string };
  const user = await User.findOne({ email: email?.toLowerCase() });
  // Always return ok to avoid email enumeration
  if (user) {
    const token = nanoid(32);
    await PasswordReset.create({
      user: user._id,
      token,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    });
    await sendForgotPasswordEmail(user.email, token);
  }
  res.json({ ok: true });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as { token: string; password: string };
  const record = await PasswordReset.findOne({ token, used: false });
  if (!record || record.expiresAt < new Date()) {
    res.status(400).json({ error: 'Token invalide ou expiré' });
    return;
  }
  const hash = await bcrypt.hash(password, 12);
  await User.findByIdAndUpdate(record.user, { passwordHash: hash });
  await RefreshToken.deleteMany({ user: record.user });
  record.used = true;
  await record.save();
  res.json({ ok: true });
}
