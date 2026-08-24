import { useState, useEffect } from "react";
import {
  useActiveShortcuts,
  saveShortcutKey,
  resetCustomShortcuts,
  type Shortcut,
} from "@/hooks/useGlobalKeyboard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Keyboard, Search, Edit2, RotateCcw, Check, X } from "lucide-react";
import { toast } from "sonner";

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
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<{
    key: string;
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
  } | null>(null);

  const activeShortcuts = useActiveShortcuts();

  // Listen for key combinations during recording mode
  useEffect(() => {
    if (!editingId) return;

    function handleKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();

      const ignoredKeys = ["Control", "Alt", "Shift", "Meta"];
      if (ignoredKeys.includes(e.key)) {
        return;
      }

      let keyStr = e.key;
      if (keyStr === " ") keyStr = "Space";
      if (keyStr.length === 1) keyStr = keyStr.toUpperCase();

      setRecordedKeys({
        key: keyStr,
        ctrl: e.ctrlKey || e.metaKey,
        alt: e.altKey,
        shift: e.shiftKey,
      });
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [editingId]);

  const handleSaveRecorded = (shortcutId: string) => {
    if (!recordedKeys) return;
    saveShortcutKey(shortcutId, recordedKeys);
    toast.success("Shortcut key updated successfully!");
    setEditingId(null);
    setRecordedKeys(null);
  };

  const handleResetDefaults = () => {
    resetCustomShortcuts();
    toast.success("All shortcuts reset to defaults!");
    setEditingId(null);
    setRecordedKeys(null);
  };

  const filteredShortcuts = activeShortcuts.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.description.toLowerCase().includes(q) ||
      s.group.toLowerCase().includes(q) ||
      s.key.toLowerCase().includes(q)
    );
  });

  // Group shortcuts
  const groups = filteredShortcuts.reduce<Record<string, Shortcut[]>>((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-2 border-b border-border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Keyboard className="w-5 h-5 text-primary" />
              Keyboard Shortcuts &amp; Key Customizer
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              className="text-xs gap-1.5 h-8 text-muted-foreground hover:text-foreground"
              title="Reset all shortcuts to factory defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search shortcuts by key, name, or page..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </DialogHeader>

        {Object.keys(groups).length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No keyboard shortcuts found matching &quot;{search}&quot;.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
            {Object.entries(groups).map(([group, shortcuts]) => (
              <div key={group} className="space-y-2">
                <div className="text-[11px] uppercase tracking-widest text-primary font-bold pb-1 border-b border-border/60 flex items-center justify-between">
                  <span>{group}</span>
                </div>
                <ul className="space-y-2">
                  {shortcuts.map((s) => {
                    const isEditing = editingId === s.id;

                    return (
                      <li
                        key={s.id}
                        className={`flex flex-col p-2 rounded-lg transition-all border ${
                          isEditing
                            ? "bg-primary/10 border-primary shadow-sm"
                            : "bg-muted/30 border-transparent hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-foreground font-medium flex-1 truncate" title={s.description}>
                            {s.description}
                          </span>

                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 px-2 text-[11px] gap-1"
                                disabled={!recordedKeys}
                                onClick={() => handleSaveRecorded(s.id)}
                              >
                                <Check className="w-3 h-3" /> Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  setEditingId(null);
                                  setRecordedKeys(null);
                                }}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="flex items-center gap-1">
                                {shortcutLabel(s).map((part, pi) => (
                                  <span key={pi} className="flex items-center gap-0.5">
                                    {pi > 0 && <span className="text-muted-foreground text-[10px]">+</span>}
                                    <Kbd>{part}</Kbd>
                                  </span>
                                ))}
                              </span>

                              <button
                                onClick={() => {
                                  setEditingId(s.id);
                                  setRecordedKeys(null);
                                }}
                                className="p-1 text-muted-foreground hover:text-primary rounded hover:bg-background transition-colors"
                                title="Edit key binding"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Interactive Recorder Box */}
                        {isEditing && (
                          <div className="mt-2 p-2 rounded-md bg-background border border-primary/40 text-center">
                            <p className="text-[11px] text-muted-foreground font-medium mb-1">
                              Press key combo on keyboard (e.g. <Kbd>F2</Kbd>, <Kbd>B</Kbd>, <Kbd>Ctrl</Kbd>+<Kbd>B</Kbd>):
                            </p>
                            <div className="py-1">
                              {recordedKeys ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                                  {recordedKeys.ctrl && <Kbd>Ctrl</Kbd>}
                                  {recordedKeys.alt && <Kbd>Alt</Kbd>}
                                  {recordedKeys.shift && <Kbd>Shift</Kbd>}
                                  <Kbd>{recordedKeys.key}</Kbd>
                                </span>
                              ) : (
                                <span className="text-xs text-amber-500 animate-pulse font-semibold">
                                  Listening for keypress...
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">Easy Update</Badge>
            <p className="text-xs text-muted-foreground">
              Click <Edit2 className="w-3 h-3 inline mx-0.5" /> next to any shortcut to change its key binding to single keys like <Kbd>F2</Kbd>, <Kbd>F3</Kbd>, <Kbd>B</Kbd>, etc.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
