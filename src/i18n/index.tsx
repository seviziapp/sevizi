// Sèvizi / Sèvi Go — French/English.
// French is the source language: screens write t('Texte français') and the
// English dictionary (src/i18n/en.ts) is looked up by that exact French text.
// A missing entry simply stays French, so migration can be done screen by screen.
// Changing language remounts the app tree (see LanguageRoot) so every screen re-renders.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { EN as EN_BASE } from './en';
import { EN_SEVIGO } from './en_sevigo';
import { EN_APP } from './en_app';
import { EN_EXTRA } from './en_extra';
import { EN_LEGAL } from './en_legal';

const EN: Record<string, string> = { ...EN_BASE, ...EN_SEVIGO, ...EN_APP, ...EN_EXTRA, ...EN_LEGAL };

export type Lang = 'fr' | 'en';
const KEY = 'sevizi.lang';

let current: Lang = 'fr';

export function getLang(): Lang { return current; }
export function locale(): string { return current === 'en' ? 'en-GB' : 'fr-FR'; }

/** Translate French source text. `{name}` placeholders are filled from vars. */
export function t(fr: string, vars?: Record<string, string | number>): string {
  let s = current === 'en' ? (EN[fr] ?? fr) : fr;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

function detect(): Lang {
  try {
    const code = Localization.getLocales?.()[0]?.languageCode
      ?? (Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.language?.slice(0, 2) : 'fr');
    return code === 'en' ? 'en' : 'fr';
  } catch { return 'fr'; }
}

async function readStored(): Promise<Lang | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === 'fr' || v === 'en' ? v : null;
  } catch { return null; }
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void };
const LangContext = createContext<Ctx>({ lang: 'fr', setLang: () => {} });

export const useLang = () => useContext(LangContext);

/** Wrap the app once. Waits for the stored choice, then remounts children on every change. */
export function LanguageRoot({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang | null>(null);

  useEffect(() => {
    readStored().then(v => {
      current = v ?? detect();
      setLangState(current);
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = current;
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    current = l;
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = l;
  }, []);

  const value = useMemo(() => ({ lang: lang ?? 'fr', setLang }), [lang, setLang]);
  if (!lang) return null;
  return (
    <LangContext.Provider value={value}>
      <React.Fragment key={lang}>{children}</React.Fragment>
    </LangContext.Provider>
  );
}

export const tr = t;
