import api from './client';
import type { LoginCredentials, RegisterData, User, AuthResponse } from './types';

export const authApi = {
    // 1. Вход в систему (POST /auth/login)
    // Backend ожидает application/x-www-form-urlencoded
    login: async (credentials: LoginCredentials) => {
        const formData = new URLSearchParams();
        formData.append('username', credentials.email); // Backend expects 'username' field, we use email
        formData.append('password', credentials.password);

        const response = await api.post<AuthResponse>('/auth/login', formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return response.data;
    },

    // 2. Регистрация (POST /users/)
    register: async (data: RegisterData) => {
        const response = await api.post<User>('/users/', data);
        return response.data;
    },

    // 3. Получить профиль (GET /users/me)
    getProfile: async () => {
        const response = await api.get<User>('/users/me');
        return response.data;
    },
};
