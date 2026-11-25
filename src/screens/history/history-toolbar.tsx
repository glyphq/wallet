import { openUrl } from "@tauri-apps/plugin-opener";
import { Compass01Icon } from "@/lib/icons";
import { ScreenHeader } from "@/components/screen-header";
import { IconButton } from "@/components/icon-button";
import { ShellAccountSwitcher } from "@/components/shell-account-switcher";

export function HistoryToolbar({ identity }: { identity: string | null }) {
  const explorerUrl = identity ? `https://explorer.glyphq.org/accounts/${identity}` : null;

  return (
    <ScreenHeader
      leading={<ShellAccountSwitcher />}
      title="History"
      action={(
        <IconButton
          framed
          label="Open account in Glyph Explorer"
          disabled={!explorerUrl}
          onClick={() => {
            if (explorerUrl) void openUrl(explorerUrl);
          }}
        >
          <Compass01Icon size={20} aria-hidden="true" />
        </IconButton>
      )}
    />
  );
}
