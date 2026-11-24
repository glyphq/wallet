import { useEffect, useRef, useState, type DragEvent } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { FolderOpenIcon } from "@/lib/icons";
import type { VaultFileImport } from "./use-vault-file-import";

function containsPoint(element: HTMLElement, x: number, y: number) {
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** Drag-and-drop target for Vault export files, with click and keyboard fallbacks. */
export function VaultFileDrop({ flow }: { flow: VaultFileImport }) {
  const zoneRef = useRef<HTMLButtonElement>(null);
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        if (payload.type === "leave") {
          setDragging(false);
          return;
        }

        const zone = zoneRef.current;
        if (!zone) return;

        const scale = window.devicePixelRatio || 1;
        const inside = containsPoint(zone, payload.position.x / scale, payload.position.y / scale);
        setDragging(inside);

        if (payload.type === "drop" && inside) {
          const path = payload.paths[0];
          if (path) void flowRef.current.importPath(path);
        }
      })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch(() => {
        // Native drag events are unavailable; the DOM handlers below still work.
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files.item(0);
    if (file) void flowRef.current.importFile(file);
  }

  return (
    <button
      ref={zoneRef}
      type="button"
      className="vault-dropzone corner-frame"
      data-drag={dragging ? "true" : "false"}
      onClick={() => flowRef.current.openFilePicker()}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={handleDrop}
      aria-label="Import Vault file. Drop a Glyph Vault export here, or activate to browse."
    >
      <FolderOpenIcon className="vault-dropzone-icon" size={28} strokeWidth={1.4} aria-hidden="true" />
      <span className="vault-dropzone-title">Drop Vault file here</span>
      <span className="vault-dropzone-hint">or click to browse · .json</span>
    </button>
  );
}
