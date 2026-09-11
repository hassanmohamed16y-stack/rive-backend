import { PaymobService } from "../src/payment/paymob.service";

const docPayload = {
  type: "TRANSACTION",
  obj: {
    id: 192036465,
    pending: false,
    amount_cents: 100000,
    success: true,
    is_auth: false,
    is_capture: false,
    is_standalone_payment: true,
    is_voided: false,
    is_refunded: false,
    is_3d_secure: true,
    integration_id: 4097558,
    profile_id: 164295,
    has_parent_transaction: false,
    order: {
      id: 217503754,
    },
    created_at: "2024-06-13T11:33:44.592345",
    currency: "EGP",
    source_data: {
      pan: "2346",
      sub_type: "MasterCard",
      type: "card",
    },
    error_occured: false,
    owner: 302852,
  },
};

const service = new PaymobService(null as any, null as any);

// Set test secret
process.env.PAYMOB_HMAC_SECRET = "486CF40C8BEBD130F7CEF8CCFCF7BEBA";

const calculatedHmac = service.calculateHmac(docPayload);

console.log("=== RAW PAYMOB HMAC VERIFICATION TEST ===");
console.log("Payload:", JSON.stringify(docPayload, null, 2));
console.log("Configured HMAC Secret:", process.env.PAYMOB_HMAC_SECRET);
console.log("Calculated HMAC-SHA512 Output:", calculatedHmac);
