import { Types } from 'mongoose';
import { Notification } from '../models/Notification';

type NotificationType = 'request_created' | 'request_confirmed' | 'provider_accepted' | 'provider_proposed' | 'provider_refused' | 'client_accepted' | 'client_refused' | 'request_completed' | 'message' | 'other';

export async function createNotification(
  userId: Types.ObjectId,
  type: NotificationType,
  title: string,
  body: string,
  relatedRequestId?: Types.ObjectId,
  relatedUserId?: Types.ObjectId,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await Notification.create({
      userId,
      type,
      title,
      body,
      relatedRequestId,
      relatedUserId,
      data,
      read: false,
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

export async function notifyRequestCreated(prestataireId: Types.ObjectId, requestId: Types.ObjectId, requesterName: string): Promise<void> {
  await createNotification(
    prestataireId,
    'request_created',
    '🌿 Nouvelle demande',
    `${requesterName} a une nouvelle demande pour vous`,
    requestId
  );
}

export async function notifyRequestConfirmed(prestataireId: Types.ObjectId, requestId: Types.ObjectId, requesterName: string): Promise<void> {
  await createNotification(
    prestataireId,
    'request_confirmed',
    '✓ Demande confirmée',
    `${requesterName} a confirmé sa demande`,
    requestId
  );
}

export async function notifyProviderAccepted(clientId: Types.ObjectId, requestId: Types.ObjectId, prestatairePrenom: string): Promise<void> {
  await createNotification(
    clientId,
    'provider_accepted',
    '✓ Demande acceptée',
    `${prestatairePrenom} a accepté votre demande`,
    requestId
  );
}

export async function notifyProviderProposed(clientId: Types.ObjectId, requestId: Types.ObjectId, prestatairePrenom: string, proposedDate?: string): Promise<void> {
  const body = proposedDate
    ? `${prestatairePrenom} a proposé le ${proposedDate}`
    : `${prestatairePrenom} a une proposition pour vous`;

  await createNotification(
    clientId,
    'provider_proposed',
    '💬 Nouvelle proposition',
    body,
    requestId,
    undefined,
    { proposedDate }
  );
}

export async function notifyProviderRefused(clientId: Types.ObjectId, requestId: Types.ObjectId, prestatairePrenom: string): Promise<void> {
  await createNotification(
    clientId,
    'provider_refused',
    '✗ Demande refusée',
    `${prestatairePrenom} a refusé votre demande`,
    requestId
  );
}

export async function notifyClientAccepted(prestataireId: Types.ObjectId, requestId: Types.ObjectId): Promise<void> {
  await createNotification(
    prestataireId,
    'client_accepted',
    '✓ Proposition acceptée',
    'Le client a accepté votre proposition',
    requestId
  );
}

export async function notifyClientRefused(prestataireId: Types.ObjectId, requestId: Types.ObjectId): Promise<void> {
  await createNotification(
    prestataireId,
    'client_refused',
    '✗ Proposition refusée',
    'Le client a refusé votre proposition',
    requestId
  );
}

export async function notifyRequestCompleted(clientId: Types.ObjectId, requestId: Types.ObjectId, prestatairePrenom: string): Promise<void> {
  await createNotification(
    clientId,
    'request_completed',
    '✓ Travaux terminés',
    `${prestatairePrenom} a marqué votre demande comme terminée`,
    requestId
  );
}
