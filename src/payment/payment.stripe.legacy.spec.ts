import { PaymentService } from "./payment.service";

describe("Stripe PaymentService webhook security", () => {
  it("rejects all Stripe webhooks with BadRequestException indicating gateway is disabled", async () => {
    const service = new PaymentService();
    await expect(
      service.handleWebhook(Buffer.from("{}"), "invalid_sig"),
    ).rejects.toThrow("Stripe payment gateway is disabled");
  });
});
