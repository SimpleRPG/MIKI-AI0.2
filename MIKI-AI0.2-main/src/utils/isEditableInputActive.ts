/**
 * Checks if an editable input (input, textarea, select, contenteditable) currently has focus.
 * Used to suppress global keyboard shortcuts while the user is typing.
 */
export function isEditableInputActive(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;
  const tagName = active.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
  if ((active as HTMLElement).isContentEditable) return true;
  return false;
}
