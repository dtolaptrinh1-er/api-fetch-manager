import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, type Owner } from '../api/api';

type Theme = 'light' | 'dark';
const THEME_KEY = 'API_FETCH_MANAGER_theme';
const HOTKEY = (import.meta.env.VITE_API_FETCH_MANAGER_INSPECT_HOTKEY as string) || 'Ctrl+Shift+J';

/** So khớp KeyboardEvent với combo dạng "Ctrl+Shift+J". */
export function matchHotkey(e: KeyboardEvent, combo: string): boolean {
 const parts = combo.toLowerCase().split('+').map((s) => s.trim());
 const key = parts[parts.length - 1];
 const needCtrl = parts.includes('ctrl');
 const needShift = parts.includes('shift');
 const needAlt = parts.includes('alt');
 const needMeta = parts.includes('meta') || parts.includes('cmd');
 return (
 e.ctrlKey === needCtrl &&
 e.shiftKey === needShift &&
 e.altKey === needAlt &&
 e.metaKey === needMeta &&
 e.key.toLowerCase() === key
 );
}

interface AppState {
 theme: Theme;
 toggleTheme: () => void;
 owners: Owner[];
 ownerId: string | null;
 setOwnerId: (id: string) => void;
 reloadOwners: () => Promise<void>;
 inspect: boolean;
 setInspect: (v: boolean) => void;
 inspectPaused: boolean;
 setInspectPaused: (v: boolean) => void;
 inspectHotkey: string;
}

const Ctx = createContext<AppState | null>(null);
export const useApp = () => {
 const c = useContext(Ctx);
 if (!c) throw new Error('useApp phải nằm trong <AppProvider>');
 return c;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
 const [theme, setTheme] = useState<Theme>(() => {
 const saved = localStorage.getItem(THEME_KEY) as Theme | null;
 if (saved) return saved;
 return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
 });
 const [owners, setOwners] = useState<Owner[]>([]);
 const [ownerId, setOwnerId] = useState<string | null>(null);
 const [inspect, setInspect] = useState(false);
 const [inspectPaused, setInspectPaused] = useState(false);

 useEffect(() => {
 document.documentElement.setAttribute('data-theme', theme);
 localStorage.setItem(THEME_KEY, theme);
 }, [theme]);

 const reloadOwners = useCallback(async () => {
 const list = await api.get<Owner[]>('/owners');
 setOwners(list);
 setOwnerId((cur) => cur ?? list[0]?.id ?? null);
 }, []);

 useEffect(() => {
 reloadOwners().catch(() => {});
 }, [reloadOwners]);

 // Hotkey toàn cục bật Inspect (mọi form/modal). Mặc định Ctrl+Shift+J, override qua env.
 useEffect(() => {
 const onKey = (e: KeyboardEvent) => {
 if (matchHotkey(e, HOTKEY)) {
 e.preventDefault();
 setInspect(true);
 setInspectPaused(false);
 }
 };
 window.addEventListener('keydown', onKey, true);
 return () => window.removeEventListener('keydown', onKey, true);
 }, []);

 return (
 <Ctx.Provider
 value={{
 theme,
 toggleTheme: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
 owners,
 ownerId,
 setOwnerId,
 reloadOwners,
 inspect,
 setInspect,
 inspectPaused,
 setInspectPaused,
 inspectHotkey: HOTKEY,
 }}
 >
 {children}
 </Ctx.Provider>
 );
}
