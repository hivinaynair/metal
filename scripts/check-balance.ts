import { createPublicClient, http, formatUnits, erc20Abi, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const STABLECOINS: { symbol: string; address: Address; decimals: number }[] = [
  // Add more stablecoin contract addresses here as needed
  { symbol: "USDC", address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6 },
];

const privateKey = process.env.PAYER_PRIVATE_KEY;
if (!privateKey) throw new Error("PAYER_PRIVATE_KEY not set in env");

const account = privateKeyToAccount(privateKey as `0x${string}`);

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

(async () => {
  console.log("Address:", account.address);

  const balances = await Promise.all(
    STABLECOINS.map((token) =>
      client.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
      }).then((balance) => ({ symbol: token.symbol, balance, decimals: token.decimals }))
    )
  );

  for (const { symbol, balance, decimals } of balances) {
    console.log(`${symbol}:`, formatUnits(balance, decimals));
  }
})();
