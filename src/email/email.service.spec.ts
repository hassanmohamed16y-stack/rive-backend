import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';

describe('EmailService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  async function createService(): Promise<EmailService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();

    return module.get<EmailService>(EmailService);
  }

  it('logs warning and skips sending when EMAIL_PROVIDER_API_KEY is not set', async () => {
    delete process.env.EMAIL_PROVIDER_API_KEY;
    const loggerSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    const service = await createService();
    await service.sendEmail({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
    });

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('EMAIL_PROVIDER_API_KEY is not set; skipping email send to test@example.com (Test Subject).'),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends email successfully when EMAIL_PROVIDER_API_KEY is set', async () => {
    process.env.EMAIL_PROVIDER_API_KEY = 'test-api-key';
    process.env.EMAIL_FROM_ADDRESS = 'custom-from@example.com';
    process.env.EMAIL_PROVIDER_API_URL = 'https://api.custom-email.com/send';

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('{"id": "msg_123"}'),
    } as unknown as Response);

    const service = await createService();
    await service.sendEmail({
      to: 'recipient@example.com',
      subject: 'Hello World',
      html: '<h1>Hello</h1>',
      text: 'Hello',
    });

    expect(fetchSpy).toHaveBeenCalledWith('https://api.custom-email.com/send', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-api-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'custom-from@example.com',
        to: ['recipient@example.com'],
        subject: 'Hello World',
        html: '<h1>Hello</h1>',
        text: 'Hello',
      }),
    });
  });

  it('uses default fallback fromAddress and apiUrl when env vars are missing', async () => {
    process.env.EMAIL_PROVIDER_API_KEY = 'test-api-key';
    delete process.env.EMAIL_FROM_ADDRESS;
    delete process.env.EMAIL_PROVIDER_API_URL;

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('{"id": "msg_456"}'),
    } as unknown as Response);

    const service = await createService();
    await service.sendEmail({
      to: 'recipient@example.com',
      subject: 'Hello Default',
      html: '<p>Default</p>',
    });

    expect(fetchSpy).toHaveBeenCalledWith('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-api-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'no-reply@example.com',
        to: ['recipient@example.com'],
        subject: 'Hello Default',
        html: '<p>Default</p>',
      }),
    });
  });

  it('handles provider error responses correctly', async () => {
    process.env.EMAIL_PROVIDER_API_KEY = 'test-api-key';
    const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValue('Invalid recipient'),
    } as unknown as Response);

    const service = await createService();

    await expect(
      service.sendEmail({
        to: 'invalid-email',
        subject: 'Bad Request',
        html: '<p>Fail</p>',
      }),
    ).rejects.toThrow('Email provider request failed with status 400');

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send email to invalid-email: 400 Invalid recipient'),
    );
  });

  it('handles non-ok response with text parsing error gracefully', async () => {
    process.env.EMAIL_PROVIDER_API_KEY = 'test-api-key';
    const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockRejectedValue(new Error('Network response error')),
    } as unknown as Response);

    const service = await createService();

    await expect(
      service.sendEmail({
        to: 'user@example.com',
        subject: 'Server Error',
        html: '<p>Fail</p>',
      }),
    ).rejects.toThrow('Email provider request failed with status 500');

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send email to user@example.com: 500'),
    );
  });

  it('sendPasswordResetEmail formats options correctly', async () => {
    process.env.EMAIL_PROVIDER_API_KEY = 'test-api-key';
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('{}'),
    } as unknown as Response);

    const service = await createService();
    await service.sendPasswordResetEmail('user@example.com', 'reset-token-123');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        body: JSON.stringify({
          from: 'no-reply@example.com',
          to: ['user@example.com'],
          subject: 'Reset your RIVÉ password',
          html: '<p>Use the following token to reset your password. It expires in 1 hour.</p><p><strong>reset-token-123</strong></p>',
          text: 'Use the following token to reset your password (expires in 1 hour): reset-token-123',
        }),
      }),
    );
  });

  it('sendEmailVerificationEmail formats options correctly', async () => {
    process.env.EMAIL_PROVIDER_API_KEY = 'test-api-key';
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('{}'),
    } as unknown as Response);

    const service = await createService();
    await service.sendEmailVerificationEmail('user@example.com', 'verify-token-123');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        body: JSON.stringify({
          from: 'no-reply@example.com',
          to: ['user@example.com'],
          subject: 'Verify your RIVÉ email address',
          html: '<p>Use the following token to verify your email address.</p><p><strong>verify-token-123</strong></p>',
          text: 'Use the following token to verify your email address: verify-token-123',
        }),
      }),
    );
  });
});
