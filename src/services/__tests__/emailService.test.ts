import {
  sendWelcomeEmail,
  sendWelcomeClientEmail,
  sendRequestConfirmationEmail,
  sendRequestToProvider,
  sendProviderAcceptedEmail,
  sendProviderProposedEmail,
  sendClientRefusedProposalEmail,
  sendProviderRefusedEmail,
  sendRatingRequestEmail,
  sendUpcomingReminderEmail,
  sendMessageToClientEmail,
  sendMessageToProviderEmail,
  sendForgotPasswordEmail,
} from '../emailService';
import { sendMail } from '../../config/mailer';

jest.mock('../../config/mailer', () => ({
  sendMail: jest.fn(),
}));

describe('emailService', () => {
  const mockedSendMail = sendMail as jest.MockedFunction<typeof sendMail>;
  const originalAppUrl = process.env.APP_URL;
  const originalFrontUrl = process.env.FRONT_URL;

  beforeAll(() => {
    process.env.APP_URL = 'https://app.gardee.test';
    process.env.FRONT_URL = 'https://gardee.test';
  });

  afterAll(() => {
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
    if (originalFrontUrl === undefined) delete process.env.FRONT_URL;
    else process.env.FRONT_URL = originalFrontUrl;
  });

  beforeEach(() => mockedSendMail.mockClear());

  const user = (overrides = {}) => ({
    email: 'jean@example.com',
    prenom: 'Jean',
    nom: 'Dupont',
    ...overrides,
  }) as any;

  const request = (overrides = {}) => ({
    requesterEmail: 'client@example.com',
    requesterPrenom: 'Marie',
    requesterNom: 'Curie',
    prestations: ['Tonte', 'Taille'],
    ratingToken: 'rate-tok',
    messages: [],
    ...overrides,
  }) as any;

  // ── sendWelcomeEmail ───────────────────────────────────────────────

  it('sendWelcomeEmail — sends to the user with their prenom', async () => {
    await sendWelcomeEmail(user());

    expect(mockedSendMail).toHaveBeenCalledWith(
      'jean@example.com',
      'Bienvenue sur Gardee !',
      expect.stringContaining('Jean')
    );
  });

  // ── sendWelcomeClientEmail ─────────────────────────────────────────

  it('sendWelcomeClientEmail — includes mes-demandes link', async () => {
    await sendWelcomeClientEmail(user());

    expect(mockedSendMail).toHaveBeenCalledWith(
      'jean@example.com',
      'Bienvenue sur Gardee !',
      expect.stringContaining('https://app.gardee.test/app/mes-demandes')
    );
  });

  // ── sendRequestConfirmationEmail ───────────────────────────────────

  it('sendRequestConfirmationEmail — includes confirmation link and provider name', async () => {
    await sendRequestConfirmationEmail('client@example.com', 'conf-token', user());

    const [to, subject, body] = mockedSendMail.mock.calls[0];
    expect(to).toBe('client@example.com');
    expect(subject).toBe('Confirmez votre demande de service');
    expect(body).toContain('https://app.gardee.test/app/requests/confirm?token=conf-token');
    expect(body).toContain('Jean Dupont');
  });

  // ── sendRequestToProvider ──────────────────────────────────────────

  it('sendRequestToProvider — sends to provider with requester name and prestations', async () => {
    await sendRequestToProvider(request(), user());

    const [to, , body] = mockedSendMail.mock.calls[0];
    expect(to).toBe('jean@example.com');
    expect(body).toContain('Marie Curie');
    expect(body).toContain('Tonte, Taille');
  });

  it('sendRequestToProvider — uses email as name when prenom is absent', async () => {
    await sendRequestToProvider(
      request({ requesterPrenom: undefined }),
      user()
    );

    expect(mockedSendMail.mock.calls[0][2]).toContain('client@example.com');
  });

  it('sendRequestToProvider — trims name when requesterNom is absent', async () => {
    await sendRequestToProvider(
      request({ requesterPrenom: 'Marie', requesterNom: undefined }),
      user()
    );

    expect(mockedSendMail.mock.calls[0][2]).toContain('Marie');
  });

  it('sendRequestToProvider — includes address and description when present', async () => {
    await sendRequestToProvider(
      request({ address: '12 rue des Lilas', description: 'Haie à tailler', desiredAt: new Date('2025-06-15T09:00:00Z') }),
      user()
    );

    const body = mockedSendMail.mock.calls[0][2];
    expect(body).toContain('12 rue des Lilas');
    expect(body).toContain('Haie à tailler');
  });

  it('sendRequestToProvider — omits address block when absent', async () => {
    await sendRequestToProvider(request({ address: undefined }), user());

    expect(mockedSendMail.mock.calls[0][2]).not.toContain('Adresse du chantier');
  });

  // ── sendProviderAcceptedEmail ──────────────────────────────────────

  it('sendProviderAcceptedEmail — sends to client with provider name', async () => {
    await sendProviderAcceptedEmail(request(), user());

    const [to, subject, body] = mockedSendMail.mock.calls[0];
    expect(to).toBe('client@example.com');
    expect(subject).toBe('Votre demande a été acceptée');
    expect(body).toContain('Jean Dupont');
  });

  it('sendProviderAcceptedEmail — includes confirmed date when desiredAt is set', async () => {
    await sendProviderAcceptedEmail(request({ desiredAt: new Date('2025-08-01T10:00:00Z') }), user());

    expect(mockedSendMail.mock.calls[0][2]).toContain('Date confirmée');
  });

  // ── sendProviderProposedEmail ──────────────────────────────────────

  it('sendProviderProposedEmail — includes accept/refuse links when token provided', async () => {
    await sendProviderProposedEmail(request(), user(), new Date('2025-07-01T10:00:00Z'), 'Je suis dispo', 'prop-tok');

    const body = mockedSendMail.mock.calls[0][2];
    expect(body).toContain('https://app.gardee.test/app/requests/proposal-accept?token=prop-tok');
    expect(body).toContain('https://app.gardee.test/app/requests/proposal-refuse?token=prop-tok');
    expect(body).toContain('Je suis dispo');
  });

  it('sendProviderProposedEmail — omits action links when no token', async () => {
    await sendProviderProposedEmail(request(), user(), new Date('2025-07-01T10:00:00Z'));

    const body = mockedSendMail.mock.calls[0][2];
    expect(body).not.toContain('proposal-accept');
    expect(body).not.toContain('proposal-refuse');
  });

  it('sendProviderProposedEmail — omits comment block when absent', async () => {
    await sendProviderProposedEmail(request(), user(), new Date(), undefined, 'tok');

    expect(mockedSendMail.mock.calls[0][2]).not.toContain('Message :');
  });

  // ── sendClientRefusedProposalEmail ─────────────────────────────────

  it('sendClientRefusedProposalEmail — sends to provider with requester name', async () => {
    await sendClientRefusedProposalEmail(request(), user(), new Date('2025-07-01T10:00:00Z'));

    const [to, subject, body] = mockedSendMail.mock.calls[0];
    expect(to).toBe('jean@example.com');
    expect(subject).toBe('Proposition de date refusée');
    expect(body).toContain('Marie Curie');
  });

  it('sendClientRefusedProposalEmail — uses email when requester has no prenom', async () => {
    await sendClientRefusedProposalEmail(
      request({ requesterPrenom: undefined }),
      user(),
      new Date()
    );

    expect(mockedSendMail.mock.calls[0][2]).toContain('client@example.com');
  });

  it('sendClientRefusedProposalEmail — trims name when requesterNom is absent', async () => {
    await sendClientRefusedProposalEmail(
      request({ requesterPrenom: 'Marie', requesterNom: undefined }),
      user(),
      new Date()
    );

    expect(mockedSendMail.mock.calls[0][2]).toContain('Marie');
  });

  // ── sendProviderRefusedEmail ───────────────────────────────────────

  it('sendProviderRefusedEmail — includes optional message', async () => {
    await sendProviderRefusedEmail(request(), user(), 'Je suis indisponible');

    const body = mockedSendMail.mock.calls[0][2];
    expect(body).toContain('Je suis indisponible');
    expect(body).toContain('https://gardee.test');
  });

  it('sendProviderRefusedEmail — omits message block when absent', async () => {
    await sendProviderRefusedEmail(request(), user());

    expect(mockedSendMail.mock.calls[0][2]).not.toContain('Message :');
  });

  // ── sendRatingRequestEmail ─────────────────────────────────────────

  it('sendRatingRequestEmail — includes rating link', async () => {
    await sendRatingRequestEmail(request(), user());

    const [to, , body] = mockedSendMail.mock.calls[0];
    expect(to).toBe('client@example.com');
    expect(body).toContain('https://app.gardee.test/app/requests/rate?token=rate-tok');
    expect(body).toContain('Jean Dupont');
  });

  // ── sendUpcomingReminderEmail ──────────────────────────────────────

  it('sendUpcomingReminderEmail — sends reminder to client', async () => {
    await sendUpcomingReminderEmail(request(), user());

    const [to, subject] = mockedSendMail.mock.calls[0];
    expect(to).toBe('client@example.com');
    expect(subject).toBe('Rappel : prestation demain');
  });

  it('sendUpcomingReminderEmail — includes date when desiredAt is set', async () => {
    await sendUpcomingReminderEmail(
      request({ desiredAt: new Date('2025-07-01T09:00:00Z') }),
      user()
    );

    expect(mockedSendMail.mock.calls[0][2]).toContain('Date :');
  });

  // ── sendMessageToClientEmail ───────────────────────────────────────

  it('sendMessageToClientEmail — includes reply link and message content', async () => {
    await sendMessageToClientEmail(request(), 'Jean Dupont', 'Bonjour Marie', 'msg-tok');

    const [to, subject, body] = mockedSendMail.mock.calls[0];
    expect(to).toBe('client@example.com');
    expect(subject).toBe('Message de Jean Dupont — Gardee');
    expect(body).toContain('https://app.gardee.test/app/requests/message-reply?token=msg-tok');
    expect(body).toContain('Bonjour Marie');
  });

  it('sendMessageToClientEmail — includes requesterPrenom when present', async () => {
    await sendMessageToClientEmail(request(), 'Jean Dupont', 'Hello', 'tok');

    expect(mockedSendMail.mock.calls[0][2]).toContain('Marie');
  });

  it('sendMessageToClientEmail — omits prenom greeting when requesterPrenom absent', async () => {
    await sendMessageToClientEmail(
      request({ requesterPrenom: undefined }),
      'Jean Dupont',
      'Hello',
      'tok'
    );

    const body = mockedSendMail.mock.calls[0][2];
    expect(body).toContain('<h2>Bonjour,</h2>');
  });

  it('sendMessageToClientEmail — converts newlines to br tags', async () => {
    await sendMessageToClientEmail(request(), 'Jean', 'Ligne 1\nLigne 2', 'tok');

    expect(mockedSendMail.mock.calls[0][2]).toContain('Ligne 1<br>Ligne 2');
  });

  // ── sendMessageToProviderEmail ─────────────────────────────────────

  it('sendMessageToProviderEmail — sends to provider with client reply', async () => {
    await sendMessageToProviderEmail(request(), user(), 'Marie Curie', 'Merci pour le devis');

    const [to, subject, body] = mockedSendMail.mock.calls[0];
    expect(to).toBe('jean@example.com');
    expect(subject).toBe('Réponse de Marie Curie — Gardee');
    expect(body).toContain('Merci pour le devis');
    expect(body).toContain('https://app.gardee.test/app/mes-demandes');
  });

  it('sendMessageToProviderEmail — converts newlines to br tags', async () => {
    await sendMessageToProviderEmail(request(), user(), 'Marie', 'Ligne 1\nLigne 2');

    expect(mockedSendMail.mock.calls[0][2]).toContain('Ligne 1<br>Ligne 2');
  });

  // ── sendForgotPasswordEmail ────────────────────────────────────────

  it('sendForgotPasswordEmail — sends reset link', async () => {
    await sendForgotPasswordEmail('user@example.com', 'reset-token-123');

    expect(mockedSendMail).toHaveBeenCalledWith(
      'user@example.com',
      'Réinitialisation de votre mot de passe',
      expect.stringContaining('https://app.gardee.test/app/forgot-password?token=reset-token-123')
    );
  });

  it('FRONT_URL and APP_URL fall back to gardee.fr when env vars are unset', async () => {
    const savedApp = process.env.APP_URL;
    const savedFront = process.env.FRONT_URL;
    delete process.env.APP_URL;
    delete process.env.FRONT_URL;

    await sendProviderRefusedEmail(request(), user());     // covers FRONT_URL fallback
    await sendForgotPasswordEmail('u@example.com', 'tok'); // covers APP_URL fallback

    const bodies = mockedSendMail.mock.calls.map(c => c[2]);
    expect(bodies.some(b => b.includes('https://gardee.fr'))).toBe(true);

    process.env.APP_URL = savedApp;
    process.env.FRONT_URL = savedFront;
  });
});
