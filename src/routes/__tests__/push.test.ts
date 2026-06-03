import express from 'express';
import request from 'supertest';

jest.mock('../../models/PushSubscription', () => ({
  PushSubscription: { findOneAndUpdate: jest.fn(), deleteOne: jest.fn() },
}));

jest.mock('../../middlewares/auth', () => ({
  isConnected: (_req: any, _res: any, next: any) => {
    _req.user = { _id: 'user-id' };
    next();
  },
}));

import pushRoutes from '../push';
import { PushSubscription } from '../../models/PushSubscription';

const app = express();
app.use(express.json());
app.use('/', pushRoutes);

describe('push routes', () => {
  const mockFindOneAndUpdate = PushSubscription.findOneAndUpdate as jest.Mock;
  const mockDeleteOne = PushSubscription.deleteOne as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  describe('GET /vapid-public-key', () => {
    it('returns the VAPID public key', async () => {
      process.env.VAPID_PUBLIC_KEY = 'test-pub-key';

      const res = await request(app).get('/vapid-public-key');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ key: 'test-pub-key' });

      delete process.env.VAPID_PUBLIC_KEY;
    });

    it('returns null key when VAPID_PUBLIC_KEY is not set', async () => {
      delete process.env.VAPID_PUBLIC_KEY;

      const res = await request(app).get('/vapid-public-key');

      expect(res.status).toBe(200);
      expect(res.body.key).toBeUndefined();
    });
  });

  describe('POST /subscribe', () => {
    const validBody = { endpoint: 'https://push.example.com/sub', keys: { p256dh: 'key1', auth: 'auth1' } };

    it('returns 400 when endpoint is missing', async () => {
      const res = await request(app).post('/subscribe').send({ keys: { p256dh: 'k', auth: 'a' } });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Subscription invalide' });
    });

    it('returns 400 when keys are incomplete', async () => {
      const res = await request(app).post('/subscribe').send({ endpoint: 'https://push.example.com', keys: { p256dh: 'k' } });

      expect(res.status).toBe(400);
    });

    it('upserts subscription and returns ok:true', async () => {
      mockFindOneAndUpdate.mockResolvedValue({});

      const res = await request(app).post('/subscribe').send(validBody);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { user: 'user-id', endpoint: validBody.endpoint },
        expect.objectContaining({ endpoint: validBody.endpoint }),
        { upsert: true, new: true }
      );
    });
  });

  describe('DELETE /subscribe', () => {
    it('deletes subscription when endpoint is provided', async () => {
      mockDeleteOne.mockResolvedValue({});

      const res = await request(app).delete('/subscribe').send({ endpoint: 'https://push.example.com/sub' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(mockDeleteOne).toHaveBeenCalledWith({ user: 'user-id', endpoint: 'https://push.example.com/sub' });
    });

    it('skips delete and returns ok:true when no endpoint', async () => {
      const res = await request(app).delete('/subscribe').send({});

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(mockDeleteOne).not.toHaveBeenCalled();
    });
  });
});
