export interface DisplayNetworkConfig {
  name: "mainnet" | "testnet" | "custom";
  manifestInstanceId?: string | null;
}

const LOCAL_INSTANCE_PATTERN = /^qubic-local:([0-9a-f]{64})$/u;

export interface NetworkIndicator {
  label: string;
  detail: string;
  tone: "testnet" | "custom";
}

export function networkIndicator(network: DisplayNetworkConfig): NetworkIndicator | null {
  if (network.name === "mainnet") return null;

  if (network.name === "testnet") {
    const instanceId = network.manifestInstanceId?.trim();
    const instanceHash = instanceId?.match(LOCAL_INSTANCE_PATTERN)?.[1];
    const suffix = instanceHash ? ` · ${instanceHash.slice(0, 8)}` : "";
    return {
      label: `LOCAL TESTNET${suffix}`,
      detail: "Local testnet funds have no real value",
      tone: "testnet",
    };
  }

  return {
    label: "CUSTOM NETWORK",
    detail: "Transactions use custom RPC endpoints",
    tone: "custom",
  };
}
