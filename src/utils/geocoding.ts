import axios from 'axios';
import Bottleneck from 'bottleneck';

const limiter = new Bottleneck({ minTime: 1000 });

interface GeoResult {
  lat: number;
  lng: number;
}

export async function geocodeAddress(
  adresse?: string,
  codePostal?: string,
  ville?: string
): Promise<GeoResult | null> {
  const q = [adresse, codePostal, ville, 'France'].filter(Boolean).join(', ');
  try {
    const response = await limiter.schedule(() =>
      axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q, format: 'json', limit: 1 },
        headers: {
          'User-Agent': process.env.NOMINATIM_USER_AGENT ?? 'gardee/2.0',
          'Accept-Language': 'fr',
        },
        timeout: 10000,
      })
    );
    const results = response.data as Array<{ lat: string; lon: string }>;
    if (!results.length) return null;
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
  } catch {
    return null;
  }
}
