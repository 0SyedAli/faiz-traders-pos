"use client";

import React, { useEffect } from "react";

interface ShortcutRow {
  keys: string[];
  description: string;
}

const SHORTCUT_GROUPS: { group: string; rows: ShortcutRow[] }[] = [
  {
    group: "Navigation (works from any page)",
    rows: [
      { keys: ["Alt", "N"],    description: "New Sale — go to POS & clear cart" },
      { keys: ["Alt", "H"],    description: "Open this keyboard shortcuts help" },
      { keys: ["?"],           description: "Open this keyboard shortcuts help" },
    ],
  },
  {
    group: "Search & Product List",
    rows: [
      { keys: ["Alt", "S"],    description: "Focus product search bar" },
      { keys: ["/"],           description: "Focus search (when not typing)" },
      { keys: ["Alt", "↓"],   description: "Select next product — works from anywhere" },
      { keys: ["Alt", "↑"],   description: "Select prev product — works from anywhere" },
      { keys: ["↓"],           description: "Select next product (search focused)" },
      { keys: ["↑"],           description: "Select prev product (search focused)" },
      { keys: ["Alt", "Enter"],"description": "Add highlighted product — works from anywhere" },
      { keys: ["Enter"],       description: "Add highlighted product (search focused)" },
      { keys: ["Esc"],         description: "Clear search query" },
    ],
  },
  {
    group: "Category Filter",
    rows: [
      { keys: ["Alt", "]"],   description: "Next category" },
      { keys: ["Alt", "["],   description: "Previous category" },
    ],
  },
  {
    group: "Cart Panel Fields",
    rows: [
      { keys: ["Alt", "U"],   description: "Focus Customer selector" },
      { keys: ["Alt", "M"],   description: "Focus Payment Method selector" },
      { keys: ["Alt", "T"],   description: "Focus Sale Type selector" },
      { keys: ["Alt", "D"],   description: "Focus Discount input" },
      { keys: ["Alt", "A"],   description: "Focus Paid Amount input" },
    ],
  },
  {
    group: "Cart Item Management",
    rows: [
      { keys: ["Alt", "PgDn"], description: "Select next cart item" },
      { keys: ["Alt", "PgUp"], description: "Select previous cart item" },
      { keys: ["Alt", "="],    description: "Increment selected item quantity" },
      { keys: ["Alt", "−"],    description: "Decrement qty (reaches 0 → removes)" },
      { keys: ["Alt", "Del"],  description: "Remove selected cart item" },
    ],
  },
  {
    group: "Checkout",
    rows: [
      { keys: ["Alt", "C"],   description: "Submit / Checkout current sale" },
      { keys: ["Alt", "X"],   description: "Clear entire cart" },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="shortcuts-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts help"
      onClick={onClose}
    >
      <div className="shortcuts-modal-dialog" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="shortcuts-modal-header">
          <div className="shortcuts-modal-title">
            <span className="shortcuts-modal-icon">⌨️</span>
            <div>
              <h2>Keyboard Shortcuts</h2>
              <p>Full keyboard control — no mouse needed</p>
            </div>
          </div>
          <button className="shortcuts-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div className="shortcuts-modal-body">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.group} className="shortcuts-group">
              <h3 className="shortcuts-group-title">{group.group}</h3>
              <div className="shortcuts-group-rows">
                {group.rows.map((row) => (
                  <div key={row.description} className="shortcuts-row">
                    <div className="shortcuts-keys">
                      {row.keys.map((key, i) => (
                        <React.Fragment key={key}>
                          <kbd className="shortcuts-kbd">{key}</kbd>
                          {i < row.keys.length - 1 && <span className="shortcuts-plus">+</span>}
                        </React.Fragment>
                      ))}
                    </div>
                    <span className="shortcuts-desc">{row.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="shortcuts-modal-footer">
          <span>Press <kbd className="shortcuts-kbd">?</kbd> or <kbd className="shortcuts-kbd">Alt+H</kbd> anytime to reopen</span>
        </div>

      </div>
    </div>
  );
}
