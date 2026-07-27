import { useEffect } from "react";
import { useNavigate } from "react-router";
import { ScreenHeader } from "@/components/screen-header";
import { useHeaderSlot } from "@/layouts/header-slot";

/**
 * Registers a fixed shell header for settings subpages.
 */
export function SettingsPageHeader({ title, backTo = "/settings" }: { title: string; backTo?: string }) {
  const navigate = useNavigate();
  const { setHeader } = useHeaderSlot();

  useEffect(() => {
    setHeader(
      <ScreenHeader
        title={title}
        onBack={() => navigate(backTo)}
        backAriaLabel={backTo === "/settings" ? "Back to settings" : "Go back"}
      />,
    );
    return () => setHeader(null);
  }, [backTo, navigate, setHeader, title]);

  return null;
}
