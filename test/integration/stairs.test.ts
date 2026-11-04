import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "node:child_process";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { BOTCHAIN_ABI } from "../../lib/botchain/abi";
import { quoteBuy, quoteSell } from "../../lib/stairs";

const ANVIL_PORT = 8659;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;

describe("Stairs Integration Test", () => {
  let anvil: ChildProcess;

  const creatorAccount = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
  const aliceAccount = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
  const bobAccount = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");

  const publicClient = createPublicClient({
    transport: http(RPC_URL),
  });

  let stairsAddress: `0x${string}`;

  beforeAll(async () => {
    anvil = spawn("anvil", ["-p", String(ANVIL_PORT)], {
      stdio: "ignore",
    });

    // Wait for anvil to spin up
    for (let i = 0; i < 30; i++) {
      try {
        await publicClient.getBlockNumber();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // Deploy Stairs contract
    const creatorClient = createWalletClient({
      account: creatorAccount,
      transport: http(RPC_URL),
    });

    const deployer = spawn(
      "forge",
      [
        "create",
        "contracts/src/Stairs.sol:Stairs",
        "--rpc-url",
        RPC_URL,
        "--private-key",
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        "--broadcast",
      ],
      { cwd: process.cwd() }
    );

    let output = "";
    deployer.stdout.on("data", (d) => (output += d.toString()));
    deployer.stderr.on("data", (d) => (output += d.toString()));

    await new Promise<void>((resolve, reject) => {
      deployer.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Deploy failed: ${output}`));
      });
    });

    const match = output.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/);
    if (!match) throw new Error(`Could not find deployed address: ${output}`);
    stairsAddress = match[1] as `0x${string}`;
  }, 30000);

  afterAll(() => {
    if (anvil) {
      anvil.kill();
    }
  });

  it("handles the full lifecycle: create -> quote parity -> buy -> price move -> sell -> withdraw", async () => {
    const creatorClient = createWalletClient({
      account: creatorAccount,
      transport: http(RPC_URL),
    });
    const aliceClient = createWalletClient({
      account: aliceAccount,
      transport: http(RPC_URL),
    });
    const bobClient = createWalletClient({
      account: bobAccount,
      transport: http(RPC_URL),
    });

    const base = 100_000_000_000_000_000n; // 0.1 ETH
    const step = 20_000_000_000_000_000n; // 0.02 ETH
    const cap = 50;
    const bps = 1000; // 10%

    // 1. Creator creates edition
    const createTx = await creatorClient.writeContract({
      address: stairsAddress,
      abi: BOTCHAIN_ABI,
      functionName: "create",
      args: ["Integration Pass", cap, base, step, bps],
    });
    await publicClient.waitForTransactionReceipt({ hash: createTx });

    const id = 1n;

    // 2. Parity check on quoteBuy
    const contractQuoteBuy = (await publicClient.readContract({
      address: stairsAddress,
      abi: BOTCHAIN_ABI,
      functionName: "quoteBuy",
      args: [id, 3],
    })) as bigint;

    const libQuoteBuy = quoteBuy(base, step, 0, 3);
    expect(contractQuoteBuy).toBe(libQuoteBuy);

    // 3. Alice buys 3 copies
    const buyTxAlice = await aliceClient.writeContract({
      address: stairsAddress,
      abi: BOTCHAIN_ABI,
      functionName: "buy",
      args: [id, 3, contractQuoteBuy],
      value: contractQuoteBuy,
    });
    await publicClient.waitForTransactionReceipt({ hash: buyTxAlice });

    // Verify Alice holds 3
    const aliceHeld = (await publicClient.readContract({
      address: stairsAddress,
      abi: BOTCHAIN_ABI,
      functionName: "heldBy",
      args: [id, aliceAccount.address],
    })) as number;
    expect(aliceHeld).toBe(3);

    // 4. Bob buys 2 copies
    const bobCost = (await publicClient.readContract({
      address: stairsAddress,
      abi: BOTCHAIN_ABI,
      functionName: "quoteBuy",
      args: [id, 2],
    })) as bigint;

    const buyTxBob = await bobClient.writeContract({
      address: stairsAddress,
      abi: BOTCHAIN_ABI,
      functionName: "buy",
      args: [id, 2, bobCost],
      value: bobCost,
    });
    await publicClient.waitForTransactionReceipt({ hash: buyTxBob });

    // Supply is now 5
    const edition = (await publicClient.readContract({
      address: stairsAddress,
      abi: BOTCHAIN_ABI,
      functionName: "editionOf",
      args: [id],
    })) as { supply: number; reserve: bigint };
    expect(edition.supply).toBe(5);

    // 5. Parity check on quoteSell for Alice selling 2 copies
    const contractQuoteSell = (await publicClient.readContract({
      address: stairsAddress,
      abi: BOTCHAIN_ABI,
      functionName: "quoteSell",
      args: [id, 2],
    })) as bigint;

    const libQuoteSell = quoteSell(base, step, bps, 5, 2);
    expect(contractQuoteSell).toBe(libQuoteSell);

    // 6. Alice sells 2 copies
    const sellTx = await aliceClient.writeContract({
      address: stairsAddress,
      abi: BOTCHAIN_ABI,
      functionName: "sell",
      args: [id, 2, contractQuoteSell],
    });
    await publicClient.waitForTransactionReceipt({ hash: sellTx });

    // Alice now holds 1 copy, supply is 3
    const aliceHeldAfter = (await publicClient.readContract({
      address: stairsAddress,
      abi: BOTCHAIN_ABI,
      functionName: "heldBy",
      args: [id, aliceAccount.address],
    })) as number;
    expect(aliceHeldAfter).toBe(1);

    // 7. Creator withdraws accrued cuts
    const pendingCut = (await publicClient.readContract({
      address: stairsAddress,
      abi: BOTCHAIN_ABI,
      functionName: "pending",
      args: [creatorAccount.address],
    })) as bigint;
    expect(pendingCut).toBeGreaterThan(0n);

    const withdrawTx = await creatorClient.writeContract({
      address: stairsAddress,
      abi: BOTCHAIN_ABI,
      functionName: "withdraw",
      args: [],
    });
    await publicClient.waitForTransactionReceipt({ hash: withdrawTx });

    const pendingAfter = (await publicClient.readContract({
      address: stairsAddress,
      abi: BOTCHAIN_ABI,
      functionName: "pending",
      args: [creatorAccount.address],
    })) as bigint;
    expect(pendingAfter).toBe(0n);
  });
});
