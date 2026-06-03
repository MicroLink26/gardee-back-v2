import axios from 'axios';
import { geocodeAddress } from '../geocoding';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('geocodeAddress', () => {
  it('returns latitude and longitude for a successful OpenStreetMap response', async () => {
    mockedAxios.get.mockResolvedValue({ data: [{ lat: '48.8566', lon: '2.3522' }] });

    const coords = await geocodeAddress('1 rue de Paris', '75000', 'Paris');

    expect(coords).toEqual({ lat: 48.8566, lng: 2.3522 });
    expect(mockedAxios.get).toHaveBeenCalled();
  });

  it('returns null when no results are returned', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });

    const coords = await geocodeAddress('inconnu', undefined, undefined);

    expect(coords).toBeNull();
  });

  it('returns null when the HTTP request throws', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network error'));

    const coords = await geocodeAddress('1 rue de Paris', '75000', 'Paris');

    expect(coords).toBeNull();
  });
});
