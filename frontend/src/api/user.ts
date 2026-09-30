import api from './client';
import type { User } from './types';

export const userApi = {
    getProfile: async (): Promise<User> => {
        const response = await api.get<User>('/users/me');
        return response.data;
    },

    updateProfile: async (data: Partial<User> & { password?: string }): Promise<User> => {
        const response = await api.put<User>('/users/me', data);
        return response.data;
    },

    uploadAvatar: async (file: File): Promise<User> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post<User>('/users/me/avatar', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    }
};

export default userApi;
