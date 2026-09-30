import api from './client';
import type { News } from './types';

export const newsApi = {
    getAll: async (): Promise<News[]> => {
        const response = await api.get<News[]>('/news/');
        return response.data;
    },

    create: async (data: Omit<News, 'id' | 'created_at'>): Promise<News> => {
        const response = await api.post<News>('/news/', data);
        return response.data;
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`/news/${id}`);
    }
};
