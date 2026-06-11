import { Response } from 'express';
import { User } from '../models/User';
import { Prestataire } from '../models/Prestataire';
import { ServiceRequest } from '../models/ServiceRequest';
import { AuthRequest, UserRole } from '../types';
import {
  sendPrestataireAcceptedEmail,
  sendPrestataireRejectedTemporaryEmail,
  sendPrestataireRejectedPermanentlyEmail,
} from '../services/emailService';
import { logMessageActionError } from '../utils/logger';

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function recalculatePrestataireRating(prestataireId: string): Promise<void> {
  const reviews = await ServiceRequest.find({
    prestataireId,
    ratingDetails: { $exists: true },
    reviewApproved: { $ne: false },
  }).select('ratingDetails');

  const prest = await Prestataire.findOne({ userId: prestataireId });
  if (!prest) return;

  if (reviews.length === 0) {
    prest.averageRating = 0;
    prest.numberOfReviews = 0;
  } else {
    const total = reviews.reduce((sum, r) => {
      const d = r.ratingDetails as unknown as Record<string, number>;
      const vals = Object.values(d).filter((v): v is number => typeof v === 'number');
      return sum + (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
    }, 0);
    prest.numberOfReviews = reviews.length;
    prest.averageRating = parseFloat((total / reviews.length).toFixed(2));
  }
  await prest.save();
}

function buildUserFilter(query: Record<string, string>) {
  const filter: Record<string, unknown> = {};
  if (query.q) {
    const regex = new RegExp(escapeRegExp(query.q), 'i');
    filter.$or = [{ nom: regex }, { prenom: regex }, { email: regex }];
  }
  if (query.role) filter.role = query.role;
  return filter;
}

export async function listUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { page = '1', pageSize = '20', ...filters } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const filter = buildUserFilter(filters);

    const [items, total] = await Promise.all([
      User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize)),
      User.countDocuments(filter),
    ]);

    res.json({ items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    logMessageActionError('listUsers: Failed to list users', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
}

export async function listPendingPrestataires(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { page = '1', pageSize = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const q = (req.query as Record<string, string>).q;

    const prestFilter: Record<string, unknown> = { is_validated: false };
    if (q) {
      const regex = new RegExp(escapeRegExp(q), 'i');
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
  } catch (error) {
    logMessageActionError('listPendingPrestataires: Failed to list pending prestataires', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la récupération des prestataires' });
  }
}

export async function validatePrestataire(req: AuthRequest, res: Response): Promise<void> {
  try {
    const prestataire = await Prestataire.findOne({ userId: req.params.id })
      ?? await Prestataire.findById(req.params.id);
    if (!prestataire) {
      res.status(404).json({ error: 'Prestataire introuvable' });
      return;
    }
    prestataire.is_validated = true;
    await prestataire.save();

    const user = await User.findById(prestataire.userId);
    if (user) {
      user.rejectedTemporarily = false;
      user.rejectionReason = undefined;
      user.rejectedAt = undefined;
      user.rejectionPingShown = false;
      await user.save();
      sendPrestataireAcceptedEmail(user).catch(() => {});
    }

    res.json({ ok: true, prestataire });
  } catch (error) {
    logMessageActionError('validatePrestataire: Failed to validate prestataire', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la validation' });
  }
}

export async function rejectPrestataire(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { type, reason } = req.body as { type: 'temporary' | 'permanent'; reason?: string };
    if (!type || !['temporary', 'permanent'].includes(type)) {
      res.status(400).json({ error: 'Type de refus invalide (temporary | permanent)' });
      return;
    }

    const prestataire = await Prestataire.findOne({ userId: req.params.id })
      ?? await Prestataire.findById(req.params.id);
    if (!prestataire) {
      res.status(404).json({ error: 'Prestataire introuvable' });
      return;
    }

    const user = await User.findById(prestataire.userId);
    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }

    prestataire.is_validated = false;
    await prestataire.save();

    if (type === 'permanent') {
      user.bannedPermanently = true;
      user.rejectedTemporarily = false;
      user.rejectionReason = reason;
      user.rejectedAt = new Date();
      await user.save();
      sendPrestataireRejectedPermanentlyEmail(user, reason ?? '').catch(() => {});
    } else {
      user.rejectedTemporarily = true;
      user.rejectionReason = reason;
      user.rejectedAt = new Date();
      user.rejectionPingShown = false;
      await user.save();
      sendPrestataireRejectedTemporaryEmail(user, reason ?? '').catch(() => {});
    }

    res.json({ ok: true });
  } catch (error) {
    logMessageActionError('rejectPrestataire: Failed to reject prestataire', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors du refus' });
  }
}

export async function markRejectionPingShown(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    user.rejectionPingShown = true;
    await user.save();
    res.json({ ok: true });
  } catch (error) {
    logMessageActionError('markRejectionPingShown: Failed to mark rejection ping shown', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
}

export async function updateRole(req: AuthRequest, res: Response): Promise<void> {
  try {
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
  } catch (error) {
    logMessageActionError('updateRole: Failed to update user role', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du rôle' });
  }
}

export async function deleteUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    await Prestataire.deleteOne({ userId: req.params.id });
    res.json({ ok: true });
  } catch (error) {
    logMessageActionError('deleteUser: Failed to delete user', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
}

export async function getInsights(req: AuthRequest, res: Response): Promise<void> {
  try {
    const days = Math.min(parseInt((req.query as Record<string, string>).days ?? '30'), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Granularité : daily ≤ 30j, weekly ≤ 90j, sinon monthly
    const granularity = days <= 30 ? 'day' : days <= 90 ? 'week' : 'month';
    const dateFormat = granularity === 'day' ? '%Y-%m-%d' : granularity === 'week' ? '%Y-%U' : '%Y-%m';

    const [
      totalUsers,
      totalPrestataires,
      pendingPrestataires,
      totalRequests,
      completedRequests,
      usersSeries,
      requestsSeries,
      requestsByStatus,
    ] = await Promise.all([
      User.countDocuments(),
      Prestataire.countDocuments({ is_validated: true }),
      Prestataire.countDocuments({ is_validated: false }),
      ServiceRequest.countDocuments(),
      ServiceRequest.countDocuments({ status: 'completed' }),
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: dateFormat, date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      ServiceRequest.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: dateFormat, date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      ServiceRequest.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      kpis: { totalUsers, totalPrestataires, pendingPrestataires, totalRequests, completedRequests },
      granularity,
      series: {
        users: usersSeries.map(x => ({ date: x._id, count: x.count })),
        requests: requestsSeries.map(x => ({ date: x._id, count: x.count })),
      },
      requestsByStatus: Object.fromEntries(requestsByStatus.map(x => [x._id, x.count])),
    });
  } catch (error) {
    logMessageActionError('getInsights: Failed to fetch insights', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
}

export async function listPendingReviews(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { page = '1', pageSize = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);

    const filter = {
      ratingDetails: { $exists: true },
      reviewApproved: { $exists: false },
    };

    const [items, total] = await Promise.all([
      ServiceRequest.find(filter)
        .select('prestataireId requesterPrenom requesterNom requesterEmail ratingDetails ratingComment recommend ratingGivenAt reviewApproved')
        .sort({ ratingGivenAt: -1 })
        .skip(skip)
        .limit(parseInt(pageSize)),
      ServiceRequest.countDocuments(filter),
    ]);

    res.json({ items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    logMessageActionError('listPendingReviews: Failed to list pending reviews', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la récupération des avis' });
  }
}

export async function approveReview(req: AuthRequest, res: Response): Promise<void> {
  try {
    const review = await ServiceRequest.findById(req.params.id);
    if (!review || !review.ratingDetails) {
      res.status(404).json({ error: 'Avis introuvable' });
      return;
    }
    review.reviewApproved = true;
    await review.save();
    await recalculatePrestataireRating(review.prestataireId.toString());
    res.json({ ok: true });
  } catch (error) {
    logMessageActionError('approveReview: Failed to approve review', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de l\'approbation' });
  }
}

export async function rejectReview(req: AuthRequest, res: Response): Promise<void> {
  try {
    const review = await ServiceRequest.findById(req.params.id);
    if (!review || !review.ratingDetails) {
      res.status(404).json({ error: 'Avis introuvable' });
      return;
    }
    review.reviewApproved = false;
    await review.save();
    await recalculatePrestataireRating(review.prestataireId.toString());
    res.json({ ok: true });
  } catch (error) {
    logMessageActionError('rejectReview: Failed to reject review', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors du refus' });
  }
}
