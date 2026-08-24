import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export type ShortcutScope = "global";

export interface Shortcut {
  id: string;
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  description: string;
  group: string;
  actionRoute?: string;
  actionType?: "route" | "help" | "commandPalette" | "newRecord" | "focusSearch";
}

/**
 * Master list of all global keyboard shortcuts across the application.
 * Function Keys (F1-F12) are single keypresses.
 * All Letter Shortcuts use Alt + Letter (Alt+B, Alt+S, Alt+P, etc.) to prevent typing interference in billing & forms.
 */
export const DEFAULT_SHORTCUTS: Shortcut[] = [
  // ── Single Function Key Actions (F1-F12: 1-Click Access) ──
  { id: "help", key: "F1", description: "Show / hide keyboard shortcuts help", group: "Function Keys (F1-F12)", actionType: "help" },
  { id: "new_bill", key: "F2", description: "Go to Billing / POS Page", group: "Function Keys (F1-F12)", actionRoute: "/billing", actionType: "route" },
  { id: "daily_ledger", key: "F3", description: "Go to Daily Ledger Page", group: "Function Keys (F1-F12)", actionRoute: "/ledger", actionType: "route" },
  { id: "purchases", key: "F4", description: "Go to Purchases Page", group: "Function Keys (F1-F12)", actionRoute: "/purchases", actionType: "route" },
  { id: "sales", key: "F5", description: "Go to Sales Invoices Register", group: "Function Keys (F1-F12)", actionRoute: "/sales", actionType: "route" },
  { id: "customers", key: "F6", description: "Go to Customers Page", group: "Function Keys (F1-F12)", actionRoute: "/customers", actionType: "route" },
  { id: "expenses", key: "F7", description: "Go to Expenses Page", group: "Function Keys (F1-F12)", actionRoute: "/expenses", actionType: "route" },
  { id: "reports", key: "F8", description: "Go to Reports Page", group: "Function Keys (F1-F12)", actionRoute: "/reports", actionType: "route" },
  { id: "girvi", key: "F9", description: "Go to Girvi Loans Page", group: "Function Keys (F1-F12)", actionRoute: "/girvi", actionType: "route" },
  { id: "repairs", key: "F10", description: "Go to Repairs Page", group: "Function Keys (F1-F12)", actionRoute: "/repairs", actionType: "route" },
  { id: "orders", key: "F11", description: "Go to Orders Page", group: "Function Keys (F1-F12)", actionRoute: "/orders", actionType: "route" },
  { id: "profile", key: "F12", description: "Go to Shop Profile & Settings", group: "Function Keys (F1-F12)", actionRoute: "/profile", actionType: "route" },

  // ── Command Search & Fast Controls ──
  { id: "cmd_palette", key: "k", ctrl: true, description: "Open Command Search", group: "Quick Launch", actionType: "commandPalette" },
  { id: "focus_search", key: "f", alt: true, description: "Focus search / filter input on page", group: "Quick Launch", actionType: "focusSearch" },
  { id: "new_record", key: "F2", description: "Open Add / New Form / New Bill on current page (F2 / Enter)", group: "Quick Launch", actionType: "newRecord" },

  // ── Alt + Letter Fast Navigation ──
  { id: "nav_billing", key: "b", alt: true, description: "Go to Billing / POS Page", group: "Alt + Letter Access", actionRoute: "/billing", actionType: "route" },
  { id: "nav_ledger", key: "l", alt: true, description: "Go to Daily Ledger Page", group: "Alt + Letter Access", actionRoute: "/ledger", actionType: "route" },
  { id: "nav_sales", key: "s", alt: true, description: "Go to Sales Invoices Register", group: "Alt + Letter Access", actionRoute: "/sales", actionType: "route" },
  { id: "nav_purchases", key: "p", alt: true, description: "Go to Purchases Page", group: "Alt + Letter Access", actionRoute: "/purchases", actionType: "route" },
  { id: "nav_customers", key: "c", alt: true, description: "Go to Customers Page", group: "Alt + Letter Access", actionRoute: "/customers", actionType: "route" },
  { id: "nav_expenses", key: "e", alt: true, description: "Go to Expenses Page", group: "Alt + Letter Access", actionRoute: "/expenses", actionType: "route" },
  { id: "nav_girvi", key: "g", alt: true, description: "Go to Girvi Loans Page", group: "Alt + Letter Access", actionRoute: "/girvi", actionType: "route" },
  { id: "nav_repairs", key: "r", alt: true, description: "Go to Repairs Page", group: "Alt + Letter Access", actionRoute: "/repairs", actionType: "route" },
  { id: "nav_orders", key: "o", alt: true, description: "Go to Orders Page", group: "Alt + Letter Access", actionRoute: "/orders", actionType: "route" },
  { id: "nav_inventory", key: "i", alt: true, description: "Go to Inventory / Products", group: "Alt + Letter Access", actionRoute: "/inventory", actionType: "route" },
  { id: "nav_dashboard", key: "d", alt: true, description: "Go to Dashboard", group: "Alt + Letter Access", actionRoute: "/dashboard", actionType: "route" },

  // ── Alt + Letter Register Access ──
  { id: "nav_dues", key: "u", alt: true, description: "Go to Customer Dues", group: "Registers & Reports", actionRoute: "/dues", actionType: "route" },
  { id: "nav_catalog", key: "t", alt: true, description: "Go to Product Catalog", group: "Registers & Reports", actionRoute: "/catalog", actionType: "route" },
  { id: "nav_suppliers", key: "v", alt: true, description: "Go to Suppliers Page", group: "Registers & Reports", actionRoute: "/suppliers", actionType: "route" },
  { id: "nav_employees", key: "m", alt: true, description: "Go to Employees Page", group: "Registers & Reports", actionRoute: "/employees", actionType: "route" },
  { id: "nav_karigars", key: "w", alt: true, description: "Go to Karigars Page", group: "Registers & Reports", actionRoute: "/karigars", actionType: "route" },
  { id: "nav_tasks", key: "j", alt: true, description: "Go to Karigar Job Tasks", group: "Registers & Reports", actionRoute: "/karigar-tasks", actionType: "route" },
  { id: "nav_gst", key: "x", alt: true, description: "Go to GST Report Register", group: "Registers & Reports", actionRoute: "/gst-report", actionType: "route" },
  { id: "nav_balance", key: "a", alt: true, description: "Go to Financial Balance Sheet", group: "Registers & Reports", actionRoute: "/balance-sheet", actionType: "route" },

  // ── Form Navigation & Controls ──
  { id: "form_save", key: "Enter", ctrl: true, description: "Save current form", group: "Form Navigation" },
  { id: "form_cancel", key: "Escape", description: "Close dialog / cancel form", group: "Form Navigation" },
];

export const GLOBAL_SHORTCUTS = DEFAULT_SHORTCUTS;

const STORAGE_KEY = "ajms_custom_shortcuts_v8";

/**
 * Get active shortcuts including user customizations from localStorage
 */
export function getCustomShortcuts(): Shortcut[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_SHORTCUTS;
    const parsed: Record<string, Partial<Shortcut>> = JSON.parse(saved);
    return DEFAULT_SHORTCUTS.map((item) => {
      if (parsed[item.id]) {
        return {
          ...item,
          key: parsed[item.id].key ?? item.key,
          ctrl: parsed[item.id].ctrl ?? item.ctrl,
          alt: parsed[item.id].alt ?? item.alt,
          shift: parsed[item.id].shift ?? item.shift,
        };
      }
      return item;
    });
  } catch {
    return DEFAULT_SHORTCUTS;
  }
}

/**
 * Save custom key binding for a specific shortcut ID
 */
export function saveShortcutKey(id: string, binding: { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean }) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed: Record<string, Partial<Shortcut>> = saved ? JSON.parse(saved) : {};
    parsed[id] = {
      key: binding.key,
      ctrl: !!binding.ctrl,
      alt: !!binding.alt,
      shift: !!binding.shift,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    window.dispatchEvent(new CustomEvent("ajms:shortcuts-updated"));
  } catch (e) {
    console.error("Failed to update shortcut key:", e);
  }
}

/**
 * Reset all customized shortcuts to defaults
 */
export function resetCustomShortcuts() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("ajms:shortcuts-updated"));
  } catch (e) {
    console.error("Failed to reset custom shortcuts:", e);
  }
}

/**
 * React Hook to subscribe to global shortcuts updates
 */
export function useActiveShortcuts(): Shortcut[] {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(getCustomShortcuts);

  useEffect(() => {
    const handleUpdate = () => {
      setShortcuts(getCustomShortcuts());
    };
    window.addEventListener("ajms:shortcuts-updated", handleUpdate);
    return () => window.removeEventListener("ajms:shortcuts-updated", handleUpdate);
  }, []);

  return shortcuts;
}

/**
 * Utility function to handle 4-way Arrow Navigation (ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Enter)
 * across any form or table grid input fields.
 */
export function handleGridArrowNav(e: React.KeyboardEvent<HTMLElement> | KeyboardEvent) {
  const target = e.target as HTMLElement;
  if (!target || (target.tagName !== "INPUT" && target.tagName !== "SELECT" && target.tagName !== "TEXTAREA")) {
    return;
  }

  const isSelect = target.tagName === "SELECT";
  const isInput = target.tagName === "INPUT";
  const inputEl = target as HTMLInputElement;

  // Helper to query all focusable inputs in container
  const getInputs = () => {
    const container = target.closest("table, form, [role='dialog']") || document.body;
    return Array.from(container.querySelectorAll<HTMLElement>("input, select, textarea")).filter(
      el => !el.hasAttribute("disabled") && el.tabIndex !== -1 && (el.offsetWidth > 0 || el.offsetHeight > 0)
    );
  };

  // ==========================================
  // 1. SELECT DROPDOWN SPECIFIC KEYBOARD RULES
  // ==========================================
  if (isSelect) {
    // ArrowUp / ArrowDown: Allow native dropdown option selection (e.g. Wt -> % -> Rs)
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.altKey && !e.ctrlKey) {
      return; // allow native select option cycling!
    }

    // ArrowRight or Enter or Tab: Move focus forward to next field!
    if (e.key === "ArrowRight" || (e.key === "Enter" && !e.shiftKey)) {
      e.preventDefault();
      const inputs = getInputs();
      const index = inputs.indexOf(target);
      if (index >= 0 && index < inputs.length - 1) {
        inputs[index + 1].focus();
        if (inputs[index + 1].tagName === "INPUT") (inputs[index + 1] as HTMLInputElement).select?.();
      }
      return;
    }

    // ArrowLeft or Shift+Tab: Move focus backward to previous field!
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const inputs = getInputs();
      const index = inputs.indexOf(target);
      if (index > 0) {
        inputs[index - 1].focus();
        if (inputs[index - 1].tagName === "INPUT") (inputs[index - 1] as HTMLInputElement).select?.();
      }
      return;
    }
  }

  // ==========================================
  // 2. INPUT TEXT / NUMBER KEYBOARD RULES
  // ==========================================

  // ArrowUp: move to input in row above
  if (e.key === "ArrowUp") {
    e.preventDefault();
    const tr = target.closest("tr");
    if (tr && tr.previousElementSibling) {
      const colIndex = Array.from(tr.children).indexOf(target.closest("td, th") as HTMLTableCellElement);
      const prevTr = tr.previousElementSibling;
      const prevTd = prevTr.children[colIndex];
      const prevInput = prevTd?.querySelector<HTMLElement>("input, select, textarea");
      if (prevInput) {
        prevInput.focus();
        if (prevInput.tagName === "INPUT") (prevInput as HTMLInputElement).select?.();
        return;
      }
    }

    const inputs = getInputs();
    const index = inputs.indexOf(target);
    if (index > 0) {
      inputs[index - 1].focus();
      if (inputs[index - 1].tagName === "INPUT") (inputs[index - 1] as HTMLInputElement).select?.();
    }
  }

  // ArrowDown or Enter: move to input in row below or next field
  else if (e.key === "ArrowDown" || (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey)) {
    e.preventDefault();
    const tr = target.closest("tr");
    if (tr && tr.nextElementSibling) {
      const colIndex = Array.from(tr.children).indexOf(target.closest("td, th") as HTMLTableCellElement);
      const nextTr = tr.nextElementSibling;
      const nextTd = nextTr.children[colIndex];
      const nextInput = nextTd?.querySelector<HTMLElement>("input, select, textarea");
      if (nextInput) {
        nextInput.focus();
        if (nextInput.tagName === "INPUT") (nextInput as HTMLInputElement).select?.();
        return;
      }
    }

    const inputs = getInputs();
    const index = inputs.indexOf(target);
    if (index >= 0 && index < inputs.length - 1) {
      inputs[index + 1].focus();
      if (inputs[index + 1].tagName === "INPUT") (inputs[index + 1] as HTMLInputElement).select?.();
    }
  }

  // ArrowRight: move to next field if cursor is at end of text
  else if (e.key === "ArrowRight") {
    if (isInput && (inputEl.type === "text" || inputEl.type === "search" || !inputEl.type) && inputEl.selectionStart !== inputEl.value.length) {
      return; // allow normal text cursor navigation inside text box
    }
    const inputs = getInputs();
    const index = inputs.indexOf(target);
    if (index >= 0 && index < inputs.length - 1) {
      e.preventDefault();
      inputs[index + 1].focus();
      if (inputs[index + 1].tagName === "INPUT") (inputs[index + 1] as HTMLInputElement).select?.();
    }
  }

  // ArrowLeft: move to previous field if cursor is at position 0
  else if (e.key === "ArrowLeft") {
    if (isInput && (inputEl.type === "text" || inputEl.type === "search" || !inputEl.type) && inputEl.selectionStart !== 0) {
      return; // allow normal text cursor navigation inside text box
    }
    const inputs = getInputs();
    const index = inputs.indexOf(target);
    if (index > 0) {
      e.preventDefault();
      inputs[index - 1].focus();
      if (inputs[index - 1].tagName === "INPUT") (inputs[index - 1] as HTMLInputElement).select?.();
    }
  }
}

export function useGlobalKeyboard(options: {
  onToggleHelp: () => void;
  onToggleCommandPalette?: () => void;
  onNewRecord?: () => void;
  onFocusSearch?: () => void;
}) {
  const navigate = useNavigate();
  const { onToggleHelp, onToggleCommandPalette, onNewRecord, onFocusSearch } = options;

  useEffect(() => {
    function isInputActive() {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT") {
        const type = (el as HTMLInputElement).type?.toLowerCase();
        if (type === "button" || type === "submit" || type === "reset" || type === "checkbox" || type === "radio") return false;
        return true;
      }
      if (tag === "TEXTAREA") return true;
      if (el.isContentEditable) return true;
      return false;
    }

    function handler(e: KeyboardEvent) {
      const activeShortcuts = getCustomShortcuts();
      const keyLower = e.key.toLowerCase();
      const isFunctionKey = /^F(1[0-2]|[1-9])$/i.test(e.key);

      // Handle Arrow key navigation inside form input fields
      if (isInputActive() && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Enter")) {
        handleGridArrowNav(e);
        return;
      }

      // Direct F2, Enter, or Alt+N trigger: On any page, open the page form / new bill
      if (
        e.key === "F2" ||
        (e.key === "Enter" && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) ||
        (e.key.toLowerCase() === "n" && e.altKey)
      ) {
        const isDialogOpen = !!document.querySelector('[role="dialog"]');
        const activeEl = document.activeElement as HTMLElement | null;
        const isTextarea = activeEl?.tagName === "TEXTAREA";
        const isButtonOrLink = activeEl?.tagName === "BUTTON" || activeEl?.tagName === "A";

        // For F2 or Alt+N, execute immediately even from inside text inputs
        if (e.key === "F2" || (e.key.toLowerCase() === "n" && e.altKey)) {
          e.preventDefault();
          onNewRecord?.();
          return;
        }

        // For plain Enter, execute when no dialog is open and not in multiline textarea / clickable button
        if (!isDialogOpen && !isTextarea && !isButtonOrLink) {
          e.preventDefault();
          onNewRecord?.();
          return;
        }
      }

      // Match shortcut against event
      for (const s of activeShortcuts) {
        const targetKeyLower = s.key.toLowerCase();
        const ctrlMatch = !!s.ctrl === (e.ctrlKey || e.metaKey);
        const altMatch = !!s.alt === e.altKey;
        const shiftMatch = !!s.shift === e.shiftKey;
        const keyMatch = keyLower === targetKeyLower;

        if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
          // If typing inside a text input field, ignore plain shortcuts without Alt/Ctrl
          if (isInputActive() && !isFunctionKey && !(s.ctrl && targetKeyLower === "k") && !s.alt) {
            continue;
          }

          e.preventDefault();

          if (s.actionType === "commandPalette") {
            onToggleCommandPalette?.();
            return;
          }
          if (s.actionType === "help") {
            onToggleHelp();
            return;
          }
          if (s.actionType === "focusSearch") {
            onFocusSearch?.();
            return;
          }
          if (s.actionType === "newRecord") {
            onNewRecord?.();
            return;
          }
          if (s.actionType === "route" && s.actionRoute) {
            // Smart Alt+I: Focus table input when inside any form page/modal, navigate to Inventory when outside
            if (s.id === "nav_inventory" || (s.alt && targetKeyLower === "i")) {
              const currentPath = window.location.pathname;
              const isFormPage = ["/billing", "/purchases", "/orders", "/repairs", "/girvi", "/expenses", "/catalog", "/suppliers", "/advances", "/karigars"].includes(currentPath);
              const isModalOpen = !!document.querySelector('[role="dialog"], form');
              
              const tableInput = document.querySelector(
                "#erp-item-table-container input, #erp-item-table-container select, [data-table-input='true'], table tbody input:not([type='hidden']), table tbody select, form table tbody input"
              ) as HTMLElement | null;

              if (isFormPage || isModalOpen || tableInput) {
                if (tableInput) {
                  e.preventDefault();
                  tableInput.focus();
                  if ("select" in tableInput && typeof (tableInput as any).select === "function") {
                    (tableInput as any).select();
                  }
                  return;
                }
              }
            }

            const targetPath = s.actionRoute.split("?")[0];
            if (window.location.pathname !== targetPath) {
              navigate(targetPath);
            }
            return;
          }
        }
      }

      // Fallback F1 / ? handler
      if (e.key === "F1" || (e.key === "?" && !e.ctrlKey && !e.altKey && !e.metaKey && !isInputActive())) {
        e.preventDefault();
        onToggleHelp();
        return;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, onToggleHelp, onToggleCommandPalette, onNewRecord, onFocusSearch]);
}
