import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Prestataire } from '../models/Prestataire';
import { AuthRequest } from '../types';

export async function isConnected(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token manquant' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as { sub: string };
    const user = await User.findById(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'Utilisateur introuvable' });
      return;
    }
    req.user = user;
    req.prestataire = await Prestataire.findOne({ userId: user._id });
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

export function isStaff(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'staff' && req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Accès réservé au staff' });
    return;
  }
  next();
}

export function isAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    return;
  }
  next();
}

export function isPrestataire(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.prestataire && req.user?.role !== 'staff' && req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Accès réservé aux prestataires' });
    return;
  }
  next();
}
