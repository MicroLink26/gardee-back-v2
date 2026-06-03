import { sendMail } from '../mailer';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({ sendMail: jest.fn() }),
}));

describe('mailer', () => {
  const nodemailer = jest.requireMock('nodemailer');
  const mockSendMail: jest.Mock = nodemailer.createTransport().sendMail;

  beforeEach(() => mockSendMail.mockClear());

  it('sends email with provided to, subject and html', async () => {
    mockSendMail.mockResolvedValue({});

    await sendMail('dest@example.com', 'Sujet test', '<p>Bonjour</p>');

    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'dest@example.com',
      subject: 'Sujet test',
      html: '<p>Bonjour</p>',
    }));
  });

  it('uses MAIL_FROM env var when set', async () => {
    mockSendMail.mockResolvedValue({});
    process.env.MAIL_FROM = 'MonApp <no-reply@monapp.fr>';

    await sendMail('u@example.com', 'Test', '<p>Hi</p>');

    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'MonApp <no-reply@monapp.fr>',
    }));

    delete process.env.MAIL_FROM;
  });

  it('falls back to default sender when MAIL_FROM is unset', async () => {
    mockSendMail.mockResolvedValue({});
    delete process.env.MAIL_FROM;

    await sendMail('u@example.com', 'Test', '<p>Hi</p>');

    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Gardee <noreply@gardee.fr>',
    }));
  });
});
