import { Response } from 'express';
import { User } from '../models/User';
import { AuthRequest, UserRole } from '../types';

function buildFilter(query: Record<string, string>) {
  const filter: Record<string, unknown> = {};
  if (query.q) {
    const regex = new RegExp(query.q, 'i');
    filter.$or = [{ nom: regex }, { prenom: regex }, { email: regex }, { ville: regex }];
  }
  if (query.ville) filter.ville = new RegExp(query.ville, 'i');
  if (query.codePostal) filter.codePostal = query.codePostal;
  if (query.prestations) filter.prestations = { $in: query.prestations.split(',') };
  if (query.role) filter.role = query.role;
  if (query.is_validated !== undefined) filter.is_validated = query.is_validated === 'true';
  return filter;
}

export async function listUsers(req: AuthRequest, res: Response): Promise<void> {
  const { page = '1', pageSize = '20', ...filters } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);
  const filter = buildFilter(filters);

  const [items, total] = await Promise.all([
    User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize)),
    User.countDocuments(filter),
  ]);

  res.json({ items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
}

export async function listPendingPrestataires(req: AuthRequest, res: Response): Promise<void> {
  const { page = '1', pageSize = '20', ...filters } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);
  const filter = { ...buildFilter(filters), role: 'prestataire', is_validated: false };

  const [items, total] = await Promise.all([
    User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize)),
    User.countDocuments(filter),
  ]);

  res.json({ items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
}

export async function validateUser(req: AuthRequest, res: Response): Promise<void> {
  const user = await User.findByIdAndUpdate(req.params.id, { is_validated: true }, { new: true });
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  res.json({ ok: true, user });
}

export async function updateRole(req: AuthRequest, res: Response): Promise<void> {
  const { role } = req.body as { role: UserRole };
  const allowed: UserRole[] = ['client', 'prestataire', 'staff', 'admin'];
  if (!allowed.includes(role)) {
    res.status(400).json({ error: 'Rôle invalide' });
    return;
  }
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-passwordHash');
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  res.json({ ok: true, user });
}

export async function deleteUser(req: AuthRequest, res: Response): Promise<void> {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  res.json({ ok: true });
}
