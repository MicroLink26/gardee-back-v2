import { Request, Response } from 'express';
import { sendMessage, replyByToken, getThreadByToken } from '../messageController';
import { ServiceRequest } from '../../models/ServiceRequest';
import { User } from '../../models/User';
import { AuthRequest } from '../../types';

jest.mock('../../models/ServiceRequest', () => ({
  ServiceRequest: { findOne: jest.fn() },
}));

jest.mock('../../models/User', () => ({
  User: { findById: jest.fn() },
}));

jest.mock('../../services/emailService', () => ({
  sendMessageToClientEmail: jest.fn().mockResolvedValue(undefined),
  sendMessageToProviderEmail: jest.fn().mockResolvedValue(undefined),
}));

describe('messageController', () => {
  const mockSRFindOne = ServiceRequest.findOne as jest.Mock;
  const mockUserFindById = User.findById as jest.Mock;

  let res: Partial<Response>;
  let json: jest.Mock;
  let status: jest.Mock;

  beforeEach(() => {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    res = { status, json };
    jest.clearAllMocks();
  });

  // ── sendMessage ───────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('returns 400 when content is empty', async () => {
      const req = { body: { content: '  ' }, params: { id: 'req-id' }, user: { _id: 'uid' } } as unknown as AuthRequest;

      await sendMessage(req, res as Response);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Le message ne peut pas être vide' });
    });

    it('returns 404 when request is not found', async () => {
      mockSRFindOne.mockResolvedValue(null);
      const req = { body: { content: 'Hello' }, params: { id: 'req-id' }, user: { _id: 'uid', prenom: 'Jean', nom: 'Dupont', email: 'jean@example.com' } } as unknown as AuthRequest;

      await sendMessage(req, res as Response);

      expect(status).toHaveBeenCalledWith(404);
    });

    it('saves the message and returns ok', async () => {
      const saveMock = jest.fn();
      const request = {
        messages: [],
        messageToken: undefined,
        messageTokenExpiresAt: undefined,
        requesterEmail: 'client@example.com',
        save: saveMock,
      } as any;
      request.messages.push = jest.fn();
      mockSRFindOne.mockResolvedValue(request);

      const req = {
        body: { content: 'Bonjour, question sur la demande' },
        params: { id: 'req-id' },
        user: { _id: 'uid', prenom: 'Jean', nom: 'Dupont', email: 'jean@example.com' },
      } as unknown as AuthRequest;

      await sendMessage(req, res as Response);

      expect(saveMock).toHaveBeenCalled();
      expect(request.messageToken).toBeDefined();
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });
  });

  // ── replyByToken ─────────────────────────────────────────────────

  describe('replyByToken', () => {
    it('returns 400 for invalid token', async () => {
      mockSRFindOne.mockResolvedValue(null);

      await replyByToken(
        { body: { token: 'bad-token', content: 'Ma réponse' } } as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Lien invalide ou expiré' });
    });

    it('returns 400 when content is empty', async () => {
      await replyByToken(
        { body: { token: 'tok', content: '' } } as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(400);
    });

    it('saves the reply and rotates the token', async () => {
      const saveMock = jest.fn();
      const request = {
        messages: [],
        messageToken: 'old-token',
        messageTokenExpiresAt: new Date(Date.now() + 86400000),
        requesterEmail: 'client@example.com',
        requesterPrenom: 'Marie',
        requesterNom: 'Curie',
        prestataireId: 'prest-id',
        save: saveMock,
      } as any;
      request.messages.push = jest.fn();
      mockSRFindOne.mockResolvedValue(request);
      mockUserFindById.mockResolvedValue({ prenom: 'Jean', nom: 'Dupont', email: 'jean@example.com' });

      await replyByToken(
        { body: { token: 'old-token', content: 'Ma réponse' } } as Request,
        res as Response
      );

      expect(saveMock).toHaveBeenCalled();
      expect(request.messageToken).not.toBe('old-token');
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, newToken: expect.any(String) }));
    });
  });

  // ── getThreadByToken ──────────────────────────────────────────────

  describe('getThreadByToken', () => {
    it('returns 400 for expired or invalid token', async () => {
      mockSRFindOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await getThreadByToken(
        { query: { token: 'expired' } } as unknown as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(400);
    });

    it('returns messages, prestataireName and clientEmail', async () => {
      const request = {
        messages: [{ fromRole: 'provider', content: 'Bonjour' }],
        requesterEmail: 'client@example.com',
        prestataireId: 'prest-id',
      };
      mockSRFindOne.mockReturnValue({ select: jest.fn().mockResolvedValue(request) });
      mockUserFindById.mockReturnValue({ select: jest.fn().mockResolvedValue({ prenom: 'Jean', nom: 'Dupont' }) });

      await getThreadByToken(
        { query: { token: 'valid-token' } } as unknown as Request,
        res as Response
      );

      expect(json).toHaveBeenCalledWith({
        messages: request.messages,
        prestataireName: 'Jean Dupont',
        clientEmail: 'client@example.com',
      });
    });
  });
});
