import { describe, expect, test } from "bun:test";
import {
  LOCAL_TESTNET_LIVE_API_URL,
  LOCAL_TESTNET_QUERY_API_URL,
  localTestnetNetworkScope,
} from "@/lib/network-config";
import { LOCAL_NETWORK_MANIFEST_URL, type LocalNetworkManifest } from "@/lib/rpc-transport";
import {
  INITIAL_LOCAL_READINESS_STATE,
  abortableSleep,
  reduceLocalReadinessState,
  validateLocalNetworkManifest,
  verifyLocalNetworkReadiness,
} from "./local-testnet-readiness";

const INSTANCE_ID = `qubic-local:${"a".repeat(64)}`;

function manifest(overrides: Record<string, unknown> = {}): LocalNetworkManifest {
  return {
    schemaVersion: 1,
    kind: "qubic-local-network",
    network: "qubic:local",
    name: "Qubic Local Testnet",
    instanceId: INSTANCE_ID,
    manifestUrl: LOCAL_NETWORK_MANIFEST_URL,
    endpoints: {
      live: LOCAL_TESTNET_LIVE_API_URL,
      query: LOCAL_TESTNET_QUERY_API_URL,
    },
    ...overrides,
  };
}

describe("local testnet manifest validation", () => {
  test("resolves only the exact dev-kit contract to a wipe-sensitive canonical config", () => {
    const result = validateLocalNetworkManifest(manifest());

    expect(result.config).toEqual({
      name: "testnet",
      liveApiUrl: LOCAL_TESTNET_LIVE_API_URL,
      queryApiUrl: LOCAL_TESTNET_QUERY_API_URL,
      manifestInstanceId: INSTANCE_ID,
      scope: localTestnetNetworkScope(INSTANCE_ID),
    });
  });

  test("fails closed when identity, schema, or canonical endpoints diverge", () => {
    expect(() => validateLocalNetworkManifest(manifest({ schemaVersion: 2 }))).toThrow(
      "schemaVersion",
    );
    expect(() =>
      validateLocalNetworkManifest(manifest({ instanceId: `qubic-local:${"A".repeat(64)}` })),
    ).toThrow("instanceId is invalid");
    expect(() =>
      validateLocalNetworkManifest(
        manifest({
          endpoints: {
            live: "http://localhost:41841/live/v1",
            query: LOCAL_TESTNET_QUERY_API_URL,
          },
        }),
      ),
    ).toThrow("manifest live");
  });
});

describe("local testnet readiness", () => {
  test("honors pre-aborted signals without starting an RPC probe", async () => {
    const controller = new AbortController();
    const reason = new Error("cancelled before start");
    controller.abort(reason);
    let calls = 0;

    await expect(
      verifyLocalNetworkReadiness(
        {
          readLiveTick: async () => { calls += 1; return 100; },
          readQueryTick: async () => { calls += 1; return 99; },
        },
        { signal: controller.signal },
      ),
    ).rejects.toBe(reason);
    expect(calls).toBe(0);
  });

  test("abortable sleep removes its listener after normal resolution", async () => {
    const controller = new AbortController();
    const signal = controller.signal;
    const originalAdd = signal.addEventListener.bind(signal);
    const originalRemove = signal.removeEventListener.bind(signal);
    let adds = 0;
    let removes = 0;
    signal.addEventListener = ((...args: Parameters<AbortSignal["addEventListener"]>) => {
      adds += 1;
      return originalAdd(...args);
    }) as AbortSignal["addEventListener"];
    signal.removeEventListener = ((...args: Parameters<AbortSignal["removeEventListener"]>) => {
      removes += 1;
      return originalRemove(...args);
    }) as AbortSignal["removeEventListener"];

    await abortableSleep(0, signal);

    expect(adds).toBe(1);
    expect(removes).toBe(1);
  });

  test("probes live and query, then proves live progress using one RPC snapshot", async () => {
    const liveTicks = [100, 100, 101];
    const queryTicks = [98, 99];
    let now = 0;
    const capabilities: string[] = [];

    const result = await verifyLocalNetworkReadiness(
      {
        readLiveTick: async () => liveTicks.shift(),
        readQueryTick: async () => queryTicks.shift(),
      },
      {
        timeoutMs: 50,
        pollIntervalMs: 10,
        now: () => now,
        sleep: async (milliseconds) => { now += milliseconds; },
        onCapability: (capability) => capabilities.push(capability),
      },
    );

    expect(result).toEqual({ initialLiveTick: 100, liveTick: 101, queryTick: 99 });
    expect(capabilities).toEqual(["live", "query", "progress"]);
  });

  test("rejects invalid query ticks and backwards live progress", async () => {
    await expect(
      verifyLocalNetworkReadiness(
        {
          readLiveTick: async () => 100,
          readQueryTick: async () => "100",
        },
        { timeoutMs: 10, sleep: async () => undefined },
      ),
    ).rejects.toThrow("query endpoint returned an invalid tick");

    let now = 0;
    const liveTicks = [100, 99];
    await expect(
      verifyLocalNetworkReadiness(
        {
          readLiveTick: async () => liveTicks.shift(),
          readQueryTick: async () => 98,
        },
        {
          timeoutMs: 10,
          pollIntervalMs: 1,
          now: () => now,
          sleep: async (milliseconds) => { now += milliseconds; },
        },
      ),
    ).rejects.toThrow("moved backwards");
  });

  test("stops at the deterministic deadline when the live tick stalls", async () => {
    let now = 0;
    await expect(
      verifyLocalNetworkReadiness(
        {
          readLiveTick: async () => 100,
          readQueryTick: async () => 99,
        },
        {
          timeoutMs: 5,
          pollIntervalMs: 2,
          now: () => now,
          sleep: async (milliseconds) => { now += milliseconds; },
        },
      ),
    ).rejects.toThrow("did not advance within 1 seconds");
  });
});

describe("local readiness state transitions", () => {
  test("retains passed capabilities on failure and resets before a retry", () => {
    let state = reduceLocalReadinessState(INITIAL_LOCAL_READINESS_STATE, { type: "start" });
    state = reduceLocalReadinessState(state, {
      type: "capability",
      capability: "manifest",
      instanceId: INSTANCE_ID,
    });
    state = reduceLocalReadinessState(state, { type: "capability", capability: "live", tick: 100 });
    state = reduceLocalReadinessState(state, { type: "error", message: "query failed" });

    expect(state).toMatchObject({
      phase: "error",
      completed: ["manifest", "live"],
      instanceId: INSTANCE_ID,
      initialLiveTick: 100,
      error: "query failed",
    });
    expect(reduceLocalReadinessState(state, { type: "reset" })).toEqual(
      INITIAL_LOCAL_READINESS_STATE,
    );
  });

  test("reaches ready only after progress is recorded", () => {
    let state = reduceLocalReadinessState(INITIAL_LOCAL_READINESS_STATE, { type: "start" });
    for (const capability of ["manifest", "live", "query"] as const) {
      state = reduceLocalReadinessState(state, { type: "capability", capability, tick: 101 });
    }
    state = reduceLocalReadinessState(state, { type: "ready" });
    expect(state.phase).toBe("checking");

    state = reduceLocalReadinessState(state, { type: "capability", capability: "progress", tick: 101 });
    state = reduceLocalReadinessState(state, { type: "ready" });

    expect(state.phase).toBe("ready");
    expect(state.completed).toEqual(["manifest", "live", "query", "progress"]);
    expect(state.liveTick).toBe(101);
  });
});
