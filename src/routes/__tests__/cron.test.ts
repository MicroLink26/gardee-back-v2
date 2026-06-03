import express from 'express';
import request from 'supertest';

jest.mock('../../services/cronService', () => ({
  updateMissingGeocoding: jest.fn().mockResolvedValue(3),
  geocodeMissingVilleOnly: jest.fn().mockResolvedValue(1),
  sendUpcomingReminders: jest.fn().mockResolvedValue(2),
  sendRatingRequests: jest.fn().mockResolvedValue(4),
}));

import cronRoutes from '../cron';

const app = express();
app.use(express.json());
app.use('/', cronRoutes);

describe('cron routes', () => {
  const SECRET = 'test-cron-secret';

  beforeAll(() => { process.env.CRON_SECRET = SECRET; });
  afterAll(() => { delete process.env.CRON_SECRET; });

  describe('GET /daily', () => {
    it('returns 401 when token is missing', async () => {
      const res = await request(app).get('/daily');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Non autorisé' });
    });

    it('returns 401 when token is wrong', async () => {
      const res = await request(app).get('/daily?token=wrong-token');

      expect(res.status).toBe(401);
    });

    it('runs all cron tasks and returns results when token is correct', async () => {
      const res = await request(app).get(`/daily?token=${SECRET}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, geocoded: 3, villeGeocoded: 1, reminders: 2, ratings: 4 });
    });
  });
});
