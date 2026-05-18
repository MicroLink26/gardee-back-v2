import { Request, Response } from 'express';
import { ServiceRequest } from '../models/ServiceRequest';
import { User } from '../models/User';

export async function validateRatingToken(req: Request, res: Response): Promise<void> {
  const { token } = req.query as { token: string };
  const request = await ServiceRequest.findOne({
    ratingToken: token,
    ratingTokenExpiresAt: { $gt: new Date() },
    ratingDetails: { $exists: false },
  }).select('_id prestataireId desiredAt prestations');

  if (!request) {
    res.status(400).json({ error: 'Lien invalide ou expiré' });
    return;
  }
  res.json({ ok: true, request });
}

export async function submitReview(req: Request, res: Response): Promise<void> {
  const { token, ratings, recommend, comment } = req.body as {
    token: string;
    ratings: { time: number; quality: number; sympathy: number; value: number; punctuality: number };
    recommend?: boolean;
    comment?: string;
  };

  const request = await ServiceRequest.findOne({
    ratingToken: token,
    ratingTokenExpiresAt: { $gt: new Date() },
    ratingDetails: { $exists: false },
  });

  if (!request) {
    res.status(400).json({ error: 'Lien invalide ou expiré' });
    return;
  }

  const values = [ratings.time, ratings.quality, ratings.sympathy, ratings.value, ratings.punctuality];
  if (values.some((v) => !Number.isInteger(v) || v < 1 || v > 5)) {
    res.status(400).json({ error: 'Les notes doivent être entre 1 et 5' });
    return;
  }

  const average = values.reduce((a, b) => a + b, 0) / values.length;

  request.ratingDetails = ratings;
  request.ratingComment = comment;
  request.recommend = recommend;
  request.ratingGivenAt = new Date();
  request.ratingToken = undefined;
  request.status = 'completed';
  await request.save();

  const prestataire = await User.findById(request.prestataireId);
  if (prestataire) {
    const total = prestataire.averageRating * prestataire.numberOfReviews + average;
    prestataire.numberOfReviews += 1;
    prestataire.averageRating = parseFloat((total / prestataire.numberOfReviews).toFixed(2));
    await prestataire.save();
  }

  res.json({ ok: true });
}
