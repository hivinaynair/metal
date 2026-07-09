import type { CdpClient } from "@coinbase/cdp-sdk"

let _cdp: CdpClient | undefined

export async function getCdp(): Promise<CdpClient> {
  if (!_cdp) {
    const { CdpClient } = await import("@coinbase/cdp-sdk")
    _cdp = new CdpClient()
  }
  return _cdp
}
