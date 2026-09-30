import api from './client';
import type { BlogPost } from './types';

export const blogApi = {
    getAll: async (): Promise<BlogPost[]> => {
        const response = await api.get<BlogPost[]>('/blog-posts/');
        return response.data;
    },

    getById: async (id: number): Promise<BlogPost> => {
        const response = await api.get<BlogPost>(`/blog-posts/${id}`);
        return response.data;
    },

    create: async (data: Omit<BlogPost, 'id' | 'created_at'>): Promise<BlogPost> => {
        const response = await api.post<BlogPost>('/blog-posts/', data);
        return response.data;
    },

    update: async (id: number, data: Partial<Omit<BlogPost, 'id' | 'created_at'>>): Promise<BlogPost> => {
        const response = await api.put<BlogPost>(`/blog-posts/${id}`, data);
        return response.data;
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`/blog-posts/${id}`);
    }
};
