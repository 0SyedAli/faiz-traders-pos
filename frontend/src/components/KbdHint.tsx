import React from "react";

interface KbdHintProps {
  /** The key combination to display, e.g. "Alt+S", "/", "Esc" */
  keys: string;
  className?: string;
}

/**
 * KbdHint
 *
 * A tiny inline keyboard badge that communicates a hotkey to the cashier.
 * Renders a styled <kbd> element like: [Alt+C]
 *
 * @example
 * <button>
 *   Checkout <KbdHint keys="Alt+C" />
 * </button>
 */
export function KbdHint({ keys, className = "" }: KbdHintProps) {
  return (
    <kbd className={`kbd-hint ${className}`.trim()} aria-label={`Shortcut: ${keys}`}>
      {keys}
    </kbd>
  );
}
