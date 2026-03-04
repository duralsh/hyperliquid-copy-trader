import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { signTypedData } from "viem/actions";
import { arbitrum } from "viem/chains";

const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
const HL_DEPOSIT_ADDRESS = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7" as const;
const USDC_DECIMALS = 6;

function env() {
  return {
    walletAddress: process.env.MAIN_WALLET_ADDRESS ?? "",
    privateKey: process.env.MAIN_WALLET_PRIVATE_KEY ?? "",
    arbRpc: process.env.ARBITRUM_RPC_URL ?? "https://arb1.arbitrum.io/rpc",
  };
}

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

function getPublicClient() {
  return createPublicClient({ chain: arbitrum, transport: http(env().arbRpc) });
}

function getAccount() {
  const key = env().privateKey;
  const normalized = key.startsWith("0x")
    ? (key as `0x${string}`)
    : (`0x${key}` as `0x${string}`);
  return privateKeyToAccount(normalized);
}

// 15 second cache for balances
let cachedBalances: { ethBalance: number; usdcBalance: number } | null = null;
let cacheTime = 0;
const CACHE_TTL = 15_000;

export async function fetchWalletBalances(walletAddress?: string): Promise<{ ethBalance: number; usdcBalance: number }> {
  if (!walletAddress && cachedBalances && Date.now() - cacheTime < CACHE_TTL) return cachedBalances;

  const pub = getPublicClient();
  const addr = (walletAddress ?? env().walletAddress) as `0x${string}`;

  const [ethRaw, usdcRaw] = await Promise.all([
    pub.getBalance({ address: addr }),
    pub.readContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] }),
  ]);

  cachedBalances = {
    ethBalance: parseFloat(formatUnits(ethRaw, 18)),
    usdcBalance: parseFloat(formatUnits(usdcRaw, USDC_DECIMALS)),
  };
  cacheTime = Date.now();
  return cachedBalances;
}

export function invalidateBalanceCache() {
  cachedBalances = null;
}

export async function deposit(amount: number, privateKey?: string): Promise<string> {
  const account = privateKey ? privateKeyToAccount((privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`) : getAccount();
  const walletClient = createWalletClient({ account, chain: arbitrum, transport: http(env().arbRpc) });
  const pub = getPublicClient();

  const hash = await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [HL_DEPOSIT_ADDRESS, parseUnits(amount.toString(), USDC_DECIMALS)],
  });

  await pub.waitForTransactionReceipt({ hash });
  invalidateBalanceCache();
  return hash;
}

export async function withdraw(amount: number, walletAddr?: string, privKey?: string): Promise<{ success: boolean }> {
  const walletAddress = walletAddr ?? env().walletAddress;
  const account = privKey ? privateKeyToAccount((privKey.startsWith("0x") ? privKey : `0x${privKey}`) as `0x${string}`) : getAccount();
  const walletClient = createWalletClient({ account, chain: arbitrum, transport: http(env().arbRpc) });
  const timestamp = Date.now();

  const signature = await signTypedData(walletClient, {
    account,
    domain: {
      name: "HyperliquidSignTransaction",
      version: "1",
      chainId: 42161,
      verifyingContract: "0x0000000000000000000000000000000000000000",
    },
    types: {
      "HyperliquidTransaction:Withdraw": [
        { name: "hyperliquidChain", type: "string" },
        { name: "destination", type: "string" },
        { name: "amount", type: "string" },
        { name: "time", type: "uint64" },
      ],
    },
    primaryType: "HyperliquidTransaction:Withdraw",
    message: {
      hyperliquidChain: "Mainnet",
      destination: walletAddress,
      amount: amount.toString(),
      time: BigInt(timestamp),
    },
  });

  const r = signature.slice(0, 66);
  const s = "0x" + signature.slice(66, 130);
  const v = parseInt(signature.slice(130, 132), 16);

  const res = await fetch("https://api.hyperliquid.xyz/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: {
        type: "withdraw3",
        hyperliquidChain: "Mainnet",
        signatureChainId: "0xa4b1",
        destination: walletAddress,
        amount: amount.toString(),
        time: timestamp,
      },
      nonce: timestamp,
      signature: { r, s, v },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Withdraw failed: ${res.status} ${errBody}`);
  }

  invalidateBalanceCache();
  return { success: true };
}
