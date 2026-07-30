export interface DappInfo {
	name: string;
	origin: string;
	icon?: string;
}

export function RequestHeader({ dapp }: { dapp: DappInfo }) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
			<div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
				Unverified request from
			</div>
			<div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-section)", fontWeight: 500, color: "var(--color-text-display)" }}>
				{dapp.name || "Unknown app"}
			</div>
			<div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.05em", wordBreak: "break-all" }}>
				Claimed origin: {dapp.origin}
			</div>
			<div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
				Custom links cannot prove website identity. Confirm the request in the originating app before approving.
			</div>
		</div>
	);
}
