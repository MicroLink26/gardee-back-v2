import { sendMail } from '../config/mailer';
import { IServiceRequest } from '../models/ServiceRequest';
import { IUser } from '../models/User';

const FRONT_URL = () => process.env.FRONT_URL ?? 'https://gardee.fr';
const APP_URL = () => process.env.APP_URL ?? 'https://gardee.fr';

export async function sendWelcomeEmail(user: IUser): Promise<void> {
  await sendMail(
    user.email,
    'Bienvenue sur Gardee !',
    `<p>Bonjour ${user.prenom},</p>
    <p>Votre inscription a bien été reçue. Votre profil sera visible après validation par notre équipe.</p>
    <p>L'équipe Gardee</p>`
  );
}

export async function sendRequestConfirmationEmail(
  to: string,
  token: string,
  prestataire: IUser
): Promise<void> {
  const link = `${APP_URL()}/app/requests/confirm?token=${token}`;
  await sendMail(
    to,
    'Confirmez votre demande de service',
    `<p>Bonjour,</p>
    <p>Vous avez soumis une demande de service à <strong>${prestataire.prenom} ${prestataire.nom}</strong>.</p>
    <p>Cliquez sur le lien ci-dessous pour confirmer votre demande (valable 48h) :</p>
    <p><a href="${link}">${link}</a></p>
    <p>L'équipe Gardee</p>`
  );
}

export async function sendRequestToProvider(
  request: IServiceRequest,
  prestataire: IUser
): Promise<void> {
  await sendMail(
    prestataire.email,
    'Nouvelle demande de service',
    `<p>Bonjour ${prestataire.prenom},</p>
    <p>Vous avez reçu une nouvelle demande de service de la part de <strong>${request.requesterPrenom ? `${request.requesterPrenom} ${request.requesterNom ?? ''}`.trim() : request.requesterEmail}</strong>.</p>
    <p>Email : ${request.requesterEmail}</p>
    ${request.address ? `<p>Adresse du chantier : <strong>${request.address}</strong></p>` : ''}
    <p>Services demandés : ${request.prestations.join(', ')}</p>
    ${request.desiredAt ? `<p>Date souhaitée : ${new Date(request.desiredAt).toLocaleDateString('fr-FR')}</p>` : ''}
    ${request.description ? `<p>Description : ${request.description}</p>` : ''}
    <p>Connectez-vous à votre espace pour répondre : <a href="${APP_URL()}/app/mes-demandes">${APP_URL()}/app/mes-demandes</a></p>
    <p>L'équipe Gardee</p>`
  );
}

export async function sendProviderAcceptedEmail(
  request: IServiceRequest,
  prestataire: IUser
): Promise<void> {
  await sendMail(
    request.requesterEmail,
    'Votre demande a été acceptée',
    `<p>Bonjour,</p>
    <p><strong>${prestataire.prenom} ${prestataire.nom}</strong> a accepté votre demande de service.</p>
    ${request.desiredAt ? `<p>Date confirmée : ${new Date(request.desiredAt).toLocaleDateString('fr-FR')}</p>` : ''}
    <p>L'équipe Gardee</p>`
  );
}

export async function sendProviderProposedEmail(
  request: IServiceRequest,
  prestataire: IUser,
  proposedDate: Date,
  comment?: string
): Promise<void> {
  await sendMail(
    request.requesterEmail,
    'Proposition de date de votre prestataire',
    `<p>Bonjour,</p>
    <p><strong>${prestataire.prenom} ${prestataire.nom}</strong> vous propose une nouvelle date :</p>
    <p><strong>${new Date(proposedDate).toLocaleDateString('fr-FR')}</strong></p>
    ${comment ? `<p>Message : ${comment}</p>` : ''}
    <p>L'équipe Gardee</p>`
  );
}

export async function sendProviderRefusedEmail(
  request: IServiceRequest,
  prestataire: IUser,
  message?: string
): Promise<void> {
  await sendMail(
    request.requesterEmail,
    'Votre demande a été refusée',
    `<p>Bonjour,</p>
    <p><strong>${prestataire.prenom} ${prestataire.nom}</strong> n'est pas disponible pour votre demande.</p>
    ${message ? `<p>Message : ${message}</p>` : ''}
    <p>Vous pouvez trouver d'autres prestataires sur <a href="${FRONT_URL()}">${FRONT_URL()}</a></p>
    <p>L'équipe Gardee</p>`
  );
}

export async function sendRatingRequestEmail(
  request: IServiceRequest,
  prestataire: IUser
): Promise<void> {
  const link = `${APP_URL()}/app/requests/rate?token=${request.ratingToken}`;
  await sendMail(
    request.requesterEmail,
    'Comment s\'est passée votre prestation ?',
    `<p>Bonjour,</p>
    <p>Votre prestation avec <strong>${prestataire.prenom} ${prestataire.nom}</strong> vient de se terminer.</p>
    <p>Donnez votre avis en cliquant sur ce lien :</p>
    <p><a href="${link}">${link}</a></p>
    <p>L'équipe Gardee</p>`
  );
}

export async function sendUpcomingReminderEmail(
  request: IServiceRequest,
  prestataire: IUser
): Promise<void> {
  await sendMail(
    request.requesterEmail,
    'Rappel : prestation demain',
    `<p>Bonjour,</p>
    <p>Rappel : votre prestation avec <strong>${prestataire.prenom} ${prestataire.nom}</strong> est prévue demain.</p>
    ${request.desiredAt ? `<p>Date : ${new Date(request.desiredAt).toLocaleDateString('fr-FR')}</p>` : ''}
    <p>L'équipe Gardee</p>`
  );
}

export async function sendForgotPasswordEmail(to: string, token: string): Promise<void> {
  const link = `${APP_URL()}/app/forgot-password?token=${token}`;
  await sendMail(
    to,
    'Réinitialisation de votre mot de passe',
    `<p>Bonjour,</p>
    <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe (valable 1h) :</p>
    <p><a href="${link}">${link}</a></p>
    <p>Si vous n'avez pas fait cette demande, ignorez cet email.</p>
    <p>L'équipe Gardee</p>`
  );
}
