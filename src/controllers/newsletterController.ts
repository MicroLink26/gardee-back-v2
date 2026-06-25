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

    try {
      const unsubscribeUrl = `${process.env.FRONT_URL ?? 'https://gardee.fr'}/api/newsletter/unsubscribe?token=${unsubscribeToken}`;
      await sendNewsletterWelcome(email, unsubscribeUrl);
    } catch (emailError) {
      console.warn('Newsletter email send failed:', emailError);
      // Continue even if email fails
    }
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
      res.redirect(`${process.env.FRONT_URL ?? 'https://gardee.fr'}/newsletter/unsubscribe?status=error&reason=missing-token`);
      return;
    }

    const newsletter = await Newsletter.findOne({ unsubscribeToken: token });
    if (!newsletter) {
      res.redirect(`${process.env.FRONT_URL ?? 'https://gardee.fr'}/newsletter/unsubscribe?status=error&reason=not-found`);
      return;
    }

    newsletter.subscribed = false;
    await newsletter.save();
    res.redirect(`${process.env.FRONT_URL ?? 'https://gardee.fr'}/newsletter/unsubscribe?status=success`);
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.redirect(`${process.env.FRONT_URL ?? 'https://gardee.fr'}/newsletter/unsubscribe?status=error&reason=internal`);
  }
}
