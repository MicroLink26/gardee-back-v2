import { Request, Response } from 'express';
import { Newsletter } from '../models/Newsletter';
import { sendNewsletterDigest } from '../services/emailService';
import { User } from '../models/User';

export async function getSubscribers(req: Request, res: Response): Promise<void> {
  try {
    const subscribers = await Newsletter.find({ subscribed: true }).sort({ subscriptionDate: -1 });
    res.json(subscribers);
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des abonnés' });
  }
}

export async function sendNewsletter(req: Request, res: Response): Promise<void> {
  try {
    const { title, content, ctaText, ctaLink, scheduledFor, segmentType } = req.body;

    if (!title || !content) {
      res.status(400).json({ error: 'Titre et contenu requis' });
      return;
    }

    // Get subscribers based on segment
    const query: any = { subscribed: true };
    if (segmentType && segmentType !== 'all') {
      query.userType = segmentType;
    }

    const subscribers = await Newsletter.find(query);

    if (subscribers.length === 0) {
      res.status(400).json({ error: 'Aucun abonné trouvé' });
      return;
    }

    // Send emails
    const frontUrl = process.env.FRONT_URL ?? 'https://gardee.fr';
    for (const sub of subscribers) {
      try {
        const unsubscribeUrl = `${frontUrl}/newsletter/unsubscribe?token=${sub.unsubscribeToken}`;
        await sendNewsletterDigest(sub.email, title, content, ctaText, ctaLink, unsubscribeUrl);
      } catch (emailError) {
        console.error(`Failed to send email to ${sub.email}:`, emailError);
        // Continue with next email even if one fails
      }
    }

    // Store in history (you would need a NewsletterSent model)
    // For now, just respond with success
    res.json({
      ok: true,
      message: `Newsletter envoyée à ${subscribers.length} abonnés`,
      count: subscribers.length,
    });
  } catch (error) {
    console.error('Error sending newsletter:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi' });
  }
}

export async function getHistory(req: Request, res: Response): Promise<void> {
  try {
    // For now, return empty array
    // You would query a NewsletterSent model here
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
  }
}
