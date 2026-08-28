import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserCodeReader, BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Camera, Gallery, QrCode } from "@solar-icons/react";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/button";

interface QrIntakeSheetProps {
  open: boolean;
  title?: string;
  errorMessage?: string;
  onClose: () => void;
  onScan: (payload: string) => void;
}

type CameraState = "idle" | "starting" | "active";

const helperText: React.CSSProperties = {
  margin: 0,
  color: "var(--color-text-secondary)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  lineHeight: 1.45,
};

const iconRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
};

function decodeErrorMessage(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "Camera permission was denied. You can still import a QR image.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No camera was found. Try importing a QR image.";
  if (name === "NotReadableError" || name === "TrackStartError") return "Camera is unavailable. Close other camera apps or import a QR image.";
  return "No QR code was found. Try a clearer image or better light.";
}

export function QrIntakeSheet({ open, title = "Scan QR", errorMessage = "", onClose, onScan }: QrIntakeSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reader = useMemo(() => new BrowserQRCodeReader(), []);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    BrowserCodeReader.releaseAllStreams();
    setCameraState("idle");
  }, []);

  const finishScan = useCallback((payload: string) => {
    stopCamera();
    setError("");
    onScan(payload);
  }, [onScan, stopCamera]);

  useEffect(() => {
    if (!open) stopCamera();
    return stopCamera;
  }, [open, stopCamera]);

  async function startCamera() {
    if (!videoRef.current || cameraState === "starting" || cameraState === "active") return;
    setError("");
    setCameraState("starting");
    try {
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        videoRef.current,
        (result) => {
          const text = result?.getText();
          if (text) finishScan(text);
        },
      );
      setCameraState("active");
    } catch (err) {
      setError(decodeErrorMessage(err));
      stopCamera();
    }
  }

  async function importImage(file: File) {
    setImporting(true);
    setError("");
    const objectUrl = URL.createObjectURL(file);
    try {
      const result = await reader.decodeFromImageUrl(objectUrl);
      finishScan(result.getText());
    } catch (err) {
      setError(decodeErrorMessage(err));
    } finally {
      URL.revokeObjectURL(objectUrl);
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) 0" }}>
          <div style={{ width: 54, height: 54, borderRadius: "var(--radius-pill)", border: "1px solid var(--color-border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-secondary)", background: "var(--color-bg-surface)" }}>
            <QrCode size={24} aria-hidden="true" />
          </div>
          <p style={{ ...helperText, textAlign: "center" }}>
            Scan with your camera or import an image. QR contents stay on this device.
          </p>
        </div>

        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="QR camera preview"
          style={{
            display: cameraState === "idle" ? "none" : "block",
            width: "100%",
            maxHeight: 260,
            objectFit: "cover",
            borderRadius: "var(--radius-card)",
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        />

        {(error || errorMessage) && (
          <div role="status" style={{ padding: "var(--space-3)", borderRadius: "var(--radius-card)", background: "var(--color-status-warning-soft)", color: "var(--color-status-warning)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", lineHeight: 1.45 }}>
            {error || errorMessage}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <Button variant={cameraState === "active" ? "ghost" : "secondary"} size="md" onClick={cameraState === "active" ? stopCamera : startCamera} loading={cameraState === "starting"}>
            <span style={iconRowStyle}>
              <Camera size={16} aria-hidden="true" />
              {cameraState === "active" ? "Stop" : "Camera"}
            </span>
          </Button>
          <Button variant="secondary" size="md" onClick={() => fileInputRef.current?.click()} loading={importing}>
            <span style={iconRowStyle}>
              <Gallery size={16} aria-hidden="true" />
              Image
            </span>
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void importImage(file);
          }}
        />

        <p style={helperText}>
          Camera access is requested only after tapping Camera. Imported images are decoded locally and are not uploaded.
        </p>
      </div>
    </Sheet>
  );
}
