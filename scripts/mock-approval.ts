import { REQUEST_PROTOCOL_V2, requestHashV2 } from "../src/lib/jcs";

const now = Math.floor(Date.now() / 1000);
const request = {
  type: "connect" as const,
  dapp: { name: "Glyph Demo", origin: "https://demo.glyph.xyz" },
  nonce: crypto.randomUUID().replaceAll("-", ""),
  exp: now + 300,
  permissions: ["transfer", "sign_message"] as const,
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
