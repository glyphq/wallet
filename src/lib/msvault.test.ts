import { describe, expect, test } from "bun:test";
import { MSVAULT, identityToPublicKey, publicKeyToIdentity } from "@glyph-oss/contracts";
import { bytesToHex } from "@/lib/hex";
import {
  MSVAULT_MAX_OWNERS,
  NULL_DESTINATION,
  buildReleaseProposals,
  decodeAssetName,
  decodeVaultName,
  defaultRequiredApprovals,
  encodeAssetName,
  encodeVaultName,
  formatAssetAmount,
  ownerIndex,
  parseAssetAmount,
  validateMultisigConfig,
  vaultHoldingCoverage,
  type MsvaultAssetRef,
} from "@/lib/msvault";

const OWNER_A = publicKeyToIdentity(new Uint8Array(32).fill(1));
const OWNER_B = publicKeyToIdentity(new Uint8Array(32).fill(2));
const OWNER_C = publicKeyToIdentity(new Uint8Array(32).fill(3));
const OWNER_D = publicKeyToIdentity(new Uint8Array(32).fill(4));
const OWNER_E = publicKeyToIdentity(new Uint8Array(32).fill(5));
const OWNER_F = publicKeyToIdentity(new Uint8Array(32).fill(6));
const DESTINATION = publicKeyToIdentity(new Uint8Array(32).fill(9));

const ASSET_QX: MsvaultAssetRef = { issuer: OWNER_A, assetName: encodeAssetName("QX"), name: "QX" };
const ASSET_QUBIC: MsvaultAssetRef = {
  issuer: OWNER_B,
  assetName: encodeAssetName("QUBIC"),
  name: "QUBIC",
};

describe("vault names", () => {
  test("round-trips a trimmed name through a zero-padded 32-byte payload", () => {
    const encoded = encodeVaultName("  Treasury  ");
    expect(encoded).toHaveLength(32);
    expect(bytesToHex(encoded.subarray(0, 8))).toBe(bytesToHex(new TextEncoder().encode("Treasury")));
    expect(encoded.subarray(8).every((byte) => byte === 0)).toBe(true);
    expect(decodeVaultName(bytesToHex(encoded))).toBe("Treasury");
  });

  test("round-trips UTF-8 and enforces the byte limit rather than the character count", () => {
    const utf8 = encodeVaultName("Café ☕");
    expect(decodeVaultName(bytesToHex(utf8))).toBe("Café ☕");

    expect(encodeVaultName("a".repeat(32))).toHaveLength(32);
    expect(encodeVaultName("é".repeat(16))).toHaveLength(32);
    expect(() => encodeVaultName("a".repeat(33))).toThrow();
    expect(() => encodeVaultName("é".repeat(17))).toThrow();
  });

  test("rejects empty names and returns an empty string for malformed payloads", () => {
    expect(() => encodeVaultName("   ")).toThrow();
    expect(decodeVaultName("not-hex")).toBe("");
    expect(decodeVaultName("abc")).toBe("");
    expect(decodeVaultName(bytesToHex(new Uint8Array(32)))).toBe("");
  });
});

describe("asset names", () => {
  test("packs 1-7 uppercase ASCII characters little-endian into a u64", () => {
    expect(encodeAssetName("qx")).toBe(0x51n | (0x58n << 8n));
    expect(decodeAssetName(encodeAssetName("qx"))).toBe("QX");
    expect(decodeAssetName(encodeAssetName("A1B2C3D"))).toBe("A1B2C3D");
    expect(decodeAssetName(encodeAssetName(" QUBIC "))).toBe("QUBIC");
  });

  test("rejects names that are empty, too long, or contain invalid characters", () => {
    expect(() => encodeAssetName("")).toThrow();
    expect(() => encodeAssetName("ABCDEFGH")).toThrow();
    expect(() => encodeAssetName("AB-CD")).toThrow();
    expect(() => encodeAssetName("A B")).toThrow();
  });

  test("returns an empty string for zero, negative, oversized, or lowercase payloads", () => {
    expect(decodeAssetName(0n)).toBe("");
    expect(decodeAssetName(-1n)).toBe("");
    expect(decodeAssetName(0xffffffffffffffffn)).toBe("");
    expect(decodeAssetName(0x61n | (0x62n << 8n))).toBe("");
  });
});

describe("asset amounts", () => {
  test("parses whole and decimal units into raw shares", () => {
    expect(parseAssetAmount("1", 0)).toBe(1n);
    expect(parseAssetAmount("1.25", 2)).toBe(125n);
    expect(parseAssetAmount("0.00000001", 8)).toBe(1n);
    expect(parseAssetAmount(" 123.45 ", 2)).toBe(12345n);
    expect(parseAssetAmount("123456789012345678.12345678", 8)).toBe(
      12345678901234567812345678n,
    );
  });

  test("rejects zero, negatives, exponents, and excess precision", () => {
    for (const invalid of ["", " ", "0", "0.0", "-1", "+1", "1e3", "1.234", "1.", ".5", "1,000"]) {
      expect(parseAssetAmount(invalid, 2)).toBeNull();
    }
    expect(parseAssetAmount("1", -1)).toBeNull();
  });

  test("formats large share counts without losing precision and trims fractional zeroes", () => {
    expect(formatAssetAmount(12345678901234567812345678n, 8)).toBe(
      "123,456,789,012,345,678.12345678",
    );
    expect(formatAssetAmount(100000000n, 8)).toBe("1");
    expect(formatAssetAmount(120000000n, 8)).toBe("1.2");
    expect(formatAssetAmount(100000001n, 8)).toBe("1.00000001");
    expect(formatAssetAmount(9007199254740993n, 0)).toBe("9,007,199,254,740,993");
    expect(formatAssetAmount(-150000000n, 8)).toBe("-1.5");
    expect(formatAssetAmount(0n, 8)).toBe("0");
  });
});

describe("owner and approval helpers", () => {
  test("derives a majority threshold and locates owners case-insensitively", () => {
    expect(defaultRequiredApprovals(2)).toBe(2);
    expect(defaultRequiredApprovals(3)).toBe(2);
    expect(defaultRequiredApprovals(4)).toBe(3);
    expect(defaultRequiredApprovals(16)).toBe(9);
    expect(ownerIndex([OWNER_A, OWNER_B], OWNER_B)).toBe(1);
    expect(ownerIndex([OWNER_A], OWNER_A.toLowerCase())).toBe(0);
    expect(ownerIndex([OWNER_A], OWNER_C)).toBe(-1);
  });

  test("validates names, owner counts, duplicates, identities, and thresholds", () => {
    const valid = { name: "Treasury", owners: [OWNER_A, OWNER_B], requiredApprovals: 2 };
    expect(validateMultisigConfig(valid)).toBe("");
    expect(
      validateMultisigConfig({
        ...valid,
        owners: [` ${OWNER_A.toLowerCase()} `, ` ${OWNER_B} `],
      }),
    ).toBe("");

    expect(validateMultisigConfig({ ...valid, name: "  " })).not.toBe("");
    expect(validateMultisigConfig({ ...valid, name: "a".repeat(33) })).not.toBe("");
    expect(validateMultisigConfig({ ...valid, owners: [OWNER_A] })).not.toBe("");
    expect(
      validateMultisigConfig({
        ...valid,
        owners: Array.from({ length: MSVAULT_MAX_OWNERS + 1 }, (_, index) =>
          publicKeyToIdentity(new Uint8Array(32).fill(index + 1)),
        ),
        requiredApprovals: 2,
      }),
    ).not.toBe("");
    expect(validateMultisigConfig({ ...valid, owners: [OWNER_A, "INVALID"] })).not.toBe("");
    expect(validateMultisigConfig({ ...valid, owners: [OWNER_A, OWNER_A.toLowerCase()] })).not.toBe("");
    expect(validateMultisigConfig({ ...valid, requiredApprovals: 1 })).not.toBe("");
    expect(validateMultisigConfig({ ...valid, requiredApprovals: 3 })).not.toBe("");
    expect(validateMultisigConfig({ ...valid, requiredApprovals: 1.5 })).not.toBe("");
  });
});

describe("release proposals", () => {
  test("groups matching owner slots into one exact proposal", () => {
    const proposals = buildReleaseProposals({
      owners: [OWNER_A, OWNER_B, OWNER_C],
      requiredApprovals: 2,
      amounts: [100n, 100n, 0n],
      destinations: [DESTINATION, DESTINATION, DESTINATION],
      assets: [],
      assetAmounts: [],
      assetDestinations: [],
    });

    expect(proposals).toHaveLength(1);
    expect(proposals[0].kind).toBe("qubic");
    expect(proposals[0].asset).toBeNull();
    expect(proposals[0].amount).toBe(100n);
    expect(proposals[0].destination).toBe(DESTINATION);
    expect(proposals[0].supporters).toEqual([0, 1]);
    expect(proposals[0].approvals).toBe(2);
    expect(proposals[0].requiredApprovals).toBe(2);
  });

  test("keeps conflicting QUBIC and asset releases in separate groups", () => {
    const proposals = buildReleaseProposals({
      owners: [OWNER_A, OWNER_B],
      requiredApprovals: 2,
      amounts: [100n, 200n],
      destinations: [DESTINATION, DESTINATION],
      assets: [ASSET_QX, ASSET_QX],
      assetAmounts: [100n, 100n],
      assetDestinations: [DESTINATION, DESTINATION],
    });

    const qubic = proposals.filter((proposal) => proposal.kind === "qubic");
    const assets = proposals.filter((proposal) => proposal.kind === "asset");
    expect(proposals).toHaveLength(3);
    expect(qubic).toHaveLength(2);
    expect(assets).toHaveLength(1);
    expect(assets[0].asset).toEqual(ASSET_QX);
    expect(assets[0].supporters).toEqual([0, 1]);
    expect(assets[0].approvals).toBe(2);
  });

  test("ignores zero amounts, null destinations, empty assets, and slots without owners", () => {
    const proposals = buildReleaseProposals({
      owners: [OWNER_A, OWNER_B, OWNER_C],
      requiredApprovals: 2,
      amounts: [0n, 50n, 70n, 999n],
      destinations: [DESTINATION, NULL_DESTINATION, DESTINATION, DESTINATION],
      assets: [null, undefined, { issuer: OWNER_A, assetName: 0n, name: "" }, ASSET_QX],
      assetAmounts: [10n, 10n, 10n, 0n],
      assetDestinations: [DESTINATION, DESTINATION, DESTINATION, DESTINATION],
    });

    expect(proposals).toHaveLength(1);
    expect(proposals[0].kind).toBe("qubic");
    expect(proposals[0].amount).toBe(70n);
    expect(proposals[0].destination).toBe(DESTINATION);
    expect(proposals[0].supporters).toEqual([2]);
    expect(proposals[0].approvals).toBe(1);
  });

  test("orders ready proposals first, then approvals, then amount", () => {
    const proposals = buildReleaseProposals({
      owners: [OWNER_A, OWNER_B, OWNER_C, OWNER_D, OWNER_E, OWNER_F],
      requiredApprovals: 3,
      amounts: [10n, 10n, 10n, 5n, 5n, 5n],
      destinations: Array.from({ length: 6 }, () => DESTINATION),
      assets: [ASSET_QX, ASSET_QX, ASSET_QX, ASSET_QX, ASSET_QUBIC, ASSET_QUBIC],
      assetAmounts: [100n, 100n, 100n, 100n, 9999n, 9999n],
      assetDestinations: Array.from({ length: 6 }, () => DESTINATION),
    });

    expect(proposals.map((proposal) => `${proposal.kind}:${proposal.amount}`)).toEqual([
      "asset:100",
      "qubic:10",
      "qubic:5",
      "asset:9999",
    ]);
    expect(proposals.map((proposal) => proposal.approvals)).toEqual([4, 3, 3, 2]);
  });

  test("computes holding coverage and returns null for a zero fee", () => {
    expect(vaultHoldingCoverage(500n, 100n)).toBe(5n);
    expect(vaultHoldingCoverage(499n, 100n)).toBe(4n);
    expect(vaultHoldingCoverage(500n, 0n)).toBeNull();
  });
});

describe("MSVAULT ABI payloads", () => {
  test("registerVault writes the name, 16 owner slots, and the threshold at offset 544", () => {
    const vaultName = encodeVaultName("Treasury");
    const payload = MSVAULT.encodeProcedure("registerVault", {
      vaultName,
      owners: [OWNER_A, OWNER_B],
      requiredApprovals: 2n,
    });
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    expect(payload.byteLength).toBe(552);
    expect(view.getBigUint64(544, true)).toBe(2n);
    expect(bytesToHex(payload.subarray(0, 32))).toBe(bytesToHex(vaultName));
    expect(bytesToHex(payload.subarray(32, 64))).toBe(
      bytesToHex(identityToPublicKey(OWNER_A)),
    );
    expect(bytesToHex(payload.subarray(64, 96))).toBe(
      bytesToHex(identityToPublicKey(OWNER_B)),
    );
    expect(payload.subarray(96, 544).every((byte) => byte === 0)).toBe(true);
  });

  test("depositAsset packs the vault, asset, and amount at their ABI offsets", () => {
    const assetName = encodeAssetName("QX");
    const payload = MSVAULT.encodeProcedure("depositAsset", {
      vaultId: 7n,
      asset: { issuer: OWNER_A, assetName },
      amount: 123n,
    });
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    expect(payload.byteLength).toBe(56);
    expect(view.getBigUint64(0, true)).toBe(7n);
    expect(bytesToHex(payload.subarray(8, 40))).toBe(bytesToHex(identityToPublicKey(OWNER_A)));
    expect(view.getBigUint64(40, true)).toBe(assetName);
    expect(view.getBigUint64(48, true)).toBe(123n);
  });

  test("releaseAssetTo appends the destination after the amount", () => {
    const payload = MSVAULT.encodeProcedure("releaseAssetTo", {
      vaultId: 7n,
      asset: { issuer: OWNER_A, assetName: encodeAssetName("QX") },
      amount: 456n,
      destination: DESTINATION,
    });
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    expect(payload.byteLength).toBe(88);
    expect(view.getBigUint64(0, true)).toBe(7n);
    expect(view.getBigUint64(48, true)).toBe(456n);
    expect(bytesToHex(payload.subarray(56, 88))).toBe(
      bytesToHex(identityToPublicKey(DESTINATION)),
    );
  });

  test("revokeAssetManagementRights packs the asset and share count", () => {
    const assetName = encodeAssetName("QX");
    const payload = MSVAULT.encodeProcedure("revokeAssetManagementRights", {
      asset: { issuer: OWNER_A, assetName },
      numberOfShares: 789n,
    });
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    expect(payload.byteLength).toBe(48);
    expect(bytesToHex(payload.subarray(0, 32))).toBe(bytesToHex(identityToPublicKey(OWNER_A)));
    expect(view.getBigUint64(32, true)).toBe(assetName);
    expect(view.getBigInt64(40, true)).toBe(789n);
  });
});
