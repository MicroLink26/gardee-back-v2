import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { ServiceRequest } from '../models/ServiceRequest';
import { User } from '../models/User';
import { AuthRequest } from '../types';
import {
  sendRequestConfirmationEmail,
  sendRequestToProvider,
  sendProviderAcceptedEmail,
  sendProviderProposedEmail,
  sendProviderRefusedEmail,
} from '../services/emailService';

export async function createRequest(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const { prestataireId, requesterEmail } = body;

  if (!prestataireId || !requesterEmail) {
    res.status(400).json({ error: 'prestataireId et requesterEmail sont requis' });
    return;
  }

  const prestataire = await User.findOne({ _id: prestataireId, role: 'prestataire', is_validated: true });
  if (!prestataire) {
    res.status(404).json({ error: 'Prestataire introuvable' });
    return;
  }

  const token = randomBytes(20).toString('hex');
  const request = await ServiceRequest.create({
    prestataireId,
    requesterEmail: (requesterEmail as string).toLowerCase(),
    requesterNom: body.requesterNom,
    requesterPrenom: body.requesterPrenom,
    requesterTelephone: body.requesterTelephone,
    prestations: body.prestations ?? [],
    estimatedHours: body.estimatedHours,
    recurring: body.recurring ?? false,
    description: body.description,
    subject: body.subject,
    address: body.address,
    codePostal: body.codePostal,
    ville: body.ville,
    desiredAt: body.desiredAt,
    status: 'email_pending',
    verifyToken: token,
    verifyTokenExpiresAt: new Date(Date.now() + 48 * 3600 * 1000),
  });

  await sendRequestConfirmationEmail(requesterEmail as string, token, prestataire);
  res.status(201).json({ ok: true, id: request._id });
}

export async function confirmRequest(req: Request, res: Response): Promise<void> {
  const { token } = req.query as { token: string };
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

  request.status = 'client_confirmed';
  await request.save();

  await sendRequestToProvider(request, prestataire);
  request.status = 'sent_to_provider';
  request.lastProviderNotifiedAt = new Date();
  await request.save();

  res.json({ ok: true, status: request.status });
}

export async function resendConfirmation(req: Request, res: Response): Promise<void> {
  const { token, email } = req.body as { token: string; email: string };
  const cooldown = parseInt(process.env.RESEND_COOLDOWN_MS ?? '600000', 10);
  const request = await ServiceRequest.findOne({ verifyToken: token, requesterEmail: email.toLowerCase() });

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
  const { page = '1', pageSize = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);

  const [items, total] = await Promise.all([
    ServiceRequest.find({ prestataireId: req.user!._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(pageSize)),
    ServiceRequest.countDocuments({ prestataireId: req.user!._id }),
  ]);

  res.json({ items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
}

export async function listMyClientRequests(req: AuthRequest, res: Response): Promise<void> {
  const { page = '1', pageSize = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);

  const filter = {
    $or: [
      { clientId: req.user!._id },
      { requesterEmail: req.user!.email },
    ],
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
  res.json({ ok: true, status: request.status });
}

export async function providerPropose(req: AuthRequest, res: Response): Promise<void> {
  const { date, comment } = req.body as { date: string; comment?: string };
  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    prestataireId: req.user!._id,
    status: { $in: ['sent_to_provider', 'client_accepted'] },
  });
  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const proposedDate = new Date(date);
  request.proposals.push({ by: 'provider', date: proposedDate, comment, createdAt: new Date() });
  request.status = 'provider_proposed';
  await request.save();

  await sendProviderProposedEmail(request, req.user!, proposedDate, comment);
  res.json({ ok: true, status: request.status, proposals: request.proposals });
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
  res.json({ ok: true });
}

export async function clientAcceptProposal(req: Request, res: Response): Promise<void> {
  const request = await ServiceRequest.findOne({
    _id: req.params.id,
    status: 'provider_proposed',
  });
  if (!request) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const lastProposal = request.proposals.at(-1);
  if (lastProposal) request.desiredAt = lastProposal.date;
  request.status = 'scheduled';
  await request.save();
  res.json({ ok: true, status: request.status, desiredAt: request.desiredAt });
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
