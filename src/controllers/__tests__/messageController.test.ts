import { Request, Response } from 'express';
import { sendMessage, replyByToken, getThreadByToken, getMessages, listThreads, clientSendMessage } from '../messageController';
import { ServiceRequest } from '../../models/ServiceRequest';
import { User } from '../../models/User';
import { AuthRequest } from '../../types';

jest.mock('../../models/ServiceRequest', () => ({
  ServiceRequest: { findOne: jest.fn(), find: jest.fn() },
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
  const mockSRFind = ServiceRequest.find as jest.Mock;
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

    it('uses requesterEmail as clientName when requesterPrenom is absent', async () => {
      const saveMock = jest.fn();
      const request = {
        messages: [],
        messageToken: 'tok',
        messageTokenExpiresAt: new Date(Date.now() + 86400000),
        requesterEmail: 'anon@example.com',
        requesterPrenom: undefined,
        prestataireId: 'prest-id',
        save: saveMock,
      } as any;
      request.messages.push = jest.fn();
      mockSRFindOne.mockResolvedValue(request);
      mockUserFindById.mockResolvedValue(null);

      await replyByToken(
        { body: { token: 'tok', content: 'Réponse' } } as Request,
        res as Response
      );

      expect(request.messages.push).toHaveBeenCalledWith(
        expect.objectContaining({ fromName: 'anon@example.com' })
      );
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

    it('returns empty prestataireName when prestataire not found', async () => {
      const request = {
        messages: [],
        requesterEmail: 'client@example.com',
        prestataireId: 'prest-id',
      };
      mockSRFindOne.mockReturnValue({ select: jest.fn().mockResolvedValue(request) });
      mockUserFindById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await getThreadByToken(
        { query: { token: 'valid-token' } } as unknown as Request,
        res as Response
      );

      expect(json).toHaveBeenCalledWith(expect.objectContaining({ prestataireName: '' }));
    });
  });

  // ── getMessages ───────────────────────────────────────────────────

  describe('getMessages', () => {
    it('returns messages and token for a valid request', async () => {
      const request = {
        messages: [{ fromRole: 'provider', content: 'Bonjour' }],
        messageToken: 'tok-123',
      };
      mockSRFindOne.mockReturnValue({ select: jest.fn().mockResolvedValue(request) });

      const req = {
        params: { id: 'req-id' },
        user: { _id: 'uid' },
      } as unknown as AuthRequest;

      await getMessages(req, res as Response);

      expect(json).toHaveBeenCalledWith({ messages: request.messages, token: 'tok-123' });
    });

    it('returns 404 when request is not found', async () => {
      mockSRFindOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      const req = {
        params: { id: 'unknown-id' },
        user: { _id: 'uid' },
      } as unknown as AuthRequest;

      await getMessages(req, res as Response);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({ error: 'Demande introuvable' });
    });
  });

  // ── listThreads ───────────────────────────────────────────────────

  describe('listThreads', () => {
    it('returns formatted threads with last message', async () => {
      const lastMsg = { fromRole: 'client', content: 'Merci', createdAt: new Date() };
      const requests = [
        {
          _id: 'req-1',
          requesterEmail: 'client@example.com',
          requesterPrenom: 'Marie',
          requesterNom: 'Curie',
          status: 'scheduled',
          messages: [lastMsg],
          createdAt: new Date(),
        },
      ];
      mockSRFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(requests),
        }),
      });

      const req = { user: { _id: 'uid' } } as unknown as AuthRequest;

      await listThreads(req, res as Response);

      expect(json).toHaveBeenCalledWith({
        threads: [expect.objectContaining({
          _id: 'req-1',
          requesterEmail: 'client@example.com',
          requesterName: 'Marie Curie',
          status: 'scheduled',
          messageCount: 1,
          lastMessage: lastMsg,
        })],
      });
    });

    it('uses requesterEmail as name when prenom is absent', async () => {
      const requests = [
        {
          _id: 'req-2',
          requesterEmail: 'anon@example.com',
          requesterPrenom: undefined,
          requesterNom: undefined,
          status: 'pending',
          messages: [{ fromRole: 'provider', content: 'Hello' }],
          createdAt: new Date(),
        },
      ];
      mockSRFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(requests),
        }),
      });

      const req = { user: { _id: 'uid' } } as unknown as AuthRequest;

      await listThreads(req, res as Response);

      const thread = (json.mock.calls[0][0] as any).threads[0];
      expect(thread.requesterName).toBe('anon@example.com');
    });
  });

  // ── clientSendMessage ─────────────────────────────────────────────

  describe('clientSendMessage', () => {
    it('returns 400 when content is empty', async () => {
      const req = {
        body: { content: '' },
        params: { id: 'req-id' },
        user: { _id: 'uid', email: 'client@example.com', prenom: 'Marie', nom: 'Curie' },
      } as unknown as AuthRequest;

      await clientSendMessage(req, res as Response);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Le message ne peut pas être vide' });
    });

    it('returns 404 when request is not found', async () => {
      mockSRFindOne.mockResolvedValue(null);

      const req = {
        body: { content: 'Ma question' },
        params: { id: 'unknown' },
        user: { _id: 'uid', email: 'client@example.com', prenom: 'Marie', nom: 'Curie' },
      } as unknown as AuthRequest;

      await clientSendMessage(req, res as Response);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({ error: 'Demande introuvable' });
    });

    it('saves the message and notifies the provider', async () => {
      const { sendMessageToProviderEmail } = jest.requireMock('../../services/emailService');
      const saveMock = jest.fn();
      const request = {
        messages: [],
        prestataireId: 'prest-id',
        save: saveMock,
      } as any;
      request.messages.push = jest.fn();
      mockSRFindOne.mockResolvedValue(request);
      mockUserFindById.mockResolvedValue({ prenom: 'Jean', nom: 'Dupont', email: 'jean@example.com' });

      const req = {
        body: { content: 'Bonjour, est-ce disponible ?' },
        params: { id: 'req-id' },
        user: { _id: 'uid', email: 'client@example.com', prenom: 'Marie', nom: 'Curie' },
      } as unknown as AuthRequest;

      await clientSendMessage(req, res as Response);

      expect(saveMock).toHaveBeenCalled();
      expect(sendMessageToProviderEmail).toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it('saves the message without error when provider is not found', async () => {
      const saveMock = jest.fn();
      const request = {
        messages: [],
        prestataireId: 'prest-id',
        save: saveMock,
      } as any;
      request.messages.push = jest.fn();
      mockSRFindOne.mockResolvedValue(request);
      mockUserFindById.mockResolvedValue(null);

      const req = {
        body: { content: 'Message sans prestataire' },
        params: { id: 'req-id' },
        user: { _id: 'uid', email: 'client@example.com', prenom: 'Marie', nom: 'Curie' },
      } as unknown as AuthRequest;

      await clientSendMessage(req, res as Response);

      expect(saveMock).toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });
  });
});
