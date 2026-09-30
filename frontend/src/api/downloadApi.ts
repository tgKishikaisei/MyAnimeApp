/**
 * Download API — Secure Signed Downloads
 *
 * All download calls now follow a 2-step flow:
 *   1.  GET  /downloads/sign/{clip_id}  — получает краткосрочный токен (10 мин)
 *   2.  GET  /downloads/clip/{id}?token=... — фактическая загрузка файла
 *
 * Это предотвращает хотлинкинг и несанкционированный доступ к файлам.
 */

import api, { API_BASE as API_URL } from './client';

/** Получить подписанный токен для одного клипа. */
async function getClipToken(clipId: number): Promise<string> {
    const { data } = await api.get(`/downloads/sign/${clipId}`);
    return data.token as string;
}

/** Получить подписанный токен для ZIP-архива аниме. */
async function getAnimeZipToken(animeId: number): Promise<string> {
    const { data } = await api.get(`/downloads/sign/zip/anime/${animeId}`);
    return data.token as string;
}

/** Вспомогательная функция: открыть URL в скрытом <a> для инициации загрузки. */
function triggerDownload(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export const downloadApi = {
    /**
     * Скачать один клип через подписанный URL.
     * Сначала получает токен, затем инициирует загрузку.
     */
    downloadClip: async (clipId: number, title: string): Promise<void> => {
        try {
            const token = await getClipToken(clipId);
            const url = `${API_URL}/downloads/clip/${clipId}?token=${encodeURIComponent(token)}`;
            triggerDownload(url, `${title}.mp4`);
        } catch (error) {
            console.error('Ошибка при получении токена для скачивания:', error);
            throw error;
        }
    },

    /**
     * Скачать несколько клипов как ZIP через подписанный URL.
     * Используется для выбранных clipsIds.
     */
    downloadZip: async (clipIds: number[], filename: string = 'download.zip'): Promise<void> => {
        try {
            // Для batch-ZIP используем подпись первого клипа как доверенный токен
            if (clipIds.length === 0) return;
            const token = await getClipToken(clipIds[0]);

            // POST запрос с blob-ответом
            const response = await api.post(
                `/downloads/zip?token=${encodeURIComponent(token)}`,
                clipIds,
                { responseType: 'blob' }
            );

            const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
            triggerDownload(blobUrl, filename);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Ошибка ZIP-загрузки:', error);
            throw error;
        }
    },

    /**
     * Скачать полный сезон аниме как ZIP.
     */
    downloadSeason: async (animeId: number, season: number): Promise<void> => {
        try {
            const token = await getAnimeZipToken(animeId);
            const url = `${API_URL}/downloads/zip/anime/${animeId}/season/${season}?token=${encodeURIComponent(token)}`;
            // Открываем в новой вкладке — браузер прямо откроет download manager для больших файлов
            window.open(url, '_blank');
        } catch (error) {
            console.error('Ошибка загрузки сезона:', error);
            throw error;
        }
    },

    /**
     * Скачать все клипы эпизода как ZIP.
     */
    downloadEpisode: async (animeId: number, season: number, episode: number): Promise<void> => {
        try {
            const token = await getAnimeZipToken(animeId);
            const url = `${API_URL}/downloads/zip/anime/${animeId}/season/${season}/episode/${episode}?token=${encodeURIComponent(token)}`;
            window.open(url, '_blank');
        } catch (error) {
            console.error('Ошибка загрузки эпизода:', error);
            throw error;
        }
    },

    /**
     * Скачать выбранные эпизоды сезона как ZIP.
     */
    downloadSelectedEpisodes: async (animeId: number, season: number, episodeNumbers: number[]): Promise<void> => {
        try {
            const token = await getAnimeZipToken(animeId);
            const response = await api.post(
                `/downloads/zip/anime/${animeId}/season/${season}/episodes?token=${encodeURIComponent(token)}`,
                episodeNumbers,
                { responseType: 'blob' }
            );

            const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
            triggerDownload(blobUrl, `Anime_${animeId}_S${season}_Selected_Episodes.zip`);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Ошибка загрузки выбранных эпизодов:', error);
            throw error;
        }
    },
};
