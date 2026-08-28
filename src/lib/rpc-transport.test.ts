import { describe, expect, test } from "bun:test";
import { createQubicClient } from "@qubic.org/rpc";
import {
  createRpcFetch,
  fetchLocalNetworkManifest,
  LOCAL_CORE_LITE_ARCHIVE_URL,
  LOCAL_CORE_LITE_LIVE_URL,
  LOCAL_NETWORK_MANIFEST_URL,
} from "./rpc-transport";

interface InvokeArgs {
  url: string;
  method: string;
  body: string | null;
}

function nativeResponse(body: unknown, status = 200) {
  return {
    status,
    body: JSON.stringify(body),
    contentType: "application/json",
  };
}

describe("RPC transport", () => {
  test("keeps normal HTTPS requests on global fetch", async () => {
    let invoked = false;
    let fetchedUrl = "";
    const rpcFetch = createRpcFetch({
      nativeInvoke: async <T>() => {
        invoked = true;
        return nativeResponse({}) as T;
      },
      globalFetch: async (request) => {
        fetchedUrl = request.url;
        return new Response("ok", { status: 200 });
      },
    });

    const response = await rpcFetch(new Request("https://rpc.example/live/v1/tick-info"));
    expect(await response.text()).toBe("ok");
    expect(fetchedUrl).toBe("https://rpc.example/live/v1/tick-info");
    expect(invoked).toBeFalse();
  });

  test("rejects non-HTTPS targets outside the exact core-lite origin", async () => {
    let invoked = false;
    const rpcFetch = createRpcFetch({
      nativeInvoke: async <T>() => {
        invoked = true;
        return nativeResponse({}) as T;
      },
    });

    for (const url of [
      "http://localhost:41841/live/v1/tick-info",
      "http://127.0.0.1:41840/live/v1/tick-info",
      "http://127.0.0.2:41841/live/v1/tick-info",
      "http://10.0.0.1:41841/live/v1/tick-info",
      "http://192.168.1.1:41841/live/v1/tick-info",
      "http://169.254.169.254:41841/latest/meta-data",
      "ftp://127.0.0.1:41841/live/v1/tick-info",
    ]) {
      await expect(rpcFetch(new Request(url))).rejects.toThrow("approved local core-lite origin");
    }
    expect(invoked).toBeFalse();
  });

  test("routes the exact local origin through the native command", async () => {
    let command = "";
    let args: InvokeArgs | null = null;
    const rpcFetch = createRpcFetch({
      nativeInvoke: async <T>(nextCommand: string, nextArgs: Record<string, unknown>) => {
        command = nextCommand;
        args = nextArgs as unknown as InvokeArgs;
        return nativeResponse({ responseData: "AA==" }) as T;
      },
    });

    const response = await rpcFetch(
      new Request(`${LOCAL_CORE_LITE_LIVE_URL}/querySmartContract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractIndex: 4, inputType: 1, inputSize: 0, requestData: "" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(command).toBe("local_rpc_request");
    expect(args).toEqual({
      url: `${LOCAL_CORE_LITE_LIVE_URL}/querySmartContract`,
      method: "POST",
      body: JSON.stringify({ contractIndex: 4, inputType: 1, inputSize: 0, requestData: "" }),
    });
  });

  test("normalizes all known core-lite shapes through @qubic.org/rpc custom fetch", async () => {
    const rpcFetch = createRpcFetch({
      nativeInvoke: async <T>(_command: string, rawArgs: Record<string, unknown>) => {
        const { url } = rawArgs as unknown as InvokeArgs;
        const pathname = new URL(url).pathname;
        const response = (() => {
          switch (pathname) {
            case "/live/v1/tick-info":
              return nativeResponse({
                tick: 4321,
                epoch: 12,
                initialTick: 4000,
                duration: 0,
                tickInfo: { tick: 4321 },
              });
            case "/query/v1/getLastProcessedTick":
              return nativeResponse({ tickNumber: 4321, epoch: 12, intervalInitialTick: 4000 });
            case "/query/v1/getProcessedTickIntervals":
              return nativeResponse([{ epoch: 12, firstTick: 4000, lastTick: 4321 }]);
            case "/query/v1/getTickData":
              return nativeResponse({ tickNumber: 4321, epoch: 12, transactionDigests: [] });
            case "/query/v1/getTransactionByHash":
              return nativeResponse({ tickNumber: 4321, sourceId: "A" });
            default:
              throw new Error(`unexpected path: ${pathname}`);
          }
        })();
        return response as T;
      },
    });
    const client = createQubicClient({
      liveBaseUrl: LOCAL_CORE_LITE_LIVE_URL,
      archiveBaseUrl: LOCAL_CORE_LITE_ARCHIVE_URL,
      fetch: rpcFetch,
    });

    const tickInfo = await client.live.getTickInfo();
    expect(tickInfo).toEqual({
      ok: true,
      value: { tick: 4321, epoch: 12, initialTick: 4000, duration: 0 },
    });

    const lastProcessed = await client.archive.getLastProcessedTick();
    expect(lastProcessed).toEqual({
      ok: true,
      value: {
        tickNumber: 4321,
        epoch: 12,
        intervalInitialTick: 4000,
        logTickNumber: 4321,
      },
    });

    const intervals = await client.archive.getProcessedTickIntervals();
    expect(intervals).toEqual({
      ok: true,
      value: [{ epoch: 12, firstTick: 4000, lastTick: 4321 }],
    });

    const tickData = await client.archive.getTickData(4321);
    expect(tickData).toEqual({
      ok: true,
      value: { tickNumber: 4321, epoch: 12, transactionDigests: [] },
    });

    const transaction = await client.archive.getTransactionByHash("a".repeat(60));
    expect(transaction).toEqual({ ok: true, value: { tickNumber: 4321, sourceId: "A" } });
  });

  test("does not rewrite non-success error payloads", async () => {
    const rpcFetch = createRpcFetch({
      nativeInvoke: async <T>() => nativeResponse({ code: 5, message: "Tick data not found" }, 404) as T,
    });
    const response = await rpcFetch(
      new Request(`${LOCAL_CORE_LITE_ARCHIVE_URL}/getTickData`, { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: 5, message: "Tick data not found" });
  });

  test("propagates AbortSignal cancellation while native work is in flight", async () => {
    const controller = new AbortController();
    const rpcFetch = createRpcFetch({
      nativeInvoke: <T>() => new Promise<T>(() => {}),
    });
    const pending = rpcFetch(
      new Request(`${LOCAL_CORE_LITE_LIVE_URL}/tick-info`, { signal: controller.signal }),
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  test("fetches and validates the exact local dev-kit network manifest", async () => {
    let command = "";
    let args: Record<string, unknown> | null = null;
    const instanceId = `qubic-local:${"a".repeat(64)}`;
    const manifest = await fetchLocalNetworkManifest({
      nativeInvoke: async <T>(nextCommand, nextArgs) => {
        command = nextCommand;
        args = nextArgs;
        return nativeResponse({ instanceId, network: "testnet" }) as T;
      },
    });

    expect(LOCAL_NETWORK_MANIFEST_URL).toBe("http://127.0.0.1:41842/network-manifest.json");
    expect(command).toBe("fetch_local_network_manifest");
    expect(args).toEqual({});
    expect(manifest).toEqual({ instanceId, network: "testnet" });
  });

  test("rejects unusable local network manifest responses", async () => {
    await expect(
      fetchLocalNetworkManifest({
        nativeInvoke: async <T>() => nativeResponse({ instanceId: "x" }, 503) as T,
      }),
    ).rejects.toThrow("HTTP 503");
    await expect(
      fetchLocalNetworkManifest({
        nativeInvoke: async <T>() =>
          ({ status: 200, body: "not-json", contentType: "application/json" }) as T,
      }),
    ).rejects.toThrow("not valid JSON");
    await expect(
      fetchLocalNetworkManifest({
        nativeInvoke: async <T>() => nativeResponse({ instanceId: "   " }) as T,
      }),
    ).rejects.toThrow("missing instanceId");
  });
});
