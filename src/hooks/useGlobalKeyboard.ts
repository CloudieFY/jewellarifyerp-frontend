import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export type ShortcutScope = "global";

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  description: string;
  group: string;
}

/**
 * Master list of all global keyboard shortcuts.
 * Shown in the help overlay (? key).
 */
export const GLOBAL_SHORTCUTS: Shortcut[] = [
  // Navigation
  { key: "1", alt: true, description: "Go to Dashboard",    group: "Navigation" },
  { key: "2", alt: true, description: "Go to Billing / POS", group: "Navigation" },
  { key: "3", alt: true, description: "Go to Sales (Invoices)", group: "Navigation" },
  { key: "4", alt: true, description: "Go to Customers",    group: "Navigation" },
  { key: "5", alt: true, description: "Go to Inventory",    group: "Navigation" },
  { key: "6", alt: true, description: "Go to Expenses",     group: "Navigation" },
  { key: "7", alt: true, description: "Go to Ledger",       group: "Navigation" },
  { key: "8", alt: true, description: "Go to Reports",      group: "Navigation" },
  { key: "9", alt: true, description: "Go to Repairs",      group: "Navigation" },
  { key: "0", alt: true, description: "Go to Orders",       group: "Navigation" },
  // Page actions (non-input, non-dialog context)
  { key: "n", description: "New record (opens Add dialog)", group: "Page Actions" },
  { key: "f", description: "Focus search / filter",         group: "Page Actions" },
  { key: "p", ctrl: true, description: "Print page",        group: "Page Actions" },
  // Forms
  { key: "Enter", ctrl: true, description: "Save current form", group: "Forms" },
  { key: "s", alt: true, description: "Save current form",       group: "Forms" },
  { key: "Escape", description: "Close dialog / cancel",          group: "Forms" },
  // Tables
  { key: "↑ / ↓", description: "Navigate table rows",             group: "Tables" },
  { key: "Enter",  description: "Open selected row",               group: "Tables" },
  { key: "Home",   description: "Jump to first row",               group: "Tables" },
  { key: "End",    description: "Jump to last row",                group: "Tables" },
  // Help
  { key: "?", description: "Show / hide keyboard shortcuts",       group: "Help" },
];

const ROUTE_MAP: Record<string, string> = {
  "1": "/dashboard",
  "2": "/billing",
  "3": "/sales",
  "4": "/customers",
  "5": "/inventory",
  "6": "/expenses",
  "7": "/ledger",
  "8": "/reports",
  "9": "/repairs",
  "0": "/orders",
};

/**
 * Global keyboard shortcuts hook.
 * Mount this ONCE at the App / Layout level.
 *
 * @param onToggleHelp — called when user presses "?" to open/close help overlay.
 * @param onNewRecord  — called when "n" pressed (not in an input/dialog).
 * @param onFocusSearch — called when "f" pressed.
 */
export function useGlobalKeyboard(options: {
  onToggleHelp: () => void;
  onNewRecord?: () => void;
  onFocusSearch?: () => void;
}) {
  const navigate = useNavigate();
  const { onToggleHelp, onNewRecord, onFocusSearch } = options;

  useEffect(() => {
    function isInputActive() {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      // Radix / custom combobox
      const role = el.getAttribute("role");
      if (role === "combobox" || role === "listbox" || role === "option") return true;
      // Inside an open dialog
      if (el.closest('[role="dialog"]')) return true;
      return false;
    }

    function handler(e: KeyboardEvent) {
      // Alt+digit → navigate
      if (e.altKey && !e.ctrlKey && !e.shiftKey && ROUTE_MAP[e.key]) {
        e.preventDefault();
        navigate(ROUTE_MAP[e.key]);
        return;
      }

      // ? → help overlay (works even in inputs for discoverability, hence checked first)
      if (e.key === "?" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (!isInputActive()) {
          e.preventDefault();
          onToggleHelp();
          return;
        }
      }

      // Everything below is suppressed while typing
      if (isInputActive()) return;

      if (e.key === "n" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onNewRecord?.();
        return;
      }

      if (e.key === "f" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onFocusSearch?.();
        return;
      }

      // Ctrl+P → print
      if (e.ctrlKey && e.key === "p") {
        // Let browser handle printing naturally — no override needed.
        return;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, onToggleHelp, onNewRecord, onFocusSearch]);
}
