import { Router, Request, Response } from 'express';
import { updateMissingGeocoding, geocodeMissingVilleOnly, sendUpcomingReminders, sendRatingRequests } from '../services/cronService';
import { logMessageActionError } from '../utils/logger';

const router = Router();

router.get('/daily', async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    logMessageActionError('cron.daily: Failed to execute daily cron tasks', undefined, undefined, error);
    res.status(500).json({ error: 'Erreur lors de l\'exécution des tâches programmées' });
  }
});

export default router;
