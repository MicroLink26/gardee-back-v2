import { sendForgotPasswordEmail, sendProviderRefusedEmail } from '../emailService';
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
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalAppUrl;
    }
    if (originalFrontUrl === undefined) {
      delete process.env.FRONT_URL;
    } else {
      process.env.FRONT_URL = originalFrontUrl;
    }
  });

  beforeEach(() => {
    mockedSendMail.mockClear();
  });

  it('sends a forgot password email with the reset link', async () => {
    await sendForgotPasswordEmail('user@example.com', 'reset-token-123');

    expect(mockedSendMail).toHaveBeenCalledTimes(1);
    expect(mockedSendMail).toHaveBeenCalledWith(
      'user@example.com',
      'Réinitialisation de votre mot de passe',
      expect.stringContaining('https://app.gardee.test/app/forgot-password?token=reset-token-123')
    );
  });

  it('sends a provider refused email with the front URL', async () => {
    const request = { requesterEmail: 'client@example.com' } as any;
    const prestataire = { prenom: 'Jean', nom: 'Dupont' } as any;

    await sendProviderRefusedEmail(request, prestataire, 'Je suis indisponible');

    expect(mockedSendMail).toHaveBeenCalledWith(
      'client@example.com',
      "Votre demande a été refusée",
      expect.stringContaining('https://gardee.test')
    );
    expect(mockedSendMail.mock.calls[0][2]).toContain('Je suis indisponible');
  });
});
