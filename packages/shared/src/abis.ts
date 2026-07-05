export const IDENTITY_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "name", type: "string" },
      { name: "metadataUri", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "lookup",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "metadataUri", type: "string" },
          { name: "registeredAt", type: "uint256" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "AgentRegistered",
    type: "event",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "registeredAt", type: "uint256", indexed: false },
    ],
  },
] as const

export const ATTESTATION_REGISTRY_ABI = [
  {
    name: "attest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "paymentHash", type: "bytes32" },
      { name: "payer", type: "address" },
      { name: "amountUsdc", type: "uint256" },
      { name: "identityStatus", type: "uint8" },
      { name: "decision", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "Attested",
    type: "event",
    inputs: [
      { name: "paymentHash", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "amountUsdc", type: "uint256", indexed: false },
      { name: "identityStatus", type: "uint8", indexed: false },
      { name: "decision", type: "uint8", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const
