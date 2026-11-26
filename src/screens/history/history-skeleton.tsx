import { Skeleton } from "@/components/skeleton";

/** Neutral row placeholders that match the two-line transaction layout. */
export function HistorySkeletonRows() {
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column" }}>
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            minHeight: 64,
            padding: "var(--space-3) var(--space-2)",
            margin: "0 calc(var(--space-2) * -1)",
          }}
        >
          <Skeleton width={40} height={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skeleton width={90} height={8} />
            <div style={{ height: 6 }} />
            <Skeleton width={150} height={6} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <Skeleton width={64} height={8} />
            <Skeleton width={80} height={6} />
          </div>
        </div>
      ))}
    </div>
  );
}
