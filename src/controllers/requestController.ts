import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { Types } from 'mongoose';
import { ServiceRequest } from '../models/ServiceRequest';
import { User } from '../models/User';
import { Prestataire } from '../models/Prestataire';
import { AuthRequest } from '../types';
import { sanitizeText } from '../utils/sanitization';
import {
  sendRequestConfirmationEmail,
  sendRequestToProvider,
  sendProviderAcceptedEmail,
  sendProviderProposedEmail,
  sendProviderRefusedEmail,
  sendClientRefusedProposalEmail,
} from '../services/emailService';
import {
  validateEmail,
  validateTextField,
  validateNumber,
  validateStringArray,
  validateToken,
  validateLabelName,
} from '../utils/validation';
import { logEmailError, logMessageActionError } from '../utils/logger';
import { sendExpoNotification } from '../services/expoService';

export async function createRequest(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;

  // Validate email
  const emailValidation = validateEmail(body.requesterEmail);
  if (!emailValidation.valid) {
    res.status(400).json({ error: emailValidation.error });
    return;
  }

  // Validate prestataireId
  const prestataireId = body.prestataireId;
  if (!prestataireId || typeof prestataireId !== 'string' || !prestataireId.trim()) {
    res.status(400).json({ error: 'prestataireId invalide' });
    return;
  }

  // Validate optional text fields
  if (body.requesterNom) {
    const nomValidation = validateTextField(body.requesterNom, 'Nom', 1, 100);
    if (!nomValidation.valid) {
      res.status(400).json({ error: nomValidation.error });
      return;
    }
  }

  if (body.requesterPrenom) {
    const prenomValidation = validateTextField(body.requesterPrenom, 'Prénom', 1, 100);
    if (!prenomValidation.valid) {
      res.status(400).json({ error: prenomValidation.error });
      return;
    }
  }

  if (body.requesterTelephone) {
    const phoneValidation = validateTextField(body.requesterTelephone, 'Téléphone', 9, 20);
    if (!phoneValidation.valid) {
      res.status(400).json({ error: phoneValidation.error });
      return;
    }
  }

  if (body.description) {
    const descValidation = validateTextField(body.description, 'Description', 10, 1000);
    if (!descValidation.valid) {
      res.status(400).json({ error: descValidation.error });
      return;
    }
  }

  if (body.subject) {
    const subjectValidation = validateTextField(body.subject, 'Sujet', 5, 200);
    if (!subjectValidation.valid) {
      res.status(400).json({ error: subjectValidation.error });
      return;
    }
  }

  if (body.address) {
    const addressValidation = validateTextField(body.address, 'Adresse', 5, 200);
    if (!addressValidation.valid) {
      res.status(400).json({ error: addressValidation.error });
      return;
    }
  }

  if (body.codePostal) {
    const codeValidation = validateTextField(body.codePostal, 'Code postal', 4, 10);
    if (!codeValidation.valid) {
      res.status(400).json({ error: codeValidation.error });
      return;
    }
  }

  if (body.ville) {
    const villeValidation = validateTextField(body.ville, 'Ville', 2, 100);
    if (!villeValidation.valid) {
      res.status(400).json({ error: villeValidation.error });
      return;
    }
  }

  if (body.estimatedHours) {
    const hoursValidation = validateNumber(body.estimatedHours, 'Heures estimées', 0.5, 1000);
    if (!hoursValidation.valid) {
      res.status(400).json({ error: hoursValidation.error });
      return;
    }
  }

  // Validate prestations array if provided
  if (body.prestations) {
    const prestValidation = validateStringArray(body.prestations, 'Prestations', 0, 10);
    if (!prestValidation.valid) {
      res.status(400).json({ error: prestValidation.error });
      return;
    }
  }

  if (!Types.ObjectId.isValid(prestataireId)) {
    res.status(404).json({ error: 'Prestataire introuvable' });
    return;
  }

  const prestataireDoc = await Prestataire.findOne({ userId: prestataireId, is_validated: true });
  if (!prestataireDoc) {
    res.status(404).json({ error: 'Prestataire introuvable' });
    return;
  }

  const prestataire = await User.findById(prestataireId);
  if (!prestataire) {
    res.status(404).json({ error: 'Prestataire introuvable' });
    return;
  }

  const token = randomBytes(20).toString('hex');
  const requesterEmail = (body.requesterEmail as string).toLowerCase();

  try {
    const request = await ServiceRequest.create({
      prestataireId,
      requesterEmail,
      requesterNom: sanitizeText(body.requesterNom as string | undefined),
      requesterPrenom: sanitizeText(body.requesterPrenom as string | undefined),
      requesterTelephone: body.requesterTelephone as string | undefined,
      prestations: (body.prestations ?? []) as string[],
      estimatedHours: body.estimatedHours,
      recurring: typeof body.recurring === 'boolean' ? body.recurring : false,
      description: sanitizeText(body.description as string | undefined),
      subject: sanitizeText(body.subject as string | undefined),
      address: sanitizeText(body.address as string | undefined),
      codePostal: body.codePostal as string | undefined,
      ville: sanitizeText(body.ville as string | undefined),
      desiredAt: body.desiredAt,
      status: 'email_pending',
      verifyToken: token,
      verifyTokenExpiresAt: new Date(Date.now() + 48 * 3600 * 1000),
    });

    await sendRequestConfirmationEmail(requesterEmail, token, prestataire).catch((err) => {
      logEmailError('createRequest: Failed to send confirmation email', request._id.toString(), undefined, requesterEmail, err);
    });

    res.status(201).json({ ok: true, id: request._id });
  } catch (error) {
    logMessageActionError('createRequest: Failed to create request', undefined, undefined, error);
    res.status(500).json({ error: 'Erreur lors de la création de la demande' });
  }
}

export async function confirmRequest(req: Request, res: Response): Promise<void> {
  const tokenValidation = validateToken(req.query?.token);
  if (!tokenValidation.valid) {
    res.status(400).json({ error: tokenValidation.error });
    return;
  }

  const token = (req.query?.token as string).trim();
  const request = await ServiceRequest.findOne({
    verifyToken: token,
    status: 'email_pending',
    verifyTokenExpiresAt: { $gt: new Date() },
  });

  if (!request) {
    res.status(400).json({ error: 'Lien invalide ou expiré' });
    return;
  }

  const prestataire = await User.findById(request.prestataireId);
  if (!prestataire) {
    res.status(404).json({ error: 'Prestataire introuvable' });
    return;
  }

  try {
    request.status = 'client_confirmed';
    await request.save();

    await sendRequestToProvider(request, prestataire).catch((err) => {
      logEmailError('confirmRequest: Failed to send to provider', request._id.toString(), undefined, prestataire.email, err);
    });

    request.status = 'sent_to_provider';
    request.lastProviderNotifiedAt = new Date();
    await request.save();

    sendExpoNotification(prestataire._id, {
      title: '🌿 Nouvelle demande',
      body: `${request.requesterPrenom ?? request.requesterEmail} a une nouvelle demande pour vous`,
      data: { requestId: request._id.toString(), screen: 'demandes' },
    }).catch(() => {});

    res.json({ ok: true, status: request.status });
  } catch (error) {
    logMessageActionError('confirmRequest: Failed to confirm request', request._id.toString(), undefined, error);
    res.status(500).json({ error: 'Erreur lors de la confirmation' });
  }
}

export async function resendConfirmation(req: Request, res: Response): Promise<void> {
  const tokenValidation = validateToken(req.body?.token);
  if (!tokenValidation.valid) {
    res.status(400).json({ error: tokenValidation.error });
    return;
  }

  const emailValidation = validateEmail(req.body?.email);
  if (!emailValidation.valid) {
    res.status(400).json({ error: emailValidation.error });
    return;
  }

  const token = (req.body?.token as string).trim();
  const email = (req.body?.email as string).toLowerCase();
  const cooldown = parseInt(process.env.RESEND_COOLDOWN_MS ?? '600000', 10);

  const request = await ServiceRequest.findOne({ verifyToken: token, requesterEmail: email });

  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  if (request.lastResendAt && Date.now() - request.lastResendAt.getTime() < cooldown) {
    res.status(429).json({ error: 'Veuillez patienter avant de renvoyer' });
    return;
  }

  const prestataire = await User.findById(request.prestataireId);
  if (!prestataire) {
    res.status(404).json({ error: 'Prestataire introuvable' });
    return;
  }

  request.lastResendAt = new Date();
  await request.save();
  await sendRequestConfirmationEmail(email, token, prestataire);
  res.json({ ok: true });
}

export async function listMyRequests(req: AuthRequest, res: Response): Promise<void> {
  const { page = '1', pageSize = '20', includeArchived = 'false' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);

  const filter = {
    prestataireId: req.user!._id,
    ...(includeArchived === 'false' && { isArchived: { $ne: true } }),
  };

  const [items, total] = await Promise.all([
    ServiceRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(pageSize)),
    ServiceRequest.countDocuments(filter),
  ]);

  res.json({ items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
}

export async function listMyClientRequests(req: AuthRequest, res: Response): Promise<void> {
  const { page = '1', pageSize = '20', includeArchived = 'false' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);

  const filter = {
    $or: [
      { clientId: req.user!._id },
      { requesterEmail: req.user!.email },
    ],
    ...(includeArchived === 'false' && { isArchived: { $ne: true } }),
  };

  const [items, total] = await Promise.all([
    ServiceRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize)),
    ServiceRequest.countDocuments(filter),
  ]);

  res.json({ items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
}

export async function providerAccept(req: AuthRequest, res: Response): Promise<void> {
  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    prestataireId: req.user!._id,
    status: 'sent_to_provider',
  });
  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  request.status = 'scheduled';
  await request.save();
  await sendProviderAcceptedEmail(request, req.user!);
  if (request.clientId) {
    sendExpoNotification(request.clientId, {
      title: '✅ Demande acceptée',
      body: `${req.user!.prenom} a accepté votre demande`,
      data: { requestId: request._id.toString(), screen: 'demandes' },
    }).catch(() => {});
  }
  res.json({ ok: true, status: request.status });
}

export async function providerPropose(req: AuthRequest, res: Response): Promise<void> {
  const date = req.body?.date;
  if (!date || typeof date !== 'string' || !date.trim()) {
    res.status(400).json({ error: 'Date requise' });
    return;
  }

  const proposedDate = new Date(date);
  if (isNaN(proposedDate.getTime())) {
    res.status(400).json({ error: 'Date invalide' });
    return;
  }

  // Validate comment if provided
  if (req.body?.comment) {
    const commentValidation = validateTextField(req.body.comment, 'Commentaire', 5, 500);
    if (!commentValidation.valid) {
      res.status(400).json({ error: commentValidation.error });
      return;
    }
  }

  const comment = req.body?.comment ? (req.body.comment as string).trim() : undefined;

  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    prestataireId: req.user!._id,
    status: { $in: ['sent_to_provider', 'client_accepted'] },
  });
  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  try {
    request.proposals.push({ by: 'provider', date: proposedDate, comment, createdAt: new Date() });
    request.status = 'provider_proposed';
    const token = randomBytes(20).toString('hex');
    request.proposalToken = token;
    request.proposalTokenExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await request.save();

    await sendProviderProposedEmail(request, req.user!, proposedDate, comment, token).catch((err) => {
      logEmailError('providerPropose: Failed to send proposal email', request._id.toString(), req.user!._id.toString(), undefined, err);
    });

    if (request.clientId) {
      sendExpoNotification(request.clientId, {
        title: '📅 Nouvelle date proposée',
        body: `${req.user!.prenom} propose un nouveau créneau`,
        data: { requestId: request._id.toString(), screen: 'demandes' },
      }).catch(() => {});
    }

    res.json({ ok: true, status: request.status, proposals: request.proposals });
  } catch (error) {
    logMessageActionError('providerPropose: Failed to propose', request._id.toString(), req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la proposition' });
  }
}

export async function providerRefuse(req: AuthRequest, res: Response): Promise<void> {
  const { message } = req.body as { message?: string };
  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    prestataireId: req.user!._id,
    status: { $in: ['sent_to_provider', 'provider_proposed', 'client_accepted', 'scheduled'] },
  });
  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  request.status = 'refused';
  await request.save();
  await sendProviderRefusedEmail(request, req.user!, message);
  if (request.clientId) {
    sendExpoNotification(request.clientId, {
      title: '❌ Demande refusée',
      body: `${req.user!.prenom} n'est pas disponible pour cette demande`,
      data: { requestId: request._id.toString(), screen: 'demandes' },
    }).catch(() => {});
  }
  res.json({ ok: true, status: request.status });
}

export async function providerCancel(req: AuthRequest, res: Response): Promise<void> {
  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    prestataireId: req.user!._id,
    status: 'scheduled',
  });
  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }
  request.status = 'cancelled';
  await request.save();
  if (request.clientId) {
    sendExpoNotification(request.clientId, {
      title: '❌ Prestation annulée',
      body: `${req.user!.prenom} a annulé la prestation planifiée`,
      data: { requestId: request._id.toString(), screen: 'demandes' },
    }).catch(() => {});
  }
  res.json({ ok: true });
}

export async function clientAcceptProposal(req: AuthRequest, res: Response): Promise<void> {
  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    status: 'provider_proposed',
    requesterEmail: req.user!.email,
  });
  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const lastProposal = request.proposals.at(-1);
  if (lastProposal) request.desiredAt = lastProposal.date;
  request.status = 'scheduled';
  await request.save();
  sendExpoNotification(request.prestataireId, {
    title: '✅ Date acceptée',
    body: `Le client a accepté votre proposition de créneau`,
    data: { requestId: request._id.toString(), screen: 'demandes' },
  }).catch(() => {});
  res.json({ ok: true, status: request.status, desiredAt: request.desiredAt });
}

export async function clientAcceptProposalByToken(req: Request, res: Response): Promise<void> {
  const { token } = req.query as { token?: string };
  if (!token) { res.status(400).json({ error: 'Token manquant' }); return; }

  const request = await ServiceRequest.findOne({
    proposalToken: token,
    proposalTokenExpiresAt: { $gt: new Date() },
    status: 'provider_proposed',
  });
  if (!request) { res.status(404).json({ error: 'Lien invalide ou expiré' }); return; }

  const lastProposal = request.proposals.at(-1);
  if (lastProposal) request.desiredAt = lastProposal.date;
  request.status = 'scheduled';
  request.proposalToken = undefined;
  await request.save();
  res.json({ ok: true, desiredAt: request.desiredAt });
}

export async function clientRefuseProposalByToken(req: Request, res: Response): Promise<void> {
  const { token } = req.query as { token?: string };
  if (!token) { res.status(400).json({ error: 'Token manquant' }); return; }

  const request = await ServiceRequest.findOne({
    proposalToken: token,
    proposalTokenExpiresAt: { $gt: new Date() },
    status: 'provider_proposed',
  });
  if (!request) { res.status(404).json({ error: 'Lien invalide ou expiré' }); return; }

  const lastProposal = request.proposals.at(-1);
  request.status = 'sent_to_provider';
  request.proposalToken = undefined;
  await request.save();

  const prestataire = await User.findById(request.prestataireId);
  if (prestataire && lastProposal) {
    await sendClientRefusedProposalEmail(request, prestataire, lastProposal.date);
  }
  res.json({ ok: true });
}

export async function clientRefuseProposal(req: AuthRequest, res: Response): Promise<void> {
  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    status: 'provider_proposed',
    requesterEmail: req.user!.email,
  });
  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const lastProposal = request.proposals.at(-1);
  request.status = 'sent_to_provider';
  request.proposalToken = undefined;
  await request.save();

  const prestataire = await User.findById(request.prestataireId);
  if (prestataire && lastProposal) {
    await sendClientRefusedProposalEmail(request, prestataire, lastProposal.date).catch((err) => {
      logEmailError('clientRefuseProposal: Failed to send email', request._id.toString(), req.user!._id.toString(), prestataire.email, err);
    });
    sendExpoNotification(request.prestataireId, {
      title: '❌ Date refusée',
      body: `${req.user!.prenom} a refusé votre proposition de créneau`,
      data: { requestId: request._id.toString(), screen: 'demandes' },
    }).catch(() => {});
  }
  res.json({ ok: true, status: request.status });
}

export async function markComplete(req: AuthRequest, res: Response): Promise<void> {
  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    prestataireId: req.user!._id,
    status: 'scheduled',
  });
  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }
  request.status = 'completed';
  await request.save();
  res.json({ ok: true });
}

export async function archiveRequest(req: AuthRequest, res: Response): Promise<void> {
  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    $or: [
      { prestataireId: req.user!._id },
      { clientId: req.user!._id },
      { requesterEmail: req.user!.email },
    ],
  });
  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }
  request.isArchived = true;
  request.archivedAt = new Date();
  await request.save();
  res.json({ ok: true });
}

export async function unarchiveRequest(req: AuthRequest, res: Response): Promise<void> {
  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    $or: [
      { prestataireId: req.user!._id },
      { clientId: req.user!._id },
      { requesterEmail: req.user!.email },
    ],
  });
  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }
  request.isArchived = false;
  request.archivedAt = undefined;
  await request.save();
  res.json({ ok: true });
}

export async function addLabel(req: AuthRequest, res: Response): Promise<void> {
  const labelValidation = validateLabelName(req.body?.labelName);
  if (!labelValidation.valid) {
    res.status(400).json({ error: labelValidation.error });
    return;
  }

  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    $or: [
      { prestataireId: req.user!._id },
      { clientId: req.user!._id },
      { requesterEmail: req.user!.email },
    ],
  });
  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const cleanName = ((req.body?.labelName as string).trim()).toLowerCase();
  if (!request.labels) request.labels = [];

  // Check if label already exists
  const maxLabels = 20;
  if (!request.labels.some(l => l.name === cleanName)) {
    if (request.labels.length >= maxLabels) {
      res.status(400).json({ error: `Maximum ${maxLabels} labels par demande` });
      return;
    }
    request.labels.push({ name: cleanName, createdAt: new Date() });
  }

  await request.save();
  res.json({ ok: true, labels: request.labels });
}

export async function removeLabel(req: AuthRequest, res: Response): Promise<void> {
  const labelValidation = validateLabelName(req.body?.labelName);
  if (!labelValidation.valid) {
    res.status(400).json({ error: labelValidation.error });
    return;
  }

  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    $or: [
      { prestataireId: req.user!._id },
      { clientId: req.user!._id },
      { requesterEmail: req.user!.email },
    ],
  });
  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const cleanName = ((req.body?.labelName as string).trim()).toLowerCase();
  request.labels = (request.labels ?? []).filter(l => l.name !== cleanName);
  await request.save();
  res.json({ ok: true, labels: request.labels });
}

export async function listLabels(req: AuthRequest, res: Response): Promise<void> {
  const requests = await ServiceRequest.find({
    $or: [
      { prestataireId: req.user!._id },
      { clientId: req.user!._id },
      { requesterEmail: req.user!.email },
    ],
  }).select('labels');

  const labelCounts = new Map<string, number>();
  requests.forEach(r => {
    (r.labels ?? []).forEach(l => {
      labelCounts.set(l.name, (labelCounts.get(l.name) ?? 0) + 1);
    });
  });

  const labels = Array.from(labelCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  res.json({ labels });
}
