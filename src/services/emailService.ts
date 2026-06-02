import { sendMail } from '../config/mailer';
import { IServiceRequest } from '../models/ServiceRequest';
import { IUser } from '../models/User';

const FRONT_URL = () => process.env.FRONT_URL ?? 'https://gardee.fr';
const APP_URL = () => process.env.APP_URL ?? 'https://gardee.fr';

const emailFooter = `
<p>L'équipe Gardee</p>
<hr style="border:none;border-top:1px solid #e9e5d6;margin:1.5rem 0" />
<p style="font-size:0.78rem;color:#9ca3af">Si ce message vous semble frauduleux ou que vous n'en êtes pas à l'origine, merci de nous le signaler à <a href="mailto:info@gardee.fr" style="color:#9ca3af">info@gardee.fr</a>.</p>`;

export async function sendWelcomeEmail(user: IUser): Promise<void> {
  await sendMail(
    user.email,
    'Bienvenue sur Gardee !',
    `<p>Bonjour ${user.prenom},</p>
    <p>Votre inscription a bien été reçue. Votre profil sera visible après validation par notre équipe.</p>
    ${emailFooter}`
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
    ${emailFooter}`
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
    ${request.desiredAt ? `<p>Date souhaitée : ${new Date(request.desiredAt).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>` : ''}
    ${request.description ? `<p>Description : ${request.description}</p>` : ''}
    <p>Connectez-vous à votre espace pour répondre : <a href="${APP_URL()}/app/mes-demandes">${APP_URL()}/app/mes-demandes</a></p>
    ${emailFooter}`
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
    ${request.desiredAt ? `<p>Date confirmée : ${new Date(request.desiredAt).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>` : ''}
    ${emailFooter}`
  );
}

export async function sendProviderProposedEmail(
  request: IServiceRequest,
  prestataire: IUser,
  proposedDate: Date,
  comment?: string,
  token?: string
): Promise<void> {
  const dateStr = `${new Date(proposedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} à ${new Date(proposedDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  const acceptLink = token ? `${APP_URL()}/app/requests/proposal-accept?token=${token}` : null;
  const refuseLink = token ? `${APP_URL()}/app/requests/proposal-refuse?token=${token}` : null;

  await sendMail(
    request.requesterEmail,
    'Proposition de date de votre prestataire',
    `<p>Bonjour,</p>
    <p><strong>${prestataire.prenom} ${prestataire.nom}</strong> vous propose une nouvelle date :</p>
    <p><strong>${dateStr}</strong></p>
    ${comment ? `<p>Message : ${comment}</p>` : ''}
    ${acceptLink ? `
    <p style="margin-top:1.5rem">
      <a href="${acceptLink}" style="display:inline-block;padding:0.75rem 1.5rem;background:#3a5020;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">
        ✓ Accepter cette date
      </a>
      &nbsp;&nbsp;
      <a href="${refuseLink}" style="display:inline-block;padding:0.75rem 1.5rem;background:#fef2f2;color:#b91c1c;text-decoration:none;border-radius:8px;font-weight:bold;border:1px solid #fecaca">
        ✗ Décliner cette date
      </a>
    </p>
    <p style="font-size:0.8rem;color:#9ca3af">Ce lien est valable 7 jours.</p>
    ` : ''}
    ${emailFooter}`
  );
}

export async function sendClientRefusedProposalEmail(
  request: IServiceRequest,
  prestataire: IUser,
  proposedDate: Date
): Promise<void> {
  const dateStr = `${new Date(proposedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} à ${new Date(proposedDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  await sendMail(
    prestataire.email,
    'Proposition de date refusée',
    `<p>Bonjour ${prestataire.prenom},</p>
    <p>Le client ${request.requesterPrenom ? `${request.requesterPrenom} ${request.requesterNom ?? ''}`.trim() : request.requesterEmail} a décliné votre proposition du <strong>${dateStr}</strong>.</p>
    <p>Vous pouvez proposer une autre date depuis votre espace : <a href="${APP_URL()}/app/mes-demandes">${APP_URL()}/app/mes-demandes</a></p>
    ${emailFooter}`
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
    ${emailFooter}`
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
    ${emailFooter}`
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
    ${request.desiredAt ? `<p>Date : ${new Date(request.desiredAt).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>` : ''}
    ${emailFooter}`
  );
}

export async function sendMessageToClientEmail(
  request: IServiceRequest,
  prestataireName: string,
  content: string,
  token: string
): Promise<void> {
  const replyLink = `${APP_URL()}/app/requests/message-reply?token=${token}`;
  await sendMail(
    request.requesterEmail,
    `Message de ${prestataireName} — Gardee`,
    `<p>Bonjour${request.requesterPrenom ? ` ${request.requesterPrenom}` : ''},</p>
    <p><strong>${prestataireName}</strong> vous a envoyé un message concernant votre demande :</p>
    <blockquote style="border-left:3px solid #a8c47a;margin:1rem 0;padding:0.75rem 1rem;background:#f5f2eb;border-radius:0 8px 8px 0;color:#374151">
      ${content.replace(/\n/g, '<br>')}
    </blockquote>
    <p style="margin-top:1.5rem">
      <a href="${replyLink}" style="display:inline-block;padding:0.75rem 1.5rem;background:#3a5020;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">
        Répondre à ce message
      </a>
    </p>
    <p style="font-size:0.85rem;color:#6b7280">Vous pouvez aussi répondre depuis votre espace Gardee si vous avez un compte : <a href="${APP_URL()}/app/mes-demandes">${APP_URL()}/app/mes-demandes</a></p>
    <p style="font-size:0.78rem;color:#9ca3af">Ce lien est valable 7 jours.</p>
    ${emailFooter}`
  );
}

export async function sendMessageToProviderEmail(
  request: IServiceRequest,
  prestataire: IUser,
  clientName: string,
  content: string
): Promise<void> {
  await sendMail(
    prestataire.email,
    `Réponse de ${clientName} — Gardee`,
    `<p>Bonjour ${prestataire.prenom},</p>
    <p><strong>${clientName}</strong> a répondu à votre message :</p>
    <blockquote style="border-left:3px solid #a8c47a;margin:1rem 0;padding:0.75rem 1rem;background:#f5f2eb;border-radius:0 8px 8px 0;color:#374151">
      ${content.replace(/\n/g, '<br>')}
    </blockquote>
    <p>Retrouvez la conversation dans votre espace : <a href="${APP_URL()}/app/mes-demandes">${APP_URL()}/app/mes-demandes</a></p>
    ${emailFooter}`
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
    ${emailFooter}`
  );
}
