import { describe, expect, test } from "bun:test";
import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import {
  dedupeTxRecords,
  getKnownContractLabel,
  isKnownContract,
  normalizeArchiveTransaction,
  normalizeEventTransfer,
  parseTimestamp,
  pendingTxToRecord,
  sortTxRecords,
  type TxRecord,
} from "@/lib/tx-domain";

function record(overrides: Partial<TxRecord> = {}): TxRecord {
  return {
    hash: "h1",
    source: "A",
    destination: "B",
    amount: "1",
    tickNumber: 10,
    moneyFlew: true,
    timestamp: 100,
    inputType: null,
    status: "confirmed",
    ...overrides,
  };
}

describe("parseTimestamp", () => {
  test("accepts finite numbers and numeric strings", () => {
    expect(parseTimestamp(1_700_000_000)).toBe(1_700_000_000);
    expect(parseTimestamp("1700000000")).toBe(1_700_000_000);
  });

  test("rejects missing, empty, and malformed values", () => {
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp("")).toBeNull();
    expect(parseTimestamp("  ")).toBeNull();
    expect(parseTimestamp("not-a-date")).toBeNull();
    expect(parseTimestamp(Number.NaN)).toBeNull();
  });
});

describe("normalizeArchiveTransaction", () => {
  test("drops records without a hash", () => {
    expect(normalizeArchiveTransaction({ source: "A" })).toBeNull();
    expect(normalizeArchiveTransaction({ hash: null })).toBeNull();
  });

  test("fills defaults and marks archive records confirmed", () => {
    expect(normalizeArchiveTransaction({ hash: "abc", timestamp: "12" })).toEqual({
      hash: "abc",
      source: null,
      destination: null,
      amount: "0",
      tickNumber: 0,
      moneyFlew: true,
      timestamp: 12,
      inputType: null,
      status: "confirmed",
    });
  });

  test("preserves explicit failure state and input type", () => {
    const tx = normalizeArchiveTransaction({
      hash: "abc", source: "A", destination: "B", amount: "5",
      tickNumber: 9, moneyFlew: false, inputType: 3,
    });
    expect(tx?.moneyFlew).toBe(false);
    expect(tx?.inputType).toBe(3);
  });
});

describe("normalizeEventTransfer", () => {
  test("requires both a transaction hash and a transfer body", () => {
    expect(normalizeEventTransfer({})).toBeNull();
    expect(normalizeEventTransfer({ transactionHash: "h1" })).toBeNull();
    expect(normalizeEventTransfer({ quTransfer: { source: "A" } })).toBeNull();
  });

  test("maps the transfer body into a confirmed record", () => {
    const tx = normalizeEventTransfer({
      transactionHash: "h1",
      tickNumber: 7,
      timestamp: "1700000000",
      quTransfer: { source: "A", destination: "B", amount: "42" },
    });
    expect(tx).toMatchObject({
      hash: "h1", source: "A", destination: "B", amount: "42",
      tickNumber: 7, timestamp: 1_700_000_000, inputType: null, status: "confirmed",
    });
  });
});

describe("pendingTxToRecord", () => {
  test("keeps the pending status and target tick", () => {
    const tx = pendingTxToRecord({
      hash: "p1",
      source: "A",
      destination: "B",
      amount: "3",
      targetTick: 99,
      broadcastAt: 55,
      contractName: "QUtil",
    } as Parameters<typeof pendingTxToRecord>[0]);
    expect(tx).toMatchObject({
      hash: "p1", tickNumber: 99, timestamp: 55, status: "pending", contractName: "QUtil",
    });
  });
});

describe("dedupeTxRecords and sortTxRecords", () => {
  test("dedupes by hash, keeping the first occurrence", () => {
    const first = record({ hash: "same", amount: "1" });
    const second = record({ hash: "same", amount: "2" });
    expect(dedupeTxRecords([first, second])).toEqual([first]);
  });

  test("sorts by tick then timestamp without mutating the input", () => {
    const input = [
      record({ hash: "old", tickNumber: 1 }),
      record({ hash: "new-a", tickNumber: 5, timestamp: 20 }),
      record({ hash: "new-b", tickNumber: 5, timestamp: 30 }),
      record({ hash: "unknown-time", tickNumber: 6, timestamp: null }),
    ];
    expect(sortTxRecords(input).map((tx) => tx.hash)).toEqual(["unknown-time", "new-b", "new-a", "old"]);
    expect(input.map((tx) => tx.hash)).toEqual(["old", "new-a", "new-b", "unknown-time"]);
  });
});

describe("known contract lookup", () => {
  test("recognizes addresses from the contract registry", () => {
    const [address, label] = Object.entries(KNOWN_CONTRACT_ADDRESSES)[0];
    expect(isKnownContract(address)).toBe(true);
    expect(getKnownContractLabel(address)).toBe(label);
  });

  test("treats unknown or missing addresses as non-contracts", () => {
    expect(isKnownContract(null)).toBe(false);
    expect(isKnownContract("NOT-A-CONTRACT")).toBe(false);
    expect(getKnownContractLabel("NOT-A-CONTRACT")).toBe("");
    expect(getKnownContractLabel(undefined)).toBe("");
  });
});
