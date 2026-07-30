import { GLOBAL_SHORTCUTS, type Shortcut } from "@/hooks/useGlobalKeyboard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Keyboard } from "lucide-react";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono font-bold text-foreground shadow-[0_1px_0_1px_hsl(var(--border))]">
      {children}
    </kbd>
  );
}

function shortcutLabel(s: Shortcut) {
  const parts: string[] = [];
  if (s.ctrl) parts.push("Ctrl");
  if (s.alt) parts.push("Alt");
  if (s.shift) parts.push("Shift");
  parts.push(s.key);
  return parts;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsDialog({ open, onClose }: Props) {
  // Group shortcuts
  const groups = GLOBAL_SHORTCUTS.reduce<Record<string, Shortcut[]>>((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Keyboard className="w-5 h-5 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
          {Object.entries(groups).map(([group, shortcuts]) => (
            <div key={group}>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 pb-1 border-b border-border">
                {group}
              </div>
              <ul className="space-y-2">
                {shortcuts.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground flex-1">{s.description}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {shortcutLabel(s).map((part, pi) => (
                        <span key={pi} className="flex items-center gap-0.5">
                          {pi > 0 && <span className="text-muted-foreground text-[10px]">+</span>}
                          <Kbd>{part}</Kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">Tip</Badge>
          <p className="text-xs text-muted-foreground">
            Press <Kbd>?</Kbd> anywhere outside a text field to open/close this panel.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
