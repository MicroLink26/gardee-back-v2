import { Request, Response } from 'express';
import { validateRatingToken, submitReview } from '../reviewController';
import { ServiceRequest } from '../../models/ServiceRequest';
import { Prestataire } from '../../models/Prestataire';

jest.mock('../../models/ServiceRequest', () => ({
  ServiceRequest: {
    findOne: jest.fn(),
  },
}));

jest.mock('../../models/Prestataire', () => ({
  Prestataire: {
    findOne: jest.fn(),
  },
}));

describe('reviewController', () => {
  const mockSRFindOne = ServiceRequest.findOne as jest.Mock;
  const mockPrestFindOne = Prestataire.findOne as jest.Mock;
  let res: Partial<Response>;
  let json: jest.Mock;
  let status: jest.Mock;

  beforeEach(() => {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    res = { status, json };
    mockSRFindOne.mockClear();
    mockPrestFindOne.mockClear();
  });

  it('returns 400 for invalid rating token', async () => {
    mockSRFindOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    await validateRatingToken({ query: { token: 'bad-token' } } as unknown as Request, res as Response);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Lien invalide ou expiré' });
  });

  it('returns request details for a valid token', async () => {
    const request = { _id: 'id', prestataireId: 'p1', desiredAt: new Date(), prestations: ['nettoyage'] };
    mockSRFindOne.mockReturnValue({ select: jest.fn().mockResolvedValue(request) });

    await validateRatingToken({ query: { token: 'good-token' } } as unknown as Request, res as Response);

    expect(status).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ ok: true, request });
  });

  it('submits a review and updates provider rating', async () => {
    const saveRequest = jest.fn();
    const savePrest = jest.fn();
    const request = {
      prestataireId: 'provider-id',
      ratingDetails: undefined,
      ratingComment: undefined,
      recommend: undefined,
      ratingGivenAt: undefined,
      ratingToken: 'token-123',
      status: 'scheduled',
      save: saveRequest,
    } as any;
    const prestDoc = {
      averageRating: 4,
      numberOfReviews: 1,
      save: savePrest,
    };

    mockSRFindOne.mockResolvedValue(request);
    mockPrestFindOne.mockResolvedValue(prestDoc);

    await submitReview(
      {
        body: {
          token: 'token-123',
          ratings: { time: 4, quality: 5, sympathy: 4, value: 5, punctuality: 4 },
          recommend: true,
          comment: 'Très bien',
        },
      } as unknown as Request,
      res as Response
    );

    expect(saveRequest).toHaveBeenCalled();
    expect(savePrest).toHaveBeenCalled();
    expect(prestDoc.numberOfReviews).toBe(2);
    expect(json).toHaveBeenCalledWith({ ok: true });
  });

  it('rejects invalid rating values', async () => {
    const request = { save: jest.fn() } as any;
    mockSRFindOne.mockResolvedValue(request);

    await submitReview(
      {
        body: {
          token: 'token-123',
          ratings: { time: 0, quality: 6, sympathy: 4, value: 5, punctuality: 4 },
        },
      } as unknown as Request,
      res as Response
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Les notes doivent être entre 1 et 5' });
  });
});
