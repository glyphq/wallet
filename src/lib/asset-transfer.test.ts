import { describe, expect, test } from "bun:test";
import { identityToPublicKey } from "@/lib/crypto";
import {
  assetNameToBigInt,
  buildQxAssetTransferCall,
  formatAssetUnits,
  parseAssetAmount,
  validateQxAssetTransfer,
} from "@/lib/asset-transfer";
import { QX_CONTRACT_INDEX, QX_TRANSFER_SHARE_OWNERSHIP_AND_POSSESSION_INPUT_TYPE } from "@/lib/contracts";

const sourceIdentity = "BZBQFLLBNCXEMGLOBHUVFTLUPLVCPQUASSILFABOFFBCADQSSUPNWLZBQEXK";
const recipientIdentity = "DJZMUACQMTYFSEJEYLDBWIGELSFCBMBLPCMBBYFXJHLTGWKHTRRJXTDEHTFL";

const asset = {
  name: "ASSET",
  numberOfUnits: "1234567890123456789012345",
  issuanceIndex: 1,
  managingContractIndex: QX_CONTRACT_INDEX,
  issuerIdentity: sourceIdentity,
  numberOfDecimalPlaces: 2,
};

describe("asset transfer helpers", () => {
  test("packs asset names as little-endian uint64 values", () => {
    expect(assetNameToBigInt("QX")).toBe(0x5851n);
    expect(assetNameToBigInt("ASSET")).toBe(0x5445535341n);
    expect(() => assetNameToBigInt("TOO-LONG")).toThrow();
  });

  test("parses and formats decimal asset units without Number conversion", () => {
    expect(parseAssetAmount("123.45", 2)).toEqual({ ok: true, units: 12345n });
    expect(parseAssetAmount("0.001", 2)).toEqual({ ok: false, error: "Use at most 2 decimal places" });
    expect(parseAssetAmount("1.1", 0)).toEqual({ ok: false, error: "This asset only accepts whole units" });
    expect(formatAssetUnits("1234567890123456789012345", 2)).toBe("12,345,678,901,234,567,890,123.45");
  });

  test("validates recipient, supported QX management, balance, and QU fee", () => {
    const ok = validateQxAssetTransfer({
      asset,
      sourceIdentity,
      recipientIdentity,
      amountText: "10.50",
      qxTransferFee: 100n,
      quBalance: 100n,
    });
    expect(ok.ok).toBe(true);
    expect(ok.units).toBe(1050n);

    expect(validateQxAssetTransfer({ ...okInput(), recipientIdentity: sourceIdentity }).recipientError).toBe("Recipient must be a different identity");
    expect(validateQxAssetTransfer({ ...okInput(), amountText: "999999999999999999999999999999" }).amountError).toBe("Amount is higher than your asset balance");
    expect(validateQxAssetTransfer({ ...okInput(), qxTransferFee: 101n, quBalance: 100n }).formError).toBe("Insufficient QU for the QX transfer fee");
    expect(validateQxAssetTransfer({ ...okInput(), asset: { ...asset, managingContractIndex: 0 } }).formError).toBe("Only QX-managed assets can be transferred here");
  });

  test("builds the supported QX transfer ownership and possession contract call", () => {
    const call = buildQxAssetTransferCall({ asset, recipientIdentity, units: 1050n });
    expect(call.contractIndex).toBe(QX_CONTRACT_INDEX);
    expect(call.inputType).toBe(QX_TRANSFER_SHARE_OWNERSHIP_AND_POSSESSION_INPUT_TYPE);
    expect(Array.from(call.payload.slice(0, 32))).toEqual(Array.from(identityToPublicKey(sourceIdentity)));
    expect(Array.from(call.payload.slice(32, 64))).toEqual(Array.from(identityToPublicKey(recipientIdentity)));
    expect(Array.from(call.payload.slice(64, 72))).toEqual([65, 83, 83, 69, 84, 0, 0, 0]);
    expect(new DataView(call.payload.buffer, call.payload.byteOffset, call.payload.byteLength).getBigInt64(72, true)).toBe(1050n);
  });
});

function okInput() {
  return {
    asset,
    sourceIdentity,
    recipientIdentity,
    amountText: "10.50",
    qxTransferFee: 100n,
    quBalance: 100n,
  };
}
