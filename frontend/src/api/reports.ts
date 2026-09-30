import api from './client';

export const reportsApi = {
    createReport: async (target_type: string, target_id: number, reason: string) => {
        const response = await api.post('/reports', { target_type, target_id, reason });
        return response.data;
    }
};
