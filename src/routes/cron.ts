import { Router, Request, Response } from 'express';
import { updateMissingGeocoding, geocodeMissingVilleOnly, sendUpcomingReminders, sendRatingRequests } from '../services/cronService';
import { ServiceRequest } from '../models/ServiceRequest';

const router = Router();

router.get('/daily', async (req: Request, res: Response) => {
  if (req.query.token !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Non autorisé' });
    return;
  }
  const [geocoded, villeGeocoded, reminders, ratings] = await Promise.all([
    updateMissingGeocoding(100),
    geocodeMissingVilleOnly(100),
    sendUpcomingReminders(),
    sendRatingRequests(),
  ]);
  res.json({ ok: true, geocoded, villeGeocoded, reminders, ratings });
});

router.get('/debug-reviews/:prestataireId', async (req: Request, res: Response) => {
  if (req.query.token !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Non autorisé' });
    return;
  }
  const { prestataireId } = req.params;
  const all = await ServiceRequest.find({ prestataireId }).select('status ratingDetails ratingGivenAt requesterPrenom requesterEmail').limit(20).lean();
  const withRating = all.filter(r => r.ratingDetails);
  res.json({ total: all.length, withRating: withRating.length, items: all });
});

export default router;
