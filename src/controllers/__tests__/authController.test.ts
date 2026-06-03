import { Request, Response } from 'express';
import {
  checkEmail, register, login,
  refresh, logout, me, getRoles,
  forgotPassword, resetPassword, changePassword,
} from '../authController';
import { User } from '../../models/User';
import { Prestataire } from '../../models/Prestataire';
import { RefreshToken } from '../../models/RefreshToken';
import { PasswordReset } from '../../models/PasswordReset';
import * as tokens from '../../utils/tokens';
import * as bcrypt from 'bcryptjs';
import { AuthRequest } from '../../types';

jest.mock('../../models/User', () => ({
  User: {
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../../models/Prestataire', () => ({
  Prestataire: { findOne: jest.fn() },
}));

jest.mock('../../models/RefreshToken', () => ({
  RefreshToken: {
    create: jest.fn(),
    findOne: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

jest.mock('../../models/PasswordReset', () => ({
  PasswordReset: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../../utils/tokens', () => ({
  signAccessToken: jest.fn().mockReturnValue('access-token-mock'),
  createRefreshToken: jest.fn().mockResolvedValue('refresh-token-mock'),
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

jest.mock('../../services/emailService', () => ({
  sendWelcomeClientEmail: jest.fn().mockResolvedValue(undefined),
  sendForgotPasswordEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('nanoid', () => ({ nanoid: jest.fn().mockReturnValue('reset-token-32chars') }));

describe('authController', () => {
  const mockUserFindOne = User.findOne as jest.Mock;
  const mockUserFindById = User.findById as jest.Mock;
  const mockUserFindByIdAndUpdate = User.findByIdAndUpdate as jest.Mock;
  const mockUserCreate = User.create as jest.Mock;
  const mockPrestFindOne = Prestataire.findOne as jest.Mock;
  const mockRefreshFindOne = RefreshToken.findOne as jest.Mock;
  const mockRefreshDeleteOne = RefreshToken.deleteOne as jest.Mock;
  const mockRefreshDeleteMany = RefreshToken.deleteMany as jest.Mock;
  const mockPasswordResetFindOne = PasswordReset.findOne as jest.Mock;
  const mockPasswordResetCreate = PasswordReset.create as jest.Mock;
  const mockBcryptCompare = bcrypt.compare as jest.Mock;

  let res: Partial<Response>;
  let json: jest.Mock;
  let status: jest.Mock;
  let cookie: jest.Mock;
  let clearCookie: jest.Mock;

  beforeEach(() => {
    json = jest.fn();
    cookie = jest.fn();
    clearCookie = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    res = { status, json, cookie, clearCookie };
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

    it('completes successfully even when welcome email fails', async () => {
      const { sendWelcomeClientEmail } = jest.requireMock('../../services/emailService');
      sendWelcomeClientEmail.mockRejectedValueOnce(new Error('SMTP down'));
      mockUserFindOne.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue({
        _id: 'new-id', email: 'u@example.com', nom: 'D', prenom: 'J', role: 'user',
        toObject: () => ({ _id: 'new-id' }),
      });

      await register(
        { body: { email: 'u@example.com', password: 'pass1234', nom: 'D', prenom: 'J' } } as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(201);
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

  // ── refresh ───────────────────────────────────────────────────────

  describe('refresh', () => {
    const baseUser = {
      _id: 'uid',
      email: 'user@example.com',
      toObject: () => ({ _id: 'uid', email: 'user@example.com', role: 'user' }),
    };

    it('rotates tokens when refresh_token cookie is valid', async () => {
      const record = {
        token: 'valid-token',
        user: 'uid',
        expiresAt: new Date(Date.now() + 10000),
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      mockRefreshFindOne.mockResolvedValue(record);
      mockUserFindById.mockResolvedValue(baseUser);

      await refresh(
        { cookies: { refresh_token: 'valid-token' } } as unknown as Request,
        res as Response
      );

      expect(record.deleteOne).toHaveBeenCalled();
      expect(cookie).toHaveBeenCalledWith('refresh_token', 'refresh-token-mock', expect.any(Object));
      expect(json).toHaveBeenCalledWith({ accessToken: 'access-token-mock' });
    });

    it('returns 401 when cookie is missing', async () => {
      await refresh(
        { cookies: {} } as unknown as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Token manquant' });
    });

    it('returns 401 when token is not found in DB', async () => {
      mockRefreshFindOne.mockResolvedValue(null);

      await refresh(
        { cookies: { refresh_token: 'unknown-token' } } as unknown as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Token invalide ou expiré' });
    });

    it('returns 401 when token is expired', async () => {
      mockRefreshFindOne.mockResolvedValue({
        token: 'expired',
        expiresAt: new Date(Date.now() - 1000),
        deleteOne: jest.fn(),
      });

      await refresh(
        { cookies: { refresh_token: 'expired' } } as unknown as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(401);
    });

    it('returns 401 when user no longer exists', async () => {
      const record = {
        token: 'valid-token',
        user: 'deleted-uid',
        expiresAt: new Date(Date.now() + 10000),
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      mockRefreshFindOne.mockResolvedValue(record);
      mockUserFindById.mockResolvedValue(null);

      await refresh(
        { cookies: { refresh_token: 'valid-token' } } as unknown as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Utilisateur introuvable' });
    });
  });

  // ── logout ────────────────────────────────────────────────────────

  describe('logout', () => {
    it('deletes refresh token and clears cookie', async () => {
      mockRefreshDeleteOne.mockResolvedValue(undefined);

      await logout(
        { cookies: { refresh_token: 'some-token' } } as unknown as Request,
        res as Response
      );

      expect(mockRefreshDeleteOne).toHaveBeenCalledWith({ token: 'some-token' });
      expect(clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(json).toHaveBeenCalledWith({ ok: true });
    });

    it('clears cookie even without refresh_token cookie', async () => {
      await logout(
        { cookies: {} } as unknown as Request,
        res as Response
      );

      expect(mockRefreshDeleteOne).not.toHaveBeenCalled();
      expect(clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(json).toHaveBeenCalledWith({ ok: true });
    });
  });

  // ── me ────────────────────────────────────────────────────────────

  describe('me', () => {
    it('returns serialized user', async () => {
      const user = {
        _id: 'uid',
        email: 'user@example.com',
        role: 'user',
        toObject: () => ({ _id: 'uid', email: 'user@example.com', role: 'user' }),
      };
      const req = { user, prestataire: null } as unknown as AuthRequest;

      await me(req, res as Response);

      expect(json).toHaveBeenCalledWith({ user: expect.objectContaining({ email: 'user@example.com' }) });
    });
  });

  // ── getRoles ──────────────────────────────────────────────────────

  describe('getRoles', () => {
    it('returns role and isPrestataire:false for a client', async () => {
      const req = { user: { role: 'client' }, prestataire: null } as unknown as AuthRequest;

      await getRoles(req, res as Response);

      expect(json).toHaveBeenCalledWith({ role: 'client', isPrestataire: false });
    });

    it('returns isPrestataire:true when prestataire exists', async () => {
      const req = { user: { role: 'prestataire' }, prestataire: { _id: 'pid' } } as unknown as AuthRequest;

      await getRoles(req, res as Response);

      expect(json).toHaveBeenCalledWith({ role: 'prestataire', isPrestataire: true });
    });
  });

  // ── forgotPassword ────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('creates a reset token and sends email when user exists', async () => {
      const { sendForgotPasswordEmail } = jest.requireMock('../../services/emailService');
      mockUserFindOne.mockResolvedValue({ _id: 'uid', email: 'user@example.com' });
      mockPasswordResetCreate.mockResolvedValue({});

      await forgotPassword(
        { body: { email: 'user@example.com' } } as Request,
        res as Response
      );

      expect(mockPasswordResetCreate).toHaveBeenCalled();
      expect(sendForgotPasswordEmail).toHaveBeenCalledWith('user@example.com', 'reset-token-32chars');
      expect(json).toHaveBeenCalledWith({ ok: true });
    });

    it('returns ok:true silently when user does not exist', async () => {
      const { sendForgotPasswordEmail } = jest.requireMock('../../services/emailService');
      mockUserFindOne.mockResolvedValue(null);

      await forgotPassword(
        { body: { email: 'nobody@example.com' } } as Request,
        res as Response
      );

      expect(mockPasswordResetCreate).not.toHaveBeenCalled();
      expect(sendForgotPasswordEmail).not.toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith({ ok: true });
    });
  });

  // ── resetPassword ─────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('resets password when token is valid', async () => {
      const record = {
        user: 'uid',
        expiresAt: new Date(Date.now() + 10000),
        used: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockPasswordResetFindOne.mockResolvedValue(record);
      mockUserFindByIdAndUpdate.mockResolvedValue(undefined);
      mockRefreshDeleteMany.mockResolvedValue(undefined);

      await resetPassword(
        { body: { token: 'valid-token', password: 'newpassword123' } } as Request,
        res as Response
      );

      expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith('uid', { passwordHash: 'hashed-password' });
      expect(mockRefreshDeleteMany).toHaveBeenCalledWith({ user: 'uid' });
      expect(record.used).toBe(true);
      expect(json).toHaveBeenCalledWith({ ok: true });
    });

    it('returns 400 when token is not found', async () => {
      mockPasswordResetFindOne.mockResolvedValue(null);

      await resetPassword(
        { body: { token: 'bad-token', password: 'newpass' } } as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Token invalide ou expiré' });
    });

    it('returns 400 when token is expired', async () => {
      mockPasswordResetFindOne.mockResolvedValue({
        expiresAt: new Date(Date.now() - 1000),
        used: false,
        save: jest.fn(),
      });

      await resetPassword(
        { body: { token: 'expired-token', password: 'newpass' } } as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(400);
    });
  });

  // ── changePassword ────────────────────────────────────────────────

  describe('changePassword', () => {
    const makeUser = () => ({
      _id: 'uid',
      passwordHash: 'old-hash',
      save: jest.fn().mockResolvedValue(undefined),
    });

    it('changes password when current password is correct', async () => {
      mockBcryptCompare.mockResolvedValue(true);
      const user = makeUser();
      const req = { user, body: { currentPassword: 'oldpass', newPassword: 'newpass123' } } as unknown as AuthRequest;

      await changePassword(req, res as Response);

      expect(user.save).toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith({ ok: true });
    });

    it('returns 401 when current password is wrong', async () => {
      mockBcryptCompare.mockResolvedValue(false);
      const user = makeUser();
      const req = { user, body: { currentPassword: 'wrong', newPassword: 'newpass123' } } as unknown as AuthRequest;

      await changePassword(req, res as Response);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Mot de passe actuel incorrect' });
      expect(user.save).not.toHaveBeenCalled();
    });

    it('returns 400 when a required field is missing', async () => {
      const req = { user: makeUser(), body: { currentPassword: 'oldpass' } } as unknown as AuthRequest;

      await changePassword(req, res as Response);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Champs requis manquants' });
    });

    it('returns 400 when new password is too short', async () => {
      const req = { user: makeUser(), body: { currentPassword: 'oldpass', newPassword: 'short' } } as unknown as AuthRequest;

      await changePassword(req, res as Response);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    });
  });
});
