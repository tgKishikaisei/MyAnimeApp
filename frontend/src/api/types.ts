// Типы данных для API

// Пользователь
export interface User {
    id: number;
    email: string;
    username: string;
    role: 'admin' | 'creator' | 'viewer';
    is_active: boolean;
    avatar_url?: string;
    full_name?: string; // New field
    bio?: string;       // New field
    created_at: string;
    banned_until?: string | null;
    ban_reason?: string | null;
    permissions?: Record<string, boolean>;
}

// Ответ при логине (JWT)
export interface AuthResponse {
    access_token: string;
    token_type: string;
}

// Данные для входа
export interface LoginCredentials {
    email: string;
    password: string;
}

// Данные для регистрации
export interface RegisterData {
    email: string;
    username: string;
    password: string;
    full_name?: string;
}

// Аниме (базовый)
export interface Anime {
    id: number;
    title: string;
    slug: string;
    description?: string;
    image: string;
    image_url?: string; // alias returned by some endpoints
    section: string;
    rating: number;
    year?: number;
    highlight_char?: string;
    accent_color?: string;
    clips?: Clip[];
}

// Watchlist entry (from /api/v1/watchlist)
export type WatchStatus = 'watching' | 'completed' | 'planned' | 'dropped';

export interface WatchlistEntry {
    id: number;
    anime_id: number;
    status: WatchStatus;
    progress_episode: number;
    note?: string;
    created_at: string;
    updated_at?: string;
}

export interface WatchlistStatusOut {
    in_list: boolean;
    status?: WatchStatus;
    entry_id?: number;
}

export interface Clip {
    id: number;
    title: string;
    video_id?: string;  // Optional, for YouTube
    video_path?: string; // For local files
    thumbnail_path?: string;
    quality: string;
    views: number;
    anime_id: number;
    season: number;
    episode: number;
    duration?: number;
    file_size?: string;
    created_at: string;
}

// Hierarchy types
export interface SeasonInfo {
    season_number: number;
    clip_count: number;
}

export interface EpisodeInfo {
    episode_number: number;
    clip_count: number;
}

export interface News {
    id: number;
    title?: string;
    video_id: string;
    image?: string;
    created_at: string;
}

export interface BlogPost {
    id: number;
    title: string;
    image?: string;
    content?: string;
    color?: string;
    link?: string;
    created_at: string;
}
