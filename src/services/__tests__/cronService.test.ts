import { updateMissingGeocoding, sendRatingRequests } from '../cronService';
import { User } from '../../models/User';
import { Prestataire } from '../../models/Prestataire';
import { ServiceRequest } from '../../models/ServiceRequest';
import { geocodeAddress } from '../../utils/geocoding';
import { sendRatingRequestEmail } from '../emailService';

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

  beforeEach(() => {
    mockedPrestFind.mockClear();
    mockedUserFindById.mockClear();
    mockedSRFind.mockClear();
    mockedGeocode.mockClear();
    mockedSendRating.mockClear();
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
});
