/**
 * i18n.ts — конфигурация react-i18next
 * Поддерживаемые языки: en, ru, ja
 * Автоопределение браузера, fallback → en
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ru from './locales/ru.json';
import ja from './locales/ja.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            ru: { translation: ru },
            ja: { translation: ja },
        },
        fallbackLng: 'en',
        supportedLngs: ['en', 'ru', 'ja'],
        interpolation: {
            escapeValue: false,  // React уже экранирует XSS
        },
        detection: {
            // Порядок определения языка
            order: ['localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage'],
            lookupLocalStorage: 'aniflow_lang',
        },
    });

// <html lang> меняется вместе с языком интерфейса: скринридеры и переводчики
// браузера должны знать реальный язык страницы.
const syncHtmlLang = (lng: string) => {
    document.documentElement.lang = (lng || 'en').split('-')[0];
};
syncHtmlLang(i18n.resolvedLanguage || i18n.language);
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
