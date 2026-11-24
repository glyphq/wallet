import { AsciiSkeleton } from "ascii-reveal";

/** Row-shaped ASCII placeholders that match the two-line transaction layout. */
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
          }}
        >
          <AsciiSkeleton
            as="div"
            variant="scan"
            rows={3}
            width={40}
            height={40}
            animate={false}
            seed={index + 1}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <AsciiSkeleton
              as="div"
              variant="scan"
              lines={1}
              widths={["55%"]}
              animate={false}
              seed={index + 11}
            />
            <div style={{ height: 6 }} />
            <AsciiSkeleton
              as="div"
              variant="scan"
              lines={1}
              widths={["82%"]}
              animate={false}
              seed={index + 21}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <AsciiSkeleton
              as="div"
              variant="scan"
              lines={1}
              widths={[64]}
              animate={false}
              seed={index + 31}
            />
            <AsciiSkeleton
              as="div"
              variant="scan"
              lines={1}
              widths={[40]}
              animate={false}
              seed={index + 41}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
