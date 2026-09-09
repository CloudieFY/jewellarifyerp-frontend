/**
 * Shared keyboard-navigation core.
 *
 * One implementation of Up / Down / Left / Right / Enter field movement, used by:
 *   - the global handler            (hooks/useGlobalKeyboard.ts -> handleGridArrowNav)
 *   - the per-dialog form hook      (lib/useFormKeyboardNav.ts)
 *   - inline grid onKeyDown props   (routes/billing.tsx, routes/orders.tsx)
 *
 * Behaviour (agreed with product):
 *   Down / plain Enter  -> next field  (row-wise inside a <td> grid, else next control)
 *   Up                  -> previous field / cell directly above
 *   Right               -> next field ONLY when the text caret is at the end
 *   Left                -> previous field ONLY when the text caret is at position 0
 *   Enter past the last field -> onSave()
 *   <select> / number input keep native Up/Down (option cycle / step) unless Alt is held.
 */

const FIELD_SELECTOR = [
  'input:not([type="hidden"]):not([disabled])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[role="combobox"]:not([aria-disabled="true"])',
].join(", ");

type NavKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Enter";
type AnyKeyEvent = KeyboardEvent | React.KeyboardEvent<HTMLElement>;

interface MoveOpts {
  /** Called when Enter is pressed on the last field. */
  onSave?: () => void;
  /** Restrict navigation to this subtree (the form hook passes its container). */
  scope?: HTMLElement | null;
  /** When true and no form/table/dialog ancestor exists, do nothing. */
  requireScope?: boolean;
}

function isVisible(el: HTMLElement): boolean {
  return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
}

export function getFocusables(scope: ParentNode): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).filter(
    (el) => el.tabIndex !== -1 && isVisible(el),
  );
}

/** Read the caret position without throwing on input types that don't support selection. */
function caret(input: HTMLInputElement): { start: number; len: number } | null {
  try {
    return { start: input.selectionStart ?? 0, len: input.value?.length ?? 0 };
  } catch {
    return null;
  }
}

function selectText(el: HTMLElement) {
  if (el.tagName !== "INPUT") return;
  const type = (el as HTMLInputElement).type?.toLowerCase();
  if (type === "checkbox" || type === "radio" || type === "button" || type === "submit" || type === "reset") return;
  try {
    (el as HTMLInputElement).select();
  } catch {
    /* some input types don't support select() */
  }
}

/** Input in the cell directly above/below `target` in the same table column. */
function cellNeighbour(target: HTMLElement, dir: 1 | -1): HTMLElement | null {
  const cell = target.closest("td, th");
  const row = target.closest("tr");
  if (!cell || !row) return null;
  const colIndex = Array.from(row.children).indexOf(cell);
  const sibling = dir === 1 ? row.nextElementSibling : row.previousElementSibling;
  const nextCell = sibling?.children[colIndex] as HTMLElement | undefined;
  const input = nextCell?.querySelector<HTMLElement>("input, select, textarea");
  return input && input.tabIndex !== -1 && isVisible(input) ? input : null;
}

/**
 * Handle an arrow / Enter keydown as field navigation.
 * @returns true if focus was moved (and preventDefault called); false to let the
 *          browser handle the key (e.g. caret movement inside a text field).
 */
export function moveFocus(e: AnyKeyEvent, opts: MoveOpts = {}): boolean {
  const key = e.key as NavKey;
  if (key !== "ArrowUp" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Enter") {
    return false;
  }

  // A more specific handler (e.g. an inline "Enter adds a row" cell handler) already acted.
  if (e.defaultPrevented) return false;

  const target = e.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") return false;

  // A modified Enter (Ctrl / Alt / Shift / Meta) is a save/other chord, not navigation.
  if (key === "Enter" && (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) return false;

  // Leave open dropdowns / listboxes to their own keyboard handling.
  if (target.getAttribute("role") === "option") return false;
  if (
    target.getAttribute("aria-expanded") === "true" &&
    (key === "ArrowUp" || key === "ArrowDown" || key === "Enter")
  ) {
    return false;
  }

  const input = target as HTMLInputElement;
  const inputType = tag === "INPUT" ? (input.type || "text").toLowerCase() : "";
  const isNumber = inputType === "number";
  const isSelect = tag === "SELECT";
  const isTextarea = tag === "TEXTAREA";
  const isEditableInput = tag === "INPUT" && !["checkbox", "radio", "button", "submit", "reset", "file", "range", "color"].includes(inputType);

  // Textarea: Enter inserts a newline.
  if (isTextarea && key === "Enter") return false;

  // Keep native Up/Down for <select> option cycling and number stepping, unless Alt is held.
  if ((key === "ArrowUp" || key === "ArrowDown") && !e.altKey && (isSelect || isNumber)) return false;

  // Horizontal keys: only jump fields from the caret edge of an editable input.
  if (key === "ArrowRight" && isEditableInput) {
    const c = caret(input);
    if (c && c.start !== c.len) return false;
  }
  if (key === "ArrowLeft" && isEditableInput) {
    const c = caret(input);
    if (c && c.start !== 0) return false;
  }

  const scopeEl = opts.scope ?? target.closest("table, form, [role='dialog'], [data-kbd-scope]");
  if (!opts.scope && opts.requireScope && !scopeEl) return false;
  const scope: ParentNode = scopeEl ?? document.body;

  // Row-wise movement first when inside a data grid.
  if (key === "ArrowUp" || key === "ArrowDown") {
    const neighbour = cellNeighbour(target, key === "ArrowDown" ? 1 : -1);
    if (neighbour) {
      e.preventDefault();
      neighbour.focus();
      selectText(neighbour);
      return true;
    }
  }

  const fields = getFocusables(scope);
  const idx = fields.indexOf(target);
  if (idx === -1) return false;

  const forward = key === "ArrowDown" || key === "ArrowRight" || key === "Enter";
  const next = forward ? fields[idx + 1] : fields[idx - 1];

  if (!next) {
    if (key === "Enter" && forward && opts.onSave) {
      e.preventDefault();
      opts.onSave();
      return true;
    }
    return false;
  }

  e.preventDefault();
  next.focus();
  selectText(next);
  return true;
}
