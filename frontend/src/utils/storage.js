export function readStoredAuth(key) {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}
