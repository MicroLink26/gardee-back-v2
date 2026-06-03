import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { Types } from 'mongoose';
import { RefreshToken } from '../models/RefreshToken';

export function signAccessToken(userId: Types.ObjectId): string {
  const ttl = parseInt(process.env.ACCESS_TTL_MINUTES ?? '15', 10);
  return jwt.sign({ sub: userId.toString() }, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: ttl * 60,
  });
}

export async function createRefreshToken(userId: Types.ObjectId): Promise<string> {
  const ttlDays = parseInt(process.env.REFRESH_TTL_DAYS ?? '30', 10);
  const token = nanoid(48);
  await RefreshToken.create({
    token,
    user: userId,
    expiresAt: new Date(Date.now() + ttlDays * 86400 * 1000),
  });
  return token;
}

export function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}
