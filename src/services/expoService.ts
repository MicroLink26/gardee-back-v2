import { Types } from 'mongoose';
import { ExpoToken } from '../models/ExpoToken';
import { logMessageActionError } from '../utils/logger';

interface ExpoMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendExpoNotification(userId: Types.ObjectId, message: ExpoMessage): Promise<void> {
  const tokens = await ExpoToken.find({ user: userId }).select('token').lean();
  if (!tokens.length) return;

  const messages = tokens.map(t => ({
    to: t.token,
    sound: 'default' as const,
    title: message.title,
    body: message.body,
    data: message.data ?? {},
  }));

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      logMessageActionError('expoService: Push API error', undefined, userId.toString(), await res.text());
      return;
    }
    const result = await res.json() as { data: { status: string; details?: { error?: string } }[] };
    // Nettoyer les tokens invalides
    const stale: string[] = [];
    result.data?.forEach((r, i) => {
      if (r.status === 'error' && (r.details?.error === 'DeviceNotRegistered' || r.details?.error === 'InvalidCredentials')) {
        stale.push(tokens[i].token);
      }
    });
    if (stale.length) {
      await ExpoToken.deleteMany({ user: userId, token: { $in: stale } });
    }
  } catch (error) {
    logMessageActionError('expoService: Failed to send push notification', undefined, userId.toString(), error);
  }
}
