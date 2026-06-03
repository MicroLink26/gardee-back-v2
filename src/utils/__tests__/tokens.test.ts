import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { randomHex, signAccessToken, createRefreshToken } from '../tokens';

jest.mock('../../models/RefreshToken', () => ({
  RefreshToken: { create: jest.fn() },
}));

jest.mock('nanoid', () => ({ nanoid: jest.fn().mockReturnValue('nanoid-token-48chars') }));

describe('tokens utils', () => {
  describe('createRefreshToken', () => {
    it('stores a new token in DB and returns it', async () => {
      const { RefreshToken } = jest.requireMock('../../models/RefreshToken');
      RefreshToken.create.mockResolvedValue({});

      const userId = new Types.ObjectId();
      const token = await createRefreshToken(userId);

      expect(token).toBe('nanoid-token-48chars');
      expect(RefreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'nanoid-token-48chars', user: userId })
      );
    });
  });

  describe('randomHex', () => {
    it('returns a hex string of double the byte length', () => {
      const result = randomHex(16);
      expect(result).toHaveLength(32); // 16 bytes → 32 hex chars
      expect(result).toMatch(/^[0-9a-f]+$/);
    });

    it('produces different values on successive calls', () => {
      expect(randomHex(16)).not.toBe(randomHex(16));
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
