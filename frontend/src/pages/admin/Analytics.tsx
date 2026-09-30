import { useState, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, Legend } from 'recharts';
import { BarChart3, Users, Eye, ArrowUp, Calendar, MonitorSmartphone, Activity, RefreshCw, Flame, SearchX, TrendingDown, ShieldAlert, Clock, UserX, Server, HardDrive, AlertTriangle, Database, ShieldOff, Search } from 'lucide-react';
import { adminApi } from '../../api/admin';

interface AnalyticsData {
    timeline: { date: string; views: number; visitors: number }[];
    totals: { views: number; visitors: number };
    audience?: {
        device_split: { name: string; value: number }[];
        heatmap: { day: number; hour: number; value: number }[];
        retention: { returning_users: number; new_users: number; retention_rate: number };
    };
    content?: {
        drop_rates: { title: string; drops: number }[];
        empty_searches: { query: string; count: number }[];
        hype_tracker: { title: string; comments: number }[];
    };
    trust?: {
        avg_toxicity: number;
        spam_block_rate: number;
        avg_resolution_hours: number;
        repeat_offenders: { username: string; reports: number }[];
    };
    server?: {
        slowest_endpoints: { endpoint: string; avg_time_ms: number }[];
        error_rates: { "4xx": number; "5xx": number; "ok": number };
        storage_mb: { table: string; size_mb: number }[];
        redis_metrics: { hit_rate: number; used_memory_mb: number };
    };
    economics?: {
        seo_score: number;
        adblock_rate: number;
        seo_warnings: string[];
    };
}

export default function Analytics() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<number>(30); // days

    useEffect(() => {
        fetchAnalytics();
    }, [period]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const res = await adminApi.getAnalytics(period);
            setData(res);
        } catch (error) {
            console.error('Failed to fetch analytics', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !data) {
        return <div className="text-white p-8">Loading analytics...</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                    <BarChart3 className="w-8 h-8 text-blue-500" />
                    Content Analytics
                </h1>

                <div className="flex bg-white/5 border border-white/10 rounded-lg p-1">
                    {[7, 30, 90].map(days => (
                        <button
                            key={days}
                            onClick={() => setPeriod(days)}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${period === days ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            {days} Days
                        </button>
                    ))}
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-[#111] border border-white/10 rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:transform group-hover:scale-110 transition-transform">
                        <Eye className="w-16 h-16 text-blue-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Total Views</p>
                        <h3 className="text-4xl font-black text-white">{data?.totals.views.toLocaleString()}</h3>
                        <div className="mt-4 flex items-center gap-2 text-green-500 text-xs font-bold uppercase tracking-wider">
                            <ArrowUp className="w-3 h-3" />
                            <span>In last {period} days</span>
                        </div>
                    </div>
                </div>

                <div className="bg-[#111] border border-white/10 rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:transform group-hover:scale-110 transition-transform">
                        <Users className="w-16 h-16 text-purple-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Unique Visitors</p>
                        <h3 className="text-4xl font-black text-white">{data?.totals.visitors.toLocaleString()}</h3>
                        <div className="mt-4 flex items-center gap-2 text-green-500 text-xs font-bold uppercase tracking-wider">
                            <ArrowUp className="w-3 h-3" />
                            <span>In last {period} days</span>
                        </div>
                    </div>
                </div>

                <div className="bg-[#111] border border-white/10 rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:transform group-hover:scale-110 transition-transform">
                        <Calendar className="w-16 h-16 text-green-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Avg Daily Views</p>
                        <h3 className="text-4xl font-black text-white">
                            {data ? Math.round(data.totals.views / period).toLocaleString() : 0}
                        </h3>
                        <div className="mt-4 flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wider">
                            <span>Per day average</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="bg-[#111] border border-white/10 rounded-xl p-6 mb-8">
                <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-6">Engagement Timeline</h3>
                <div className="h-96 w-full">
                    {loading && data?.timeline.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">Loading chart data...</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data?.timeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="date"
                                    stroke="#52525b"
                                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#52525b"
                                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    dx={-10}
                                />
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                                    itemStyle={{ fontWeight: 'bold' }}
                                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="views"
                                    name="Views"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorViews)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="visitors"
                                    name="Unique Visitors"
                                    stroke="#a855f7"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorVisitors)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Audience Analytics Phase 1 */}
            {data?.audience && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

                    {/* Device Split */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <MonitorSmartphone className="w-5 h-5 text-purple-500" />
                            Device Distribution
                        </h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.audience.device_split}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {data.audience.device_split.map((_, index) => {
                                            const COLORS = ['#3b82f6', '#a855f7', '#10b981', '#f59e0b'];
                                            return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                                        })}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Retention & Heatmap Mini */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6 flex flex-col gap-6">
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
                                <RefreshCw className="w-5 h-5 text-green-500" />
                                Retention Rate
                            </h3>
                            <div className="flex items-center gap-8">
                                <div className="flex-1 bg-white/5 rounded-lg p-4 border border-white/10">
                                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Retention</p>
                                    <h3 className="text-3xl font-black text-green-500">{data.audience.retention.retention_rate}%</h3>
                                </div>
                                <div className="flex-1 flex gap-4">
                                    <div>
                                        <p className="text-gray-500 text-xs font-bold uppercase">Returning</p>
                                        <p className="text-xl font-bold text-white">{data.audience.retention.returning_users}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-xs font-bold uppercase">New</p>
                                        <p className="text-xl font-bold text-white">{data.audience.retention.new_users}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1">
                            <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-orange-500" />
                                Activity Heatmap
                            </h3>
                            <p className="text-xs text-gray-400 mb-4">Volume of logins by hour and day of week</p>
                            <div className="h-40 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                                        <XAxis type="number" dataKey="hour" name="Hour" unit="h" tick={{ fill: '#a1a1aa', fontSize: 10 }} tickCount={24} domain={[0, 23]} axisLine={false} tickLine={false} />
                                        <YAxis type="number" dataKey="day" name="Day" tick={{ fill: '#a1a1aa', fontSize: 10 }} tickCount={7} domain={[1, 7]} axisLine={false} tickLine={false} tickFormatter={(val) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][val - 1] || val} />
                                        <ZAxis type="number" dataKey="value" range={[10, 200]} name="Logins" />
                                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }} />
                                        <Scatter data={data.audience.heatmap} fill="#f59e0b" opacity={0.8} />
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                </div>
            )}

            {/* Content Analytics Phase 2 */}
            {data?.content && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

                    {/* Hype Tracker */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
                            <Flame className="w-5 h-5 text-red-500" />
                            Hype Tracker
                        </h3>
                        <p className="text-xs text-gray-400 mb-6">Top anime by discussion</p>
                        <div className="flex flex-col gap-4">
                            {data.content.hype_tracker.length === 0 ? (
                                <div className="text-gray-500 text-sm">No recent hype data.</div>
                            ) : (
                                data.content.hype_tracker.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center text-xs font-bold">
                                                {idx + 1}
                                            </div>
                                            <span className="text-sm font-bold text-white truncate max-w-[150px]" title={item.title}>
                                                {item.title}
                                            </span>
                                        </div>
                                        <div className="text-red-400 font-bold text-sm">
                                            {item.comments} <span className="text-xs text-gray-500">CMTs</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Empty Searches */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
                            <SearchX className="w-5 h-5 text-blue-500" />
                            Empty Searches
                        </h3>
                        <p className="text-xs text-gray-400 mb-6">Most frequent queries with zero results</p>
                        <div className="flex flex-col gap-4">
                            {data.content.empty_searches.length === 0 ? (
                                <div className="text-gray-500 text-sm">No empty searches recorded.</div>
                            ) : (
                                data.content.empty_searches.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                        <span className="text-sm font-bold text-gray-300 truncate max-w-[170px]" title={item.query}>
                                            "{item.query}"
                                        </span>
                                        <div className="text-blue-400 font-bold text-sm">
                                            {item.count} <span className="text-xs text-gray-500">Reqs</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Drop Rates */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-orange-500" />
                            Highest Drop Rate
                        </h3>
                        <p className="text-xs text-gray-400 mb-6">Anime abandoned in first 30%</p>
                        <div className="flex flex-col gap-4">
                            {data.content.drop_rates.length === 0 ? (
                                <div className="text-gray-500 text-sm">No drop data recorded yet.</div>
                            ) : (
                                data.content.drop_rates.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                        <span className="text-sm font-bold text-white truncate max-w-[170px]" title={item.title}>
                                            {item.title}
                                        </span>
                                        <div className="text-orange-400 font-bold text-sm">
                                            {item.drops} <span className="text-xs text-gray-500">Drops</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            )}

            {/* Trust & Safety Analytics Phase 3 */}
            {data?.trust && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

                    {/* Toxicity & Spam Gauge */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-red-500" />
                            Toxicity & Spam Filter
                        </h3>
                        <div className="flex flex-col gap-8 h-full">
                            <div className="flex-1 bg-white/5 rounded-lg p-5 border border-white/10 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-red-500 to-orange-500"></div>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Avg Toxicity Score</p>
                                <div className="flex items-end gap-3">
                                    <h3 className="text-5xl font-black text-white">{data.trust.avg_toxicity.toFixed(2)}</h3>
                                    <span className="text-sm font-bold text-gray-500 mb-1">/ 1.0</span>
                                </div>
                            </div>
                            <div className="flex-1 bg-white/5 rounded-lg p-5 border border-white/10 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-blue-500 to-purple-500"></div>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Auto-Blocked Spam</p>
                                <div className="flex items-end gap-3">
                                    <h3 className="text-5xl font-black text-white">{data.trust.spam_block_rate}%</h3>
                                    <span className="text-sm font-bold text-gray-500 mb-1">of all comments</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Report Resolution Speed */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-green-500" />
                            Mod Resolution Time
                        </h3>
                        <p className="text-xs text-gray-400 mb-8">Average time to close a user report</p>

                        <div className="flex items-center justify-center h-48">
                            <div className="relative text-center">
                                <svg className="w-40 h-40 transform -rotate-90">
                                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                                    <circle
                                        cx="80"
                                        cy="80"
                                        r="70"
                                        stroke="currentColor"
                                        strokeWidth="8"
                                        fill="transparent"
                                        strokeDasharray={440}
                                        strokeDashoffset={440 - (440 * (Math.min(data.trust.avg_resolution_hours, 72) / 72))}
                                        className={`${data.trust.avg_resolution_hours > 24 ? 'text-red-500' : 'text-green-500'} transition-all duration-1000`}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-4xl font-black text-white">{data.trust.avg_resolution_hours}</span>
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Hours</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Repeat Offenders */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
                            <UserX className="w-5 h-5 text-purple-500" />
                            Repeat Offenders
                        </h3>
                        <p className="text-xs text-gray-400 mb-6">Users with the most reported content</p>
                        <div className="flex flex-col gap-4">
                            {data.trust.repeat_offenders.length === 0 ? (
                                <div className="text-gray-500 text-sm">No reported users yet.</div>
                            ) : (
                                data.trust.repeat_offenders.map((user, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                                            <span className="text-sm font-bold text-white truncate max-w-[150px]">
                                                @{user.username}
                                            </span>
                                        </div>
                                        <div className="text-red-400 font-bold text-sm bg-red-500/10 px-2 rounded">
                                            {user.reports} Flags
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            )}

            {/* System Performance Analytics Phase 4 */}
            {data?.server && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">

                    {/* Slowest API Endpoints */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
                            <Server className="w-5 h-5 text-blue-500" />
                            Database Profiler
                        </h3>
                        <p className="text-xs text-gray-400 mb-6">Slowest executing API endpoints</p>
                        <div className="flex flex-col gap-4">
                            {data.server.slowest_endpoints.length === 0 ? (
                                <div className="text-gray-500 text-sm">No slow queries detected.</div>
                            ) : (
                                data.server.slowest_endpoints.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                        <span className="text-sm font-mono text-gray-300 truncate max-w-[170px]" title={item.endpoint}>
                                            {item.endpoint}
                                        </span>
                                        <div className={`font-bold text-sm ${item.avg_time_ms > 500 ? 'text-red-400' : 'text-blue-400'}`}>
                                            {item.avg_time_ms} <span className="text-xs text-gray-500">ms</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* API Health Radar */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                            API Health Radar
                        </h3>
                        <p className="text-xs text-gray-400 mb-8">HTTP Error codes vs Successes (All time)</p>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                                <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-1">5xx Errors</p>
                                <h3 className="text-4xl font-black text-white">{data.server.error_rates['5xx']}</h3>
                            </div>
                            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                                <p className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-1">4xx Blocks</p>
                                <h3 className="text-4xl font-black text-white">{data.server.error_rates['4xx']}</h3>
                            </div>
                            <div className="col-span-2 bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex justify-between items-center">
                                <div>
                                    <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-1">200 OK</p>
                                    <h3 className="text-3xl font-black text-white">{data.server.error_rates['ok'].toLocaleString()}</h3>
                                </div>
                                <Activity className="w-8 h-8 text-green-500 opacity-50" />
                            </div>
                        </div>
                    </div>

                    {/* Database Storage Breakdown */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
                            <HardDrive className="w-5 h-5 text-purple-500" />
                            PostgreSQL Storage
                        </h3>
                        <p className="text-xs text-gray-400 mb-6">Database Schema size on disk (MB)</p>
                        <div className="flex flex-col gap-4">
                            {data.server.storage_mb.length === 0 ? (
                                <div className="text-gray-500 text-sm">Storage data unavailable.</div>
                            ) : (
                                data.server.storage_mb.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 relative overflow-hidden">
                                        <div
                                            className="absolute left-0 top-0 h-full bg-purple-500/20"
                                            style={{ width: `${Math.min((item.size_mb / (data.server?.storage_mb[0]?.size_mb || 1)) * 100, 100)}%` }}
                                        ></div>
                                        <span className="text-sm font-bold text-white relative z-10 truncate max-w-[150px]">
                                            {item.table}
                                        </span>
                                        <div className="text-purple-400 font-bold text-sm relative z-10">
                                            {item.size_mb} <span className="text-xs text-gray-500">MB</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Redis Cache Stats */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
                            <Database className="w-5 h-5 text-pink-500" />
                            Redis In-Memory Cache
                        </h3>
                        <p className="text-xs text-gray-400 mb-8">Cache Engine Status and Efficiency</p>

                        <div className="flex flex-col gap-6">
                            <div className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-5">
                                <p className="text-pink-400 text-xs font-bold uppercase tracking-widest mb-1">Cache Hit Ratio</p>
                                <div className="flex items-end gap-2">
                                    <h3 className="text-5xl font-black text-white">{data.server.redis_metrics.hit_rate}%</h3>
                                    <span className="text-sm font-bold text-gray-500 mb-1">Efficiency</span>
                                </div>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">RAM Allocated</p>
                                <div className="flex items-end gap-2">
                                    <h3 className="text-4xl font-black text-white">{data.server.redis_metrics.used_memory_mb}</h3>
                                    <span className="text-sm font-bold text-gray-500 mb-1">MB Active</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            )}

            {/* SEO & Economics Analytics Phase 5 */}
            {data?.economics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

                    {/* SEO Health Score */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
                            <Search className="w-5 h-5 text-indigo-500" />
                            SEO Health Score
                        </h3>
                        <p className="text-xs text-gray-400 mb-8">Catalog Optimization and Discoverability</p>

                        <div className="flex gap-8 items-center">
                            <div className="relative text-center w-32 h-32 flex-shrink-0">
                                <svg className="w-32 h-32 transform -rotate-90">
                                    <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/5" />
                                    <circle
                                        cx="64"
                                        cy="64"
                                        r="54"
                                        stroke="currentColor"
                                        strokeWidth="12"
                                        fill="transparent"
                                        strokeDasharray={340}
                                        strokeDashoffset={340 - (340 * (data.economics.seo_score / 100))}
                                        className={`${data.economics.seo_score > 80 ? 'text-green-500' : data.economics.seo_score > 50 ? 'text-yellow-500' : 'text-red-500'} transition-all duration-1000`}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-white">{data.economics.seo_score}</span>
                                </div>
                            </div>

                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-white mb-3">SEO Warnings:</h4>
                                <ul className="flex flex-col gap-2">
                                    {data.economics.seo_warnings.map((warning, idx) => (
                                        <li key={idx} className="flex gap-2 items-start text-sm">
                                            <span className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${data.economics?.seo_score === 100 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            <span className="text-gray-300">{warning}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Ad-Blocker Economics */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-bl-full pointer-events-none"></div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2 relative z-10">
                            <ShieldOff className="w-5 h-5 text-red-500" />
                            Ad-Block Economics
                        </h3>
                        <p className="text-xs text-gray-400 mb-8 relative z-10">Potential revenue loss from active ad-blockers.</p>

                        <div className="flex items-end gap-4 relative z-10">
                            <div>
                                <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-1">Ad-Block Hit Rate</p>
                                <div className="flex items-end gap-2">
                                    <h3 className="text-6xl font-black text-white">{data.economics.adblock_rate}%</h3>
                                    <span className="text-sm font-bold text-gray-500 mb-2">of all visitors</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            )}

        </div>
    );
}
