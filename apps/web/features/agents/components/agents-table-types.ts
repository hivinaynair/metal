export type AgentsTableRow = {
  address: string
  name: string
  agentId: string
  erc8004: string
  delegatorAddress: string
  maxAmountUsdc: string
  expiry: string
  status:
    | "Trusted"
    | "Mandate capped"
    | "Policy blocked"
    | "Expired mandate"
    | "Unregistered"
  registered: boolean
}

export type StatusFilter = "All statuses" | AgentsTableRow["status"]
export type RegistrationFilter = "All" | "Registered" | "Unregistered"
