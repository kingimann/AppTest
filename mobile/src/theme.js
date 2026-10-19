// The app's colours: the editor's Midnight look (and a light one), with its blue accent.
export const DARK = { bg: '#0e1014', card: '#181b22', card2: '#20242d', text: '#e8e8ea', sub: '#9aa0ac', line: '#2a2f38', accent: '#4c8bd6', onAccent: '#ffffff', danger: '#f87171', good: '#34d399', dark: true };
export const LIGHT = { bg: '#f4f6fb', card: '#ffffff', card2: '#eef1f6', text: '#1c1f26', sub: '#6b7280', line: '#e5e7eb', accent: '#3a7bfd', onAccent: '#ffffff', danger: '#ef4444', good: '#10b981', dark: false };
export const KIND = { app: ['App', '#a855f7'], '2d': ['2D game', '#4c8bd6'], '3d': ['3D game', '#f59e0b'] };
/** 5m ago, 2h ago, 3d ago, then the date. */
export const ago = (t) => { const s = (Date.now() - (+t || 0)) / 1000; return !t ? '' : s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + 'm ago' : s < 86400 ? Math.floor(s / 3600) + 'h ago' : s < 604800 ? Math.floor(s / 86400) + 'd ago' : new Date(+t).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }); };
