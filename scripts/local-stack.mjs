#!/usr/bin/env node

/**
 * Local Stack runner for Stairs (Port 8759)
 * Seeds:
 * 1. Edition 1 mid-way (supply 12 of 40, three holders)
 * 2. Edition 2 fresh (supply 0)
 * 3. Edition 3 sold out (cap 5, supply 5)
 * 4. Edition 4 with a 0% creator cut
 * 5. Edition 5 with a steep step
 */

import { spawn } from "child_process";
import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { BOTCHAIN_ABI } from "../lib/botchain/abi.js";

const ANVIL_PORT = 8759;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;

const localChain = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
});

const CREATOR_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const BUYER_A_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const BUYER_B_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
const BUYER_C_KEY = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6";

const creator = privateKeyToAccount(CREATOR_KEY);
const buyerA = privateKeyToAccount(BUYER_A_KEY);
const buyerB = privateKeyToAccount(BUYER_B_KEY);
const buyerC = privateKeyToAccount(BUYER_C_KEY);

const publicClient = createPublicClient({
  chain: localChain,
  transport: http(RPC_URL),
});

async function main() {
  console.log(`Starting Anvil on port ${ANVIL_PORT}...`);
  const anvil = spawn("anvil", ["-p", String(ANVIL_PORT)], { stdio: "ignore" });

  process.on("exit", () => anvil.kill());
  process.on("SIGINT", () => {
    anvil.kill();
    process.exit();
  });

  // Wait for RPC
  for (let i = 0; i < 30; i++) {
    try {
      await publicClient.getBlockNumber();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log("Deploying Stairs contract...");
  const deployer = spawn(
    "forge",
    [
      "create",
      "contracts/src/Stairs.sol:Stairs",
      "--rpc-url",
      RPC_URL,
      "--private-key",
      CREATOR_KEY,
      "--broadcast",
    ],
    { cwd: process.cwd() }
  );

  let output = "";
  deployer.stdout.on("data", (d) => (output += d.toString()));
  deployer.stderr.on("data", (d) => (output += d.toString()));

  await new Promise((resolve, reject) => {
    deployer.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Deploy failed: ${output}`));
    });
  });

  const match = output.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/);
  if (!match) throw new Error("Could not find deployed contract address");
  const contractAddress = match[1];
  console.log(`Stairs deployed to: ${contractAddress}`);

  const creatorClient = createWalletClient({ account: creator, chain: localChain, transport: http(RPC_URL) });
  const buyerAClient = createWalletClient({ account: buyerA, chain: localChain, transport: http(RPC_URL) });
  const buyerBClient = createWalletClient({ account: buyerB, chain: localChain, transport: http(RPC_URL) });
  const buyerCClient = createWalletClient({ account: buyerC, chain: localChain, transport: http(RPC_URL) });

  console.log("Seeding test editions...");

  // Edition 1: Mid-way (cap 40, supply 12, 3 holders)
  let tx = await creatorClient.writeContract({
    address: contractAddress,
    abi: BOTCHAIN_ABI,
    functionName: "create",
    args: ["Vanguard Pass", 40, 100_000_000_000_000_000n, 10_000_000_000_000_000n, 1000],
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });

  // Buyer A buys 5
  let cost = await publicClient.readContract({ address: contractAddress, abi: BOTCHAIN_ABI, functionName: "quoteBuy", args: [1n, 5] });
  tx = await buyerAClient.writeContract({ address: contractAddress, abi: BOTCHAIN_ABI, functionName: "buy", args: [1n, 5, cost], value: cost });
  await publicClient.waitForTransactionReceipt({ hash: tx });

  // Buyer B buys 4
  cost = await publicClient.readContract({ address: contractAddress, abi: BOTCHAIN_ABI, functionName: "quoteBuy", args: [1n, 4] });
  tx = await buyerBClient.writeContract({ address: contractAddress, abi: BOTCHAIN_ABI, functionName: "buy", args: [1n, 4, cost], value: cost });
  await publicClient.waitForTransactionReceipt({ hash: tx });

  // Buyer C buys 3
  cost = await publicClient.readContract({ address: contractAddress, abi: BOTCHAIN_ABI, functionName: "quoteBuy", args: [1n, 3] });
  tx = await buyerCClient.writeContract({ address: contractAddress, abi: BOTCHAIN_ABI, functionName: "buy", args: [1n, 3, cost], value: cost });
  await publicClient.waitForTransactionReceipt({ hash: tx });

  // Edition 2: Fresh (supply 0)
  tx = await creatorClient.writeContract({
    address: contractAddress,
    abi: BOTCHAIN_ABI,
    functionName: "create",
    args: ["Genesis Access Ticket", 100, 50_000_000_000_000_000n, 5_000_000_000_000_000n, 1500],
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });

  // Edition 3: Sold out (cap 5, supply 5)
  tx = await creatorClient.writeContract({
    address: contractAddress,
    abi: BOTCHAIN_ABI,
    functionName: "create",
    args: ["VIP Suite Key", 5, 200_000_000_000_000_000n, 50_000_000_000_000_000n, 2000],
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });

  cost = await publicClient.readContract({ address: contractAddress, abi: BOTCHAIN_ABI, functionName: "quoteBuy", args: [3n, 5] });
  tx = await buyerAClient.writeContract({ address: contractAddress, abi: BOTCHAIN_ABI, functionName: "buy", args: [3n, 5, cost], value: cost });
  await publicClient.waitForTransactionReceipt({ hash: tx });

  // Edition 4: 0% creator cut (100% reserve)
  tx = await creatorClient.writeContract({
    address: contractAddress,
    abi: BOTCHAIN_ABI,
    functionName: "create",
    args: ["Community Vault Pass", 50, 80_000_000_000_000_000n, 10_000_000_000_000_000n, 0],
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });

  // Edition 5: Steep step
  tx = await creatorClient.writeContract({
    address: contractAddress,
    abi: BOTCHAIN_ABI,
    functionName: "create",
    args: ["Exponential Stepper", 20, 10_000_000_000_000_000n, 100_000_000_000_000_000n, 500],
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });

  console.log("Local stack ready on port 8759!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
