export const isEditableInputActive = (): boolean => {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  if (active.isContentEditable) return true;
  if (active.tagName === 'TEXTAREA') return true;
  if (active.tagName !== 'INPUT') return false;
  const type = (active as HTMLInputElement).type.toLowerCase();
  return ![
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit',
  ].includes(type);
};
