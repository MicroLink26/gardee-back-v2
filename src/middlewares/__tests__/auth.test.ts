import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { isConnected, isStaff, isAdmin, isPrestataire } from '../auth';
import { User } from '../../models/User';
import { Prestataire } from '../../models/Prestataire';
import { AuthRequest } from '../../types';

jest.mock('../../models/User', () => ({
  User: { findById: jest.fn() },
}));

jest.mock('../../models/Prestataire', () => ({
  Prestataire: { findOne: jest.fn() },
}));

describe('auth middlewares', () => {
  const mockUserFindById = User.findById as jest.Mock;
  const mockPrestFindOne = Prestataire.findOne as jest.Mock;

  let res: Partial<Response>;
  let next: jest.Mock;
  let json: jest.Mock;
  let status: jest.Mock;

  const SECRET = 'test-secret';

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = SECRET;
  });

  beforeEach(() => {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    res = { status, json };
    next = jest.fn();
    jest.clearAllMocks();
  });

  // ── isConnected ────────────────────────────────────────────────────

  describe('isConnected', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const req = { headers: {} } as unknown as AuthRequest;

      await isConnected(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Token manquant' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when header does not start with Bearer', async () => {
      const req = { headers: { authorization: 'Basic abc' } } as unknown as AuthRequest;

      await isConnected(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Token manquant' });
    });

    it('returns 401 when token is invalid', async () => {
      const req = { headers: { authorization: 'Bearer invalid-token' } } as unknown as AuthRequest;

      await isConnected(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Token invalide' });
    });

    it('returns 401 when user is not found', async () => {
      const token = jwt.sign({ sub: 'uid' }, SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } } as unknown as AuthRequest;
      mockUserFindById.mockResolvedValue(null);

      await isConnected(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Utilisateur introuvable' });
    });

    it('sets req.user and req.prestataire, calls next() on valid token', async () => {
      const token = jwt.sign({ sub: 'uid' }, SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } } as unknown as AuthRequest;
      const user = { _id: 'uid', email: 'u@example.com' };
      const prest = { _id: 'pid' };
      mockUserFindById.mockResolvedValue(user);
      mockPrestFindOne.mockResolvedValue(prest);

      await isConnected(req, res as Response, next);

      expect(req.user).toBe(user);
      expect(req.prestataire).toBe(prest);
      expect(next).toHaveBeenCalled();
    });

    it('sets req.prestataire to null when user has no profile', async () => {
      const token = jwt.sign({ sub: 'uid' }, SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } } as unknown as AuthRequest;
      mockUserFindById.mockResolvedValue({ _id: 'uid' });
      mockPrestFindOne.mockResolvedValue(null);

      await isConnected(req, res as Response, next);

      expect(req.prestataire).toBeNull();
      expect(next).toHaveBeenCalled();
    });
  });

  // ── isStaff ────────────────────────────────────────────────────────

  describe('isStaff', () => {
    it('returns 403 when user is a client', () => {
      const req = { user: { role: 'user' } } as unknown as AuthRequest;

      isStaff(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next() when user is staff', () => {
      const req = { user: { role: 'staff' } } as unknown as AuthRequest;

      isStaff(req, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('calls next() when user is admin', () => {
      const req = { user: { role: 'admin' } } as unknown as AuthRequest;

      isStaff(req, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ── isAdmin ────────────────────────────────────────────────────────

  describe('isAdmin', () => {
    it('returns 403 when user is staff', () => {
      const req = { user: { role: 'staff' } } as unknown as AuthRequest;

      isAdmin(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next() when user is admin', () => {
      const req = { user: { role: 'admin' } } as unknown as AuthRequest;

      isAdmin(req, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ── isPrestataire ──────────────────────────────────────────────────

  describe('isPrestataire', () => {
    it('returns 403 when user has no prestataire profile and is not staff', () => {
      const req = { user: { role: 'user' }, prestataire: null } as unknown as AuthRequest;

      isPrestataire(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next() when user has a prestataire profile', () => {
      const req = { user: { role: 'user' }, prestataire: { _id: 'pid' } } as unknown as AuthRequest;

      isPrestataire(req, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('calls next() when user is staff without prestataire profile', () => {
      const req = { user: { role: 'staff' }, prestataire: null } as unknown as AuthRequest;

      isPrestataire(req, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('calls next() when user is admin without prestataire profile', () => {
      const req = { user: { role: 'admin' }, prestataire: null } as unknown as AuthRequest;

      isPrestataire(req, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
