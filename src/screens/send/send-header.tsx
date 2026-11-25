import { UserGroupIcon } from "@/lib/icons";
import { ScreenHeader } from "@/components/screen-header";
import { IconButton } from "@/components/icon-button";
import { ShellAccountSwitcher } from "@/components/shell-account-switcher";

/** Send screen header with the cross-flow actions. */
export function SendHeader({ onSendMany }: { onSendMany: () => void }) {
  return (
    <ScreenHeader
      leading={<ShellAccountSwitcher />}
      title="Send"
      action={
        <>
          <IconButton label="Send to many" onClick={onSendMany}>
            <UserGroupIcon size={20} aria-hidden="true" />
          </IconButton>
        </>
      }
    />
  );
}
