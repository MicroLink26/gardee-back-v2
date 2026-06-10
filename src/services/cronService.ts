import { User } from '../models/User';
import { Prestataire } from '../models/Prestataire';
import { ServiceRequest } from '../models/ServiceRequest';
import { geocodeAddress } from '../utils/geocoding';
import { nanoid } from 'nanoid';
import {
  sendUpcomingReminderEmail,
  sendRatingRequestEmail,
} from './emailService';

export async function updateMissingGeocoding(limit = 100): Promise<number> {
  const prests = await Prestataire.find({
    geocodeStatus: 'pending',
    adresse: { $exists: true },
  }).limit(limit);

  let count = 0;
  for (const prest of prests) {
    const result = await geocodeAddress(prest.adresse, prest.codePostal, prest.ville);
    if (result) {
      prest.location = { type: 'Point', coordinates: [result.lng, result.lat] };
      prest.geocodeStatus = 'ok';
    } else {
      prest.geocodeStatus = 'not_found';
    }
    prest.geocodedAt = new Date();
    await prest.save();
    count++;
  }
  return count;
}

export async function geocodeMissingVilleOnly(limit = 100): Promise<number> {
  const prests = await Prestataire.find({
    ville: { $exists: true, $ne: '' },
    geocodeStatus: { $in: ['error', 'not_found', 'pending'] },
    $or: [{ location: null }, { location: { $exists: false } }, { 'location.coordinates': { $exists: false } }],
  }).limit(limit);

  let count = 0;
  for (const prest of prests) {
    const result = await geocodeAddress(undefined, undefined, prest.ville);
    if (result) {
      prest.location = { type: 'Point', coordinates: [result.lng, result.lat] };
      prest.geocodeStatus = 'ok';
      prest.geocodedAt = new Date();
      await prest.save();
      count++;
    }
  }
  return count;
}

export async function sendUpcomingReminders(): Promise<number> {
  // Utiliser UTC pour éviter les problèmes de timezone
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  const dayAfter = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2, 0, 0, 0, 0));

  const requests = await ServiceRequest.find({
    status: 'scheduled',
    desiredAt: { $gte: tomorrow, $lt: dayAfter },
  });

  let count = 0;
  for (const req of requests) {
    const user = await User.findById(req.prestataireId);
    if (!user) continue;
    await sendUpcomingReminderEmail(req, user);
    count++;
  }
  return count;
}

export async function sendRatingRequests(): Promise<number> {
  // Utiliser UTC pour éviter les problèmes de timezone
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

  const requests = await ServiceRequest.find({
    status: 'scheduled',
    desiredAt: { $gte: yesterday, $lt: today },
    ratingEmailSentAt: { $exists: false },
  });

  let count = 0;
  for (const req of requests) {
    const user = await User.findById(req.prestataireId);
    if (!user) continue;
    const token = nanoid(32);
    req.ratingToken = token;
    req.ratingTokenExpiresAt = new Date(Date.now() + 14 * 86400 * 1000);
    req.ratingEmailSentAt = new Date();
    await req.save();
    await sendRatingRequestEmail(req, user);
    count++;
  }
  return count;
}
