import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, MessageSquare, PlayCircle, Activity } from 'lucide-react';
import { useLiveActivity } from '../../context/LiveActivityContext';

export default function LiveEventTicker() {
    const { generalEvents: events } = useLiveActivity();

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'new_user': return <UserPlus className="w-5 h-5 text-purple-400" />;
            case 'new_comment': return <MessageSquare className="w-5 h-5 text-blue-400" />;
            case 'video_watch_start': return <PlayCircle className="w-5 h-5 text-yellow-400" />;
            default: return <Activity className="w-5 h-5 text-gray-400" />;
        }
    };

    return (
        <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden backdrop-blur-md flex flex-col h-full">
            <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Live Activity Stream
                </h3>
                <span className="text-xs font-bold text-gray-500">{events.length} Recent Events</span>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar min-h-[300px]">
                <AnimatePresence initial={false}>
                    {events.map(event => (
                        <motion.div
                            key={event.id}
                            initial={{ opacity: 0, x: -20, height: 0 }}
                            animate={{ opacity: 1, x: 0, height: 'auto' }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="bg-white/5 border border-white/5 rounded-lg p-3 flex gap-4 items-start shadow-xl shadow-black/20"
                        >
                            <div className="shrink-0 mt-0.5">
                                {getEventIcon(event.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-medium leading-tight">{event.message}</p>
                                {event.type === 'new_comment' && typeof event.data.content === 'string' && event.data.content && (
                                    <p className="text-gray-400 text-xs mt-1 truncate italic">"{event.data.content}"</p>
                                )}
                                <p className="text-[10px] text-gray-500 font-mono tracking-wider mt-2">
                                    {event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                    {events.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-10 flex flex-col items-center gap-3"
                        >
                            <Activity className="w-8 h-8 text-gray-600 animate-pulse" />
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Listening for live events...</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
