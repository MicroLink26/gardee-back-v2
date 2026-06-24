import { sendMail } from '../config/mailer';
import { IServiceRequest } from '../models/ServiceRequest';
import { IUser } from '../models/User';
import { Category } from '../models/Category';

async function resolvePrestation(ids: string[]): Promise<string> {
  if (!ids.length) return '';
  const cats = await Category.find({ _id: { $in: ids } }).select('name').lean();
  const nameMap = new Map(cats.map(c => [c._id.toString(), c.name]));
  return ids.map(id => nameMap.get(id) ?? id).join(', ');
}

const FRONT_URL = () => process.env.FRONT_URL ?? 'https://gardee.fr';
const APP_URL = () => process.env.APP_URL ?? 'https://gardee.fr';

// ── Shared template wrapper ──────────────────────────────────────────────────

function layout(content: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Gardee</title>
  <style>
    body { margin:0; padding:0; background:#f2efe6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
    .wrap { max-width:600px; margin:0 auto; padding:24px 16px; }
    .card { background:#FCFAF5; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.07); }
    .header { background:linear-gradient(135deg,#1a2410 0%,#2d4a1a 60%,#3a5020 100%); padding:28px 32px; text-align:center; }
    .logo { font-size:1.5rem; font-weight:900; color:#a8c47a; letter-spacing:-0.03em; }
    .logo span { color:#fff; }
    .body { padding:32px; }
    .body p { margin:0 0 16px; font-size:15px; line-height:1.65; color:#374151; }
    .body p:last-child { margin-bottom:0; }
    h2 { font-size:1.2rem; font-weight:800; color:#1a1a0e; margin:0 0 12px; }
    .btn { display:inline-block; background:#3a5020; color:#fff !important; text-decoration:none; padding:14px 28px; border-radius:10px; font-weight:700; font-size:15px; margin:8px 0; }
    .btn-secondary { background:#f0ede3; color:#3a5020 !important; border:1.5px solid #c8d9a6; }
    .info-box { background:#f0ede3; border:1px solid #c8d9a6; border-radius:10px; padding:14px 18px; margin:16px 0; }
    .info-box p { margin:0; font-size:14px; color:#515F37; }
    .divider { height:1px; background:#e9e5d6; margin:24px 0; }
    .footer { padding:20px 32px 24px; background:#f8f6f0; border-top:1px solid #e9e5d6; }
    .footer p { margin:0 0 6px; font-size:12px; color:#9ca3af; line-height:1.6; }
    .footer a { color:#9ca3af; text-decoration:underline; }
    .badge { display:inline-block; background:rgba(168,196,122,0.15); color:#3a5020; border:1px solid rgba(168,196,122,0.35); border-radius:999px; padding:3px 12px; font-size:12px; font-weight:700; margin-bottom:20px; }
    blockquote { border-left:3px solid #a8c47a; margin:12px 0; padding:12px 16px; background:#f5f2eb; border-radius:0 8px 8px 0; }
    blockquote p { color:#374151; font-size:14px; }
    .highlight { color:#3a5020; font-weight:700; }
    @media (max-width:480px) { .body, .footer { padding:24px 20px; } }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${preheader}</div>` : ''}
  <div class="wrap">
    <div class="card">
      <div class="header">
        <div class="logo">Gard<span>ee</span></div>
      </div>
      <div class="body">
        ${content}
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Gardee · <a href="${FRONT_URL()}">gardee.fr</a> · <a href="mailto:info@gardee.fr">info@gardee.fr</a></p>
        <p>Si ce message vous semble frauduleux ou que vous n'en êtes pas à l'origine, signalez-le à <a href="mailto:info@gardee.fr">info@gardee.fr</a>.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function btn(label: string, url: string, secondary = false): string {
  return `<a href="${url}" class="btn${secondary ? ' btn-secondary' : ''}">${label}</a>`;
}

// ── Transactional emails ─────────────────────────────────────────────────────

export async function sendWelcomeEmail(user: IUser): Promise<void> {
  await sendMail(
    user.email,
    'Bienvenue sur Gardee — votre candidature est reçue',
    layout(`
      <span class="badge">Nouvelle candidature</span>
      <h2>Bonjour ${user.prenom} 👋</h2>
      <p>Votre inscription en tant que prestataire a bien été reçue. Notre équipe va examiner votre dossier dans les meilleurs délais.</p>
      <div class="info-box">
        <p>Vous recevrez un email dès que votre profil sera validé et visible sur la plateforme.</p>
      </div>
      <p>En attendant, vous pouvez compléter votre profil depuis votre espace personnel.</p>
      ${btn('Accéder à mon espace', `${APP_URL()}/app/profil`)}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">L'équipe Gardee</p>
    `, `Votre candidature Gardee a bien été reçue, ${user.prenom}.`)
  );
}

export async function sendWelcomeClientEmail(user: IUser): Promise<void> {
  const link = `${APP_URL()}/app/mes-demandes`;
  await sendMail(
    user.email,
    'Bienvenue sur Gardee !',
    layout(`
      <span class="badge">Vérification réussie</span>
      <h2>Bonjour ${user.prenom} 🌿</h2>
      <p>Votre email a été vérifié avec succès. Vous pouvez maintenant accéder à votre compte et rechercher les meilleurs jardiniers près de chez vous.</p>
      ${btn('Mes réservations', link)}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">L'équipe Gardee</p>
    `, `Bienvenue sur Gardee, ${user.prenom} !`)
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
    'Confirmez votre demande de service — Gardee',
    layout(`
      <h2>Confirmez votre demande</h2>
      <p>Vous avez soumis une demande de service à <span class="highlight">${prestataire.prenom} ${prestataire.nom}</span>.</p>
      <p>Cliquez sur le bouton ci-dessous pour confirmer votre demande. Ce lien est valable <strong>48 heures</strong>.</p>
      ${btn('Confirmer ma demande', link)}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">Si vous n'avez pas soumis cette demande, ignorez cet email.</p>
    `, 'Confirmez votre demande de service Gardee.')
  );
}

export async function sendRequestToProvider(
  request: IServiceRequest,
  prestataire: IUser
): Promise<void> {
  const clientName = request.requesterPrenom
    ? `${request.requesterPrenom} ${request.requesterNom ?? ''}`.trim()
    : request.requesterEmail;
  const dateStr = request.desiredAt
    ? new Date(request.desiredAt).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;
  const servicesStr = request.prestations.length
    ? await resolvePrestation(request.prestations)
    : '';

  await sendMail(
    prestataire.email,
    `Nouvelle demande de ${clientName} — Gardee`,
    layout(`
      <span class="badge">Nouvelle demande</span>
      <h2>Bonjour ${prestataire.prenom},</h2>
      <p>Vous avez reçu une nouvelle demande de service de la part de <span class="highlight">${clientName}</span>.</p>
      <div class="info-box">
        <p><strong>Contact :</strong> ${request.requesterEmail}</p>
        ${request.address ? `<p><strong>Adresse :</strong> ${request.address}</p>` : ''}
        ${servicesStr ? `<p><strong>Service(s) :</strong> ${servicesStr}</p>` : ''}
        ${dateStr ? `<p><strong>Date souhaitée :</strong> ${dateStr}</p>` : ''}
        ${request.description ? `<p><strong>Description :</strong> ${request.description}</p>` : ''}
      </div>
      ${btn('Répondre à cette demande', `${APP_URL()}/app/mes-demandes`)}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">L'équipe Gardee</p>
    `, `Nouvelle demande de ${clientName}.`)
  );
}

export async function sendProviderAcceptedEmail(
  request: IServiceRequest,
  prestataire: IUser
): Promise<void> {
  const dateStr = request.desiredAt
    ? new Date(request.desiredAt).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  await sendMail(
    request.requesterEmail,
    'Votre demande a été acceptée — Gardee',
    layout(`
      <span class="badge">Demande acceptée ✓</span>
      <h2>Bonne nouvelle !</h2>
      <p><span class="highlight">${prestataire.prenom} ${prestataire.nom}</span> a accepté votre demande de service.</p>
      ${dateStr ? `<div class="info-box"><p><strong>Date confirmée :</strong> ${dateStr}</p></div>` : ''}
      ${btn('Voir mes réservations', `${APP_URL()}/app/mes-demandes`)}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">L'équipe Gardee</p>
    `, `${prestataire.prenom} a accepté votre demande.`)
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
    `${prestataire.prenom} vous propose une date — Gardee`,
    layout(`
      <span class="badge">Nouvelle proposition</span>
      <h2>Proposition de date</h2>
      <p><span class="highlight">${prestataire.prenom} ${prestataire.nom}</span> vous propose un nouveau créneau :</p>
      <div class="info-box">
        <p style="font-size:1rem;font-weight:700;color:#1a1a0e">${dateStr}</p>
        ${comment ? `<p style="margin-top:8px">"${comment}"</p>` : ''}
      </div>
      ${acceptLink ? `
      <p>
        ${btn('✓ Accepter cette date', acceptLink)}
        &nbsp;&nbsp;
        ${btn('✗ Décliner', refuseLink!, true)}
      </p>
      <p style="font-size:13px;color:#9ca3af">Ces liens sont valables 7 jours.</p>
      ` : ''}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">L'équipe Gardee</p>
    `, `${prestataire.prenom} vous propose le ${dateStr}.`)
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
    'Proposition de date refusée — Gardee',
    layout(`
      <h2>Bonjour ${prestataire.prenom},</h2>
      <p>Le client <span class="highlight">${request.requesterPrenom ? `${request.requesterPrenom} ${request.requesterNom ?? ''}`.trim() : request.requesterEmail}</span> a décliné votre proposition du <strong>${dateStr}</strong>.</p>
      <p>Vous pouvez lui proposer une autre date depuis votre espace.</p>
      ${btn('Gérer mes demandes', `${APP_URL()}/app/mes-demandes`)}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">L'équipe Gardee</p>
    `)
  );
}

export async function sendProviderRefusedEmail(
  request: IServiceRequest,
  prestataire: IUser,
  message?: string
): Promise<void> {
  await sendMail(
    request.requesterEmail,
    'Votre demande n\'a pas pu être honorée — Gardee',
    layout(`
      <h2>Dommage…</h2>
      <p><span class="highlight">${prestataire.prenom} ${prestataire.nom}</span> n'est pas disponible pour votre demande.</p>
      ${message ? `<blockquote><p>${message}</p></blockquote>` : ''}
      <p>Pas d'inquiétude, d'autres jardiniers sont disponibles près de chez vous.</p>
      ${btn('Trouver un autre jardinier', `${FRONT_URL()}/carte`)}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">L'équipe Gardee</p>
    `)
  );
}

export async function sendRatingRequestEmail(
  request: IServiceRequest,
  prestataire: IUser
): Promise<void> {
  const link = `${APP_URL()}/app/requests/rate?token=${request.ratingToken}`;
  await sendMail(
    request.requesterEmail,
    `Comment s'est passée votre prestation avec ${prestataire.prenom} ?`,
    layout(`
      <span class="badge">Votre avis compte</span>
      <h2>Votre prestation est terminée !</h2>
      <p>Votre prestation avec <span class="highlight">${prestataire.prenom} ${prestataire.nom}</span> vient de se terminer. Votre avis aide d'autres clients à choisir leur jardinier.</p>
      <p>Cela prend moins de 2 minutes.</p>
      ${btn('Laisser mon avis', link)}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">L'équipe Gardee</p>
    `, `Évaluez votre prestation avec ${prestataire.prenom}.`)
  );
}

export async function sendUpcomingReminderEmail(
  request: IServiceRequest,
  prestataire: IUser
): Promise<void> {
  const dateStr = request.desiredAt
    ? new Date(request.desiredAt).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  await sendMail(
    request.requesterEmail,
    `Rappel : prestation demain avec ${prestataire.prenom} — Gardee`,
    layout(`
      <span class="badge">Rappel J-1</span>
      <h2>Votre prestation est demain !</h2>
      <p>Rappel : votre prestation avec <span class="highlight">${prestataire.prenom} ${prestataire.nom}</span> est prévue demain.</p>
      ${dateStr ? `<div class="info-box"><p><strong>Date :</strong> ${dateStr}</p></div>` : ''}
      ${btn('Voir mes réservations', `${APP_URL()}/app/mes-demandes`)}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">L'équipe Gardee</p>
    `, `Votre prestation avec ${prestataire.prenom} est demain.`)
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
    layout(`
      <span class="badge">Nouveau message</span>
      <h2>Bonjour${request.requesterPrenom ? ` ${request.requesterPrenom}` : ''},</h2>
      <p><span class="highlight">${prestataireName}</span> vous a envoyé un message :</p>
      <blockquote><p>${content.replace(/\n/g, '<br>')}</p></blockquote>
      ${btn('Répondre', replyLink)}
      <p style="font-size:13px;color:#9ca3af">Ce lien est valable 7 jours. Vous pouvez aussi répondre depuis votre <a href="${APP_URL()}/app/mes-demandes" style="color:#9ca3af">espace Gardee</a>.</p>
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">L'équipe Gardee</p>
    `, `Nouveau message de ${prestataireName}.`)
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
    layout(`
      <span class="badge">Nouveau message</span>
      <h2>Bonjour ${prestataire.prenom},</h2>
      <p><span class="highlight">${clientName}</span> a répondu à votre message :</p>
      <blockquote><p>${content.replace(/\n/g, '<br>')}</p></blockquote>
      ${btn('Voir la conversation', `${APP_URL()}/app/mes-demandes`)}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">L'équipe Gardee</p>
    `, `Nouveau message de ${clientName}.`)
  );
}

export async function sendPrestataireAcceptedEmail(user: IUser): Promise<void> {
  const link = `${APP_URL()}/app/profil`;
  await sendMail(
    user.email,
    'Félicitations, votre profil Gardee est validé ! 🎉',
    layout(`
      <span class="badge">Profil validé ✓</span>
      <h2>Félicitations, ${user.prenom} !</h2>
      <p>Excellente nouvelle ! Votre profil prestataire a été <span class="highlight">validé</span> par notre équipe. Vous êtes maintenant visible sur la plateforme Gardee et pouvez commencer à recevoir des demandes.</p>
      ${btn('Accéder à mon espace', link)}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">L'équipe Gardee</p>
    `, `Votre profil Gardee est validé, ${user.prenom} !`)
  );
}

export async function sendPrestataireRejectedTemporaryEmail(user: IUser, _reason: string): Promise<void> {
  const link = `${APP_URL()}/app/profil`;
  await sendMail(
    user.email,
    'Votre profil Gardee nécessite des modifications',
    layout(`
      <h2>Bonjour ${user.prenom},</h2>
      <p>Nous avons examiné votre profil prestataire. Des modifications sont nécessaires avant qu'il puisse être diffusé sur la plateforme.</p>
      <p>Connectez-vous à votre espace pour consulter les détails et effectuer les corrections demandées.</p>
      ${btn('Modifier mon profil', link)}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">L'équipe Gardee</p>
    `)
  );
}

export async function sendPrestataireRejectedPermanentlyEmail(user: IUser, reason: string): Promise<void> {
  await sendMail(
    user.email,
    'Votre candidature Gardee',
    layout(`
      <h2>Bonjour ${user.prenom},</h2>
      <p>Nous avons soigneusement étudié votre dossier et nous ne sommes malheureusement pas en mesure de donner suite à votre candidature sur la plateforme Gardee.</p>
      ${reason ? `<div class="info-box"><p><strong>Motif :</strong> ${reason}</p></div>` : ''}
      <p>Nous vous remercions de l'intérêt que vous portez à Gardee et vous souhaitons bonne continuation.</p>
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">L'équipe Gardee</p>
    `)
  );
}

export async function sendEmailVerificationCode(user: IUser, code: string): Promise<void> {
  const verificationUrl = `${APP_URL()}/app/verify-email#userId=${user._id.toString()}&code=${code}`;
  await sendMail(
    user.email,
    `${code} — Votre code de vérification Gardee`,
    layout(`
      <span class="badge">Vérification du compte</span>
      <h2>Bonjour ${user.prenom},</h2>
      <p>Pour activer votre compte Gardee, entrez ce code de vérification :</p>
      <div style="text-align:center;margin:1.5rem 0">
        <div style="display:inline-block;background:#1a2410;color:#a8c47a;font-size:2.2rem;font-weight:900;letter-spacing:0.3em;padding:1rem 2rem;border-radius:12px">${code}</div>
      </div>
      <p style="text-align:center;font-size:13px;color:#9ca3af">Ce code est valable <strong>10 minutes</strong>.</p>
      ${btn('Vérifier mon email', verificationUrl)}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">Si vous n'avez pas créé de compte sur Gardee, ignorez cet email.</p>
    `, `Votre code Gardee : ${code}`)
  );
}

export async function sendForgotPasswordEmail(to: string, token: string): Promise<void> {
  const link = `${APP_URL()}/app/forgot-password?token=${token}`;
  await sendMail(
    to,
    'Réinitialisation de votre mot de passe',
    layout(`
      <h2>Réinitialisation du mot de passe</h2>
      <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous — ce lien est valable <strong>1 heure</strong>.</p>
      ${btn('Réinitialiser mon mot de passe', link)}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">Si vous n'avez pas fait cette demande, ignorez cet email. Votre mot de passe ne sera pas modifié.</p>
    `, 'Réinitialisez votre mot de passe Gardee.')
  );
}

export async function sendNewsletterWelcome(email: string, unsubscribeUrl?: string): Promise<void> {
  await sendMail(
    email,
    'Bienvenue à la newsletter Gardee! 🌱',
    layout(`
      <h2>Merci de vous être abonné!</h2>
      <p>Bienvenue à la newsletter hebdomadaire Gardee. Chaque semaine, vous recevrez:</p>
      <ul style="margin:16px 0;padding-left:20px;">
        <li style="margin:8px 0;">Les <strong>top prestataires</strong> de votre région</li>
        <li style="margin:8px 0;">Les <strong>meilleurs avis</strong> de la semaine</li>
        <li style="margin:8px 0;">Des <strong>conseils d'entretien</strong> de jardin</li>
      </ul>
      ${btn('Visiter Gardee', `${FRONT_URL()}/carte`)}
      <div class="divider"></div>
      <p style="font-size:13px;color:#9ca3af">Vous recevrez votre première newsletter le lundi prochain.</p>
      ${unsubscribeUrl ? `<p style="font-size:12px;color:#9ca3af;margin-top:16px;">
        <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Cliquez ici pour vous désabonner</a>
      </p>` : ''}
    `, 'Newsletter Gardee — Bienvenue!')
  );
}

export async function sendNewsletterDigest(email: string, topPrestateurs: any[]): Promise<void> {
  const prestatairesList = topPrestateurs
    .slice(0, 5)
    .map(p => `<li><strong>${p.prenom} ${p.nom}</strong> ${p.prestataire?.ville ? `- ${p.prestataire.ville}` : ''} ⭐ ${p.prestataire?.averageRating?.toFixed(1) || 'N/A'}</li>`)
    .join('');

  await sendMail(
    email,
    'Newsletter Gardee - Top prestataires cette semaine',
    layout(`
      <h2>Top prestataires cette semaine 🏆</h2>
      <p>Découvrez les meilleurs jardiniers de votre région selon les avis clients:</p>
      <ul style="margin:16px 0;padding-left:20px;list-style:none;padding:0;">
        ${prestatairesList}
      </ul>
      <div class="divider"></div>
      <h3 style="font-size:1rem;font-weight:700;color:#1a1a0e;margin:16px 0 8px;">Conseil de la semaine 🌱</h3>
      <p style="font-size:14px;color:#374151;">C'est l'été! Arrosez vos plantes en fin d'après-midi pour limiter l'évaporation. Les arbustes auront plus de temps pour absorber l'eau avant les fortes chaleurs.</p>
      ${btn('Voir tous les prestataires', `${FRONT_URL()}/carte`)}
    `, 'Newsletter Gardee - Top de la semaine')
  );
}
