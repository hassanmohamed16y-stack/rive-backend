import { EmailService } from './email.service';

describe('EmailService', () => {
  const ORIGINAL_ENV = { ...process.env };
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('skips sending (and does not throw) when EMAIL_PROVIDER_API_KEY is not configured', async () => {
    delete process.env.EMAIL_PROVIDER_API_KEY;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    const service = new EmailService();

    await expect(service.sendEmail({ to: 'a@example.com', subject: 'Hi', html: '<p>hi</p>' })).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends an email via the provider API when a key is configured', async () => {
    process.env.EMAIL_PROVIDER_API_KEY = 'test-api-key';
    process.env.EMAIL_FROM_ADDRESS = 'from@example.com';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as any;
    const service = new EmailService();

    await service.sendEmail({ to: 'a@example.com', subject: 'Hi', html: '<p>hi</p>', text: 'hi' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: expect.stringContaining('Bearer ') }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ from: 'from@example.com', to: ['a@example.com'], subject: 'Hi', text: 'hi' });
  });

  it('throws when the provider responds with a non-ok status', async () => {
    process.env.EMAIL_PROVIDER_API_KEY = 'test-api-key';
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 500, text: jest.fn().mockResolvedValue('boom') });
    global.fetch = fetchMock as any;
    const service = new EmailService();

    await expect(service.sendEmail({ to: 'a@example.com', subject: 'Hi', html: '<p>hi</p>' }))
      .rejects.toThrow('Email provider request failed with status 500');
  });

  it('sends a password reset email with the reset token embedded', async () => {
    process.env.EMAIL_PROVIDER_API_KEY = 'test-api-key';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as any;
    const service = new EmailService();

    await service.sendPasswordResetEmail('a@example.com', 'reset-token-123');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject).toContain('Reset your');
    expect(body.html).toContain('reset-token-123');
  });

  it('sends an email verification email with the verification token embedded', async () => {
    process.env.EMAIL_PROVIDER_API_KEY = 'test-api-key';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as any;
    const service = new EmailService();

    await service.sendEmailVerificationEmail('a@example.com', 'verify-token-456');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject).toContain('Verify your');
    expect(body.html).toContain('verify-token-456');
  });
});
