import api from './client';

export interface Playlist {
    id: number;
    user_id: number;
    title: string;
    description: string | null;
    is_public: boolean;
    slug: string;
    clip_count: number;
    created_at: string;
    share_url: string | null;
}

export interface PlaylistDetail extends Playlist {
    clips: {
        id: number;
        title: string;
        video_path?: string;
        thumbnail_path?: string;
        duration?: number;
        anime_id: number;
        season: number;
        episode: number;
    }[];
}

export const playlistApi = {
    // Мои плейлисты
    getAll: async (): Promise<Playlist[]> => {
        const res = await api.get('/playlists/');
        return res.data;
    },

    // Детали конкретного плейлиста
    getById: async (id: number): Promise<PlaylistDetail> => {
        const res = await api.get(`/playlists/${id}`);
        return res.data;
    },

    // Публичный плейлист по slug (без авторизации)
    getBySlug: async (slug: string): Promise<PlaylistDetail> => {
        const res = await api.get(`/playlists/public/${slug}`);
        return res.data;
    },

    // Создать
    create: async (title: string, description?: string, is_public = true): Promise<Playlist> => {
        const res = await api.post('/playlists/', { title, description, is_public });
        return res.data;
    },

    // Обновить
    update: async (id: number, data: Partial<{ title: string; description: string; is_public: boolean }>) => {
        const res = await api.patch(`/playlists/${id}`, data);
        return res.data;
    },

    // Добавить клип
    addClip: async (playlistId: number, clipId: number) => {
        const res = await api.post(`/playlists/${playlistId}/clips`, { clip_id: clipId });
        return res.data;
    },

    // Убрать клип
    removeClip: async (playlistId: number, clipId: number) => {
        const res = await api.delete(`/playlists/${playlistId}/clips/${clipId}`);
        return res.data;
    },

    // Удалить плейлист
    delete: async (id: number) => {
        const res = await api.delete(`/playlists/${id}`);
        return res.data;
    },
};
