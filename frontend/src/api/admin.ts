import api from './client';
import type { User } from './types';


export interface AdminReview {
    id: number;
    user_id: number;
    username: string;
    anime_id: number;
    anime_title: string;
    rating: number;
    content: string;
    is_approved: boolean;
    created_at: string;
}

export interface DashboardStats {
    users: number;
    anime: number;
    clips: number;
    news: number;
    blog: number;
    system: {
        postgres: 'online' | 'offline';
        redis: 'online' | 'offline';
    };
    storage: {
        total_gb: number;
        used_gb: number;
        free_gb: number;
        percent: number;
    };
    recent_users: Array<{ id: number; username: string; email: string; created_at: string; avatar_url: string | null }>;
    top_clips: Array<{ id: number; title: string; views: number; thumbnail: string | null }>;
    recent_logs: Array<{ id: number; user_id: number; action: string; target: string; created_at: string }>;
}

export interface ServerHealth {
    status: string;
    cpu: { percent: number; cores: number };
    ram: { total_gb: number; used_gb: number; percent: number };
    disk: { total_gb: number; used_gb: number; percent: number };
}

export interface SystemSettings {
    site_name: string;
    maintenance_mode: boolean;
    allow_registrations: boolean;
    hero_banner_url: string | null;
    seo_description: string | null;
    telegram_bot_token?: string | null;
    telegram_chat_id?: string | null;
    discord_webhook_url?: string | null;
}

export const adminApi = {
    getStats: async (): Promise<DashboardStats> => {
        const response = await api.get('/admin/stats');
        return response.data;
    },

    getSettings: async (): Promise<SystemSettings> => {
        const response = await api.get('/admin/settings');
        return response.data;
    },

    updateSettings: async (settings: Partial<SystemSettings>): Promise<SystemSettings> => {
        const response = await api.patch('/admin/settings', settings);
        return response.data;
    },

    getUsers: async (skip: number = 0, limit: number = 100): Promise<User[]> => {
        const response = await api.get(`/admin/users?skip=${skip}&limit=${limit}`);
        return response.data;
    },

    updateUserRole: async (userId: number, role: string): Promise<User> => {
        const response = await api.patch(`/admin/users/${userId}/role`, { role });
        return response.data;
    },

    updateUserPermissions: async (userId: number, permissions: Record<string, boolean>): Promise<User> => {
        const response = await api.patch(`/admin/users/${userId}/permissions`, { permissions });
        return response.data;
    },

    clearCache: async (): Promise<{ status: string; message: string }> => {
        const response = await api.delete('/admin/cache');
        return response.data;
    },

    banUser: async (userId: number, bannedUntil: string, banReason: string): Promise<User> => {
        const response = await api.post(`/admin/users/${userId}/ban`, {
            banned_until: bannedUntil,
            ban_reason: banReason
        });
        return response.data;
    },

    unbanUser: async (userId: number): Promise<User> => {
        const response = await api.post(`/admin/users/${userId}/unban`);
        return response.data;
    },

    getReports: async (skip: number = 0, limit: number = 100, status?: string): Promise<Report[]> => {
        const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
        if (status) params.append('status', status);
        const response = await api.get(`/admin/reports?${params.toString()}`);
        return response.data;
    },

    updateReportStatus: async (reportId: number, status: string): Promise<Report> => {
        const response = await api.patch(`/admin/reports/${reportId}/status`, { status });
        return response.data;
    },

    deleteReport: async (reportId: number): Promise<{ message: string }> => {
        const response = await api.delete(`/admin/reports/${reportId}`);
        return response.data;
    },

    exportUsersCsv: async (): Promise<void> => {
        const response = await api.get('/admin/export/users', { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'users_export.csv');
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
    },

    // Audit Logs
    getAuditLogs: async (skip: number = 0, limit: number = 100): Promise<Array<{ id: number; user_id: number | null; username: string; action: string; target: string; details: Record<string, unknown> | null; created_at: string }>> => {
        const response = await api.get(`/admin/audit-logs?skip=${skip}&limit=${limit}`);
        return response.data;
    },

    exportAuditLogsCsv: async (): Promise<void> => {
        const response = await api.get('/admin/export/audit-logs', { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'audit_logs_export.csv');
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
    },

    // Comments Management
    getComments: async (): Promise<Array<{ id: number; target_type: string; target_id: number; content: string; user_id: number; is_deleted: boolean; created_at: string; username: string; avatar_url: string | null }>> => {
        const response = await api.get('/admin/comments');
        return response.data;
    },
    deleteComment: async (commentId: number): Promise<void> => {
        await api.delete(`/admin/comments/${commentId}`);
    },

    // System Operations
    downloadSystemBackup: async (): Promise<void> => {
        const response = await api.get('/admin/system/backup', { responseType: 'blob' });
        // Create an invisible anchor element to trigger the download prompt
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;

        // Extract filename from Content-Disposition header if available
        const contentDisposition = response.headers['content-disposition'];
        let fileName = 'aniflow_backup.sql';
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (fileNameMatch && fileNameMatch.length === 2) {
                fileName = fileNameMatch[1];
            }
        }

        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
    },

    getServerHealth: async (): Promise<ServerHealth> => {
        const response = await api.get('/admin/server-health');
        return response.data;
    },

    exportDatabase: async (): Promise<void> => {
        const response = await api.get('/admin/backup-db', { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;

        // Extract filename from Content-Disposition header if available
        const contentDisposition = response.headers['content-disposition'];
        let fileName = 'aniflow_backup.sql';
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (fileNameMatch && fileNameMatch.length === 2) {
                fileName = fileNameMatch[1];
            }
        }

        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
    },

    // Analytics
    getAnalytics: async (days: number = 30): Promise<{
        timeline: Array<{ date: string; views: number; visitors: number }>;
        totals: { views: number; visitors: number };
        audience: {
            device_split: Array<{ name: string; value: number }>;
            heatmap: Array<{ day: number; hour: number; value: number }>;
            retention: { returning_users: number; new_users: number; retention_rate: number };
        };
        content: {
            empty_searches: Array<{ query: string; count: number }>;
            hype_tracker: Array<{ title: string; comments: number }>;
            drop_rates: Array<{ title: string; drops: number }>;
        };
        trust: {
            avg_toxicity: number;
            spam_block_rate: number;
            avg_resolution_hours: number;
            repeat_offenders: Array<{ username: string; reports: number }>;
        };
        server?: {
            slowest_endpoints: Array<{ endpoint: string; avg_time_ms: number }>;
            error_rates: { "4xx": number; "5xx": number; "ok": number };
            storage_mb: Array<{ table: string; size_mb: number }>;
            redis_metrics: { hit_rate: number; used_memory_mb: number };
        };
        economics?: {
            seo_score: number;
            adblock_rate: number;
            seo_warnings: string[];
        };
    }> => {
        const response = await api.get(`/admin/analytics?days=${days}`);
        return response.data;
    },

    // Data Management
    exportAnimeCsv: async (): Promise<void> => {
        const response = await api.get('/admin/export/anime', { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'anime_export.csv');
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
    },

    importAnimeCsv: async (file: File): Promise<{ message: string }> => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/admin/anime/bulk-import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // Media Manager
    getMedia: async (folder: string = ''): Promise<Array<{ name: string; is_dir: boolean; size: number; path: string }>> => {
        const response = await api.get(`/admin/media?folder=${encodeURIComponent(folder)}`);
        return response.data;
    },

    uploadMedia: async (file: File, folder: string = ''): Promise<{ message: string; path: string }> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);
        const response = await api.post('/admin/media', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    deleteMedia: async (path: string): Promise<{ message: string }> => {
        const response = await api.delete('/admin/media', {
            data: { path }
        });
        return response.data;
    },

    // SEO Management
    updateAnimeSeo: async (updates: Array<{ id: number; title?: string; slug?: string; description?: string }>): Promise<{ message: string }> => {
        const response = await api.patch('/admin/seo/anime', updates);
        return response.data;
    },

    // Reviews Management
    getReviews: async (skip: number = 0, limit: number = 50): Promise<{ items: AdminReview[]; total: number }> => {
        const response = await api.get(`/admin/reviews?skip=${skip}&limit=${limit}`);
        return response.data;
    },

    updateReviewStatus: async (reviewId: number, isApproved: boolean): Promise<{ message: string }> => {
        const response = await api.patch(`/admin/reviews/${reviewId}`, { is_approved: isApproved });
        return response.data;
    },

    deleteReview: async (reviewId: number): Promise<{ message: string }> => {
        const response = await api.delete(`/admin/reviews/${reviewId}`);
        return response.data;
    }
};

export interface Report {
    id: number;
    user_id: number | null;
    target_type: string;
    target_id: number;
    reason: string;
    status: 'pending' | 'resolved' | 'dismissed';
    created_at: string;
    updated_at: string | null;
}
