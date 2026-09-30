/**
 * AniFlow Service Worker
 *
 * Стратегия кэширования:
 *  - Shell (HTML/JS/CSS): Cache First → мгновенный старт
 *  - Изображения / статика: Cache First с Time-To-Live
 *  - API запросы: Network First → свежие данные, fallback на кэш
 *  - Страницы: Network First → при офлайне отдаём /offline.html
 */

// v2: старый api-кэш (v1) содержал ответы с личными данными — при активации
// нового воркера он удаляется.
const CACHE_VERSION = 'v2';

// Личные разделы API никогда не кэшируем: после выхода из аккаунта они
// оставались бы в браузере и были бы доступны офлайн следующему человеку.
const PRIVATE_API = /^\/api\/v1\/(auth|users|admin|notifications|watchlist|playlists|downloads|ws|tasks)(\/|$)/;
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

// Файлы, которые кэшируются при установке (App Shell)
const SHELL_URLS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/offline.html',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
    );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    const allowedCaches = [SHELL_CACHE, STATIC_CACHE, API_CACHE];
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => !allowedCaches.includes(k)).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Пропускаем chrome-extension и не-GET запросы
    if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

    // API: публичные GET без авторизации — Network First; личные — мимо кэша.
    if (url.pathname.startsWith('/api/')) {
        if (PRIVATE_API.test(url.pathname) || request.headers.has('Authorization')) return;
        event.respondWith(networkFirst(request, API_CACHE));
        return;
    }

    // Изображения: Cache First
    if (request.destination === 'image' || /\.(png|jpg|jpeg|webp|gif|svg)$/.test(url.pathname)) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }

    // JS / CSS / Fonts: Cache First
    if (['script', 'style', 'font'].includes(request.destination)) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }

    // Навигационные запросы (HTML страницы): Network First → fallback shell
    if (request.mode === 'navigate') {
        event.respondWith(navigationHandler(request));
        return;
    }
});

// ─── Strategies ───────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('Offline', { status: 503 });
    }
}

async function networkFirst(request, cacheName) {
    try {
        const response = await fetch(request);
        const noStore = (response.headers.get('Cache-Control') || '').includes('no-store');
        if (response.ok && !noStore) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached || new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

async function navigationHandler(request) {
    try {
        const response = await fetch(request);
        return response;
    } catch {
        // Офлайн: отдаём кэшированный shell
        const cached = await caches.match('/offline.html');
        return cached || caches.match('/index.html');
    }
}
