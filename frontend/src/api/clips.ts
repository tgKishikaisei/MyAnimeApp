import type { AxiosProgressEvent } from 'axios';
import api from './client';
import type { Clip } from './types';

export const clipsApi = {
    // Get all clips
    getAll: async (skip: number = 0, limit: number = 50) => {
        const response = await api.get<Clip[]>('/clips/', {
            params: { skip, limit }
        });
        return response.data;
    },

    // Get clip by ID
    getById: async (id: number) => {
        const response = await api.get<Clip>(`/clips/${id}`);
        return response.data;
    },

    // Upload new clip with video file
    uploadClip: async (
        videoFile: File,
        thumbnailFile: File | null,
        clipData: {
            title: string,
            anime_id: number,
            season: number,
            episode: number
        },
        onProgress?: (percent: number) => void
    ) => {
        const formData = new FormData();
        formData.append('video_file', videoFile);
        if (thumbnailFile) {
            formData.append('thumbnail_file', thumbnailFile);
        }
        formData.append('title', clipData.title);
        formData.append('anime_id', String(clipData.anime_id));
        formData.append('season', String(clipData.season));
        formData.append('episode', String(clipData.episode));

        const response = await api.post<Clip>('/clips/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent: AxiosProgressEvent) => {
                if (onProgress && progressEvent.total) {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percent);
                }
            }
        });
        return response.data;
    },

    // Update clip
    update: async (id: number, data: Partial<Clip>) => {
        const response = await api.patch<Clip>(`/clips/${id}`, data);
        return response.data;
    },

    // Delete clip
    delete: async (id: number) => {
        await api.delete(`/clips/${id}`);
    }
};
