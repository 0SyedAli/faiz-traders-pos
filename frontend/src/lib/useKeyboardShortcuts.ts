import { useEffect, useRef } from "react";

/** A single shortcut definition. */
export interface ShortcutDefinition {
  /** The primary key, e.g. "s", "Enter", "ArrowDown", "/" */
  key: string;
  /** Require Alt to be held */
  alt?: boolean;
  /** Require Ctrl to be held */
  ctrl?: boolean;
  /** Require Shift to be held */
  shift?: boolean;
  /**
   * When true, the shortcut fires even if the active element is an
   * <input> or <textarea>. Use this for Escape / Enter / Arrow keys
   * that must work inside the search field.
   *
   * NOTE: You do NOT need to set this for shortcuts that already use
   * `alt: true` or `ctrl: true` — those are automatically allowed inside
   * inputs because modifier+key combos don't produce typed characters and
   * should never be blocked (e.g. Alt+C for checkout while typing a price).
   */
  allowInInputs?: boolean;
  /** The callback to invoke when the shortcut matches. */
  handler: (event: KeyboardEvent) => void;
}

/**
 * useKeyboardShortcuts
 *
 * Registers a set of keyboard shortcuts on `window` for the lifetime of the
 * calling component. All shortcuts are torn down automatically on unmount.
 *
 * Input guard rules:
 * - Plain shortcuts (no Alt/Ctrl) are silently ignored when the focused
 *   element is an <input>, <textarea>, or [contenteditable] — UNLESS
 *   `allowInInputs: true` is set.
 * - Shortcuts with `alt: true` or `ctrl: true` ALWAYS fire, even inside
 *   inputs, because modifier+key combos never produce regular typed text.
 *   This ensures Alt+C (checkout), Alt+N (new sale), Alt+X (clear cart),
 *   Alt+ArrowDown/Up (navigate list) all work even when a cart price or
 *   quantity input is focused.
 * - `event.preventDefault()` is called for every matched shortcut so that
 *   browser defaults (e.g. Alt+S opening browser history) are suppressed.
 *
 * @example
 * useKeyboardShortcuts([
 *   { key: "s", alt: true, handler: () => searchRef.current?.focus() },
 *   { key: "Escape", allowInInputs: true, handler: () => setSearch("") },
 * ]);
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]): void {
  // Keep a stable ref so we never re-register the listener on re-render.
  const shortcutsRef = useRef<ShortcutDefinition[]>(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      for (const shortcut of shortcutsRef.current) {
        // ── Modifier + key matching ──────────────────────────────────────
        const altOk  = !!shortcut.alt  === event.altKey;
        const ctrlOk = !!shortcut.ctrl === event.ctrlKey;
        const shiftOk = !!shortcut.shift === event.shiftKey;
        const keyOk =
          event.key === shortcut.key ||
          event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (!altOk || !ctrlOk || !shiftOk || !keyOk) continue;

        // ── Input guard ──────────────────────────────────────────────────
        // Alt- or Ctrl-modified shortcuts bypass the guard automatically
        // because they never produce typed characters.
        const isModifiedShortcut = shortcut.alt || shortcut.ctrl;
        if (inInput && !shortcut.allowInInputs && !isModifiedShortcut) continue;

        event.preventDefault();
        shortcut.handler(event);
        break; // first match only
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // intentionally empty — shortcutsRef always stays fresh
}
