import { Compass01Icon } from "@/lib/icons";
import { explorerAccountUrl, openExplorer } from "@/lib/explorer";
import { ScreenHeader } from "@/components/screen-header";
import { IconButton } from "@/components/icon-button";
import { ShellAccountSwitcher } from "@/components/shell-account-switcher";

export function HistoryToolbar({ identity }: { identity: string | null }) {
  return (
    <ScreenHeader
      leading={<ShellAccountSwitcher />}
      title="History"
      action={(
        <IconButton
          framed
          label="Open account in Glyph Explorer"
          disabled={!identity}
          onClick={() => {
            if (identity) openExplorer(explorerAccountUrl(identity));
          }}
        >
          <Compass01Icon size={20} aria-hidden="true" />
        </IconButton>
      )}
    />
  );
}
