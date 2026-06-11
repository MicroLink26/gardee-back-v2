import { Request, Response } from 'express';
import { ServiceRequest } from '../models/ServiceRequest';
import { Prestataire } from '../models/Prestataire';
import { validateToken, validateTextField } from '../utils/validation';
import { logMessageActionError } from '../utils/logger';

export async function validateRatingToken(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.query as { token: string };

    const tokenValidation = validateToken(token);
    if (!tokenValidation.valid) {
      res.status(400).json({ error: tokenValidation.error });
      return;
    }

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
  } catch (error) {
    logMessageActionError('validateRatingToken: Failed to validate rating token', undefined, undefined, error);
    res.status(500).json({ error: 'Erreur lors de la validation' });
  }
}

export async function submitReview(req: Request, res: Response): Promise<void> {
  try {
    const { token, ratings, recommend, comment } = req.body as {
      token: string;
      ratings: { time: number; quality: number; sympathy: number; value: number; punctuality: number };
      recommend?: boolean;
      comment?: string;
    };

    const tokenValidation = validateToken(token);
    if (!tokenValidation.valid) {
      res.status(400).json({ error: tokenValidation.error });
      return;
    }

    if (!ratings || typeof ratings !== 'object') {
      res.status(400).json({ error: 'Les notes sont requises' });
      return;
    }

    const requiredRatingFields = ['time', 'quality', 'sympathy', 'value', 'punctuality'];
    for (const field of requiredRatingFields) {
      const fieldValue = ratings[field as keyof typeof ratings];
      if (!Number.isInteger(fieldValue) || fieldValue < 1 || fieldValue > 5) {
        res.status(400).json({ error: 'Les notes doivent être entre 1 et 5' });
        return;
      }
    }

    if (comment !== undefined) {
      const commentValidation = validateTextField(comment, 'Commentaire', 0, 1000);
      if (!commentValidation.valid) {
        res.status(400).json({ error: commentValidation.error });
        return;
      }
    }

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
    const average = values.reduce((a, b) => a + b, 0) / values.length;

    request.ratingDetails = ratings;
    request.ratingComment = comment ? (comment as string).trim() : undefined;
    request.recommend = recommend;
    request.ratingGivenAt = new Date();
    request.ratingToken = undefined;
    request.status = 'completed';
    await request.save();

    const prestDoc = await Prestataire.findOne({ userId: request.prestataireId });
    if (prestDoc) {
      const total = prestDoc.averageRating * prestDoc.numberOfReviews + average;
      prestDoc.numberOfReviews += 1;
      prestDoc.averageRating = parseFloat((total / prestDoc.numberOfReviews).toFixed(2));
      await prestDoc.save();
    }

    res.json({ ok: true });
  } catch (error) {
    logMessageActionError('submitReview: Failed to submit review', undefined, undefined, error);
    res.status(500).json({ error: 'Erreur lors de la soumission de l\'avis' });
  }
}
