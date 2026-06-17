import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { filterXSS } from 'xss';
import { ServiceRequest } from '../models/ServiceRequest';
import { User } from '../models/User';
import { AuthRequest } from '../types';
import { sendMessageToClientEmail, sendMessageToProviderEmail } from '../services/emailService';
import { sendPushToUser } from '../services/pushService';
import { sendExpoNotification } from '../services/expoService';
import { validateMessageContent, validateMessageIds, validateToken, validateEmoji } from '../utils/validation';
import { logEmailError, logMessageActionError } from '../utils/logger';

const xssOptions = { whiteList: {}, stripIgnoredTag: true };

// Prestataire envoie un message au client (auth requise)
export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  const validation = validateMessageContent(req.body?.content);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const content = (req.body?.content as string).trim();

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
  const sanitizedContent = filterXSS(content.trim(), xssOptions);
  request.messages.push({
    fromRole: 'provider',
    fromEmail: req.user!.email,
    fromName,
    content: sanitizedContent,
    createdAt: new Date(),
  } as Parameters<typeof request.messages.push>[0]);

  await request.save();

  await sendMessageToClientEmail(request, fromName, content.trim(), token).catch((err) => {
    logEmailError(
      'sendMessage: Failed to send email to client',
      request._id.toString(),
      req.user!._id.toString(),
      request.requesterEmail,
      err
    );
  });

  // Push notification au client si compte enregistré
  const clientUser = await User.findOne({ email: request.requesterEmail });
  if (clientUser) {
    sendPushToUser(clientUser._id, {
      title: `Message de ${fromName}`,
      body: content.trim().slice(0, 100),
      url: `/app/messagerie?conversation=${request._id}`,
      requestId: request._id.toString(),
    }).catch(() => {});
    sendExpoNotification(clientUser._id, {
      title: `💬 ${fromName}`,
      body: content.trim().slice(0, 100),
      data: { requestId: request._id.toString(), screen: 'requests' },
    }).catch(() => {});
  }

  res.json({ ok: true, messages: request.messages });
}

// Client repond via token (sans compte)
export async function replyByToken(req: Request, res: Response): Promise<void> {
  const tokenValidation = validateToken(req.body?.token);
  if (!tokenValidation.valid) {
    res.status(400).json({ error: tokenValidation.error });
    return;
  }

  const contentValidation = validateMessageContent(req.body?.content);
  if (!contentValidation.valid) {
    res.status(400).json({ error: contentValidation.error });
    return;
  }

  const token = (req.body?.token as string).trim();
  const content = (req.body?.content as string).trim();

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

  const sanitizedContent = filterXSS(content, xssOptions);
  request.messages.push({
    fromRole: 'client',
    fromEmail: request.requesterEmail,
    fromName: clientName,
    content: sanitizedContent,
    createdAt: new Date(),
  } as Parameters<typeof request.messages.push>[0]);

  // Rotate token so next reply link is fresh
  const newToken = randomBytes(24).toString('hex');
  request.messageToken = newToken;
  request.messageTokenExpiresAt = new Date(Date.now() + 7 * 86400 * 1000);

  await request.save();

  const prestataire = await User.findById(request.prestataireId);
  if (prestataire) {
    await sendMessageToProviderEmail(request, prestataire, clientName, content).catch((err) => {
      logEmailError(
        'replyByToken: Failed to send email to provider',
        request._id.toString(),
        prestataire._id.toString(),
        prestataire.email,
        err
      );
    });
    sendPushToUser(prestataire._id, {
      title: `Réponse de ${clientName}`,
      body: content.slice(0, 100),
      url: `/app/messagerie?conversation=${request._id}`,
      requestId: request._id.toString(),
    }).catch(() => {});
    sendExpoNotification(prestataire._id, {
      title: `💬 ${clientName}`,
      body: content.slice(0, 100),
      data: { requestId: request._id.toString(), screen: 'requests' },
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
  }).select('messages requesterEmail requesterPrenom requesterNom prestataireId messageTokenExpiresAt');

  if (!request) {
    res.status(400).json({ error: 'Lien invalide ou expiré' });
    return;
  }

  // Filter messages to show only those created after this token was generated
  // Token expires in 7 days, so token was created 7 days before expiration
  let filteredMessages = request.messages;
  if (request.messageTokenExpiresAt) {
    const tokenCreatedAt = new Date(request.messageTokenExpiresAt.getTime() - 7 * 86400 * 1000);
    filteredMessages = request.messages.filter(m => new Date(m.createdAt) >= tokenCreatedAt);
  }

  const prestataire = await User.findById(request.prestataireId).select('prenom nom');
  res.json({
    messages: filteredMessages,
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
    .select('messages requesterEmail requesterPrenom requesterNom status createdAt isArchived labels')
    .sort({ updatedAt: -1 });

  const threads = requests.map(r => ({
    _id: r._id,
    requesterEmail: r.requesterEmail,
    requesterName: r.requesterPrenom ? `${r.requesterPrenom} ${r.requesterNom ?? ''}`.trim() : r.requesterEmail,
    status: r.status,
    messageCount: r.messages.length,
    lastMessage: r.messages[r.messages.length - 1],
    createdAt: r.createdAt,
    isArchived: r.isArchived,
    labels: r.labels ?? [],
  }));

  res.json({ threads });
}

// Lister les fils de messages pour le client connecte
export async function listClientThreads(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!._id;
  const userEmail = req.user!.email;

  // Get registered client requests (clientId must match)
  // OR guest requests where requesterEmail matches AND clientId is empty (not a registered client)
  const requests = await ServiceRequest.find({
    $or: [
      { clientId: userId },
      { requesterEmail: userEmail, clientId: { $exists: false } },
    ],
    'messages.0': { $exists: true },
  })
    .select('messages status createdAt updatedAt prestataireId isArchived labels')
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
    isArchived: r.isArchived,
    labels: r.labels ?? [],
  }));

  res.json({ threads });
}

// Client connecte envoie un message (demande client)
export async function clientSendMessage(req: AuthRequest, res: Response): Promise<void> {
  const validation = validateMessageContent(req.body?.content);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const content = (req.body?.content as string).trim();

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
    content,
    createdAt: new Date(),
  } as Parameters<typeof request.messages.push>[0]);

  await request.save();

  const prestataire = await User.findById(request.prestataireId);
  if (prestataire) {
    await sendMessageToProviderEmail(request, prestataire, clientName, content).catch((err) => {
      logEmailError(
        'clientSendMessage: Failed to send email to provider',
        request._id.toString(),
        req.user!._id.toString(),
        prestataire.email,
        err
      );
    });
    sendPushToUser(prestataire._id, {
      title: `Réponse de ${clientName}`,
      body: content.slice(0, 100),
      url: `/app/messagerie?conversation=${request._id}`,
      requestId: request._id.toString(),
    }).catch(() => {});
    sendExpoNotification(prestataire._id, {
      title: `💬 ${clientName}`,
      body: content.slice(0, 100),
      data: { requestId: request._id.toString(), screen: 'requests' },
    }).catch(() => {});
  }

  res.json({ ok: true, messages: request.messages });
}

// Marquer les messages comme lus (prestataire connecté)
export async function markMessagesAsRead(req: AuthRequest, res: Response): Promise<void> {
  const validation = validateMessageIds(req.body?.messageIds);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const messageIds = req.body?.messageIds as string[];

  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    prestataireId: req.user!._id,
  });

  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const readerEmail = req.user!.email;
  for (const messageId of messageIds) {
    const messageIdx = request.messages.findIndex(m => m._id.toString() === messageId);
    if (messageIdx >= 0) {
      const message = request.messages[messageIdx];
      if (!message.readBy?.includes(readerEmail)) {
        if (!message.readBy) message.readBy = [];
        message.readBy.push(readerEmail);
      }
    }
  }

  await request.save();
  res.json({ ok: true, messages: request.messages });
}

// Marquer les messages comme lus (client via token)
export async function markMessagesAsReadByToken(req: Request, res: Response): Promise<void> {
  const tokenValidation = validateToken(req.body?.token);
  if (!tokenValidation.valid) {
    res.status(400).json({ error: tokenValidation.error });
    return;
  }

  const idsValidation = validateMessageIds(req.body?.messageIds);
  if (!idsValidation.valid) {
    res.status(400).json({ error: idsValidation.error });
    return;
  }

  const token = (req.body?.token as string).trim();
  const messageIds = req.body?.messageIds as string[];

  const request = await ServiceRequest.findOne({
    messageToken: token,
    messageTokenExpiresAt: { $gt: new Date() },
  });

  if (!request) {
    res.status(400).json({ error: 'Lien invalide ou expiré' });
    return;
  }

  const readerEmail = request.requesterEmail;
  for (const messageId of messageIds) {
    const messageIdx = request.messages.findIndex(m => m._id.toString() === messageId);
    if (messageIdx >= 0) {
      const message = request.messages[messageIdx];
      if (!message.readBy?.includes(readerEmail)) {
        if (!message.readBy) message.readBy = [];
        message.readBy.push(readerEmail);
      }
    }
  }

  await request.save();
  res.json({ ok: true, messages: request.messages });
}

// Ajouter une réaction (prestataire connecté)
export async function addReaction(req: AuthRequest, res: Response): Promise<void> {
  const messageId = req.body?.messageId;
  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    res.status(400).json({ error: 'messageId invalide' });
    return;
  }

  const emojiValidation = validateEmoji(req.body?.emoji);
  if (!emojiValidation.valid) {
    res.status(400).json({ error: emojiValidation.error });
    return;
  }

  const emoji = (req.body?.emoji as string).trim();

  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    prestataireId: req.user!._id,
  });

  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const messageIdx = request.messages.findIndex(m => m._id.toString() === messageId);
  if (messageIdx < 0) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }

  const message = request.messages[messageIdx];
  const reactorEmail = req.user!.email;
  
  if (!message.reactions) message.reactions = [];
  
  // Vérifier si la réaction existe déjà
  const existingIdx = message.reactions.findIndex(r => r.emoji === emoji && r.reactorEmail === reactorEmail);
  if (existingIdx >= 0) {
    // Supprimer si déjà existant (toggle)
    message.reactions.splice(existingIdx, 1);
  } else {
    // Ajouter la réaction
    message.reactions.push({
      emoji,
      reactorEmail,
      createdAt: new Date(),
    } as Parameters<typeof message.reactions.push>[0]);
  }

  await request.save();
  res.json({ ok: true, messages: request.messages });
}

// Ajouter une réaction (client via token)
export async function addReactionByToken(req: Request, res: Response): Promise<void> {
  const tokenValidation = validateToken(req.body?.token);
  if (!tokenValidation.valid) {
    res.status(400).json({ error: tokenValidation.error });
    return;
  }

  const messageId = req.body?.messageId;
  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    res.status(400).json({ error: 'messageId invalide' });
    return;
  }

  const emojiValidation = validateEmoji(req.body?.emoji);
  if (!emojiValidation.valid) {
    res.status(400).json({ error: emojiValidation.error });
    return;
  }

  const token = (req.body?.token as string).trim();
  const emoji = (req.body?.emoji as string).trim();

  const request = await ServiceRequest.findOne({
    messageToken: token,
    messageTokenExpiresAt: { $gt: new Date() },
  });

  if (!request) {
    res.status(400).json({ error: 'Lien invalide ou expiré' });
    return;
  }

  const messageIdx = request.messages.findIndex(m => m._id.toString() === messageId);
  if (messageIdx < 0) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }

  const message = request.messages[messageIdx];
  const reactorEmail = request.requesterEmail;
  
  if (!message.reactions) message.reactions = [];
  
  // Vérifier si la réaction existe déjà
  const existingIdx = message.reactions.findIndex(r => r.emoji === emoji && r.reactorEmail === reactorEmail);
  if (existingIdx >= 0) {
    // Supprimer si déjà existant (toggle)
    message.reactions.splice(existingIdx, 1);
  } else {
    // Ajouter la réaction
    message.reactions.push({
      emoji,
      reactorEmail,
      createdAt: new Date(),
    } as Parameters<typeof message.reactions.push>[0]);
  }

  await request.save();
  res.json({ ok: true, messages: request.messages });
}

// Chercher dans les messages d'une demande (prestataire connecté)
export async function searchMessages(req: AuthRequest, res: Response): Promise<void> {
  const q = req.query?.q;
  if (typeof q !== 'string') {
    res.status(400).json({ error: 'Query doit être une chaîne de caractères' });
    return;
  }

  const trimmed = q.trim();
  if (trimmed.length < 2) {
    res.status(400).json({ error: 'Query doit faire au moins 2 caractères' });
    return;
  }

  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    prestataireId: req.user!._id,
  }).select('messages');

  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const query = trimmed.toLowerCase();
  const results = request.messages
    .map((m, idx) => ({
      message: m,
      index: idx,
      matches: m.content.toLowerCase().includes(query) || m.fromName.toLowerCase().includes(query),
    }))
    .filter(r => r.matches)
    .map(r => ({ ...r.message, _originalIndex: r.index }));

  res.json({ results, total: results.length, query });
}

// Chercher dans les messages (client via token)
export async function searchMessagesByToken(req: Request, res: Response): Promise<void> {
  const tokenValidation = validateToken(req.query?.token);
  if (!tokenValidation.valid) {
    res.status(400).json({ error: tokenValidation.error });
    return;
  }

  const q = req.query?.q;
  if (typeof q !== 'string') {
    res.status(400).json({ error: 'Query doit être une chaîne de caractères' });
    return;
  }

  const trimmed = q.trim();
  if (trimmed.length < 2) {
    res.status(400).json({ error: 'Query doit faire au moins 2 caractères' });
    return;
  }

  const token = (req.query?.token as string).trim();

  const request = await ServiceRequest.findOne({
    messageToken: token,
    messageTokenExpiresAt: { $gt: new Date() },
  }).select('messages');

  if (!request) {
    res.status(400).json({ error: 'Lien invalide ou expiré' });
    return;
  }

  const query = trimmed.toLowerCase();
  const results = request.messages
    .map((m, idx) => ({
      message: m,
      index: idx,
      matches: m.content.toLowerCase().includes(query) || m.fromName.toLowerCase().includes(query),
    }))
    .filter(r => r.matches)
    .map(r => ({ ...r.message, _originalIndex: r.index }));

  res.json({ results, total: results.length, query });
}

// Épingler un message (prestataire connecté)
export async function pinMessage(req: AuthRequest, res: Response): Promise<void> {
  const messageId = req.body?.messageId;
  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    res.status(400).json({ error: 'messageId invalide' });
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

  const messageIdx = request.messages.findIndex(m => m._id.toString() === messageId);
  if (messageIdx < 0) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }

  const message = request.messages[messageIdx];
  message.isPinned = true;
  message.pinnedAt = new Date();

  await request.save();
  res.json({ ok: true, messages: request.messages });
}

// Dépingler un message (prestataire connecté)
export async function unpinMessage(req: AuthRequest, res: Response): Promise<void> {
  const messageId = req.body?.messageId;
  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    res.status(400).json({ error: 'messageId invalide' });
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

  const messageIdx = request.messages.findIndex(m => m._id.toString() === messageId);
  if (messageIdx < 0) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }

  const message = request.messages[messageIdx];
  message.isPinned = false;
  message.pinnedAt = undefined;

  await request.save();
  res.json({ ok: true, messages: request.messages });
}

// Éditer un message (prestataire ou client selon propriété)
export async function editMessage(req: AuthRequest, res: Response): Promise<void> {
  const messageId = req.body?.messageId;
  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    res.status(400).json({ error: 'messageId invalide' });
    return;
  }

  const contentValidation = validateMessageContent(req.body?.content);
  if (!contentValidation.valid) {
    res.status(400).json({ error: contentValidation.error });
    return;
  }

  const content = (req.body?.content as string).trim();

  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    $or: [{ prestataireId: req.user!._id }, { requesterEmail: req.user!.email }],
  });

  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const messageIdx = request.messages.findIndex(m => m._id.toString() === messageId);
  if (messageIdx < 0) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }

  const message = request.messages[messageIdx];
  // Vérifier que c'est le propriétaire du message
  if (message.fromEmail !== req.user!.email) {
    res.status(403).json({ error: 'Vous ne pouvez éditer que vos propres messages' });
    return;
  }

  if (message.isDeleted) {
    res.status(400).json({ error: 'Impossible d\'éditer un message supprimé' });
    return;
  }

  // Save current content to edit history
  if (!message.editHistory) message.editHistory = [];
  message.editHistory.push({
    previousContent: message.content,
    editedAt: new Date(),
    editedBy: req.user!.email,
  });

  message.content = filterXSS(content, xssOptions);
  message.editedAt = new Date();

  await request.save();
  res.json({ ok: true, messages: request.messages });
}

// Supprimer un message (soft delete)
export async function deleteMessage(req: AuthRequest, res: Response): Promise<void> {
  const messageId = req.body?.messageId;
  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    res.status(400).json({ error: 'messageId invalide' });
    return;
  }

  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    $or: [{ prestataireId: req.user!._id }, { requesterEmail: req.user!.email }],
  });

  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const messageIdx = request.messages.findIndex(m => m._id.toString() === messageId);
  if (messageIdx < 0) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }

  const message = request.messages[messageIdx];
  // Vérifier que c'est le propriétaire du message
  if (message.fromEmail !== req.user!.email) {
    res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres messages' });
    return;
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  message.content = '[Message supprimé]';

  await request.save();
  res.json({ ok: true, messages: request.messages });
}

// Transférer un message à une autre demande
export async function forwardMessage(req: AuthRequest, res: Response): Promise<void> {
  const messageId = req.body?.messageId;
  if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
    res.status(400).json({ error: 'messageId invalide' });
    return;
  }

  const targetRequestId = req.body?.targetRequestId;
  if (!targetRequestId || typeof targetRequestId !== 'string' || !targetRequestId.trim()) {
    res.status(400).json({ error: 'targetRequestId invalide' });
    return;
  }

  const sourceRequest = await ServiceRequest.findOne({
    _id: req.params.id,
    $or: [{ prestataireId: req.user!._id }, { requesterEmail: req.user!.email }],
  });

  if (!sourceRequest) {
    res.status(404).json({ error: 'Demande source introuvable' });
    return;
  }

  const sourceMessage = sourceRequest.messages.find(m => m._id.toString() === messageId);
  if (!sourceMessage) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }

  const targetRequest = await ServiceRequest.findOne({
    _id: targetRequestId,
    $or: [{ prestataireId: req.user!._id }, { requesterEmail: req.user!.email }],
  });

  if (!targetRequest) {
    res.status(404).json({ error: 'Demande cible introuvable' });
    return;
  }

  // Créer une copie du message avec note de forwarding
  const forwardedContent = `[Transféré depuis une autre conversation]\n\n${sourceMessage.content}\n\n— ${sourceMessage.fromName}`;
  const sanitizedForwardedContent = filterXSS(forwardedContent, xssOptions);

  // Déterminer le rôle based on qui est propriétaire de la demande cible
  const isTargetOwnerProvider = targetRequest.prestataireId.toString() === req.user!._id.toString();

  targetRequest.messages.push({
    fromRole: isTargetOwnerProvider ? 'provider' : 'client',
    fromEmail: req.user!.email,
    fromName: req.user!.prenom && req.user!.nom ? `${req.user!.prenom} ${req.user!.nom}` : req.user!.email,
    content: sanitizedForwardedContent,
    createdAt: new Date(),
  } as Parameters<typeof targetRequest.messages.push>[0]);

  await targetRequest.save();
  res.json({ ok: true, messages: targetRequest.messages });
}

// Lister les demandes disponibles pour forwarding (prestataire)
export async function getForwardTargets(req: AuthRequest, res: Response): Promise<void> {
  const currentRequestId = req.params.id;
  
  const requests = await ServiceRequest.find({
    _id: { $ne: currentRequestId },
    $or: [{ prestataireId: req.user!._id }, { requesterEmail: req.user!.email }],
    'messages.0': { $exists: true },
  })
    .select('_id status createdAt requesterEmail requesterPrenom requesterNom')
    .sort({ updatedAt: -1 })
    .limit(20);

  const targets = requests.map(r => ({
    _id: r._id,
    status: r.status,
    displayName: r.requesterPrenom ? `${r.requesterPrenom} ${r.requesterNom ?? ''}`.trim() : r.requesterEmail,
    createdAt: r.createdAt,
  }));

  res.json({ targets });
}

// Nombre total de messages non lus pour l'utilisateur connecté (toutes demandes)
export async function getUnreadCount(req: AuthRequest, res: Response): Promise<void> {
  const userEmail = req.user!.email;
  const isProvider = !!(req.prestataire || req.user!.role === 'staff' || req.user!.role === 'admin');

  const filter = isProvider
    ? { prestataireId: req.user!._id, 'messages.0': { $exists: true } }
    : { $or: [{ clientId: req.user!._id }, { requesterEmail: userEmail }], 'messages.0': { $exists: true } };

  const requests = await ServiceRequest.find(filter).select('messages');

  let count = 0;
  for (const r of requests) {
    for (const msg of r.messages) {
      if (msg.isDeleted) continue;
      const fromOther = isProvider ? msg.fromRole === 'client' : msg.fromRole === 'provider';
      if (fromOther && !msg.readBy?.includes(userEmail)) count++;
    }
  }

  res.json({ count });
}
