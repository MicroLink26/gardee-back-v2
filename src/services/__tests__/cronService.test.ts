import {
  updateMissingGeocoding,
  geocodeMissingVilleOnly,
  sendUpcomingReminders,
  sendRatingRequests,
} from '../cronService';
import { User } from '../../models/User';
import { Prestataire } from '../../models/Prestataire';
import { ServiceRequest } from '../../models/ServiceRequest';
import { geocodeAddress } from '../../utils/geocoding';
import { sendRatingRequestEmail, sendUpcomingReminderEmail } from '../emailService';

jest.mock('../../models/User', () => ({
  User: { findById: jest.fn() },
}));

jest.mock('../../models/Prestataire', () => ({
  Prestataire: { find: jest.fn() },
}));

jest.mock('../../models/ServiceRequest', () => ({
  ServiceRequest: { find: jest.fn() },
}));

jest.mock('../../utils/geocoding', () => ({
  geocodeAddress: jest.fn(),
}));

jest.mock('../emailService', () => ({
  sendRatingRequestEmail: jest.fn(),
  sendUpcomingReminderEmail: jest.fn(),
}));

describe('cronService', () => {
  const mockedPrestFind = Prestataire.find as jest.Mock;
  const mockedUserFindById = User.findById as jest.Mock;
  const mockedSRFind = ServiceRequest.find as jest.Mock;
  const mockedGeocode = geocodeAddress as jest.MockedFunction<typeof geocodeAddress>;
  const mockedSendRating = sendRatingRequestEmail as jest.MockedFunction<typeof sendRatingRequestEmail>;
  const mockedSendReminder = sendUpcomingReminderEmail as jest.MockedFunction<typeof sendUpcomingReminderEmail>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates missing geocoding and saves prestataires', async () => {
    const saveMock = jest.fn();
    const prest = {
      adresse: '1 rue de Test',
      codePostal: '75000',
      ville: 'Paris',
      geocodeStatus: 'pending',
      geocodedAt: undefined,
      location: undefined,
      save: saveMock,
    } as any;

    mockedPrestFind.mockReturnValue({ limit: jest.fn().mockResolvedValue([prest]) });
    mockedGeocode.mockResolvedValue({ lat: 48.8566, lng: 2.3522 });

    const count = await updateMissingGeocoding(5);

    expect(count).toBe(1);
    expect(prest.location).toEqual({ type: 'Point', coordinates: [2.3522, 48.8566] });
    expect(prest.geocodeStatus).toBe('ok');
    expect(saveMock).toHaveBeenCalled();
  });

  it('marks geocodeStatus as not_found when geocoding fails', async () => {
    const saveMock = jest.fn();
    const prest = {
      adresse: 'Adresse inconnue',
      codePostal: '00000',
      ville: 'Nulle Part',
      geocodeStatus: 'pending',
      geocodedAt: undefined,
      save: saveMock,
    } as any;

    mockedPrestFind.mockReturnValue({ limit: jest.fn().mockResolvedValue([prest]) });
    mockedGeocode.mockResolvedValue(null);

    const count = await updateMissingGeocoding(5);

    expect(count).toBe(1);
    expect(prest.geocodeStatus).toBe('not_found');
    expect(saveMock).toHaveBeenCalled();
  });

  it('sends rating requests for scheduled services and updates tokens', async () => {
    const saveMock = jest.fn();
    const request = {
      prestataireId: 'provider-id',
      save: saveMock,
      ratingToken: undefined,
      ratingTokenExpiresAt: undefined,
      ratingEmailSentAt: undefined,
    } as any;
    const provider = { _id: 'provider-id' } as any;

    mockedSRFind.mockResolvedValue([request]);
    mockedUserFindById.mockResolvedValue(provider);

    const count = await sendRatingRequests();

    expect(count).toBe(1);
    expect(saveMock).toHaveBeenCalled();
    expect(mockedSendRating).toHaveBeenCalledWith(request, provider);
    expect(request.ratingToken).toBeDefined();
    expect(request.ratingTokenExpiresAt).toBeInstanceOf(Date);
    expect(request.ratingEmailSentAt).toBeInstanceOf(Date);
  });

  it('returns 0 when no prestataires need geocoding', async () => {
    mockedPrestFind.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });

    const count = await updateMissingGeocoding();

    expect(count).toBe(0);
  });

  it('skips rating request when provider not found', async () => {
    const request = {
      prestataireId: 'missing-id',
      save: jest.fn(),
      ratingToken: undefined,
    } as any;

    mockedSRFind.mockResolvedValue([request]);
    mockedUserFindById.mockResolvedValue(null);

    const count = await sendRatingRequests();

    expect(count).toBe(0);
    expect(request.save).not.toHaveBeenCalled();
    expect(mockedSendRating).not.toHaveBeenCalled();
  });

  it('returns 0 when no rating requests to send', async () => {
    mockedSRFind.mockResolvedValue([]);

    const count = await sendRatingRequests();

    expect(count).toBe(0);
  });

  // ── geocodeMissingVilleOnly ────────────────────────────────────────

  describe('geocodeMissingVilleOnly', () => {
    it('geocodes by ville only and saves location', async () => {
      const saveMock = jest.fn();
      const prest = {
        ville: 'Lyon',
        geocodeStatus: 'not_found',
        location: undefined,
        geocodedAt: undefined,
        save: saveMock,
      } as any;

      mockedPrestFind.mockReturnValue({ limit: jest.fn().mockResolvedValue([prest]) });
      mockedGeocode.mockResolvedValue({ lat: 45.748, lng: 4.846 });

      const count = await geocodeMissingVilleOnly(5);

      expect(mockedGeocode).toHaveBeenCalledWith(undefined, undefined, 'Lyon');
      expect(prest.location).toEqual({ type: 'Point', coordinates: [4.846, 45.748] });
      expect(prest.geocodeStatus).toBe('ok');
      expect(prest.geocodedAt).toBeInstanceOf(Date);
      expect(saveMock).toHaveBeenCalled();
      expect(count).toBe(1);
    });

    it('skips save and does not count when geocoding fails', async () => {
      const saveMock = jest.fn();
      const prest = {
        ville: 'VilleInconnue',
        geocodeStatus: 'pending',
        save: saveMock,
      } as any;

      mockedPrestFind.mockReturnValue({ limit: jest.fn().mockResolvedValue([prest]) });
      mockedGeocode.mockResolvedValue(null);

      const count = await geocodeMissingVilleOnly(5);

      expect(saveMock).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });

    it('returns 0 when no prestataires match', async () => {
      mockedPrestFind.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });

      const count = await geocodeMissingVilleOnly();

      expect(count).toBe(0);
    });
  });

  // ── sendUpcomingReminders ─────────────────────────────────────────

  describe('sendUpcomingReminders', () => {
    it('sends a reminder for each scheduled request tomorrow', async () => {
      const request = { prestataireId: 'prest-id' } as any;
      const provider = { _id: 'prest-id', prenom: 'Jean' } as any;

      mockedSRFind.mockResolvedValue([request]);
      mockedUserFindById.mockResolvedValue(provider);

      const count = await sendUpcomingReminders();

      expect(mockedSendReminder).toHaveBeenCalledWith(request, provider);
      expect(count).toBe(1);
    });

    it('skips when provider not found', async () => {
      mockedSRFind.mockResolvedValue([{ prestataireId: 'missing' } as any]);
      mockedUserFindById.mockResolvedValue(null);

      const count = await sendUpcomingReminders();

      expect(mockedSendReminder).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });

    it('returns 0 when no scheduled requests tomorrow', async () => {
      mockedSRFind.mockResolvedValue([]);

      const count = await sendUpcomingReminders();

      expect(count).toBe(0);
    });
  });
});
