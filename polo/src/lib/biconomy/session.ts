import {
  toMultichainNexusAccount,
  createMeeClient,
  getMEEVersion,
  MEEVersion,
  type SessionDetail,
} from "@biconomy/abstractjs";
import {
  http,
  encodeFunctionData,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import {
  YO_GATEWAY,
  FEE_TOKEN,
  FEE_TOKEN_CHAIN_ID,
} from "./config";

// ─── ERC-4626 Vault ABI (subset for deposit/redeem) ────────────────────────
const VAULT_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ─── Create agent MEE client for executing on behalf of a user ──────────────
export async function createAgentMeeClient(
  agentSignerKey: Hex,
  userSmartAccountAddress: Address,
) {
  const agentSigner = privateKeyToAccount(agentSignerKey);

  const agentAccount = await toMultichainNexusAccount({
    signer: agentSigner,
    chainConfigurations: [
      {
        chain: base,
        transport: http(),
        version: getMEEVersion(MEEVersion.V2_1_0),
        accountAddress: userSmartAccountAddress,
      },
    ],
  });

  const meeClient = await createMeeClient({ account: agentAccount });

  return { meeClient, agentAccount };
}

// ─── Execute a deposit on behalf of a user via session ──────────────────────
export async function executeSessionDeposit(
  agentSignerKey: Hex,
  userSmartAccountAddress: Address,
  sessionDetails: SessionDetail[],
  vaultAddress: Address,
  tokenAddress: Address,
  amount: bigint,
) {
  const { meeClient, agentAccount } = await createAgentMeeClient(
    agentSignerKey,
    userSmartAccountAddress,
  );

  // Build approve + deposit calls
  const approveData = encodeFunctionData({
    abi: VAULT_ABI,
    functionName: "approve",
    args: [YO_GATEWAY, amount],
  });

  const depositData = encodeFunctionData({
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [amount, userSmartAccountAddress],
  });

  const instructions = await agentAccount.build({
    type: "default",
    data: [
      {
        calls: [
          { to: tokenAddress, data: approveData },
          { to: vaultAddress, data: depositData },
        ],
        chainId: base.id,
      },
    ],
  });

  const quote = await meeClient.getSessionQuote({
    mode: "USE",
    sessionDetails,
    simulation: { simulate: true },
    feeToken: { address: FEE_TOKEN, chainId: FEE_TOKEN_CHAIN_ID },
    instructions,
  });

  const { hash } = await meeClient.executeSessionQuote(quote);
  const receipt = await meeClient.waitForSupertransactionReceipt({ hash });

  return { hash, receipt };
}

// ─── Execute a redeem on behalf of a user via session ───────────────────────
export async function executeSessionRedeem(
  agentSignerKey: Hex,
  userSmartAccountAddress: Address,
  sessionDetails: SessionDetail[],
  vaultAddress: Address,
  shares: bigint,
) {
  const { meeClient, agentAccount } = await createAgentMeeClient(
    agentSignerKey,
    userSmartAccountAddress,
  );

  const redeemData = encodeFunctionData({
    abi: VAULT_ABI,
    functionName: "redeem",
    args: [shares, userSmartAccountAddress, userSmartAccountAddress],
  });

  const instructions = await agentAccount.build({
    type: "default",
    data: [
      {
        calls: [{ to: vaultAddress, data: redeemData }],
        chainId: base.id,
      },
    ],
  });

  const quote = await meeClient.getSessionQuote({
    mode: "USE",
    sessionDetails,
    simulation: { simulate: true },
    feeToken: { address: FEE_TOKEN, chainId: FEE_TOKEN_CHAIN_ID },
    instructions,
  });

  const { hash } = await meeClient.executeSessionQuote(quote);
  const receipt = await meeClient.waitForSupertransactionReceipt({ hash });

  return { hash, receipt };
}
