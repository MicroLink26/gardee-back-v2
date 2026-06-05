import { Request, Response } from 'express';
import {
  registerPrestataire, addPrestataireProfile, updateMyPrestataire,
  getPublicProfile, searchPrestataires, getRanking, getReviews, geocodePrestataire,
} from '../prestataireController';
import { User } from '../../models/User';
import { Prestataire } from '../../models/Prestataire';
import * as geocodingModule from '../../utils/geocoding';
import * as fileUpload from '../../utils/fileUpload';
import { AuthRequest } from '../../types';

jest.mock('../../models/User', () => ({
  User: { findOne: jest.fn(), findById: jest.fn(), create: jest.fn() },
}));

jest.mock('../../models/Prestataire', () => ({
  Prestataire: { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), countDocuments: jest.fn() },
}));

jest.mock('../../models/ServiceRequest', () => ({
  ServiceRequest: {
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hashed-pw') }));

jest.mock('../../utils/geocoding', () => ({ geocodeAddress: jest.fn().mockResolvedValue(null) }));

jest.mock('../../utils/fileUpload', () => ({
  uploadProfileImage: jest.fn().mockResolvedValue({ secure_url: 'https://img.url', public_id: 'pid' }),
}));

jest.mock('../../services/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendEmailVerificationCode: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../models/Category', () => ({
  Category: {
    findById: jest.fn((id: string) => ({
      select: jest.fn().mockResolvedValue({ _id: id, nom: id }),
    })),
    find: jest.fn(() => ({
      select: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue([]),
      })),
    })),
  },
}));

describe('prestataireController', () => {
  const mockUserFindOne = User.findOne as jest.Mock;
  const mockUserFindById = User.findById as jest.Mock;
  const mockUserCreate = User.create as jest.Mock;
  const mockPrestFindOne = Prestataire.findOne as jest.Mock;
  const mockPrestFind = Prestataire.find as jest.Mock;
  const mockPrestCreate = Prestataire.create as jest.Mock;
  const mockPrestCount = Prestataire.countDocuments as jest.Mock;
  const mockGeocode = geocodingModule.geocodeAddress as jest.Mock;
  const mockUpload = fileUpload.uploadProfileImage as jest.Mock;

  let res: Partial<Response>;
  let json: jest.Mock;
  let status: jest.Mock;

  beforeEach(() => {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    res = { status, json };
    jest.clearAllMocks();
    mockGeocode.mockResolvedValue(null);
  });

  const makeUser = (overrides = {}) => ({
    _id: 'uid',
    email: 'prest@example.com',
    prenom: 'Jean',
    nom: 'Dupont',
    role: 'user',
    save: jest.fn(),
    toObject: () => ({ _id: 'uid', email: 'prest@example.com', prenom: 'Jean', nom: 'Dupont' }),
    ...overrides,
  }) as any;

  const makePrestataire = (overrides = {}) => ({
    _id: 'pid',
    userId: 'uid',
    prestations: ['Tonte'],
    ville: 'Paris',
    adresse: '1 rue Test',
    codePostal: '75000',
    averageRating: 4.5,
    numberOfReviews: 2,
    save: jest.fn(),
    toObject: () => ({ _id: 'pid', prestations: ['Tonte'] }),
    ...overrides,
  }) as any;

  const makePrestForSearch = (overrides = {}) => ({
    userId: { _id: 'uid', nom: 'Dupont', prenom: 'Jean', email: 'p@b.com' },
    ville: 'Paris',
    prestations: ['Tonte'],
    tarifHoraire: 25,
    profil_image: null,
    averageRating: 4,
    numberOfReviews: 1,
    location: null,
    ...overrides,
  }) as any;

  // ── registerPrestataire ───────────────────────────────────────────

  describe('registerPrestataire', () => {
    it('returns 400 when required fields are missing', async () => {
      await registerPrestataire(
        { body: { email: 'a@b.com', password: 'pass' } } as Request,
        res as Response
      );
      expect(status).toHaveBeenCalledWith(400);
    });

    it('returns 409 when email already exists', async () => {
      mockUserFindOne.mockResolvedValue({ _id: 'existing' });
      await registerPrestataire(
        { body: { email: 'taken@b.com', password: 'pass', nom: 'D', prenom: 'J', telephone: '06' } } as Request,
        res as Response
      );
      expect(status).toHaveBeenCalledWith(409);
    });

    it('creates user and prestataire, returns 201', async () => {
      mockUserFindOne.mockResolvedValue(null);
      const user = makeUser();
      mockUserCreate.mockResolvedValue(user);
      const prest = makePrestataire();
      mockPrestCreate.mockResolvedValue(prest);

      await registerPrestataire(
        { body: { email: 'new@b.com', password: 'pass123', nom: 'D', prenom: 'J', telephone: '06' }, files: undefined } as unknown as Request,
        res as Response
      );

      expect(mockPrestCreate).toHaveBeenCalledWith(expect.objectContaining({ is_validated: false }));
      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it('uploads photo when files.photo is provided', async () => {
      mockUserFindOne.mockResolvedValue(null);
      const user = makeUser();
      mockUserCreate.mockResolvedValue(user);
      const prest = makePrestataire();
      mockPrestCreate.mockResolvedValue(prest);

      await registerPrestataire(
        {
          body: { email: 'new@b.com', password: 'pass123', nom: 'D', prenom: 'J', telephone: '06' },
          files: { photo: { mimetype: 'image/jpeg', size: 100, data: Buffer.from('') } },
        } as unknown as Request,
        res as Response
      );

      expect(mockUpload).toHaveBeenCalled();
      expect(prest.save).toHaveBeenCalled();
    });

    it('geocodes and saves location in background when geo resolves', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(makeUser());
      const prest = makePrestataire();
      mockPrestCreate.mockResolvedValue(prest);
      mockGeocode.mockResolvedValue({ lat: 48.85, lng: 2.35 });

      await registerPrestataire(
        { body: { email: 'new@b.com', password: 'pass123', nom: 'D', prenom: 'J', telephone: '06' }, files: undefined } as unknown as Request,
        res as Response
      );
      // flush the fire-and-forget .then() callback
      await new Promise(resolve => setImmediate(resolve));

      expect(prest.location).toEqual({ type: 'Point', coordinates: [2.35, 48.85] });
      expect(prest.geocodeStatus).toBe('ok');
    });

    it('continues when photo upload throws', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(makeUser());
      mockPrestCreate.mockResolvedValue(makePrestataire());
      mockUpload.mockRejectedValueOnce(new Error('Upload failed'));

      await registerPrestataire(
        {
          body: { email: 'new@b.com', password: 'pass123', nom: 'D', prenom: 'J', telephone: '06' },
          files: { photo: {} },
        } as unknown as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(201);
    });

    it('completes successfully when welcome email fails', async () => {
      const { sendWelcomeEmail } = jest.requireMock('../../services/emailService');
      sendWelcomeEmail.mockRejectedValueOnce(new Error('SMTP down'));
      mockUserFindOne.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(makeUser());
      mockPrestCreate.mockResolvedValue(makePrestataire());

      await registerPrestataire(
        { body: { email: 'new@b.com', password: 'pass123', nom: 'D', prenom: 'J', telephone: '06' } } as Request,
        res as Response
      );

      expect(status).toHaveBeenCalledWith(201);
    });
  });

  // ── addPrestataireProfile ─────────────────────────────────────────

  describe('addPrestataireProfile', () => {
    it('returns 409 when user already has a prestataire profile', async () => {
      const req = { user: makeUser(), prestataire: makePrestataire(), body: {} } as unknown as AuthRequest;
      await addPrestataireProfile(req, res as Response);
      expect(status).toHaveBeenCalledWith(409);
    });

    it('creates a new prestataire profile', async () => {
      const prest = makePrestataire();
      mockPrestCreate.mockResolvedValue(prest);
      const req = {
        user: makeUser(),
        prestataire: null,
        body: { prestations: ['Tonte'], ville: 'Lyon' },
      } as unknown as AuthRequest;

      await addPrestataireProfile(req, res as Response);

      expect(mockPrestCreate).toHaveBeenCalledWith(expect.objectContaining({ is_validated: false }));
      expect(status).toHaveBeenCalledWith(201);
    });

    it('defaults prestations to [] when not provided', async () => {
      mockPrestCreate.mockResolvedValue(makePrestataire());
      const req = {
        user: makeUser(),
        prestataire: null,
        body: { ville: 'Lyon' },
      } as unknown as AuthRequest;

      await addPrestataireProfile(req, res as Response);

      expect(mockPrestCreate).toHaveBeenCalledWith(expect.objectContaining({ prestations: [] }));
    });
  });

  // ── updateMyPrestataire ───────────────────────────────────────────

  describe('updateMyPrestataire', () => {
    it('returns 404 when no prestataire profile', async () => {
      const req = { user: makeUser(), prestataire: null, body: {} } as unknown as AuthRequest;
      await updateMyPrestataire(req, res as Response);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('updates editable fields and saves', async () => {
      const prest = makePrestataire();
      const user = makeUser();
      user.toObject = () => ({ _id: 'uid' });
      const req = {
        user,
        prestataire: prest,
        body: { tarifHoraire: 30, ville: 'Lyon' },
        files: undefined,
      } as unknown as AuthRequest;

      await updateMyPrestataire(req, res as Response);

      expect((prest as any).tarifHoraire).toBe(30);
      expect((prest as any).ville).toBe('Lyon');
      expect(prest.save).toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ user: expect.any(Object) }));
    });

    it('uploads photo when files.photo is provided', async () => {
      const prest = makePrestataire();
      const user = makeUser();
      user.toObject = () => ({ _id: 'uid' });
      const req = {
        user,
        prestataire: prest,
        body: {},
        files: { photo: { mimetype: 'image/jpeg', size: 100, data: Buffer.from('') } },
      } as unknown as AuthRequest;

      await updateMyPrestataire(req, res as Response);

      expect(mockUpload).toHaveBeenCalled();
      expect(prest.profil_image).toEqual({ secure_url: 'https://img.url', public_id: 'pid' });
    });
  });

  // ── getPublicProfile ──────────────────────────────────────────────

  describe('getPublicProfile', () => {
    it('returns 404 when user not found', async () => {
      mockUserFindById.mockResolvedValue(null);
      await getPublicProfile({ params: { id: 'uid' } } as unknown as Request, res as Response);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('returns 404 when prestataire profile not found', async () => {
      mockUserFindById.mockResolvedValue(makeUser());
      mockPrestFindOne.mockResolvedValue(null);
      await getPublicProfile({ params: { id: 'uid' } } as unknown as Request, res as Response);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('returns public profile without passwordHash', async () => {
      mockUserFindById.mockResolvedValue(makeUser());
      mockPrestFindOne.mockResolvedValue(makePrestataire());
      await getPublicProfile({ params: { id: 'uid' } } as unknown as Request, res as Response);

      const result = json.mock.calls[0][0].user;
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.isPrestataire).toBe(true);
    });
  });

  // ── searchPrestataires ────────────────────────────────────────────

  describe('searchPrestataires', () => {
    const makeQueryChain = (items: unknown[] = []) => {
      return {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(items),
      };
    };

    it('returns all validated prestataires without filter', async () => {
      const prests = [makePrestForSearch()];
      mockPrestFind.mockReturnValue(makeQueryChain(prests));
      mockPrestCount.mockResolvedValue(1);

      await searchPrestataires({ query: {} } as unknown as Request, res as Response);

      expect(json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
    });

    it('filters results by q (text search)', async () => {
      const prests = [
        makePrestForSearch({ userId: { _id: 'u1', nom: 'Dupont', prenom: 'Jean' }, prestations: ['Tonte'] }),
        makePrestForSearch({ userId: { _id: 'u2', nom: 'Martin', prenom: 'Paul' }, prestations: ['Taille'] }),
      ];
      mockPrestFind.mockReturnValue(makeQueryChain(prests));
      mockPrestCount.mockResolvedValue(2);

      await searchPrestataires({ query: { q: 'dupont' } } as unknown as Request, res as Response);

      const { total } = json.mock.calls[0][0];
      expect(total).toBe(2);
    });

    it('filters results by q matching prestation', async () => {
      const prests = [
        makePrestForSearch({ userId: { _id: 'u1', nom: 'Martin', prenom: 'Paul' }, prestations: ['Elagage'], ville: undefined }),
        makePrestForSearch({ userId: { _id: 'u2', nom: 'Durand', prenom: 'Marc' }, prestations: ['Tonte'] }),
      ];
      mockPrestFind.mockReturnValue(makeQueryChain(prests));
      mockPrestCount.mockResolvedValue(2);

      await searchPrestataires({ query: { q: 'elagage' } } as unknown as Request, res as Response);

      const { total } = json.mock.calls[0][0];
      expect(total).toBe(2);
    });

    it('applies sort=rating', async () => {
      mockPrestFind.mockReturnValue(makeQueryChain([]));

      await searchPrestataires({ query: { sort: 'rating' } } as unknown as Request, res as Response);

      const chain = mockPrestFind.mock.results[0].value;
      expect(chain.sort).toHaveBeenCalledWith({ averageRating: -1, numberOfReviews: -1 });
    });

    it('applies sort=price_asc', async () => {
      mockPrestFind.mockReturnValue(makeQueryChain([]));

      await searchPrestataires({ query: { sort: 'price_asc' } } as unknown as Request, res as Response);

      const chain = mockPrestFind.mock.results[0].value;
      expect(chain.sort).toHaveBeenCalledWith({ tarifHoraire: 1 });
    });

    it('applies geospatial filter for sort=distance', async () => {
      mockPrestFind.mockReturnValue(makeQueryChain([]));

      await searchPrestataires(
        { query: { sort: 'distance', lat: '48.85', lng: '2.35' } } as unknown as Request,
        res as Response
      );

      const filter = mockPrestFind.mock.calls[0][0];
      expect(filter.location).toBeDefined();
    });

    it('filters by prestation and ville', async () => {
      mockPrestFind.mockReturnValue(makeQueryChain([]));
      mockPrestCount.mockResolvedValue(0);

      await searchPrestataires(
        { query: { prestation: 'Tonte', ville: 'Paris' } } as unknown as Request,
        res as Response
      );

      const filter = mockPrestFind.mock.calls[0][0];
      expect(filter.prestations).toEqual(expect.objectContaining({ $in: expect.arrayContaining(['Tonte']) }));
      expect(filter.ville).toBeInstanceOf(RegExp);
    });
  });

  // ── getRanking ────────────────────────────────────────────────────

  describe('getRanking', () => {
    it('returns ranked prestataires', async () => {
      const prests = [makePrestForSearch()];
      mockPrestFind.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(prests) }),
          }),
        }),
      });
      mockPrestCount.mockResolvedValue(1);

      await getRanking({ query: {} } as unknown as Request, res as Response);

      expect(json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
    });

    it('filters by prestation and ville', async () => {
      mockPrestFind.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }),
          }),
        }),
      });
      mockPrestCount.mockResolvedValue(0);

      await getRanking({ query: { prestation: 'Taille', ville: 'Lyon' } } as unknown as Request, res as Response);

      const filter = mockPrestFind.mock.calls[0][0];
      expect(filter.prestations).toEqual(expect.objectContaining({ $in: expect.arrayContaining(['Taille']) }));
      expect(filter.ville).toBeInstanceOf(RegExp);
    });
  });

  // ── getReviews ────────────────────────────────────────────────────

  describe('getReviews', () => {
    it('returns 404 when prestataire not found', async () => {
      mockPrestFindOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });

      await getReviews({ params: { id: 'uid' }, query: {} } as unknown as Request, res as Response);

      expect(status).toHaveBeenCalledWith(404);
    });

    it('returns reviews with prestataire info', async () => {
      const { ServiceRequest } = jest.requireMock('../../models/ServiceRequest');
      const prest = makePrestataire({
        userId: { _id: 'uid', nom: 'Dupont', prenom: 'Jean' },
        toObject: () => ({}),
      });
      mockPrestFindOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(prest) });
      const reviews = [{ ratingDetails: { quality: 5 } }];
      ServiceRequest.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(reviews) }),
          }),
        }),
      });
      ServiceRequest.countDocuments.mockResolvedValue(1);

      await getReviews({ params: { id: 'uid' }, query: {} } as unknown as Request, res as Response);

      expect(json).toHaveBeenCalledWith(expect.objectContaining({
        prestataire: expect.objectContaining({ nom: 'Dupont' }),
        total: 1,
      }));
    });
  });

  // ── geocodePrestataire ────────────────────────────────────────────

  describe('geocodePrestataire', () => {
    it('returns 404 when prestataire not found', async () => {
      mockPrestFindOne.mockResolvedValue(null);
      await geocodePrestataire({ params: { id: 'uid' } } as unknown as Request, res as Response);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('saves location when geocoding succeeds', async () => {
      const prest = makePrestataire();
      mockPrestFindOne.mockResolvedValue(prest);
      mockGeocode.mockResolvedValue({ lat: 48.85, lng: 2.35 });

      await geocodePrestataire({ params: { id: 'uid' } } as unknown as Request, res as Response);

      expect(prest.geocodeStatus).toBe('ok');
      expect(prest.location).toEqual({ type: 'Point', coordinates: [2.35, 48.85] });
      expect(prest.save).toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it('sets geocodeStatus to not_found when geocoding fails', async () => {
      const prest = makePrestataire();
      mockPrestFindOne.mockResolvedValue(prest);
      mockGeocode.mockResolvedValue(null);

      await geocodePrestataire({ params: { id: 'uid' } } as unknown as Request, res as Response);

      expect(prest.geocodeStatus).toBe('not_found');
    });
  });
});
