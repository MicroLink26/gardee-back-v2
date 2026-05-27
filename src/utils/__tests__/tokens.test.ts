import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { randomHex, signAccessToken } from '../tokens';

describe('tokens utils', () => {
  describe('randomHex', () => {
    it('returns a hex string of the requested length', () => {
      const result = randomHex(16);
      expect(result).toHaveLength(16);
      expect(result).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('signAccessToken', () => {
    const originalSecret = process.env.JWT_ACCESS_SECRET;

    beforeAll(() => {
      process.env.JWT_ACCESS_SECRET = 'test-secret';
      process.env.ACCESS_TTL_MINUTES = '1';
    });

    afterAll(() => {
      if (originalSecret !== undefined) {
        process.env.JWT_ACCESS_SECRET = originalSecret;
      } else {
        delete process.env.JWT_ACCESS_SECRET;
      }
      delete process.env.ACCESS_TTL_MINUTES;
    });

    it('signs a JWT with the user id in the sub claim', () => {
      const objectId = new Types.ObjectId();
      const token = signAccessToken(objectId);
      const decoded = jwt.verify(token, 'test-secret') as jwt.JwtPayload;

      expect(decoded.sub).toBe(objectId.toString());
      expect(typeof decoded.exp).toBe('number');
      expect(typeof decoded.iat).toBe('number');
    });
  });
});
