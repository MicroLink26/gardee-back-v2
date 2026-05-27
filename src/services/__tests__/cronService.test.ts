import { updateMissingGeocoding, sendRatingRequests } from '../cronService';
import { User } from '../../models/User';
import { ServiceRequest } from '../../models/ServiceRequest';
import { geocodeAddress } from '../../utils/geocoding';
import { sendRatingRequestEmail } from '../emailService';

jest.mock('../../models/User', () => ({
  User: {
    find: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock('../../models/ServiceRequest', () => ({
  ServiceRequest: {
    find: jest.fn(),
  },
}));

jest.mock('../../utils/geocoding', () => ({
  geocodeAddress: jest.fn(),
}));

jest.mock('../emailService', () => ({
  sendRatingRequestEmail: jest.fn(),
}));

describe('cronService', () => {
  const mockedUserFind = User.find as jest.Mock;
  const mockedUserFindById = User.findById as jest.Mock;
  const mockedServiceRequestFind = ServiceRequest.find as jest.Mock;
  const mockedGeocodeAddress = geocodeAddress as jest.MockedFunction<typeof geocodeAddress>;
  const mockedSendRatingRequestEmail = sendRatingRequestEmail as jest.MockedFunction<typeof sendRatingRequestEmail>;

  beforeEach(() => {
    mockedUserFind.mockClear();
    mockedUserFindById.mockClear();
    mockedServiceRequestFind.mockClear();
    mockedGeocodeAddress.mockClear();
    mockedSendRatingRequestEmail.mockClear();
  });

  it('updates missing geocoding and saves users', async () => {
    const saveMock = jest.fn();
    const user = {
      adresse: '1 rue de Test',
      codePostal: '75000',
      ville: 'Paris',
      geocodeStatus: 'pending',
      save: saveMock,
    } as any;

    mockedUserFind.mockReturnValue({ limit: jest.fn().mockResolvedValue([user]) });
    mockedGeocodeAddress.mockResolvedValue({ lat: 48.8566, lng: 2.3522 });

    const count = await updateMissingGeocoding(5);

    expect(count).toBe(1);
    expect(user.location).toEqual({ type: 'Point', coordinates: [2.3522, 48.8566] });
    expect(user.geocodeStatus).toBe('ok');
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
    const provider = {
      _id: 'provider-id',
    } as any;

    mockedServiceRequestFind.mockResolvedValue([request]);
    mockedUserFindById.mockResolvedValue(provider);

    const count = await sendRatingRequests();

    expect(count).toBe(1);
    expect(saveMock).toHaveBeenCalled();
    expect(mockedSendRatingRequestEmail).toHaveBeenCalledWith(request, provider);
    expect(request.ratingToken).toBeDefined();
    expect(request.ratingTokenExpiresAt).toBeInstanceOf(Date);
    expect(request.ratingEmailSentAt).toBeInstanceOf(Date);
  });
});
