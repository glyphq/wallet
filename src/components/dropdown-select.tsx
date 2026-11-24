import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FieldLabel } from "./field-parts";
import { ArrowDown01Icon, CheckmarkCircle01Icon } from "@/lib/icons";

export interface DropdownOption {
  value: string;
  label: string;
}

interface MenuPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

export function DropdownSelect({
  label,
  value,
  options,
  onChange,
  hint,
  disabled = false,
  id,
}: {
  label: string;
  value: string;
  options: readonly DropdownOption[];
  onChange: (value: string) => void;
  hint?: ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  const generatedId = useId();
  const selectId = id ?? `dropdown-${generatedId}`;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  function openMenu() {
    if (disabled || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 180);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(240, Math.max(120, (openUp ? spaceAbove : spaceBelow) - 16));

    setMenu({
      left,
      width,
      maxHeight,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    buttonRef.current?.focus();
  }

  const menuNode = open && menu
    ? createPortal(
        <>
          <div
            aria-hidden="true"
            onMouseDown={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 1000 }}
          />
          <div
            id={`${selectId}-menu`}
            role="listbox"
            aria-label={label}
            className="dropdown-menu"
            style={{
              position: "fixed",
              left: menu.left,
              width: menu.width,
              top: menu.top,
              bottom: menu.bottom,
              maxHeight: menu.maxHeight,
            }}
          >
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className="dropdown-option"
                  onClick={() => choose(option.value)}
                >
                  <span>{option.label}</span>
                  {active ? <CheckmarkCircle01Icon size={14} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 0 }}>
      <FieldLabel htmlFor={selectId}>{label}</FieldLabel>
      <div className="dropdown-trigger" data-disabled={disabled ? "true" : undefined}>
        <button
          ref={buttonRef}
          id={selectId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? `${selectId}-menu` : undefined}
          aria-describedby={hintId}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openMenu())}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
            width: "100%",
            minHeight: 48,
            padding: "0 var(--space-4)",
            border: 0,
            background: "transparent",
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono-sm)",
            letterSpacing: "0.04em",
            textAlign: "left",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selected?.label ?? "No options"}
          </span>
          <span aria-hidden="true" style={{ display: "flex", flexShrink: 0, color: "var(--color-text-tertiary)", transform: open ? "rotate(180deg)" : undefined, transition: "transform var(--duration-fast) var(--ease-out)" }}>
            <ArrowDown01Icon size={16} />
          </span>
        </button>
      </div>
      {hint ? (
        <span id={hintId} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.03em", overflowWrap: "anywhere" }}>
          {hint}
        </span>
      ) : null}
      {menuNode}
    </div>
  );
}
