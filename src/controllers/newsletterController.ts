import { Request, Response } from 'express';
import { Newsletter } from '../models/Newsletter';
import { sendNewsletterWelcome } from '../services/emailService';
import { randomBytes } from 'crypto';

export async function subscribeNewsletter(req: Request, res: Response): Promise<void> {
  try {
    const { email, userType } = req.body;

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Email invalide' });
      return;
    }

    const unsubscribeToken = randomBytes(32).toString('hex');

    const existing = await Newsletter.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (existing.subscribed) {
        res.status(400).json({ error: 'Cet email est déjà abonné' });
        return;
      }
      existing.subscribed = true;
      existing.unsubscribeToken = unsubscribeToken;
      await existing.save();
    } else {
      await Newsletter.create({
        email: email.toLowerCase(),
        subscribed: true,
        unsubscribeToken,
        userType,
      });
    }

    await sendNewsletterWelcome(email);
    res.json({ ok: true, message: 'Abonnement réussi! Vérifiez votre email.' });
  } catch (error: any) {
    console.error('Newsletter subscription error:', error?.message || error);
    res.status(500).json({ error: error?.message || 'Erreur lors de l\'abonnement' });
  }
}

export async function unsubscribeNewsletter(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.query;

    if (!token) {
      res.status(400).json({ error: 'Token manquant' });
      return;
    }

    const newsletter = await Newsletter.findOne({ unsubscribeToken: token });
    if (!newsletter) {
      res.status(404).json({ error: 'Abonnement introuvable' });
      return;
    }

    newsletter.subscribed = false;
    await newsletter.save();
    res.json({ ok: true, message: 'Vous avez été désabonné.' });
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({ error: 'Erreur lors du désabonnement' });
  }
}
