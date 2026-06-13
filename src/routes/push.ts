import { Router, Response } from 'express';
import { isConnected } from '../middlewares/auth';
import { PushSubscription } from '../models/PushSubscription';
import { ExpoToken } from '../models/ExpoToken';
import { AuthRequest } from '../types';
import { logMessageActionError } from '../utils/logger';

const router = Router();

router.get('/vapid-public-key', (_req, res) => {
  try {
    res.json({ key: process.env.VAPID_PUBLIC_KEY });
  } catch (error) {
    logMessageActionError('push.get: Failed to get VAPID key', undefined, undefined, error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la clé' });
  }
});

router.post('/subscribe', isConnected, async (req: AuthRequest, res: Response) => {
  try {
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
  } catch (error) {
    logMessageActionError('push.subscribe: Failed to subscribe to push notifications', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

router.delete('/subscribe', isConnected, async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint } = req.body as { endpoint: string };
    if (endpoint) await PushSubscription.deleteOne({ user: req.user!._id, endpoint });
    res.json({ ok: true });
  } catch (error) {
    logMessageActionError('push.delete: Failed to unsubscribe from push notifications', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la désinscription' });
  }
});

// Expo Push Token (mobile)
router.post('/expo-token', isConnected, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body as { token?: string };
    if (!token || !token.startsWith('ExponentPushToken[')) {
      res.status(400).json({ error: 'Token Expo invalide' });
      return;
    }
    await ExpoToken.findOneAndUpdate(
      { user: req.user!._id, token },
      { user: req.user!._id, token },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (error) {
    logMessageActionError('push.expo-token: Failed to save token', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du token' });
  }
});

router.delete('/expo-token', isConnected, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body as { token?: string };
    if (token) await ExpoToken.deleteOne({ user: req.user!._id, token });
    res.json({ ok: true });
  } catch (error) {
    logMessageActionError('push.expo-token.delete: Failed to delete token', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la suppression du token' });
  }
});

export default router;
