import React, { createContext, useContext, useState, useEffect } from 'react';
import { getWsTicket, restoreSession, wsUrl } from '../api/client';

interface StreamEvent {
    anime_title: string;
    anime_id: number;
    lat: number;
    lng: number;
    timestamp: string;
}

interface GeneralEvent {
    id: string; // generated locally
    type: string;
    message: string;
    data: Record<string, unknown>;
    timestamp: Date;
}

interface LiveActivityContextType {
    streamEvents: StreamEvent[];
    generalEvents: GeneralEvent[];
}

const LiveActivityContext = createContext<LiveActivityContextType | undefined>(undefined);

export function LiveActivityProvider({ children }: { children: React.ReactNode }) {
    const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
    const [generalEvents, setGeneralEvents] = useState<GeneralEvent[]>([]);

    useEffect(() => {
        // Админский канал: сначала короткий WS-билет (60 с, только для admin),
        // access-токен в URL больше не попадает.
        let ws: WebSocket | null = null;
        let cancelled = false;

        const connect = async () => {
            // Токен восстанавливается асинхронно (refresh-cookie) — ждём его.
            if (!(await restoreSession())) return;
            const ticket = await getWsTicket('admin');
            if (!ticket || cancelled) return;
            ws = new WebSocket(wsUrl('/admin/ws', ticket));
            attach(ws);
        };

        const attach = (ws: WebSocket) => {
        ws.onopen = () => {
            console.log('Connected to Admin Live Activity WebSocket');
        };

        ws.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);

                // Add to general events ticker
                const newGeneralEvent: GeneralEvent = {
                    id: Math.random().toString(36).substring(7),
                    type: parsed.type,
                    message: parsed.message,
                    data: parsed.data,
                    timestamp: new Date()
                };

                setGeneralEvents(prev => {
                    const updated = [newGeneralEvent, ...prev];
                    if (updated.length > 20) return updated.slice(0, 20);
                    return updated;
                });

                // Add to globe stream events if it's a video start
                if (parsed.type === 'video_watch_start' && parsed.data) {
                    const data = parsed.data;
                    const newStreamEvent: StreamEvent = {
                        anime_title: data.anime_title || "Unknown Anime",
                        anime_id: data.anime_id,
                        lat: data.lat || (Math.random() * 120 - 60),
                        lng: data.lng || (Math.random() * 360 - 180),
                        timestamp: new Date().toISOString()
                    };

                    setStreamEvents(prev => {
                        const updated = [newStreamEvent, ...prev];
                        if (updated.length > 30) return updated.slice(0, 30);
                        return updated;
                    });
                }

            } catch (err) {
                console.error("Failed to parse admin ws event", err);
            }
        };

        ws.onclose = () => {
            console.log('Admin WS disconnected.');
        };

        };

        connect();

        return () => {
            cancelled = true;
            if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                ws.close();
            }
        };
    }, []);

    return (
        <LiveActivityContext.Provider value={{ streamEvents, generalEvents }}>
            {children}
        </LiveActivityContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components -- хук рядом с провайдером: влияет только на fast refresh в dev
export function useLiveActivity() {
    const context = useContext(LiveActivityContext);
    if (context === undefined) {
        throw new Error('useLiveActivity must be used within a LiveActivityProvider');
    }
    return context;
}
