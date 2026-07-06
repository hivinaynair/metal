import { privateKeyToAccount } from "viem/accounts"
import { MANDATE_EIP712_DOMAIN, MANDATE_EIP712_TYPES, type SignedMandate } from "../../packages/shared/src/mandate"

const DEMO_MAX_AMOUNT_USDC = 100n
const DEMO_EXPIRY = 9999999999n // far-future Unix timestamp (~year 2286), mandate never expires
const DEMO_NONCE = 0n

export async function signMandate(
  agentAddress: `0x${string}`,
  delegatorPrivateKey: `0x${string}`
): Promise<SignedMandate> {
  const delegator = privateKeyToAccount(delegatorPrivateKey)

  const payload = {
    agent: agentAddress,
    delegator: delegator.address,
    maxAmountUsdc: DEMO_MAX_AMOUNT_USDC,
    expiry: DEMO_EXPIRY,
    nonce: DEMO_NONCE,
  }

  const signature = await delegator.signTypedData({
    domain: MANDATE_EIP712_DOMAIN,
    types: MANDATE_EIP712_TYPES,
    primaryType: "MandatePayload",
    message: payload,
  })

  return { payload, signature }
}
