import { Request, Response } from 'express';
import { checkEmail, register, login } from '../authController';
import { User } from '../../models/User';
import { Prestataire } from '../../models/Prestataire';
import * as tokens from '../../utils/tokens';
import * as bcrypt from 'bcryptjs';

jest.mock('../../models/User', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../../models/Prestataire', () => ({
  Prestataire: { findOne: jest.fn() },
}));

jest.mock('../../models/RefreshToken', () => ({
  RefreshToken: { create: jest.fn(), deleteMany: jest.fn() },
}));

jest.mock('../../utils/tokens', () => ({
  signAccessToken: jest.fn().mockReturnValue('access-token-mock'),
  createRefreshToken: jest.fn().mockResolvedValue('refresh-token-mock'),
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('authController', () => {
  const mockUserFindOne = User.findOne as jest.Mock;
  const mockUserCreate = User.create as jest.Mock;
  const mockPrestFindOne = Prestataire.findOne as jest.Mock;
  const mockBcryptCompare = bcrypt.compare as jest.Mock;

  let res: Partial<Response>;
  let json: jest.Mock;
  let status: jest.Mock;
  let cookie: jest.Mock;

  beforeEach(() => {
    json = jest.fn();
    cookie = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    res = { status, json, cookie };
    jest.clearAllMocks();
    (tokens.signAccessToken as jest.Mock).mockReturnValue('access-token-mock');
    (tokens.createRefreshToken as jest.Mock).mockResolvedValue('refresh-token-mock');
  });

  // ── checkEmail ────────────────────────────────────────────────────

  describe('checkEmail', () => {
    it('returns exists:false when email is free', async () => {
      mockUserFindOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await checkEmail({ query: { email: 'new@example.com' } } as unknown as Request, res as Response);

      expect(json).toHaveBeenCalledWith({ exists: false });
    });

    it('returns exists:true when email is taken', async () => {
      mockUserFindOne.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'uid' }) });

      await checkEmail({ query: { email: 'taken@example.com' } } as unknown as Request, res as Response);

      expect(json).toHaveBeenCalledWith({ exists: true });
    });

    it('returns 400 when email is missing', async () => {
      await checkEmail({ query: {} } as unknown as Request, res as Response);

      expect(status).toHaveBeenCalledWith(400);
    });
  });

  // ── register ─────────────────────────────────────────────────────

  describe('register', () => {
    it('creates a user and returns tokens', async () => {
      mockUserFindOne.mockResolvedValue(null);
      const createdUser = {
        _id: 'new-id',
        email: 'user@example.com',
        nom: 'Dupont',
        prenom: 'Jean',
        role: 'user',
        toObject: () => ({ _id: 'new-id', email: 'user@example.com', nom: 'Dupont', prenom: 'Jean', role: 'user' }),
      };
      mockUserCreate.mockResolvedValue(createdUser);

      await register(
        { body: { email: 'user@example.com', password: 'password123', nom: 'Dupont', prenom: 'Jean' } } as Request,
        res as Response
      );

      expect(mockUserCreate).toHaveBeenCalled();
      expect(cookie).toHaveBeenCalledWith('refresh_token', 'refresh-token-mock', expect.any(Object));
      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'access-token-mock' }));
    });

    it('returns 409 when email already exists', async () => {
      mockUserFindOne.mockResolvedValue({ _id: 'existing' });

      await register(
        { body: { email: 'taken@example.com', password: 'password123', nom: 'Dupont', prenom: 'Jean' } } as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith({ error: 'Un compte existe déjà avec cet email' });
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it('returns 400 when a required field is missing', async () => {
      await register(
        { body: { email: 'user@example.com', password: 'password123' } } as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(mockUserCreate).not.toHaveBeenCalled();
    });
  });

  // ── login ─────────────────────────────────────────────────────────

  describe('login', () => {
    const baseUser = {
      _id: 'uid',
      email: 'user@example.com',
      passwordHash: 'hashed',
      last_login: undefined as Date | undefined,
      save: jest.fn(),
      toObject: () => ({ _id: 'uid', email: 'user@example.com', role: 'user' }),
    };

    it('returns tokens on valid credentials', async () => {
      mockUserFindOne.mockResolvedValue({ ...baseUser, save: jest.fn() });
      mockPrestFindOne.mockResolvedValue(null);
      mockBcryptCompare.mockResolvedValue(true);

      await login(
        { body: { email: 'user@example.com', password: 'correct' } } as Request,
        res as Response
      );

      expect(cookie).toHaveBeenCalledWith('refresh_token', 'refresh-token-mock', expect.any(Object));
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'access-token-mock' }));
    });

    it('returns 401 on wrong password', async () => {
      mockUserFindOne.mockResolvedValue({ ...baseUser });
      mockBcryptCompare.mockResolvedValue(false);

      await login(
        { body: { email: 'user@example.com', password: 'wrong' } } as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Identifiants invalides' });
    });

    it('returns 401 when user not found', async () => {
      mockUserFindOne.mockResolvedValue(null);

      await login(
        { body: { email: 'nobody@example.com', password: 'pass' } } as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(401);
    });
  });
});
