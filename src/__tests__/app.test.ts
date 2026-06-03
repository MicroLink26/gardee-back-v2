import request from 'supertest';

// Prevent real DB connection when app module is loaded
jest.mock('../config/db', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));

// Prevent morgan from polluting test output
jest.mock('morgan', () => () => (_req: any, _res: any, next: any) => next());

// Stub models used by auth middleware
jest.mock('../models/User', () => ({ User: { findById: jest.fn().mockResolvedValue(null) } }));
jest.mock('../models/Prestataire', () => ({ Prestataire: { findOne: jest.fn().mockResolvedValue(null) } }));

import app from '../app';

describe('app', () => {
  // ── Health ──────────────────────────────────────────────────────────

  describe('GET /api/health', () => {
    it('returns 200 with ok:true and version', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(typeof res.body.version).toBe('string');
      expect(typeof res.body.buildDate).toBe('string');
    });
  });

  // ── 404 ─────────────────────────────────────────────────────────────

  describe('unknown routes', () => {
    it('returns 404 for an unregistered path', async () => {
      const res = await request(app).get('/api/unknown-route-xyz');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Route introuvable' });
    });
  });

  // ── CORS ─────────────────────────────────────────────────────────────

  describe('CORS', () => {
    it('allows requests from an authorised origin', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://gardee.fr');

      expect(res.headers['access-control-allow-origin']).toBe('https://gardee.fr');
    });

    it('blocks requests from an unauthorised origin', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://evil.com');

      expect(res.status).toBe(500);
    });

    it('allows requests without an Origin header (server-to-server)', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
    });
  });

  // ── Auth middleware on protected routes ───────────────────────────────

  describe('protected routes', () => {
    it('returns 401 on a protected route without token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Token manquant' });
    });

    it('returns 401 on a protected route with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Token invalide' });
    });
  });
});

