import { useCallback } from "react";
import { moveFocus } from "@/lib/keyboardNav";

/**
 * POS-style keyboard navigation for a form or dialog body:
 *  - Enter / ArrowDown  -> next field
 *  - ArrowUp            -> previous field
 *  - ArrowLeft / Right  -> previous / next field, but only from the caret edge of a text field
 *  - Enter on the last field, or Ctrl+Enter / Alt+S anywhere -> onSave()
 *  - Textarea keeps Enter for newlines; open Radix selects keep their own keys.
 *
 * Attach the returned handler to a `<form>`, `DialogContent`, or wrapper `<div>`.
 * Navigation is scoped to that element's subtree.
 */
export function useFormKeyboardNav(onSave?: () => void) {
  return useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const container = e.currentTarget;
      const target = e.target as HTMLElement;

      // Ignore events bubbling up from nested portaled dialogs.
      if (!container.contains(target)) return;

      // Explicit save chords.
      if ((e.ctrlKey && e.key === "Enter") || (e.altKey && e.key.toLowerCase() === "s")) {
        e.preventDefault();
        e.stopPropagation();
        onSave?.();
        return;
      }

      if (moveFocus(e, { onSave, scope: container })) {
        e.stopPropagation();
      }
    },
    [onSave],
  );
}
