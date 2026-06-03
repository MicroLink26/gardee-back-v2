import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { ServiceRequest } from '../models/ServiceRequest';
import { User } from '../models/User';
import { AuthRequest } from '../types';
import { sendMessageToClientEmail, sendMessageToProviderEmail } from '../services/emailService';
import { sendPushToUser } from '../services/pushService';

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

  // Push notification au client si compte enregistré
  const clientUser = await User.findOne({ email: request.requesterEmail });
  if (clientUser) {
    sendPushToUser(clientUser._id, {
      title: `Message de ${fromName}`,
      body: content.trim().slice(0, 100),
      url: `/app/messagerie?conversation=${request._id}`,
      requestId: request._id.toString(),
    }).catch(() => {});
  }

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
    sendPushToUser(prestataire._id, {
      title: `Réponse de ${clientName}`,
      body: content.trim().slice(0, 100),
      url: `/app/messagerie?conversation=${request._id}`,
      requestId: request._id.toString(),
    }).catch(() => {});
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

// Lister les fils de messages pour le client connecte
export async function listClientThreads(req: AuthRequest, res: Response): Promise<void> {
  const requests = await ServiceRequest.find({
    $or: [{ clientId: req.user!._id }, { requesterEmail: req.user!.email }],
    'messages.0': { $exists: true },
  })
    .select('messages status createdAt updatedAt prestataireId')
    .sort({ updatedAt: -1 });

  const prestataireIds = [...new Set(requests.map(r => r.prestataireId.toString()))];
  const prestataires = await User.find({ _id: { $in: prestataireIds } }).select('nom prenom');
  const nameMap = new Map(prestataires.map(p => [p._id.toString(), `${p.prenom} ${p.nom}`.trim()]));

  const threads = requests.map(r => ({
    _id: r._id,
    prestataireName: nameMap.get(r.prestataireId.toString()) ?? 'Prestataire',
    status: r.status,
    messageCount: r.messages.length,
    lastMessage: r.messages[r.messages.length - 1],
    messages: r.messages,
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
    sendPushToUser(prestataire._id, {
      title: `Réponse de ${clientName}`,
      body: content.trim().slice(0, 100),
      url: `/app/messagerie?conversation=${request._id}`,
      requestId: request._id.toString(),
    }).catch(() => {});
  }

  res.json({ ok: true, messages: request.messages });
}
