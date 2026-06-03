import { Request, Response } from 'express';
import { registerClient, getMyProfile, updateMyProfile } from '../userController';
import { User } from '../../models/User';
import { Prestataire } from '../../models/Prestataire';
import * as bcrypt from 'bcryptjs';
import { AuthRequest } from '../../types';

jest.mock('../../models/User', () => ({
  User: { findOne: jest.fn(), create: jest.fn() },
}));

jest.mock('../../models/Prestataire', () => ({
  Prestataire: { findOne: jest.fn() },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-pw'),
}));

describe('userController', () => {
  const mockUserFindOne = User.findOne as jest.Mock;
  const mockUserCreate = User.create as jest.Mock;
  const mockPrestFindOne = Prestataire.findOne as jest.Mock;

  let res: Partial<Response>;
  let json: jest.Mock;
  let status: jest.Mock;

  beforeEach(() => {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    res = { status, json };
    jest.clearAllMocks();
  });

  const makeUser = (overrides = {}) => ({
    _id: 'uid',
    email: 'user@example.com',
    nom: 'Dupont',
    prenom: 'Jean',
    role: 'user',
    save: jest.fn().mockResolvedValue(undefined),
    toObject: () => ({ _id: 'uid', email: 'user@example.com', nom: 'Dupont', prenom: 'Jean', role: 'user' }),
    ...overrides,
  }) as any;

  // ── registerClient ────────────────────────────────────────────────

  describe('registerClient', () => {
    it('returns 400 when required fields are missing', async () => {
      await registerClient(
        { body: { email: 'a@b.com', password: 'pass1234', nom: 'Dupont' } } as Request,
        res as Response
      );
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Champs obligatoires manquants' });
    });

    it('returns 400 when password is too short', async () => {
      await registerClient(
        { body: { email: 'a@b.com', password: 'short', nom: 'Dupont', prenom: 'Jean', telephone: '0600' } } as Request,
        res as Response
      );
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    });

    it('returns 409 when email already exists', async () => {
      mockUserFindOne.mockResolvedValue({ _id: 'existing' });
      await registerClient(
        { body: { email: 'taken@b.com', password: 'password123', nom: 'D', prenom: 'J', telephone: '06' } } as Request,
        res as Response
      );
      expect(status).toHaveBeenCalledWith(409);
    });

    it('creates user and returns 201', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue({});

      await registerClient(
        { body: { email: 'New@B.com', password: 'password123', nom: 'Dupont', prenom: 'Jean', telephone: '0600' } } as Request,
        res as Response
      );

      expect(mockUserCreate).toHaveBeenCalledWith(expect.objectContaining({
        email: 'new@b.com',
        role: 'user',
        is_validated: true,
      }));
      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith({ ok: true, detail: 'Compte créé.' });
    });
  });

  // ── getMyProfile ──────────────────────────────────────────────────

  describe('getMyProfile', () => {
    it('returns serialized user', async () => {
      const user = makeUser();
      const req = { user, prestataire: null } as unknown as AuthRequest;

      await getMyProfile(req, res as Response);

      expect(json).toHaveBeenCalledWith({ user: expect.objectContaining({ email: 'user@example.com' }) });
    });
  });

  // ── updateMyProfile ───────────────────────────────────────────────

  describe('updateMyProfile', () => {
    it('returns 409 when new email is already taken', async () => {
      mockUserFindOne.mockResolvedValue({ _id: 'other' });
      const user = makeUser();
      const req = { user, prestataire: null, body: { email: 'taken@b.com' } } as unknown as AuthRequest;

      await updateMyProfile(req, res as Response);

      expect(status).toHaveBeenCalledWith(409);
    });

    it('updates allowed fields and saves user', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockPrestFindOne.mockResolvedValue(null);
      const user = makeUser();
      const req = {
        user,
        prestataire: null,
        body: { nom: 'Martin', email: 'New@B.com', telephone: '0700' },
      } as unknown as AuthRequest;

      await updateMyProfile(req, res as Response);

      expect(user.nom).toBe('Martin');
      expect(user.email).toBe('new@b.com');
      expect(user.save).toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith({ user: expect.any(Object) });
    });

    it('skips email uniqueness check when email is unchanged', async () => {
      mockPrestFindOne.mockResolvedValue(null);
      const user = makeUser();
      const req = {
        user,
        prestataire: null,
        body: { email: 'user@example.com', nom: 'Dupont' },
      } as unknown as AuthRequest;

      await updateMyProfile(req, res as Response);

      expect(mockUserFindOne).not.toHaveBeenCalled();
      expect(user.save).toHaveBeenCalled();
    });

    it('also updates prestataire fields when user has a prestataire profile', async () => {
      mockPrestFindOne.mockResolvedValue(null);
      const prest = {
        save: jest.fn().mockResolvedValue(undefined),
        toObject: () => ({}),
      } as any;
      const user = makeUser();
      const req = {
        user,
        prestataire: prest,
        body: { nom: 'Martin', tarifHoraire: 30, ville: 'Lyon' },
      } as unknown as AuthRequest;

      await updateMyProfile(req, res as Response);

      expect((prest as any).tarifHoraire).toBe(30);
      expect((prest as any).ville).toBe('Lyon');
      expect(prest.save).toHaveBeenCalled();
    });

    it('does not call prestataire.save when no prestataire fields are in body', async () => {
      mockPrestFindOne.mockResolvedValue(null);
      const prest = { save: jest.fn(), toObject: () => ({}) } as any;
      const user = makeUser();
      const req = {
        user,
        prestataire: prest,
        body: { nom: 'Martin' },
      } as unknown as AuthRequest;

      await updateMyProfile(req, res as Response);

      expect(prest.save).not.toHaveBeenCalled();
    });
  });
});
