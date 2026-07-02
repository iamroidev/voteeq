import { useEffect } from 'react';

export async function readImageAsDataUrl(file) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Please choose a valid image file.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Photo must be under 5MB.');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read photo file.'));
    reader.readAsDataURL(file);
  });
}

export function getImageFileFromClipboardEvent(event) {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Listen for image paste (Ctrl+V) while active.
 * Skips paste when focus is in a text field unless ignoreInputs is false.
 */
export function useClipboardImagePaste({ active, onImage, ignoreInputs = true }) {
  useEffect(() => {
    if (!active || !onImage) return undefined;

    const handlePaste = (event) => {
      if (ignoreInputs && isEditableTarget(event.target)) return;

      const file = getImageFileFromClipboardEvent(event);
      if (!file) return;

      event.preventDefault();
      onImage(file);
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [active, onImage, ignoreInputs]);
}

export function handleClipboardImagePaste(event, onImage) {
  const file = getImageFileFromClipboardEvent(event);
  if (!file) return false;
  event.preventDefault();
  onImage(file);
  return true;
}
