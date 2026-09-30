import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

/**
 * HTTP-клиент API.
 *
 * Безопасность:
 * - access-токен живёт ТОЛЬКО в памяти вкладки (переменная модуля), не в
 *   localStorage, где его прочитала бы любая XSS.
 * - refresh-токен лежит в HttpOnly-cookie (JS его не видит) и уходит только на
 *   /api/v1/auth/*. После перезагрузки страницы сессия восстанавливается
 *   вызовом restoreSession() → /auth/refresh.
 * - Базовый адрес относительный (/api/v1): в dev запросы проксирует Vite,
 *   в production — nginx.
 * - Заголовок X-Requested-With обязателен для /auth/refresh и /auth/logout
 *   (защита от CSRF: чужой сайт не может его выставить без CORS-preflight).
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') + '/api/v1';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
    return accessToken;
}

export function setAccessToken(token: string | null): void {
    accessToken = token;
}

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

// Один refresh на все параллельные запросы вкладки (single-flight).
let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const { data } = await axios.post(
                `${API_BASE}/auth/refresh`,
                {},
                { withCredentials: true, headers: { 'X-Requested-With': 'XMLHttpRequest' } },
            );
            setAccessToken(data.access_token);
            return data.access_token as string;
        } catch (err) {
            // 409 — соседняя вкладка как раз ротировала токен; новая cookie уже
            // в браузере, просто повторяем один раз.
            if ((err as AxiosError).response?.status === 409 && attempt === 0) {
                await new Promise((r) => setTimeout(r, 300));
                continue;
            }
            setAccessToken(null);
            return null;
        }
    }
    return null;
}

export function refreshAccessToken(): Promise<string | null> {
    if (!refreshPromise) {
        refreshPromise = doRefresh().finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
}

/**
 * Восстановить сессию после перезагрузки страницы (по refresh-cookie).
 * Если несекретной cookie-подсказки `aniflow_session` нет, пользователь точно
 * не входил — не делаем заведомо неудачный запрос к /auth/refresh.
 */
export async function restoreSession(): Promise<boolean> {
    if (accessToken) return true;
    if (!document.cookie.split('; ').some((c) => c === 'aniflow_session=1')) return false;
    return (await refreshAccessToken()) !== null;
}

/** Короткий билет для WebSocket: access-токен в URL больше не передаём. */
export async function getWsTicket(channel: 'notifications' | 'admin'): Promise<string | null> {
    try {
        const { data } = await api.post('/auth/ws-ticket', null, { params: { channel } });
        return data.ticket as string;
    } catch {
        return null;
    }
}

/** ws(s)://<тот же хост>/api/v1<path>?ticket=... */
export function wsUrl(path: string, ticket: string): string {
    const base = new URL(API_BASE, window.location.origin);
    base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${base.origin}${base.pathname}${path}?ticket=${encodeURIComponent(ticket)}`;
}

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
        const url = original?.url ?? '';
        if (
            error.response?.status === 401 &&
            original &&
            !original._retry &&
            !url.includes('/auth/refresh') &&
            !url.includes('/auth/login')
        ) {
            original._retry = true;
            const token = await refreshAccessToken();
            if (token) {
                original.headers.Authorization = `Bearer ${token}`;
                return api(original);
            }
            if (!window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    },
);

export default api;
