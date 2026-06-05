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
  const requests = await ServiceRequest.find({
    $or: [{ clientId: req.user!._id }, { requesterEmail: req.user!.email }],
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
    messageToken: r.messageToken,
    isArchived: r.isArchived,
    labels: r.labels ?? [],
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

// Marquer les messages comme lus (prestataire connecté)
export async function markMessagesAsRead(req: AuthRequest, res: Response): Promise<void> {
  const { messageIds } = req.body as { messageIds: string[] };
  if (!messageIds || !Array.isArray(messageIds)) {
    res.status(400).json({ error: 'messageIds doit être un tableau' });
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
  const { token, messageIds } = req.body as { token: string; messageIds: string[] };
  if (!messageIds || !Array.isArray(messageIds)) {
    res.status(400).json({ error: 'messageIds doit être un tableau' });
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
  const { messageId, emoji } = req.body as { messageId: string; emoji: string };
  if (!messageId || !emoji) {
    res.status(400).json({ error: 'messageId et emoji requis' });
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
  const { token, messageId, emoji } = req.body as { token: string; messageId: string; emoji: string };
  if (!token || !messageId || !emoji) {
    res.status(400).json({ error: 'token, messageId et emoji requis' });
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
  const { q } = req.query as { q: string };
  if (!q || q.trim().length < 2) {
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

  const query = q.toLowerCase();
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
  const { token, q } = req.query as { token: string; q: string };
  if (!q || q.trim().length < 2) {
    res.status(400).json({ error: 'Query doit faire au moins 2 caractères' });
    return;
  }

  const request = await ServiceRequest.findOne({
    messageToken: token,
    messageTokenExpiresAt: { $gt: new Date() },
  }).select('messages');

  if (!request) {
    res.status(400).json({ error: 'Lien invalide ou expiré' });
    return;
  }

  const query = q.toLowerCase();
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
  const { messageId } = req.body as { messageId: string };
  if (!messageId) {
    res.status(400).json({ error: 'messageId requis' });
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
  const { messageId } = req.body as { messageId: string };
  if (!messageId) {
    res.status(400).json({ error: 'messageId requis' });
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
  const { messageId, content } = req.body as { messageId: string; content: string };
  if (!messageId || !content?.trim()) {
    res.status(400).json({ error: 'messageId et contenu requis' });
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

  message.content = content.trim();
  message.editedAt = new Date();

  await request.save();
  res.json({ ok: true, messages: request.messages });
}

// Supprimer un message (soft delete)
export async function deleteMessage(req: AuthRequest, res: Response): Promise<void> {
  const { messageId } = req.body as { messageId: string };
  if (!messageId) {
    res.status(400).json({ error: 'messageId requis' });
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
  const { messageId, targetRequestId } = req.body as { messageId: string; targetRequestId: string };
  if (!messageId || !targetRequestId) {
    res.status(400).json({ error: 'messageId et targetRequestId requis' });
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

  // Déterminer le rôle based on qui est propriétaire de la demande cible
  const isTargetOwnerProvider = targetRequest.prestataireId.toString() === req.user!._id.toString();

  targetRequest.messages.push({
    fromRole: isTargetOwnerProvider ? 'provider' : 'client',
    fromEmail: req.user!.email,
    fromName: req.user!.prenom && req.user!.nom ? `${req.user!.prenom} ${req.user!.nom}` : req.user!.email,
    content: forwardedContent,
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
