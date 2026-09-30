import { useState, useEffect } from 'react';
import { adminApi } from '../../api/admin';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Search, Download, ShieldAlert, ChevronDown, ChevronRight, User, Settings, AlertTriangle, Key } from 'lucide-react';
import CyberpunkParticles from '../../components/admin/CyberpunkParticles';


type AuditLogEntry = Awaited<ReturnType<typeof adminApi.getAuditLogs>>[number];
// Simple helper to pick an icon and color based on the action name
const getActionStyle = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('role') || act.includes('permission') || act.includes('ban')) {
        return { icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' };
    }
    if (act.includes('setting') || act.includes('config')) {
        return { icon: Settings, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
    }
    if (act.includes('login') || act.includes('auth')) {
        return { icon: Key, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
    }
    if (act.includes('delete') || act.includes('remove') || act.includes('drop')) {
        return { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
    }
    return { icon: History, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
};

export default function AuditLogs() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getAuditLogs(0, 500); // Fetch latest 500 for timeline
            setLogs(data);
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.target && log.target.toLowerCase().includes(searchTerm.toLowerCase())) ||
        log.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <CyberpunkParticles />

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3 uppercase tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                        <History className="w-8 h-8 text-emerald-500" />
                        Security Audit Timeline
                    </h1>
                    <p className="text-gray-400 mt-1 uppercase tracking-wider text-xs font-bold">Comprehensive chronological log of administrator actions.</p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Filter timeline..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors uppercase tracking-widest text-xs font-bold"
                        />
                    </div>
                    <button
                        onClick={adminApi.exportAuditLogsCsv}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/50 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors whitespace-nowrap"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                    <button
                        onClick={fetchLogs}
                        className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Timeline UI */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
                </div>
            ) : (
                <div className="relative pl-8 md:pl-0">
                    {/* Vertical Timeline Bar (visible on md+) */}
                    <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-1/2"></div>
                    {/* Mobile Timeline Bar */}
                    <div className="md:hidden absolute left-[15px] top-0 bottom-0 w-px bg-white/10"></div>

                    <div className="space-y-8">
                        {filteredLogs.map((log, index) => {
                            const isExpanded = expandedLogId === log.id;
                            const isEven = index % 2 === 0;
                            const style = getActionStyle(log.action);
                            const MIcon = style.icon;

                            return (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`relative flex flex-col md:flex-row justify-between items-start md:items-center w-full ${isEven ? 'md:flex-row-reverse' : ''}`}
                                >
                                    {/* Center Node icon */}
                                    <div className={`absolute left-[-32px] md:left-1/2 top-4 md:top-1/2 -translate-y-1/2 w-8 h-8 rounded-full ${style.bg} border ${style.border} flex items-center justify-center z-10 md:-translate-x-1/2 ring-4 ring-[#0f1115]`}>
                                        <MIcon className={`w-4 h-4 ${style.color}`} />
                                    </div>

                                    {/* Content Card */}
                                    <div className="w-full md:w-[calc(50%-2rem)]">
                                        <div
                                            className={`p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors backdrop-blur-sm cursor-pointer ${isExpanded ? 'ring-1 ring-white/20' : ''}`}
                                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-bold uppercase tracking-widest ${style.color}`}>
                                                        {log.action}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-gray-500 font-mono">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </span>
                                            </div>

                                            <p className="text-gray-300 text-sm mb-3 font-mono break-words">{log.target || 'System'}</p>

                                            <div className="flex items-center justify-between border-t border-white/5 pt-3">
                                                <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-widest">
                                                    <User className="w-3 h-3" />
                                                    {log.username}
                                                </div>

                                                {log.details && (
                                                    <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                                                        <span>View Details JSON</span>
                                                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Expandable JSON Diff Details */}
                                            <AnimatePresence>
                                                {isExpanded && log.details && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="mt-4 pt-4 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                                                            <div className="bg-black/60 rounded-lg p-3 overflow-x-auto border border-white/5">
                                                                <pre className="text-xs font-mono text-gray-300">
                                                                    {JSON.stringify(log.details, null, 2)}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                        {filteredLogs.length === 0 && (
                            <div className="text-center py-20 text-gray-500 font-bold uppercase tracking-widest">
                                No audit logs found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
