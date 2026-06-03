import webpush from 'web-push';
import { PushSubscription } from '../models/PushSubscription';
import { Types } from 'mongoose';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured || !process.env.VAPID_PUBLIC_KEY) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:info@gardee.fr',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY!
  );
  vapidConfigured = true;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  requestId?: string;
}

export async function sendPushToUser(userId: Types.ObjectId, payload: PushPayload): Promise<void> {
  ensureVapid();
  const subs = await PushSubscription.find({ user: userId });
  const stale: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(sub.endpoint);
      }
    })
  );

  if (stale.length) {
    await PushSubscription.deleteMany({ endpoint: { $in: stale } });
  }
}
