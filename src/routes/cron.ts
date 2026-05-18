import { Router, Request, Response } from 'express';
import { updateMissingGeocoding, sendUpcomingReminders, sendRatingRequests } from '../services/cronService';

const router = Router();

router.get('/daily', async (req: Request, res: Response) => {
  if (req.query.token !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Non autorisé' });
    return;
  }
  const [geocoded, reminders, ratings] = await Promise.all([
    updateMissingGeocoding(100),
    sendUpcomingReminders(),
    sendRatingRequests(),
  ]);
  res.json({ ok: true, geocoded, reminders, ratings });
});

export default router;
