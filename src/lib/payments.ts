/**
 * Payment boundary.
 *
 * The MVP runs a simulated charge. When Paystack keys are configured the
 * `paystack` branch can be implemented here and every caller keeps working.
 */

export interface ChargeRequest {
  amountNgn: number;
  reference: string;
  description: string;
}

export interface ChargeResult {
  status: "success" | "failed";
  provider: "mock" | "paystack";
  reference: string;
}

export const isPaystackConfigured = () =>
  Boolean(import.meta.env["VITE_PAYSTACK_PUBLIC_KEY"]);

export async function chargeCard(req: ChargeRequest): Promise<ChargeResult> {
  if (isPaystackConfigured()) {
    // Paystack inline checkout goes here once keys exist.
  }
  await new Promise((r) => setTimeout(r, 1400));
  return { status: "success", provider: "mock", reference: req.reference };
}
