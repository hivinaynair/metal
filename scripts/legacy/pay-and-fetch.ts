// Dev script — replaced by apps/agent (AgentKit) once mandate is registered.
// Prerequisite: run `scripts/register-mandate.ts` first so the facilitator
// has the mandate on file for PAYER_ADDRESS.
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.PAYER_PRIVATE_KEY;
if (!privateKey) throw new Error("PAYER_PRIVATE_KEY not set in env");

const account = privateKeyToAccount(privateKey as `0x${string}`);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:84532", client: new ExactEvmScheme(account) }],
});

const url = process.env.APP_URL ?? "http://localhost:3000";
console.log("Calling protected route...");
const response = await fetchWithPayment(`${url}/api/settlement-risk-report`);

const paymentHeader = response.headers.get("PAYMENT-RESPONSE");
if (paymentHeader) {
  const decoded = decodePaymentResponseHeader(paymentHeader);
  console.log("Payment response:", JSON.stringify(decoded, null, 2));
  const txHash = (decoded as Record<string, unknown>).transaction ?? (decoded as Record<string, unknown>).txHash;
  if (txHash) {
    console.log("Tx hash:", txHash);
    console.log("Basescan:", `https://sepolia.basescan.org/tx/${txHash}`);
  }
}

const data = await response.json();
console.log("Status:", response.status);
console.log("Report:", JSON.stringify(data, null, 2));
