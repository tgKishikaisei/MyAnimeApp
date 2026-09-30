import React, { createContext, useContext, useState, useEffect } from 'react';
import { type SystemSettings } from '../api/admin';
import api from '../api/client';

export interface SettingsContextType {
    settings: SystemSettings | null;
    refreshSettings: () => Promise<void>;
    loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshSettings = async () => {
        try {
            // Because this is public context (not just admin), we should create a public endpoint for it, 
            // but for now we'll reuse the admin GET or a newly created public one.
            // Let's assume we'll create GET /api/v1/settings for public consumption.
            const response = await api.get('/settings');
            setSettings(response.data);

            // Apply side-effects immediately
            if (response.data.site_name) {
                document.title = response.data.site_name;
            }
            if (response.data.seo_description) {
                let meta = document.querySelector('meta[name="description"]');
                if (!meta) {
                    meta = document.createElement('meta');
                    meta.setAttribute('name', 'description');
                    document.head.appendChild(meta);
                }
                meta.setAttribute('content', response.data.seo_description);
            }

        } catch (error) {
            console.error('Failed to load global settings', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshSettings();
    }, []);

    // Maintenance Mode Lockout
    // If maintenance mode is active, and we are not on an admin route, show a lockout screen
    // (This requires router integration ideally, but a hard overlay works too)

    // We defer actual implementation of lockout to a wrapper component so we can use hooks like useLocation

    return (
        <SettingsContext.Provider value={{ settings, refreshSettings, loading }}>
            {children}
        </SettingsContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components -- хук рядом с провайдером: влияет только на fast refresh в dev
export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
