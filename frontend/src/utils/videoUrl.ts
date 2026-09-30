import type { Clip } from '../api/types';
import { getStaticUrl } from './imageUrl';

/**
 * Get the playable video URL for a clip
 * Supports both YouTube videos and local MP4 files
 */
export function getVideoUrl(clip: Clip): string {
    // YouTube video
    if (clip.video_id) {
        return `https://www.youtube.com/embed/${encodeURIComponent(clip.video_id)}?autoplay=1`;
    }

    // Local video file (тот же origin: /static проксирует Vite/nginx)
    if (clip.video_path) {
        return getStaticUrl(clip.video_path);
    }

    return '';
}

/**
 * Get thumbnail URL for a clip
 * YouTube thumbnails or local thumbnail if available
 */
export function getThumbnailUrl(clip: Clip): string {
    if (clip.video_id) {
        return `https://img.youtube.com/vi/${encodeURIComponent(clip.video_id)}/hqdefault.jpg`;
    }
    if (clip.thumbnail_path) {
        return getStaticUrl(clip.thumbnail_path);
    }
    // Локальная заглушка вместо стороннего via.placeholder.com
    return '/placeholder.png';
}

/**
 * Check if clip uses YouTube
 */
export function isYouTubeClip(clip: Clip): boolean {
    return !!clip.video_id;
}

/**
 * Check if clip uses local video
 */
export function isLocalClip(clip: Clip): boolean {
    return !!clip.video_path && !clip.video_id;
}
