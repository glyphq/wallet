import { expect, test } from "bun:test";
import { signTransaction } from "@qubic.org/tx";
import { toSeed } from "@qubic.org/types";
import {
  base64ToBytesStrict,
  bytesToBase64,
  createExternalSignerTransferRequest,
  EXTERNAL_SIGNER_SUPPORT,
  verifyExternalSignedTransaction,
} from "./external-signer";

const SEED_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const IDENTITY_A = "BZBQFLLBNCXEMGLOBHUVFTLUPLVCPQUASSILFABOFFBCADQSSUPNWLZBQEXK";
const IDENTITY_B = "DJZMUACQMTYFSEJEYLDBWIGELSFCBMBLPCMBBYFXJHLTGWKHTRRJXTDEHTFL";

async function signedFixture(request = createExternalSignerTransferRequest({
  sourceIdentity: IDENTITY_A,
  destinationIdentity: IDENTITY_B,
  amount: "123456789",
  targetTick: "18500005",
}, 1, "external-test")) {
  const signed = await signTransaction(base64ToBytesStrict(request.unsignedTxBase64), toSeed(SEED_A));
  return { request, signed, signedBase64: bytesToBase64(signed) };
}

test("external signer support exposes real primitives without claiming hardware transport", () => {
  expect(EXTERNAL_SIGNER_SUPPORT.directHardwareTransport).toBe(false);
  expect(EXTERNAL_SIGNER_SUPPORT.unsignedExport).toBe(true);
  expect(EXTERNAL_SIGNER_SUPPORT.signedImport).toBe(true);
});

test("creates unsigned transfer requests without seed material", () => {
  const request = createExternalSignerTransferRequest({
    sourceIdentity: IDENTITY_A.toLowerCase(),
    destinationIdentity: IDENTITY_B,
    amount: "000123456789",
    targetTick: "18500005",
  }, 1, "external-test");

  expect(request).toMatchObject({
    id: "external-test",
    sourceIdentity: IDENTITY_A,
    destinationIdentity: IDENTITY_B,
    amount: "123456789",
    targetTick: 18500005,
    inputType: 0,
    payloadBase64: "",
    status: "exported",
  });
  expect(Object.keys(request).join(" ").toLowerCase()).not.toContain("seed");
  expect(base64ToBytesStrict(request.unsignedTxBase64)).toHaveLength(80);
});

test("verifies a matching signed transaction and computes the broadcast hash", async () => {
  const { request, signedBase64 } = await signedFixture();
  const verified = verifyExternalSignedTransaction(request, signedBase64);

  expect(verified).toEqual({
    signedTxBase64: "H1kNA+YTvd7Ti0wIIKxEYV+RrxJDWYCz7ePAjDFaJUSR9s+QT3zfoVkRgS6NH21MxVAZhz7zIf6BTOuJxN+3jhXNWwcAAAAApUkaAQAAAACZOflcDgKfRp05kvzeeLV2LOzf6N53T4mlK770dO2FSjzZovW7jCs7rdqnXI+Nlb5Jh/FO+kuILUXKS0GAVwkA",
    txHash: "obllacnvrgymjgtpdclwvfqztizgbaxbiydxalaweewvtcfcwequxiiddmdn",
    sourceIdentity: IDENTITY_A,
    destinationIdentity: IDENTITY_B,
    amount: "123456789",
    targetTick: 18500005,
  });
});

test("rejects signed transactions that do not match the exported request", async () => {
  const { signedBase64 } = await signedFixture();
  const otherRequest = createExternalSignerTransferRequest({
    sourceIdentity: IDENTITY_A,
    destinationIdentity: IDENTITY_B,
    amount: "123456790",
    targetTick: "18500005",
  }, 2, "external-other");

  expect(() => verifyExternalSignedTransaction(otherRequest, signedBase64)).toThrow("does not match");
});

test("rejects malformed or tampered signed imports", async () => {
  const { request, signed } = await signedFixture();
  signed[signed.length - 1] ^= 1;

  expect(() => base64ToBytesStrict("not valid base64!")).toThrow("malformed");
  expect(() => verifyExternalSignedTransaction(request, bytesToBase64(signed))).toThrow("signature");
});
