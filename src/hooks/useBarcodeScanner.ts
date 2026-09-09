import { useEffect, useRef } from "react";

/**
 * Listens for USB / Bluetooth "keyboard-wedge" barcode scanners: a burst of very
 * fast keypresses terminated by Enter. A single shared buffer — this replaces the
 * two parallel buffers that used to run on the Billing screen.
 *
 * `onScan` receives the trimmed code. The listener stays out of the way while the
 * user is typing in a real field (the dedicated scan box has its own Enter
 * handler) and ignores modified keypresses.
 */
export function useBarcodeScanner(
  onScan: (code: string) => void,
  opts: { enabled?: boolean; minLength?: number; gapMs?: number } = {},
) {
  const { enabled = true, minLength = 3, gapMs = 80 } = opts;
  const buffer = useRef("");
  const lastTime = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // If the user is in a real field, let that field own the key (the POS scan
      // input has its own Enter handler).
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return;

      const now = Date.now();
      const fast = now - lastTime.current < gapMs;
      lastTime.current = now;

      if (e.key === "Enter") {
        const code = buffer.current.trim();
        buffer.current = "";
        if (code.length >= minLength) {
          // A real scan terminated — consume the Enter so it can't also trigger
          // form submit / "new record".
          e.preventDefault();
          e.stopImmediatePropagation();
          onScanRef.current(code);
        }
        return;
      }

      if (e.key.length === 1) {
        buffer.current = fast ? buffer.current + e.key : e.key;
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [enabled, minLength, gapMs]);
}
