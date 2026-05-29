import { Router, Request, Response } from 'express';
import { updateMissingGeocoding, geocodeMissingVilleOnly, sendUpcomingReminders, sendRatingRequests } from '../services/cronService';

const router = Router();

router.get('/daily', async (req: Request, res: Response) => {
  if (req.query.token !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Non autorisé' });
    return;
  }
  const [geocoded, villeResult, reminders, ratings] = await Promise.all([
    updateMissingGeocoding(100),
    geocodeMissingVilleOnly(100),
    sendUpcomingReminders(),
    sendRatingRequests(),
  ]);
  const { villeGeocoded, debugCount } = villeResult;
  res.json({ ok: true, geocoded, villeGeocoded, debugCount, reminders, ratings });
});

export default router;
