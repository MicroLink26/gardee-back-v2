import { Response } from 'express';
import { User } from '../models/User';
import { Prestataire } from '../models/Prestataire';
import { AuthRequest, UserRole } from '../types';

function buildUserFilter(query: Record<string, string>) {
  const filter: Record<string, unknown> = {};
  if (query.q) {
    const regex = new RegExp(query.q, 'i');
    filter.$or = [{ nom: regex }, { prenom: regex }, { email: regex }];
  }
  if (query.role) filter.role = query.role;
  return filter;
}

export async function listUsers(req: AuthRequest, res: Response): Promise<void> {
  const { page = '1', pageSize = '20', ...filters } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);
  const filter = buildUserFilter(filters);

  const [items, total] = await Promise.all([
    User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize)),
    User.countDocuments(filter),
  ]);

  res.json({ items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
}

export async function listPendingPrestataires(req: AuthRequest, res: Response): Promise<void> {
  const { page = '1', pageSize = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);
  const q = (req.query as Record<string, string>).q;

  const prestFilter: Record<string, unknown> = { is_validated: false };
  if (q) {
    const regex = new RegExp(q, 'i');
    prestFilter.$or = [{ ville: regex }, { prestations: regex }];
  }

  const [prests, total] = await Promise.all([
    Prestataire.find(prestFilter)
      .populate('userId', '-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(pageSize)),
    Prestataire.countDocuments(prestFilter),
  ]);

  // Return items in the same format as before (user object with prestataire data embedded)
  const items = prests.map(p => {
    const u = p.userId as unknown as { toObject?: () => Record<string, unknown> } & Record<string, unknown>;
    const userObj = typeof u.toObject === 'function' ? u.toObject() : u;
    return { ...userObj, isPrestataire: true, prestataire: p.toObject(), prestataireId: p._id };
  });

  res.json({ items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
}

export async function validatePrestataire(req: AuthRequest, res: Response): Promise<void> {
  // id can be User._id or Prestataire._id — try both
  const prestataire = await Prestataire.findOne({ userId: req.params.id })
    ?? await Prestataire.findById(req.params.id);
  if (!prestataire) {
    res.status(404).json({ error: 'Prestataire introuvable' });
    return;
  }
  prestataire.is_validated = true;
  await prestataire.save();
  res.json({ ok: true, prestataire });
}

export async function updateRole(req: AuthRequest, res: Response): Promise<void> {
  const { role } = req.body as { role: UserRole };
  const allowed: UserRole[] = ['user', 'staff', 'admin'];
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
  await Prestataire.deleteOne({ userId: req.params.id });
  res.json({ ok: true });
}
