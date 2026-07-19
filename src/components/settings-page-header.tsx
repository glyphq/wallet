import { useNavigate } from "react-router-dom";
import { ScreenHeader } from "@/components/screen-header";

/**
 * Inline header for settings subpages.
 * The slot-based header is hidden for /settings/* routes by showChrome,
 * so each subpage renders its own header inline.
 */
export function SettingsPageHeader({ title, backTo = "/settings" }: { title: string; backTo?: string }) {
  const navigate = useNavigate();
  return <ScreenHeader title={title} onBack={() => navigate(backTo)} backAriaLabel={backTo === "/settings" ? "Back to settings" : "Go back"} />;
}
