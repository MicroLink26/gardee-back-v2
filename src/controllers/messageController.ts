import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { ServiceRequest } from '../models/ServiceRequest';
import { User } from '../models/User';
import { AuthRequest } from '../types';
import { sendMessageToClientEmail, sendMessageToProviderEmail } from '../services/emailService';

// Prestataire envoie un message au client (auth requise)
export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  const { content } = req.body as { content: string };
  if (!content?.trim()) {
    res.status(400).json({ error: 'Le message ne peut pas être vide' });
    return;
  }

  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    prestataireId: req.user!._id,
  });
  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const token = randomBytes(24).toString('hex');
  request.messageToken = token;
  request.messageTokenExpiresAt = new Date(Date.now() + 7 * 86400 * 1000);

  const fromName = `${req.user!.prenom} ${req.user!.nom}`;
  request.messages.push({
    fromRole: 'provider',
    fromEmail: req.user!.email,
    fromName,
    content: content.trim(),
    createdAt: new Date(),
  } as Parameters<typeof request.messages.push>[0]);

  await request.save();

  await sendMessageToClientEmail(request, fromName, content.trim(), token).catch(() => {});

  res.json({ ok: true, messages: request.messages });
}

// Client repond via token (sans compte)
export async function replyByToken(req: Request, res: Response): Promise<void> {
  const { token, content } = req.body as { token: string; content: string };
  if (!content?.trim()) {
    res.status(400).json({ error: 'Le message ne peut pas être vide' });
    return;
  }

  const request = await ServiceRequest.findOne({
    messageToken: token,
    messageTokenExpiresAt: { $gt: new Date() },
  });
  if (!request) {
    res.status(400).json({ error: 'Lien invalide ou expiré' });
    return;
  }

  const clientName = request.requesterPrenom
    ? `${request.requesterPrenom} ${request.requesterNom ?? ''}`.trim()
    : request.requesterEmail;

  request.messages.push({
    fromRole: 'client',
    fromEmail: request.requesterEmail,
    fromName: clientName,
    content: content.trim(),
    createdAt: new Date(),
  } as Parameters<typeof request.messages.push>[0]);

  // Rotate token so next reply link is fresh
  const newToken = randomBytes(24).toString('hex');
  request.messageToken = newToken;
  request.messageTokenExpiresAt = new Date(Date.now() + 7 * 86400 * 1000);

  await request.save();

  const prestataire = await User.findById(request.prestataireId);
  if (prestataire) {
    await sendMessageToProviderEmail(request, prestataire, clientName, content.trim()).catch(() => {});
  }

  res.json({ ok: true, newToken });
}

// Recuperer les messages d'une demande (prestataire connecte)
export async function getMessages(req: AuthRequest, res: Response): Promise<void> {
  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    prestataireId: req.user!._id,
  }).select('messages requesterEmail requesterPrenom requesterNom messageToken messageTokenExpiresAt');

  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }
  res.json({ messages: request.messages, token: request.messageToken });
}

// Recuperer le fil via token (client sans compte)
export async function getThreadByToken(req: Request, res: Response): Promise<void> {
  const { token } = req.query as { token: string };
  const request = await ServiceRequest.findOne({
    messageToken: token,
    messageTokenExpiresAt: { $gt: new Date() },
  }).select('messages requesterEmail requesterPrenom requesterNom prestataireId');

  if (!request) {
    res.status(400).json({ error: 'Lien invalide ou expiré' });
    return;
  }

  const prestataire = await User.findById(request.prestataireId).select('prenom nom');
  res.json({
    messages: request.messages,
    prestataireName: prestataire ? `${prestataire.prenom} ${prestataire.nom}` : '',
    clientEmail: request.requesterEmail,
  });
}

// Lister toutes les demandes avec messages (pour la page Messagerie du back office)
export async function listThreads(req: AuthRequest, res: Response): Promise<void> {
  const requests = await ServiceRequest.find({
    prestataireId: req.user!._id,
    'messages.0': { $exists: true },
  })
    .select('messages requesterEmail requesterPrenom requesterNom status createdAt')
    .sort({ updatedAt: -1 });

  const threads = requests.map(r => ({
    _id: r._id,
    requesterEmail: r.requesterEmail,
    requesterName: r.requesterPrenom ? `${r.requesterPrenom} ${r.requesterNom ?? ''}`.trim() : r.requesterEmail,
    status: r.status,
    messageCount: r.messages.length,
    lastMessage: r.messages[r.messages.length - 1],
    createdAt: r.createdAt,
  }));

  res.json({ threads });
}

// Client connecte envoie un message (demande client)
export async function clientSendMessage(req: AuthRequest, res: Response): Promise<void> {
  const { content } = req.body as { content: string };
  if (!content?.trim()) {
    res.status(400).json({ error: 'Le message ne peut pas être vide' });
    return;
  }

  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    requesterEmail: req.user!.email,
  });
  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const clientName = `${req.user!.prenom} ${req.user!.nom}`;
  request.messages.push({
    fromRole: 'client',
    fromEmail: req.user!.email,
    fromName: clientName,
    content: content.trim(),
    createdAt: new Date(),
  } as Parameters<typeof request.messages.push>[0]);

  await request.save();

  const prestataire = await User.findById(request.prestataireId);
  if (prestataire) {
    await sendMessageToProviderEmail(request, prestataire, clientName, content.trim()).catch(() => {});
  }

  res.json({ ok: true, messages: request.messages });
}
