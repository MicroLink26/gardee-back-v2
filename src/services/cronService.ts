import { User } from '../models/User';
import { ServiceRequest } from '../models/ServiceRequest';
import { geocodeAddress } from '../utils/geocoding';
import { nanoid } from 'nanoid';
import {
  sendUpcomingReminderEmail,
  sendRatingRequestEmail,
} from './emailService';

export async function updateMissingGeocoding(limit = 100): Promise<number> {
  const users = await User.find({
    role: 'prestataire',
    geocodeStatus: 'pending',
    adresse: { $exists: true },
  }).limit(limit);

  let count = 0;
  for (const user of users) {
    const result = await geocodeAddress(user.adresse, user.codePostal, user.ville);
    if (result) {
      user.location = { type: 'Point', coordinates: [result.lng, result.lat] };
      user.geocodeStatus = 'ok';
    } else {
      user.geocodeStatus = 'not_found';
    }
    user.geocodedAt = new Date();
    await user.save();
    count++;
  }
  return count;
}

export async function geocodeMissingVilleOnly(limit = 100): Promise<{ villeGeocoded: number; debugCount: number }> {
  const query = {
    role: 'prestataire',
    ville: { $exists: true, $ne: '' },
    geocodeStatus: { $in: ['error', 'not_found', 'pending'] },
    $or: [{ location: null }, { location: { $exists: false } }, { 'location.coordinates': { $exists: false } }],
  };
  const debugCount = await User.countDocuments(query);
  const users = await User.find(query).limit(limit);

  let villeGeocoded = 0;
  for (const user of users) {
    const result = await geocodeAddress(undefined, undefined, user.ville);
    if (result) {
      user.location = { type: 'Point', coordinates: [result.lng, result.lat] };
      user.geocodeStatus = 'ok';
      user.geocodedAt = new Date();
      await user.save();
      villeGeocoded++;
    }
  }
  return { villeGeocoded, debugCount };
}

export async function sendUpcomingReminders(): Promise<number> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const start = new Date(tomorrow.setHours(0, 0, 0, 0));
  const end = new Date(tomorrow.setHours(23, 59, 59, 999));

  const requests = await ServiceRequest.find({
    status: 'scheduled',
    desiredAt: { $gte: start, $lte: end },
  });

  let count = 0;
  for (const req of requests) {
    const prestataire = await User.findById(req.prestataireId);
    if (!prestataire) continue;
    await sendUpcomingReminderEmail(req, prestataire);
    count++;
  }
  return count;
}

export async function sendRatingRequests(): Promise<number> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const start = new Date(yesterday.setHours(0, 0, 0, 0));
  const end = new Date(yesterday.setHours(23, 59, 59, 999));

  const requests = await ServiceRequest.find({
    status: 'scheduled',
    desiredAt: { $gte: start, $lte: end },
    ratingEmailSentAt: { $exists: false },
  });

  let count = 0;
  for (const req of requests) {
    const prestataire = await User.findById(req.prestataireId);
    if (!prestataire) continue;
    const token = nanoid(32);
    req.ratingToken = token;
    req.ratingTokenExpiresAt = new Date(Date.now() + 14 * 86400 * 1000);
    req.ratingEmailSentAt = new Date();
    await req.save();
    await sendRatingRequestEmail(req, prestataire);
    count++;
  }
  return count;
}
