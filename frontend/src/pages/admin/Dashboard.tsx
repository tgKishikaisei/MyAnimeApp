import { useState, useEffect } from 'react';
import { adminApi, type DashboardStats } from '../../api/admin';
import { Film, Newspaper, FileText, Users, Video, Database, Server, Activity, Clock, TrendingUp, History, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import CyberpunkParticles from '../../components/admin/CyberpunkParticles';
import LiveEventTicker from '../../components/admin/LiveEventTicker';
import ServerHealthWidget from '../../components/admin/ServerHealthWidget';

export default function Dashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await adminApi.getStats();
                setStats(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading || !stats) {
        return <div className="p-8 text-white">Loading dashboard...</div>;
    }

    const handleClearCache = async () => {
        if (!confirm('Are you sure you want to flush the entire Redis cache? This may cause a temporary spike in database load.')) return;
        try {
            await adminApi.clearCache();
            alert('Cache cleared successfully!');
        } catch (error) {
            console.error(error);
            alert('Failed to clear cache.');
        }
    };

    const cards = [
        { title: 'Total Users', value: stats.users, icon: Users, color: 'bg-purple-500/20 text-purple-500 border-purple-500/20' },
        { title: 'Total Anime', value: stats.anime, icon: Film, color: 'bg-red-500/20 text-red-500 border-red-500/20' },
        { title: 'Total Clips', value: stats.clips, icon: Video, color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/20' },
        { title: 'Total News', value: stats.news, icon: Newspaper, color: 'bg-blue-500/20 text-blue-500 border-blue-500/20' },
        { title: 'Blog Posts', value: stats.blog, icon: FileText, color: 'bg-green-500/20 text-green-500 border-green-500/20' },
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
    };

    return (
        <div className="relative min-h-screen">
            {/* Particles Background */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-60">
                <CyberpunkParticles />
            </div>

            {/* Main Content Container (z-index above particles) */}
            <div className="relative z-10 p-2">
                <motion.h1
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-3xl font-black text-white mb-8 tracking-tighter uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                >
                    Dashboard
                </motion.h1>

                {/* Content Stats */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6"
                >
                    {cards.map((card) => (
                        <motion.div
                            variants={itemVariants}
                            whileHover={{ scale: 1.05, y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px 0px rgba(0, 210, 255, 0.2)" }}
                            key={card.title}
                            className={`relative overflow-hidden p-6 rounded-xl border backdrop-blur-md bg-opacity-20 ${card.color} flex flex-col justify-between group`}
                        >
                            {/* Animated Border Glow */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[100%] group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />

                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <p className="text-sm font-bold uppercase tracking-wider opacity-90">{card.title}</p>
                                <card.icon className="w-6 h-6 opacity-70 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                            </div>
                            <motion.p
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                className="text-4xl font-black relative z-10 drop-shadow-md"
                            >
                                {card.value}
                            </motion.p>
                        </motion.div>
                    ))}
                </motion.div>

                {/* System Health */}
                <h2 className="text-xl font-bold text-white mt-12 mb-6 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-500" />
                    System Health
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Postgres Card */}
                    <div className="p-6 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-lg ${stats.system.postgres === 'online' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                                <Database className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-white font-bold text-lg">PostgreSQL Database</p>
                                <p className="text-sm text-gray-400">Primary Data Storage</p>
                            </div>
                        </div>
                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${stats.system.postgres === 'online' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                            {stats.system.postgres}
                        </div>
                    </div>

                    {/* Redis Card */}
                    <div className="p-6 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-lg ${stats.system.redis === 'online' ? 'bg-red-500/20 text-red-500' : 'bg-gray-500/20 text-gray-400'}`}>
                                <Server className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-white font-bold text-lg">Redis Cache</p>
                                <p className="text-sm text-gray-400">High Performance Memory Store</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${stats.system.redis === 'online' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                {stats.system.redis}
                            </div>
                            {stats.system.redis === 'online' && (
                                <button
                                    onClick={handleClearCache}
                                    className="text-xs font-bold uppercase bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded transition-colors"
                                >
                                    Clear Cache
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Hardware Health & Grafana Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">

                    {/* Server Hardware Health (Replaces Storage) */}
                    <div className="lg:col-span-1">
                        <ServerHealthWidget />
                    </div>

                    {/* Grafana Iframe 1 - RPS/Latency */}
                    <div className="p-6 rounded-xl border border-white/10 bg-white/5 lg:col-span-2 overflow-hidden flex flex-col">
                        <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="w-5 h-5 text-yellow-500" />
                            API Traffic (Grafana)
                        </h2>
                        <div className="flex-1 min-h-[200px] bg-black/50 rounded border border-white/5 relative">
                            {/* 
                            We point this to the local Grafana instance. Note that in a real production environment, 
                            this URL would be your public Grafana domain, and you'd use a specific panel ID.
                            For now, this attempts to load the default Grafana home/dashboard if embedded. 
                        */}
                            <iframe
                                src="http://localhost:3000/d-solo/fastapi-monitoring/fastapi-monitoring?orgId=1&theme=dark&panelId=2"
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                title="Grafana Traffic"
                                className="absolute inset-0"
                                // Fallback if localhost:3000 isn't reachable or dashboard isn't setup perfectly yet
                                onError={(e) => {
                                    const target = e.target as HTMLIFrameElement;
                                    target.style.display = 'none';
                                    target.parentElement!.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-600 uppercase tracking-widest">Connect Grafana to view live metrics</div>';
                                }}
                            ></iframe>
                        </div>
                    </div>

                </div>

                {/* Bottom Row: Recent Signups & Top Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">

                    {/* Recent Users */}
                    <div className="p-6 rounded-xl border border-white/10 bg-white/5">
                        <h2 className="text-lg font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-5 h-5 text-purple-500" />
                            Recent Signups
                        </h2>
                        <div className="space-y-4">
                            {stats.recent_users.map(user => (
                                <div key={user.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center font-bold overflow-hidden shrink-0">
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xs uppercase leading-none">{user.username.substring(0, 2)}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-white font-bold truncate text-sm leading-tight">{user.username}</p>
                                        <p className="text-xs text-gray-400 truncate mt-0.5">{user.email}</p>
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-mono tracking-wider shrink-0 uppercase">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                            {stats.recent_users.length === 0 && <p className="text-gray-500 text-sm font-bold uppercase tracking-widest text-center py-4">No recent signups</p>}
                        </div>
                    </div>

                    {/* Trending Content */}
                    <div className="p-6 rounded-xl border border-white/10 bg-white/5">
                        <h2 className="text-lg font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-red-500" />
                            Trending Clips
                        </h2>
                        <div className="space-y-4">
                            {stats.top_clips.map((clip, idx) => (
                                <div key={clip.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors">
                                    <span className={`text-lg font-black w-4 text-center ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-700' : 'text-gray-600'}`}>
                                        {idx + 1}
                                    </span>
                                    <div className="w-16 h-10 rounded bg-black/50 overflow-hidden shrink-0 flex items-center justify-center border border-white/5">
                                        {clip.thumbnail ? (
                                            <img src={clip.thumbnail} alt="thumb" className="w-full h-full object-cover opacity-80" />
                                        ) : (
                                            <Video className="w-4 h-4 text-gray-600" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-white font-bold truncate text-sm mb-1">{clip.title}</p>
                                        <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{clip.views.toLocaleString()} views</p>
                                    </div>
                                </div>
                            ))}
                            {stats.top_clips.length === 0 && <p className="text-gray-500 text-sm font-bold uppercase tracking-widest text-center py-4">No trending clips</p>}
                        </div>
                    </div>

                    {/* Live Event Stream */}
                    <div className="lg:col-span-1">
                        <LiveEventTicker />
                    </div>
                </div>

                {/* Audit Log (Moved below) */}
                <div className="mt-6 p-6 rounded-xl border border-white/10 bg-white/5">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <History className="w-5 h-5 text-green-500" />
                            Audit Log
                        </h2>
                        <button
                            onClick={() => adminApi.exportAuditLogsCsv()}
                            className="text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded flex items-center gap-2 text-white transition-colors"
                        >
                            <Download className="w-3 h-3" /> Export CSV
                        </button>
                    </div>
                    <div className="space-y-4">
                        {stats.recent_logs.map(log => (
                            <div key={log.id} className="border-l-2 border-green-500/50 pl-4 py-2 hover:bg-white/5 rounded-r-lg transition-colors">
                                <p className="text-sm text-white font-bold leading-none mb-2">{log.action}</p>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400 font-mono tracking-tight bg-black/50 px-2 py-0.5 rounded">{log.target}</span>
                                    <span className="text-gray-600 font-bold tracking-widest uppercase">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                        ))}
                        {stats.recent_logs.length === 0 && <p className="text-gray-500 text-sm font-bold uppercase tracking-widest text-center py-4">No recent activity</p>}
                    </div>
                </div>

            </div>
        </div>
    );
}
