import { FireIcon, UserGroupIcon } from "@/lib/icons";
import { ScreenHeader } from "@/components/screen-header";
import { IconButton } from "@/components/icon-button";
import { ShellWalletSwitcher } from "@/components/shell-wallet-switcher";

/** Send screen header with the cross-flow actions. */
export function SendHeader({
  onSendMany,
  onBurn,
}: {
  onSendMany: () => void;
  onBurn: () => void;
}) {
  return (
    <ScreenHeader
      leading={<ShellWalletSwitcher />}
      title="Send"
      action={
        <>
          <IconButton label="Send to many" onClick={onSendMany}>
            <UserGroupIcon size={20} aria-hidden="true" />
          </IconButton>
          <IconButton label="Burn QU" onClick={onBurn}>
            <FireIcon size={20} aria-hidden="true" />
          </IconButton>
        </>
      }
    />
  );
}
