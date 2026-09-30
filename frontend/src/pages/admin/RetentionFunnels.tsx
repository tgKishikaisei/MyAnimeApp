import { useState, useEffect } from 'react';
import { Filter, Users, TrendingDown } from 'lucide-react';
import api from '../../api/client';
import { animeApi } from '../../api/anime';
import type { Anime } from '../../api/types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

interface FunnelData {
    episode: number;
    unique_viewers: number;
    total_views: number;
    bandwidth_mb: number;
    retention_pct: number;
}

interface CohortData {
    cohort_date: string;
    total_users: number;
    retention_by_week: number[];
}

export default function RetentionFunnels() {
    const [animes, setAnimes] = useState<Anime[]>([]);
    const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);
    const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
    const [cohorts, setCohorts] = useState<CohortData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Fetch all anime for the dropdown
                const animeList = await animeApi.getAll();
                setAnimes(animeList);
                if (animeList.length > 0) {
                    setSelectedAnimeId(animeList[0].id);
                }

                // Fetch global cohorts
                const cohortRes = await api.get('/admin/analytics_ds/cohorts');
                setCohorts(cohortRes.data.cohorts || []);
            } catch (err) {
                console.error("Failed to load DS analytics init data", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (!selectedAnimeId) return;
        const fetchFunnel = async () => {
            try {
                const res = await api.get(`/admin/analytics_ds/funnels/${selectedAnimeId}`);
                setFunnelData(res.data.funnel || []);
            } catch (err) {
                console.error("Failed to load funnel for anime", err);
            }
        };
        fetchFunnel();
    }, [selectedAnimeId]);

    // Color gradient for the funnel bars (Green to Red as it drops)
    const getBarColor = (retention: number) => {
        if (retention >= 80) return '#10b981'; // green
        if (retention >= 50) return '#f59e0b'; // yellow
        return '#ef4444'; // red
    };

    if (isLoading) return <div>Loading Data Science Engine...</div>;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <Filter className="w-8 h-8 text-emerald-500" />
                    Audience Retention & Funnels
                </h2>
                <p className="text-gray-400">Deep Cohort Analysis and Drop-Off tracking.</p>
            </div>

            {/* Top Analysis: Drop-off Funnel */}
            <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-white/10 pb-6">
                    <div>
                        <h3 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-red-500" />
                            Episode Drop-Off Funnel
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Analyzes how many users start Episode 1 and survive to Episode N.
                        </p>
                    </div>

                    <select
                        className="bg-black border border-white/20 text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5"
                        value={selectedAnimeId || ''}
                        onChange={(e) => setSelectedAnimeId(Number(e.target.value))}
                    >
                        {animes.map(a => (
                            <option key={a.id} value={a.id}>{a.title}</option>
                        ))}
                    </select>
                </div>

                {funnelData.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 italic">No watch data available for this Anime yet.</div>
                ) : (
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={funnelData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="episode" tick={{ fill: '#9ca3af' }} tickFormatter={(v) => `Ep ${v}`} />
                                <YAxis yAxisId="left" tick={{ fill: '#9ca3af' }} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af' }} tickFormatter={(v) => `${v}%`} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#000', borderColor: '#333', color: '#fff' }}
                                    formatter={(value, name) => {
                                        if (name === 'retention_pct') return [`${value}%`, 'Survival Rate'];
                                        if (name === 'unique_viewers') return [value, 'Unique Viewers'];
                                        return [value, name];
                                    }}
                                />
                                <Bar yAxisId="left" dataKey="unique_viewers" name="Unique Viewers" radius={[4, 4, 0, 0]}>
                                    {funnelData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={getBarColor(entry.retention_pct)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Bottom Analysis: User Cohorts Matrix */}
            <div className="bg-[#111] border border-white/10 rounded-xl p-6 overflow-hidden">
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500" />
                        User Retention Cohorts (Weekly)
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Table reads Left to Right: Of the users who signed up on Week X, what % returned in subsequent weeks?
                    </p>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    {cohorts.length === 0 ? (
                        <div className="text-center py-20 text-gray-500 italic">Collecting cohort data...</div>
                    ) : (
                        <table className="w-full text-sm text-left text-gray-400">
                            <thead className="text-xs uppercase bg-black/50 text-gray-500 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 min-w-[120px]">Cohort Week</th>
                                    <th className="px-4 py-3 text-center">Total Users</th>
                                    <th className="px-4 py-3 text-center border-l border-white/10 bg-white/5">Week 0</th>
                                    <th className="px-4 py-3 text-center border-l border-white/10">Week 1</th>
                                    <th className="px-4 py-3 text-center border-l border-white/10">Week 2</th>
                                    <th className="px-4 py-3 text-center border-l border-white/10">Week 3</th>
                                    <th className="px-4 py-3 text-center border-l border-white/10">Week 4</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cohorts.map((cohort, idx) => (
                                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="px-4 py-3 font-medium text-white">{cohort.cohort_date}</td>
                                        <td className="px-4 py-3 text-center font-bold">{cohort.total_users}</td>

                                        {[0, 1, 2, 3, 4].map(weekIndex => {
                                            const pct = cohort.retention_by_week[weekIndex];
                                            let bgClass = "bg-black/20 text-gray-600"; // No data
                                            if (pct !== undefined) {
                                                if (pct >= 80) bgClass = "bg-emerald-500/80 text-white font-bold";
                                                else if (pct >= 50) bgClass = "bg-emerald-500/50 text-emerald-100 font-bold";
                                                else if (pct >= 20) bgClass = "bg-emerald-500/20 text-emerald-200";
                                                else bgClass = "bg-red-500/20 text-red-200";
                                            }

                                            return (
                                                <td key={weekIndex} className="p-1 border-l border-white/5 text-center">
                                                    <div className={`w-full h-full py-2 rounded ${bgClass}`}>
                                                        {pct !== undefined ? `${pct.toFixed(0)}%` : '-'}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

        </div>
    );
}
