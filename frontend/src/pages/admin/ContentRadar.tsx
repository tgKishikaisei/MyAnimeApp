import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Flame, Clock } from 'lucide-react';
import api from '../../api/client';
import type { Anime } from '../../api/types';
import { animeApi } from '../../api/anime';

interface HeatPoint {
    second: number;
    timeLabel: string;
    views: number;
}

export default function ContentRadar() {
    const [animes, setAnimes] = useState<Anime[]>([]);
    const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);
    // Тепловая карта хранится вместе с id аниме: loading вычисляется, а не выставляется в эффекте.
    const [heatmap, setHeatmap] = useState<{ id: number; data: HeatPoint[] } | null>(null);
    const [animesLoaded, setAnimesLoaded] = useState(false);
    const heatmapData = heatmap && heatmap.id === selectedAnimeId ? heatmap.data : [];
    const loading = !animesLoaded || (selectedAnimeId !== null && heatmap?.id !== selectedAnimeId);

    // 1. Fetch available animes
    useEffect(() => {
        animeApi.getAll().then(data => {
            setAnimes(data);
            if (data.length > 0) setSelectedAnimeId(data[0].id);
            setAnimesLoaded(true);
        });
    }, []);

    // 2. Fetch heatmap for selected anime
    useEffect(() => {
        if (!selectedAnimeId) return;
        let cancelled = false;
        // Build a new route in analytics or anime to GET the heatmap
        // For now we assume a dedicated GET route in our analytics router
        api.get(`/analytics/heatmap/${selectedAnimeId}`)
            .then(res => {
                // Heatmap comes as {"12": 4, "13": 5, "100": 1, ...}
                // We need to map it to an array sorted by second
                const rawData = res.data?.heatmap_data || {};

                let maxSecond = 0;
                for (const sec in rawData) {
                    maxSecond = Math.max(maxSecond, parseInt(sec));
                }

                // Generate empty bins up to the max scrubbed second
                const chartData: HeatPoint[] = [];
                for (let i = 0; i <= maxSecond; i++) {
                    chartData.push({
                        second: i,
                        timeLabel: new Date(i * 1000).toISOString().substr(14, 5),
                        views: rawData[String(i)] || 0
                    });
                }

                if (!cancelled) setHeatmap({ id: selectedAnimeId, data: chartData });
            })
            .catch(err => {
                console.error("Failed to fetch heatmap", err);
                if (!cancelled) setHeatmap({ id: selectedAnimeId, data: [] });
            });
        return () => { cancelled = true; };
    }, [selectedAnimeId]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <Flame className="w-8 h-8 text-orange-500" />
                    Content Heatmap Radar
                </h2>
                <p className="text-gray-400">Track exact viewer retention drops and hype moments second-by-second.</p>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-xl p-6">

                {/* Selector Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <h3 className="text-white font-bold uppercase tracking-widest text-sm">Select Target:</h3>
                        <select
                            className="bg-black border border-white/20 text-white rounded px-4 py-2 hover:border-orange-500 transition-colors cursor-pointer outline-none"
                            value={selectedAnimeId || ''}
                            onChange={(e) => setSelectedAnimeId(parseInt(e.target.value))}
                        >
                            {animes.map(a => (
                                <option key={a.id} value={a.id}>{a.title}</option>
                            ))}
                        </select>
                    </div>

                    {heatmapData.length > 0 && (
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                                <Clock className="w-4 h-4 text-orange-500" />
                                Tracked Length: {heatmapData[heatmapData.length - 1]?.timeLabel || "00:00"}
                            </div>
                        </div>
                    )}
                </div>

                {/* Heatmap Area Chart */}
                <div className="h-[400px]">
                    {loading ? (
                        <div className="h-full flex items-center justify-center text-orange-500 animate-pulse">Scanning DB...</div>
                    ) : heatmapData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-500">No telemetry data collected yet.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={heatmapData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ff5500" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#ff5500" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="timeLabel"
                                    stroke="#555"
                                    minTickGap={50} // Don't crowd 00:01, 00:02 etc
                                />
                                <YAxis stroke="#555" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', borderColor: '#ff5500', color: 'white' }}
                                    itemStyle={{ color: '#ff5500', fontWeight: 'bold' }}
                                    labelStyle={{ color: '#999' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="views"
                                    stroke="#ff5500"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorViews)"
                                    activeDot={{ r: 6, fill: "#fff", stroke: "#ff5500", strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
}
