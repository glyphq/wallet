import { ScreenHeader } from "@/components/screen-header";
import { ShellAccountSwitcher } from "@/components/shell-account-switcher";

/** Send screen header. */
export function SendHeader() {
  return <ScreenHeader leading={<ShellAccountSwitcher />} title="Send" />;
}
