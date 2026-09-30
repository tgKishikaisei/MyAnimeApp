import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api, { getWsTicket, wsUrl as buildWsUrl } from '../api/client';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string | null;
    data: Record<string, unknown> | null;
    is_read: boolean;
    created_at: string;
}

export default function NotificationBell() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(id);
    }, []);
    const panelRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);

    // Загрузить уведомления с сервера
    const fetchNotifications = useCallback(async () => {
        try {
            const [notifRes, countRes] = await Promise.all([
                api.get<Notification[]>('/notifications/?limit=20'),
                api.get<{ unread_count: number }>('/notifications/unread-count'),
            ]);
            setNotifications(notifRes.data);
            setUnreadCount(countRes.data.unread_count);
        } catch {
            // Не критично
        }
    }, []);

    // Подключение WebSocket
    useEffect(() => {
        if (!user) return;

        // WS-билет вместо access-токена в URL (см. api/client.ts).
        let cancelled = false;
        let ws: WebSocket | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

        const connect = async () => {
            const ticket = await getWsTicket('notifications');
            if (!ticket || cancelled) return;
            ws = new WebSocket(buildWsUrl('/ws/notifications', ticket));
            wsRef.current = ws;
            attach(ws);
        };

        const attach = (ws: WebSocket) => {
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type && data.title) {
                    // Новое уведомление — обновляем список
                    fetchNotifications();
                }
            } catch { /* ignore */ }
        };

        ws.onclose = () => {
            if (cancelled) return;
            // Переподключение через 5 секунд (новый билет — старый уже истёк)
            reconnectTimer = setTimeout(() => {
                fetchNotifications();
                connect();
            }, 5000);
        };
        };

        connect();

        return () => {
            cancelled = true;
            clearTimeout(reconnectTimer);
            ws?.close();
        };
    }, [user, fetchNotifications]);

    // Первоначальная загрузка + периодические обновления
    useEffect(() => {
        if (!user) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- setState внутри вызывается после await, синхронного каскада нет
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Каждые 30 сек
        return () => clearInterval(interval);
    }, [user, fetchNotifications]);

    // Закрытие по клику вне панели
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Пометить как прочитанное
    const markAsRead = async (id: number) => {
        try {
            await api.patch(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch { /* ignore */ }
    };

    // Пометить все как прочитанные
    const markAllAsRead = async () => {
        try {
            await api.patch('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch { /* ignore */ }
    };

    // Форматирование времени: «сейчас» обновляется раз в минуту, а не вычисляется в рендере.
    const timeAgo = (dateStr: string) => {
        const diff = now - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    if (!user) return null;

    return (
        <div ref={panelRef} className="relative">
            {/* Bell Icon */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-400 hover:text-white transition-colors"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
                    >
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </motion.span>
                )}
            </button>

            {/* Dropdown Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-80 max-h-[420px] bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                            <span className="text-sm font-bold text-white tracking-wide">Notifications</span>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1"
                                        title="Mark all as read"
                                    >
                                        <CheckCheck className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="overflow-y-auto max-h-[360px] divide-y divide-white/5">
                            {notifications.length === 0 ? (
                                <div className="px-4 py-8 text-center text-gray-600 text-sm">No notifications yet</div>
                            ) : notifications.map((notif) => (
                                <button
                                    key={notif.id}
                                    onClick={() => !notif.is_read && markAsRead(notif.id)}
                                    className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex gap-3 items-start ${!notif.is_read ? 'bg-white/[0.02]' : ''}`}
                                >
                                    {/* Unread dot */}
                                    <div className="mt-1.5 shrink-0">
                                        {!notif.is_read ? (
                                            <div className="w-2 h-2 rounded-full bg-red-500" />
                                        ) : (
                                            <div className="w-2 h-2 rounded-full bg-transparent" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm leading-tight ${!notif.is_read ? 'text-white font-semibold' : 'text-gray-400'}`}>
                                            {notif.title}
                                        </p>
                                        {notif.message && (
                                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{notif.message}</p>
                                        )}
                                        <p className="text-[10px] text-gray-600 mt-1">{timeAgo(notif.created_at)}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
