export const COLOR_THEMES = [
  { id: 'gold', name: 'Antique Gold', value: '#b8986c', rgb: '184, 152, 108', light: '#f5eedf', dark: '#8e714b' },
  { id: 'burgundy', name: 'Royal Burgundy', value: '#6a2e2e', rgb: '106, 46, 46', light: '#f5ebeb', dark: '#4a1d1d' },
  { id: 'onyx', name: 'Midnight Onyx', value: '#2a2b2d', rgb: '42, 43, 45', light: '#e8e9ea', dark: '#151515' },
  { id: 'sage', name: 'Sage Green', value: '#606f5c', rgb: '96, 111, 92', light: '#eef2ed', dark: '#414f3e' },
  { id: 'blue', name: 'Nordic Blue', value: '#5d8aa8', rgb: '93, 138, 168', light: '#e8f2f8', dark: '#3d6278' },
  { id: 'amber', name: 'Tuscan Amber', value: '#dca134', rgb: '220, 161, 52', light: '#fdf6e8', dark: '#9a7018' },
];

const STORAGE_KEY = 'voteeq_accent';

export function getStoredAccent() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && COLOR_THEMES.some((t) => t.value === stored)) return stored;
  } catch {
    /* ignore */
  }
  return COLOR_THEMES[0].value;
}

export function applyAccentTheme(color) {
  const theme = COLOR_THEMES.find((t) => t.value === color) || COLOR_THEMES[0];
  const root = document.documentElement;

  root.style.setProperty('--accent', theme.value);
  root.style.setProperty('--accent-rgb', theme.rgb);
  root.style.setProperty('--accent-light', theme.light);
  root.style.setProperty('--accent-dark', theme.dark);
  root.dataset.accent = theme.id;

  root.classList.remove('theme-flash');
  void root.offsetWidth;
  root.classList.add('theme-flash');

  try {
    localStorage.setItem(STORAGE_KEY, theme.value);
  } catch {
    /* ignore */
  }

  return theme;
}
