import { REQUEST_PROTOCOL_V2, requestHashV2 } from "../src/lib/jcs";

const identity = "JTPKXWYCBQKZKBXLYYXMSKPHJDGAPEOETXUNOVBVJFMUFWIDXEPZPEPFZONO";
const now = Math.floor(Date.now() / 1000);
const request = {
  type: "transfer" as const,
  dapp: { name: "Glyph Demo", origin: "https://demo.glyph.xyz" },
  nonce: crypto.randomUUID().replaceAll("-", ""),
  exp: now + 300,
  from: identity,
  to: identity,
  amount: "1",
};
const network = { id: "qubic:mainnet" as const };
const requestHash = await requestHashV2({
  protocol: REQUEST_PROTOCOL_V2,
  request,
  callback: null,
  redirect_uri: null,
  network,
});
const envelope = {
  protocol: REQUEST_PROTOCOL_V2,
  request,
  callback: null,
  redirect_uri: null,
  network,
  request_hash: requestHash,
};
const url = `glyph://v2/request?d=${Buffer.from(JSON.stringify(envelope)).toString("base64url")}`;
console.log(url);
if (process.argv.includes("--open")) {
  const wallet = new URL("../src-tauri/target/debug/glyph-wallet.exe", import.meta.url).pathname.slice(1);
  if ((await Bun.file(wallet).exists()) && process.env.GLYPH_INSTALLED !== "1") {
    Bun.spawn([wallet, url]);
  } else {
    Bun.spawn(["cmd", "/c", "start", "", url]);
  }
}
