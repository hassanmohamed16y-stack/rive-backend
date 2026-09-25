import { Test, TestingModule } from "@nestjs/testing";
import { AlertService } from "./alert.service";
import { EmailService } from "../email/email.service";

describe("AlertService", () => {
  let alertService: AlertService;
  let emailService: { sendEmail: jest.Mock };

  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      ADMIN_ALERT_EMAIL: "admin@rive.com",
    };

    emailService = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    alertService = module.get<AlertService>(AlertService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("skips alert if ADMIN_ALERT_EMAIL is not set", async () => {
    delete process.env.ADMIN_ALERT_EMAIL;

    const result = await alertService.sendAlert(
      "TEST_ALERT",
      "Subject",
      "Details",
    );

    expect(result).toBe(false);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it("sends email alert when ADMIN_ALERT_EMAIL is configured", async () => {
    const result = await alertService.sendAlert(
      "TEST_ALERT",
      "Subject Test",
      "Details Test",
    );

    expect(result).toBe(true);
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@rive.com",
        subject: "[RIVÉ ALERT] Subject Test",
      }),
    );
  });

  it("throttles duplicate alerts within 15 minutes window", async () => {
    const firstResult = await alertService.sendAlert(
      "DATABASE_FAILURE",
      "Subject 1",
      "Details 1",
    );
    expect(firstResult).toBe(true);
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);

    // Immediate second call with same alertKey
    const secondResult = await alertService.sendAlert(
      "DATABASE_FAILURE",
      "Subject 2",
      "Details 2",
    );
    expect(secondResult).toBe(false);
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);

    // Call with a different alert key should succeed
    const thirdResult = await alertService.sendAlert(
      "UNHANDLED_EXCEPTION",
      "Subject 3",
      "Details 3",
    );
    expect(thirdResult).toBe(true);
    expect(emailService.sendEmail).toHaveBeenCalledTimes(2);
  });
});
