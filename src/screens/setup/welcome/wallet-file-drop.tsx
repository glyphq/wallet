import { useEffect, useState, type DragEvent } from "react";
import { FolderOpenIcon, MoneyReceive01Icon } from "@/lib/icons";
import type { WalletFileImport } from "./use-wallet-file-import";

/** Drag-and-drop target for wallet backup files, with click and keyboard fallbacks. */
export function WalletFileDrop({ flow }: { flow: WalletFileImport }) {
  const [dragging, setDragging] = useState(false);
  const DropIcon = dragging ? MoneyReceive01Icon : FolderOpenIcon;

  useEffect(() => {
    const ignoreOutside = (event: globalThis.DragEvent) => event.preventDefault();
    window.addEventListener("dragover", ignoreOutside);
    window.addEventListener("drop", ignoreOutside);
    return () => {
      window.removeEventListener("dragover", ignoreOutside);
      window.removeEventListener("drop", ignoreOutside);
    };
  }, []);

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files.item(0);
    if (file) void flow.importFile(file);
  }

  return (
    <button
      type="button"
      className="wallet-dropzone corner-frame"
      data-drag={dragging ? "true" : "false"}
      onClick={() => flow.openFilePicker()}
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
      aria-label="Import wallet backup. Drop a Glyph wallet backup here, or activate to browse."
    >
      <DropIcon className="wallet-dropzone-icon" size={28} strokeWidth={1.4} aria-hidden="true" />
      <span className="wallet-dropzone-title">{dragging ? "Release to import" : "Drop wallet backup here"}</span>
      <span className="wallet-dropzone-hint">{dragging ? "Wallet backup · .json" : "or click to browse · .json"}</span>
    </button>
  );
}
