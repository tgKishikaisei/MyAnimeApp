import api from './client';
import type { Anime } from './types';

export type WatchStatus = 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch';

export interface WatchlistEntry {
    id: number;
    user_id: number;
    anime_id: number;
    status: WatchStatus;
    progress_episode: number;
    note?: string;
    created_at: string;
    updated_at: string;
    anime?: Anime; // The joined anime data
}

export const watchlistApi = {
    // Получить весь список просмотра пользователя
    getWatchlist: async (status?: WatchStatus) => {
        const params = status ? { status } : {};
        const response = await api.get<WatchlistEntry[]>('/watchlist/', { params });
        return response.data;
    },

    // Удалить аниме из списка
    removeFromWatchlist: async (animeId: number) => {
        await api.delete(`/watchlist/${animeId}`);
    }
};
