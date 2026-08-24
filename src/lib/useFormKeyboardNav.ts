import { useCallback } from "react";

// Fields/controls that make sense to stop on when tabbing through a form with Enter.
// Buttons are deliberately excluded: landing focus on e.g. a row's delete icon and
// having a second Enter press activate it would be destructive.
const FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[role="combobox"]:not([disabled])',
].join(", ");

function isVisible(el: HTMLElement) {
  return el.offsetParent !== null || el.getClientRects().length > 0;
}

/**
 * Wires up POS-style keyboard navigation for a form or dialog body:
 * - Enter OR ArrowDown moves focus to the NEXT field.
 * - ArrowUp moves focus to the PREVIOUS field.
 * - Enter on a closed Select trigger confirms and moves on;
 *   Enter while the dropdown is open is left to Radix.
 * - Ctrl+Enter or Alt+S triggers `onSave`.
 * Esc-closes-dialog is Radix's default behavior and needs no wiring here.
 *
 * Attach the returned handler to a `<form>` or the `DialogContent` wrapper.
 */
export function useFormKeyboardNav(onSave?: () => void) {
  return useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const target = e.target as HTMLElement;
      const container = e.currentTarget;

      // Ignore events from nested portaled dialogs
      if (!container.contains(target)) return;

      const isSaveShortcut = (e.ctrlKey && e.key === "Enter") || (e.altKey && e.key.toLowerCase() === "s");
      if (isSaveShortcut) {
        e.preventDefault();
        e.stopPropagation();
        onSave?.();
        return;
      }

      const isEnter = e.key === "Enter";
      const isArrowDown = e.key === "ArrowDown";
      const isArrowUp = e.key === "ArrowUp";

      if (!isEnter && !isArrowDown && !isArrowUp) return;

      const tag = target.tagName;

      // Textarea: allow newlines on Enter, but ArrowDown/Up still moves
      if (tag === "TEXTAREA" && isEnter) return;

      // Button: let Enter activate normally
      if (tag === "BUTTON" && isEnter) return;

      // Radix select open: let Radix handle option selection
      if (target.getAttribute("role") === "option") return;
      if (
        target.getAttribute("role") === "combobox" &&
        target.getAttribute("aria-expanded") === "true" &&
        isEnter
      ) return;

      // For a number/text input, ArrowDown/Up would normally change value — allow that
      // only if it would have no effect (i.e. not a number input). For number inputs
      // we skip the navigation to keep natural browser behaviour.
      if ((isArrowDown || isArrowUp) && tag === "INPUT" && (target as HTMLInputElement).type === "number") return;

      e.preventDefault();
      e.stopPropagation();

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(isVisible);
      const idx = focusable.indexOf(target);
      if (idx === -1) return;

      const next = isArrowUp
        ? focusable[idx - 1]
        : focusable[idx + 1];

      if (!next) {
        if (isEnter && !isArrowUp) {
          onSave?.();
        }
        return;
      }
      next.focus();
      if (next instanceof HTMLInputElement) next.select();
    },
    [onSave],
  );
}
