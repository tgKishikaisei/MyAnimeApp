/**
 * Полный URL картинки/медиа из backend/static.
 * Бэкенд хранит пути вида "/static/anime_images/x.jpg" или "anime_images/x.jpg".
 *
 * Базовый адрес — VITE_API_URL (если API на другом домене) или тот же origin:
 * в dev /static проксирует Vite, в production — nginx. Жёстко зашитый
 * http://localhost:8000 сломал бы картинки на реальном домене и дал бы
 * mixed content на HTTPS.
 */
export const MEDIA_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export function getImageUrl(imagePath: string | null | undefined): string {
    if (!imagePath) return '/placeholder.png';
    if (/^https?:\/\//i.test(imagePath)) return imagePath;
    if (imagePath.startsWith('/static/')) return `${MEDIA_BASE_URL}${imagePath}`;
    // Картинки из frontend/public (например, /placeholder.png) отдаёт сам фронтенд.
    if (imagePath.startsWith('/')) return imagePath;
    return `${MEDIA_BASE_URL}/static/${imagePath}`;
}

/** URL файла из static по относительному пути (videos/..., thumbnails/...). */
export function getStaticUrl(relativePath: string): string {
    return `${MEDIA_BASE_URL}/static/${relativePath.replace(/^\/?(static\/)?/, '')}`;
}
