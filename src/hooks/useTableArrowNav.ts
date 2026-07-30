import { useCallback, useRef } from "react";

/**
 * Enables arrow-key navigation for data tables.
 *
 * Attach `onKeyDown` to each `<tr>` element, `tabIndex={0}` so rows are focusable.
 * When a row is focused:
 *   - ArrowDown  → focus next row
 *   - ArrowUp    → focus previous row
 *   - Enter / Space → fire `onSelect(index)`
 *   - Home       → focus first row
 *   - End        → focus last row
 *
 * Example:
 *   const { rowProps } = useTableArrowNav(rows, (i) => openDetail(rows[i]));
 *   <tr key={r.id} {...rowProps(i)} className="...">
 */
export function useTableArrowNav<T>(
  rows: T[],
  onSelect?: (index: number, row: T) => void
) {
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);

  const getFocusableRows = useCallback((): HTMLTableRowElement[] => {
    if (!tbodyRef.current) return [];
    return Array.from(
      tbodyRef.current.querySelectorAll<HTMLTableRowElement>("tr[tabindex]")
    );
  }, []);

  const rowProps = useCallback(
    (index: number) => ({
      tabIndex: 0,
      onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => {
        const allRows = getFocusableRows();
        const current = allRows.indexOf(e.currentTarget);
        if (current === -1) return;

        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            allRows[Math.min(current + 1, allRows.length - 1)]?.focus();
            break;
          case "ArrowUp":
            e.preventDefault();
            allRows[Math.max(current - 1, 0)]?.focus();
            break;
          case "Home":
            e.preventDefault();
            allRows[0]?.focus();
            break;
          case "End":
            e.preventDefault();
            allRows[allRows.length - 1]?.focus();
            break;
          case "Enter":
          case " ":
            e.preventDefault();
            onSelect?.(index, rows[index]);
            break;
          default:
            break;
        }
      },
    }),
    [rows, onSelect, getFocusableRows]
  );

  return { tbodyRef, rowProps };
}
