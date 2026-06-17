import { Request, Response } from 'express';
import {
  createRequest, confirmRequest, resendConfirmation,
  listMyRequests, listMyClientRequests,
  providerAccept, providerPropose, providerRefuse, providerCancel,
  clientAcceptProposal, clientAcceptProposalByToken, clientRefuseProposalByToken,
  markComplete,
} from '../requestController';
import { ServiceRequest } from '../../models/ServiceRequest';
import { User } from '../../models/User';
import { Prestataire } from '../../models/Prestataire';
import { AuthRequest } from '../../types';

jest.mock('../../models/ServiceRequest', () => ({
  ServiceRequest: {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.mock('../../models/User', () => ({
  User: {
    findOne: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock('../../models/Prestataire', () => ({
  Prestataire: {
    findOne: jest.fn(),
  },
}));

jest.mock('../../services/emailService', () => ({
  sendRequestConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendRequestToProvider: jest.fn().mockResolvedValue(undefined),
  sendProviderAcceptedEmail: jest.fn().mockResolvedValue(undefined),
  sendProviderProposedEmail: jest.fn().mockResolvedValue(undefined),
  sendProviderRefusedEmail: jest.fn().mockResolvedValue(undefined),
  sendClientRefusedProposalEmail: jest.fn().mockResolvedValue(undefined),
}));

describe('requestController', () => {
  const mockSRFindOne = ServiceRequest.findOne as jest.Mock;
  const mockSRFind = ServiceRequest.find as jest.Mock;
  const mockSRCreate = ServiceRequest.create as jest.Mock;
  const mockSRCountDocuments = ServiceRequest.countDocuments as jest.Mock;
  const mockUserFindOne = User.findOne as jest.Mock;
  const mockUserFindById = User.findById as jest.Mock;
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

  const makeRequest = (overrides = {}) => ({
    _id: 'req-id',
    prestataireId: 'prest-id',
    requesterEmail: 'client@example.com',
    status: 'sent_to_provider',
    proposals: [],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as any;

  const makeUser = (overrides = {}) => ({
    _id: 'prest-id',
    email: 'prest@example.com',
    prenom: 'Jean',
    nom: 'Dupont',
    role: 'prestataire',
    toObject: () => ({}),
    ...overrides,
  }) as any;

  const makePrestataire = (overrides = {}) => ({
    _id: 'prest-doc-id',
    userId: 'prest-id',
    is_validated: true,
    ...overrides,
  }) as any;

  // ── createRequest ─────────────────────────────────────────────────

  describe('createRequest', () => {
    it('returns 400 when prestataireId or requesterEmail is missing', async () => {
      await createRequest(
        { body: { requesterEmail: 'a@b.com' } } as Request,
        res as Response
      );
      expect(status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when prestataire not found', async () => {
      mockPrestFindOne.mockResolvedValue(null);
      await createRequest(
        { body: { prestataireId: '507f1f77bcf86cd799439011', requesterEmail: 'a@b.com' } } as Request,
        res as Response
      );
      expect(status).toHaveBeenCalledWith(404);
    });

    it('creates the request and sends confirmation email', async () => {
      const { sendRequestConfirmationEmail } = jest.requireMock('../../services/emailService');
      mockPrestFindOne.mockResolvedValue(makePrestataire());
      mockUserFindById.mockResolvedValue(makeUser());
      mockSRCreate.mockResolvedValue({ _id: 'new-id' });

      await createRequest(
        { body: { prestataireId: '507f1f77bcf86cd799439011', requesterEmail: 'Client@B.com', prestations: ['Tonte'] } } as Request,
        res as Response
      );

      expect(mockSRCreate).toHaveBeenCalledWith(expect.objectContaining({
        requesterEmail: 'client@b.com',
        status: 'email_pending',
      }));
      expect(sendRequestConfirmationEmail).toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, id: 'new-id' }));
    });

    it('defaults prestations to [] when not provided', async () => {
      mockPrestFindOne.mockResolvedValue(makePrestataire());
      mockUserFindById.mockResolvedValue(makeUser());
      mockSRCreate.mockResolvedValue({ _id: 'new-id' });

      await createRequest(
        { body: { prestataireId: '507f1f77bcf86cd799439011', requesterEmail: 'client@b.com' } } as Request,
        res as Response
      );

      expect(mockSRCreate).toHaveBeenCalledWith(expect.objectContaining({ prestations: [] }));
    });
  });

  // ── confirmRequest ────────────────────────────────────────────────

  describe('confirmRequest', () => {
    it('returns 400 for invalid or expired token', async () => {
      mockSRFindOne.mockResolvedValue(null);
      await confirmRequest({ query: { token: 'bad' } } as unknown as Request, res as Response);
      expect(status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when prestataire no longer exists', async () => {
      mockSRFindOne.mockResolvedValue(makeRequest());
      mockUserFindById.mockResolvedValue(null);
      await confirmRequest({ query: { token: 'tok' } } as unknown as Request, res as Response);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('confirms and notifies the provider', async () => {
      const { sendRequestToProvider } = jest.requireMock('../../services/emailService');
      const request = makeRequest();
      mockSRFindOne.mockResolvedValue(request);
      mockUserFindById.mockResolvedValue(makeUser());

      await confirmRequest({ query: { token: 'tok' } } as unknown as Request, res as Response);

      expect(request.save).toHaveBeenCalled();
      expect(sendRequestToProvider).toHaveBeenCalled();
      expect(request.status).toBe('sent_to_provider');
      expect(json).toHaveBeenCalledWith({ ok: true, status: 'sent_to_provider' });
    });
  });

  // ── resendConfirmation ────────────────────────────────────────────

  describe('resendConfirmation', () => {
    it('returns 404 when request not found', async () => {
      mockSRFindOne.mockResolvedValue(null);
      await resendConfirmation(
        { body: { token: 'tok', email: 'a@b.com' } } as Request,
        res as Response
      );
      expect(status).toHaveBeenCalledWith(404);
    });

    it('returns 429 when within cooldown period', async () => {
      mockSRFindOne.mockResolvedValue(makeRequest({ lastResendAt: new Date() }));
      await resendConfirmation(
        { body: { token: 'tok', email: 'client@example.com' } } as Request,
        res as Response
      );
      expect(status).toHaveBeenCalledWith(429);
    });

    it('returns 404 when prestataire not found', async () => {
      mockSRFindOne.mockResolvedValue(makeRequest({ lastResendAt: null }));
      mockUserFindById.mockResolvedValue(null);
      await resendConfirmation(
        { body: { token: 'tok', email: 'client@example.com' } } as Request,
        res as Response
      );
      expect(status).toHaveBeenCalledWith(404);
    });

    it('resends confirmation email and updates lastResendAt', async () => {
      const { sendRequestConfirmationEmail } = jest.requireMock('../../services/emailService');
      const request = makeRequest({ lastResendAt: null });
      mockSRFindOne.mockResolvedValue(request);
      mockUserFindById.mockResolvedValue(makeUser());

      await resendConfirmation(
        { body: { token: 'tok', email: 'client@example.com' } } as Request,
        res as Response
      );

      expect(request.lastResendAt).toBeInstanceOf(Date);
      expect(request.save).toHaveBeenCalled();
      expect(sendRequestConfirmationEmail).toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith({ ok: true });
    });
  });

  // ── listMyRequests ────────────────────────────────────────────────

  describe('listMyRequests', () => {
    it('returns paginated requests for the authenticated provider', async () => {
      const items = [makeRequest()];
      mockSRFind.mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(items) }) }) });
      mockSRCountDocuments.mockResolvedValue(1);

      const req = { query: {}, user: { _id: 'prest-id' } } as unknown as AuthRequest;
      await listMyRequests(req, res as Response);

      expect(json).toHaveBeenCalledWith({ items, total: 1, page: 1, pageSize: 20 });
    });
  });

  // ── listMyClientRequests ──────────────────────────────────────────

  describe('listMyClientRequests', () => {
    it('returns paginated requests for the authenticated client', async () => {
      const items = [makeRequest()];
      mockSRFind.mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(items) }) }) });
      mockSRCountDocuments.mockResolvedValue(1);

      const req = { query: {}, user: { _id: 'uid', email: 'client@example.com' } } as unknown as AuthRequest;
      await listMyClientRequests(req, res as Response);

      expect(json).toHaveBeenCalledWith({ items, total: 1, page: 1, pageSize: 20 });
    });
  });

  // ── providerAccept ────────────────────────────────────────────────

  describe('providerAccept', () => {
    it('returns 404 when request not found', async () => {
      mockSRFindOne.mockResolvedValue(null);
      const req = { params: { id: 'req-id' }, user: makeUser() } as unknown as AuthRequest;
      await providerAccept(req, res as Response);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('marks request as scheduled and notifies client', async () => {
      const { sendProviderAcceptedEmail } = jest.requireMock('../../services/emailService');
      const request = makeRequest();
      mockSRFindOne.mockResolvedValue(request);
      const req = { params: { id: 'req-id' }, user: makeUser() } as unknown as AuthRequest;

      await providerAccept(req, res as Response);

      expect(request.status).toBe('scheduled');
      expect(request.save).toHaveBeenCalled();
      expect(sendProviderAcceptedEmail).toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith({ ok: true, status: 'scheduled' });
    });
  });

  // ── providerPropose ───────────────────────────────────────────────

  describe('providerPropose', () => {
    it('returns 404 when request not found', async () => {
      mockSRFindOne.mockResolvedValue(null);
      const req = { params: { id: 'req-id' }, body: { date: '2025-07-01' }, user: makeUser() } as unknown as AuthRequest;
      await providerPropose(req, res as Response);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('saves proposal and sends email', async () => {
      const { sendProviderProposedEmail } = jest.requireMock('../../services/emailService');
      const request = makeRequest({ proposals: [] });
      request.proposals.push = jest.fn();
      mockSRFindOne.mockResolvedValue(request);
      const req = {
        params: { id: 'req-id' },
        body: { date: '2025-07-01T10:00:00Z', comment: 'Je suis dispo' },
        user: makeUser(),
      } as unknown as AuthRequest;

      await providerPropose(req, res as Response);

      expect(request.proposals.push).toHaveBeenCalled();
      expect(request.status).toBe('provider_proposed');
      expect(request.proposalToken).toBeDefined();
      expect(request.save).toHaveBeenCalled();
      expect(sendProviderProposedEmail).toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, status: 'provider_proposed' }));
    });
  });

  // ── providerRefuse ────────────────────────────────────────────────

  describe('providerRefuse', () => {
    it('returns 404 when request not found', async () => {
      mockSRFindOne.mockResolvedValue(null);
      const req = { params: { id: 'req-id' }, body: {}, user: makeUser() } as unknown as AuthRequest;
      await providerRefuse(req, res as Response);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('marks request as refused and notifies client', async () => {
      const { sendProviderRefusedEmail } = jest.requireMock('../../services/emailService');
      const request = makeRequest();
      mockSRFindOne.mockResolvedValue(request);
      const req = { params: { id: 'req-id' }, body: { message: 'Indisponible' }, user: makeUser() } as unknown as AuthRequest;

      await providerRefuse(req, res as Response);

      expect(request.status).toBe('refused');
      expect(sendProviderRefusedEmail).toHaveBeenCalledWith(request, expect.any(Object), 'Indisponible');
      expect(json).toHaveBeenCalledWith({ ok: true, status: 'refused' });
    });
  });

  // ── providerCancel ────────────────────────────────────────────────

  describe('providerCancel', () => {
    it('returns 404 when request not found', async () => {
      mockSRFindOne.mockResolvedValue(null);
      const req = { params: { id: 'req-id' }, user: makeUser() } as unknown as AuthRequest;
      await providerCancel(req, res as Response);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('marks request as cancelled', async () => {
      const request = makeRequest({ status: 'scheduled' });
      mockSRFindOne.mockResolvedValue(request);
      const req = { params: { id: 'req-id' }, user: makeUser() } as unknown as AuthRequest;

      await providerCancel(req, res as Response);

      expect(request.status).toBe('cancelled');
      expect(request.save).toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith({ ok: true });
    });
  });

  // ── clientAcceptProposal ──────────────────────────────────────────

  describe('clientAcceptProposal', () => {
    it('returns 404 when request not found', async () => {
      mockSRFindOne.mockResolvedValue(null);
      const req = { params: { id: 'req-id' }, user: { email: 'client@example.com' } } as unknown as AuthRequest;
      await clientAcceptProposal(req, res as Response);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('accepts proposal and sets desiredAt from last proposal', async () => {
      const proposalDate = new Date('2025-07-10T09:00:00Z');
      const request = makeRequest({
        status: 'provider_proposed',
        proposals: [{ date: proposalDate }],
        desiredAt: undefined,
      });
      mockSRFindOne.mockResolvedValue(request);
      const req = { params: { id: 'req-id' }, user: { email: 'client@example.com' } } as unknown as AuthRequest;

      await clientAcceptProposal(req, res as Response);

      expect(request.desiredAt).toBe(proposalDate);
      expect(request.status).toBe('scheduled');
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, status: 'scheduled' }));
    });

    it('accepts without setting desiredAt when no proposals exist', async () => {
      const request = makeRequest({ status: 'provider_proposed', proposals: [], desiredAt: undefined });
      mockSRFindOne.mockResolvedValue(request);
      const req = { params: { id: 'req-id' }, user: { email: 'client@example.com' } } as unknown as AuthRequest;

      await clientAcceptProposal(req, res as Response);

      expect(request.desiredAt).toBeUndefined();
      expect(request.status).toBe('scheduled');
    });
  });

  // ── clientAcceptProposalByToken ───────────────────────────────────

  describe('clientAcceptProposalByToken', () => {
    it('returns 400 when token is missing', async () => {
      await clientAcceptProposalByToken({ query: {} } as unknown as Request, res as Response);
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Token manquant' });
    });

    it('returns 404 for invalid or expired token', async () => {
      mockSRFindOne.mockResolvedValue(null);
      await clientAcceptProposalByToken({ query: { token: 'bad' } } as unknown as Request, res as Response);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('accepts proposal and clears proposalToken', async () => {
      const proposalDate = new Date('2025-07-10T09:00:00Z');
      const request = makeRequest({ proposals: [{ date: proposalDate }], proposalToken: 'valid-tok' });
      mockSRFindOne.mockResolvedValue(request);

      await clientAcceptProposalByToken({ query: { token: 'valid-tok' } } as unknown as Request, res as Response);

      expect(request.status).toBe('scheduled');
      expect(request.proposalToken).toBeUndefined();
      expect(request.desiredAt).toBe(proposalDate);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });
  });

  // ── clientRefuseProposalByToken ───────────────────────────────────

  describe('clientRefuseProposalByToken', () => {
    it('returns 400 when token is missing', async () => {
      await clientRefuseProposalByToken({ query: {} } as unknown as Request, res as Response);
      expect(status).toHaveBeenCalledWith(400);
    });

    it('returns 404 for invalid or expired token', async () => {
      mockSRFindOne.mockResolvedValue(null);
      await clientRefuseProposalByToken({ query: { token: 'bad' } } as unknown as Request, res as Response);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('refuses proposal, notifies provider, and resets token', async () => {
      const { sendClientRefusedProposalEmail } = jest.requireMock('../../services/emailService');
      const proposalDate = new Date('2025-07-10T09:00:00Z');
      const request = makeRequest({ proposals: [{ date: proposalDate }], proposalToken: 'valid-tok' });
      mockSRFindOne.mockResolvedValue(request);
      mockUserFindById.mockResolvedValue(makeUser());

      await clientRefuseProposalByToken({ query: { token: 'valid-tok' } } as unknown as Request, res as Response);

      expect(request.status).toBe('sent_to_provider');
      expect(request.proposalToken).toBeUndefined();
      expect(sendClientRefusedProposalEmail).toHaveBeenCalledWith(request, expect.any(Object), proposalDate);
      expect(json).toHaveBeenCalledWith({ ok: true });
    });

    it('skips email when prestataire not found', async () => {
      const { sendClientRefusedProposalEmail } = jest.requireMock('../../services/emailService');
      const request = makeRequest({ proposals: [{ date: new Date() }], proposalToken: 'tok' });
      mockSRFindOne.mockResolvedValue(request);
      mockUserFindById.mockResolvedValue(null);

      await clientRefuseProposalByToken({ query: { token: 'tok' } } as unknown as Request, res as Response);

      expect(sendClientRefusedProposalEmail).not.toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith({ ok: true });
    });
  });

  // ── markComplete ──────────────────────────────────────────────────

  describe('markComplete', () => {
    it('returns 404 when request not found', async () => {
      mockSRFindOne.mockResolvedValue(null);
      const req = { params: { id: 'req-id' }, user: makeUser() } as unknown as AuthRequest;
      await markComplete(req, res as Response);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('marks request as completed', async () => {
      const request = makeRequest({ status: 'scheduled' });
      mockSRFindOne.mockResolvedValue(request);
      const req = { params: { id: 'req-id' }, user: makeUser() } as unknown as AuthRequest;

      await markComplete(req, res as Response);

      expect(request.status).toBe('completed');
      expect(request.save).toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith({ ok: true });
    });
  });
});
