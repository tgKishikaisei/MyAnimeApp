import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';
import api, { restoreSession, setAccessToken } from '../api/client';
import type { User } from '../api/types';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (token: string) => Promise<void>;
    logout: () => Promise<void>;
    logoutEverywhere: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Токен хранится только в памяти (см. api/client.ts). При загрузке страницы
 * сессия восстанавливается по HttpOnly refresh-cookie — localStorage больше
 * не используется, и XSS не может унести токен.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkAuth = async () => {
        try {
            if (await restoreSession()) {
                setUser(await authApi.getProfile());
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            setAccessToken(null);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const login = async (token: string) => {
        setAccessToken(token);
        await checkAuth();
    };

    const finishLogout = () => {
        setAccessToken(null);
        setUser(null);
        window.location.href = '/login';
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch {
            // Даже если сервер недоступен — локально сессию всё равно завершаем.
        }
        finishLogout();
    };

    const logoutEverywhere = async () => {
        try {
            await api.post('/auth/logout-all');
        } catch {
            /* см. logout */
        }
        finishLogout();
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout, logoutEverywhere, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components -- хук рядом с провайдером: влияет только на fast refresh в dev
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
