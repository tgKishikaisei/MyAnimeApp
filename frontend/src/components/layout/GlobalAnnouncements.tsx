import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { announcementsApi, type Announcement } from '../../api/announcements';

export default function GlobalAnnouncements() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [dismissed, setDismissed] = useState<Set<number>>(new Set());

    useEffect(() => {
        const fetchAnnouncements = async () => {
            try {
                const active = await announcementsApi.getActive();
                setAnnouncements(active);
            } catch (err) {
                // Silently fail for public components
                console.error("Failed to load announcements", err);
            }
        };

        fetchAnnouncements();

        // Optional: Poll every few minutes so static users see new alerts
        const interval = setInterval(fetchAnnouncements, 300000);
        return () => clearInterval(interval);
    }, []);

    const handleDismiss = (id: number) => {
        setDismissed(prev => {
            const newSet = new Set(prev);
            newSet.add(id);
            return newSet;
        });
    };

    if (announcements.length === 0) return null;

    const visibleAnnouncements = announcements.filter(ann => !dismissed.has(ann.id));
    if (visibleAnnouncements.length === 0) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center pointer-events-none">
            {visibleAnnouncements.map(ann => {
                let bgColors = '';
                let Icon = Info;

                switch (ann.type) {
                    case 'warning':
                        bgColors = 'bg-yellow-500/90 border-yellow-500 text-yellow-950';
                        Icon = AlertTriangle;
                        break;
                    case 'success':
                        bgColors = 'bg-green-500/90 border-green-500 text-green-950';
                        Icon = CheckCircle;
                        break;
                    case 'info':
                    default:
                        bgColors = 'bg-blue-500/90 border-blue-500 text-white';
                        Icon = Info;
                        break;
                }

                return (
                    <div
                        key={ann.id}
                        className={`w-full max-w-4xl mx-auto shadow-2xl backdrop-blur-md border-b pointer-events-auto transform transition-all duration-500 ${bgColors}`}
                    >
                        <div className="px-4 py-3 flex items-start sm:items-center justify-between gap-4">
                            <div className="flex items-start sm:items-center gap-3">
                                <Icon className="w-5 h-5 shrink-0 mt-0.5 sm:mt-0" />
                                <div>
                                    <h4 className="font-bold text-sm sm:text-base leading-tight">
                                        {ann.title}
                                    </h4>
                                    <p className="text-xs sm:text-sm mt-0.5 opacity-90">
                                        {ann.message}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDismiss(ann.id)}
                                className="p-1 hover:bg-black/10 rounded-full transition-colors shrink-0"
                                aria-label="Dismiss"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
