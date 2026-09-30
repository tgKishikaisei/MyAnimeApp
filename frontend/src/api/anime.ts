import api from './client';
import type { Anime } from './types';

export const animeApi = {
    // Получить список аниме с фильтрами
    getAll: async (section?: string, bypassCache?: boolean) => {
        const params: Record<string, string | number> = section ? { section } : {};
        if (bypassCache) {
            params['_t'] = Date.now();
        }
        const response = await api.get<Anime[]>('/animes/', { params });
        return response.data;
    },

    // Поиск аниме по названию
    search: async (q: string, limit = 20) => {
        const response = await api.get<Anime[]>('/animes/', { params: { q, limit } });
        return response.data;
    },

    // Получить одно аниме по ID
    getById: async (id: number) => {
        const response = await api.get<Anime>(`/animes/${id}`);
        return response.data;
    },

    // Создать аниме (для админки/тестов)
    create: async (data: Partial<Anime>) => {
        const response = await api.post<Anime>('/animes/', data);
        return response.data;
    },

    // Import from MyAnimeList via Jikan
    importFromMal: async (malId: number) => {
        const response = await api.post<Partial<Anime>>(`/animes/import/jikan?mal_id=${malId}`);
        return response.data;
    },

    // Upload anime with image file
    uploadAnime: async (
        imageFile: File,
        animeData: {
            title: string,
            description?: string,
            section?: string,
            year?: number,
        }
    ) => {
        const formData = new FormData();
        formData.append('image_file', imageFile);
        formData.append('title', animeData.title);
        formData.append('description', animeData.description || '');
        formData.append('section', animeData.section || 'popular');
        if (animeData.year) formData.append('year', String(animeData.year));

        const response = await api.post<Anime>('/animes/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    // Обновить аниме
    update: async (id: number, data: Partial<Anime>) => {
        const response = await api.patch<Anime>(`/animes/${id}`, data);
        return response.data;
    },

    // Удалить аниме
    delete: async (id: number) => {
        await api.delete(`/animes/${id}`);
    },

    // Обновить порядок сортировки (Drag & Drop)
    reorder: async (orderedIds: number[]) => {
        const response = await api.put('/animes/reorder', { ordered_ids: orderedIds });
        return response.data;
    },

    // Get seasons for an anime
    getSeasons: async (animeId: number) => {
        const response = await api.get(`/animes/${animeId}/seasons`);
        return response.data;
    },

    // Get episodes for a season
    getEpisodes: async (animeId: number, seasonId: number) => {
        const response = await api.get(`/animes/${animeId}/seasons/${seasonId}/episodes`);
        return response.data;
    },

    // Get clips for an episode
    getEpisodeClips: async (animeId: number, seasonId: number, episodeId: number) => {
        const response = await api.get(`/animes/${animeId}/seasons/${seasonId}/episodes/${episodeId}/clips`);
        return response.data;
    },

    // --- Public Comments ---
    getComments: async (slug: string) => {
        const response = await api.get(`/comments/anime/${slug}`);
        return response.data;
    },

    postComment: async (slug: string, content: string, parent_id?: number) => {
        const response = await api.post(`/comments/anime/${slug}`, { content, parent_id: parent_id ?? null });
        return response.data;
    },

    reactToComment: async (commentId: number, emoji: string): Promise<{ reactions: Record<string, number>; my_reaction: string | null }> => {
        const response = await api.post(`/comments/${commentId}/react`, { emoji });
        return response.data;
    },

    // Track Video Playback (Live Activity)
    logVideoSession: async (clipId: number, animeId: number, durationWatched: number, totalDuration: number, completed: boolean, episodeNumber: number, bandwidthMb: number) => {
        const response = await api.post('/animes/video-session', {
            clip_id: clipId,
            anime_id: animeId,
            duration_watched: durationWatched,
            total_duration: totalDuration,
            completed,
            episode_number: episodeNumber,
            bandwidth_mb: bandwidthMb
        });
        return response.data;
    },

    // --- Public Reviews ---
    getReviews: async (slug: string) => {
        const response = await api.get(`/animes/${slug}/reviews`);
        return response.data;
    },

    postReview: async (slug: string, rating: number, content: string) => {
        const response = await api.post(`/animes/${slug}/reviews`, { rating, content: content || null });
        return response.data;
    },

    // --- View Tracking ---
    recordView: async (slug: string) => {
        try {
            await api.post(`/animes/${slug}/view`);
        } catch {
            // Silently fail if recording view doesn't work (e.g., adblocker)
        }
    }
};
