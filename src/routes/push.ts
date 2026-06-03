import { Router, Response } from 'express';
import { isConnected } from '../middlewares/auth';
import { PushSubscription } from '../models/PushSubscription';
import { AuthRequest } from '../types';

const router = Router();

router.get('/vapid-public-key', (_req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY });
});

router.post('/subscribe', isConnected, async (req: AuthRequest, res: Response) => {
  const { endpoint, keys } = req.body as { endpoint: string; keys: { p256dh: string; auth: string } };
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: 'Subscription invalide' });
    return;
  }
  await PushSubscription.findOneAndUpdate(
    { user: req.user!._id, endpoint },
    { user: req.user!._id, endpoint, keys },
    { upsert: true, new: true }
  );
  res.json({ ok: true });
});

router.delete('/subscribe', isConnected, async (req: AuthRequest, res: Response) => {
  const { endpoint } = req.body as { endpoint: string };
  if (endpoint) await PushSubscription.deleteOne({ user: req.user!._id, endpoint });
  res.json({ ok: true });
});

export default router;
