export interface DisplayNetworkConfig {
  name: "mainnet" | "testnet" | "custom";
  manifestInstanceId?: string | null;
}

const UNRESOLVED_LOCAL_INSTANCE = "manifest-unresolved";

export interface NetworkIndicator {
  label: string;
  detail: string;
  tone: "testnet" | "custom";
}

export function networkIndicator(network: DisplayNetworkConfig): NetworkIndicator | null {
  if (network.name === "mainnet") return null;

  if (network.name === "testnet") {
    const instanceId = network.manifestInstanceId?.trim();
    const suffix = instanceId && instanceId !== UNRESOLVED_LOCAL_INSTANCE
      ? ` · ${instanceId.slice(0, 8)}`
      : "";
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
