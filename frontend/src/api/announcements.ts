import api from './client';

export interface Announcement {
    id: number;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success';
    is_active: boolean;
    created_at: string;
    updated_at: string | null;
    author_id: number | null;
}

export const announcementsApi = {
    getActive: async (): Promise<Announcement[]> => {
        const response = await api.get('/announcements/active');
        return response.data;
    },

    getAllAdmin: async (skip: number = 0, limit: number = 100): Promise<Announcement[]> => {
        const response = await api.get(`/announcements/all?skip=${skip}&limit=${limit}`);
        return response.data;
    },

    create: async (data: Partial<Announcement>): Promise<Announcement> => {
        const response = await api.post('/announcements', data);
        return response.data;
    },

    update: async (id: number, data: Partial<Announcement>): Promise<Announcement> => {
        const response = await api.patch(`/announcements/${id}`, data);
        return response.data;
    },

    delete: async (id: number): Promise<{ message: string }> => {
        const response = await api.delete(`/announcements/${id}`);
        return response.data;
    }
};
