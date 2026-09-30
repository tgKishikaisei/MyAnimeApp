import { useState } from 'react';
import { Database, Filter, Play, Download, BarChart2, PieChart, Activity, FileSpreadsheet, FileText, Users, Tv, Film } from 'lucide-react';
import api from '../../api/client';
import { apiErrorDetail, errorMessage } from '../../utils/apiError';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    PieChart as RechartsPie, Pie, Cell, LineChart, Line
} from 'recharts';

const DIMENSIONS = [
    { id: 'date', label: 'Launch Date' },
    { id: 'anime_title', label: 'Anime Title' },
    { id: 'role', label: 'User Role' },
    { id: 'episode', label: 'Episode Number' }
];

const METRICS = [
    { id: 'views', label: 'Total Views' },
    { id: 'unique_viewers', label: 'Unique Viewers' },
    { id: 'total_watch_time', label: 'Watch Time (sec)' },
    { id: 'bandwidth_mb', label: 'Bandwidth (MB)' },
    { id: 'avg_watch_time', label: 'Avg Watch Time' }
];

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

// ── Export Center ─────────────────────────────────────────────────────────────

const EXPORTS = [
    {
        id: 'users',
        label: 'Users',
        description: 'ID, email, role, status, banned_until, created_at',
        icon: Users,
        color: 'blue',
        csvUrl: '/admin/export/users',
        xlsxUrl: '/admin/export/users-xlsx?fmt=xlsx',
    },
    {
        id: 'anime',
        label: 'Anime',
        description: 'ID, title, slug, section, year, rating, description',
        icon: Tv,
        color: 'purple',
        csvUrl: '/admin/export/anime',
        xlsxUrl: '/admin/export/anime-xlsx?fmt=xlsx',
    },
    {
        id: 'clips',
        label: 'Clips',
        description: 'ID, title, anime, season, episode, quality, duration, views',
        icon: Film,
        color: 'emerald',
        csvUrl: '/admin/export/clips?fmt=csv',
        xlsxUrl: '/admin/export/clips?fmt=xlsx',
    },
];

function downloadFromApi(path: string, filename: string) {
    // Через общий клиент: токен из памяти + автоматический refresh.
    api.get(path, { responseType: 'blob' })
        .then(r => r.data as Blob)
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        })
        .catch(() => alert('Export failed. Check that you are logged in as admin.'));
}

function ExportCenter() {
    const [loading, setLoading] = useState<string | null>(null);

    const handleExport = (path: string, filename: string, key: string) => {
        setLoading(key);
        downloadFromApi(path, filename);
        setTimeout(() => setLoading(null), 1500);
    };

    return (
        <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
            <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex items-center gap-3">
                <Download className="w-5 h-5 text-emerald-400" />
                <div>
                    <h3 className="font-bold text-white">Export Center</h3>
                    <p className="text-gray-500 text-xs">Download full table snapshots as CSV or XLSX (Excel)</p>
                </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {EXPORTS.map(exp => {
                    const Icon = exp.icon;
                    const csvKey = `${exp.id}-csv`;
                    const xlsxKey = `${exp.id}-xlsx`;
                    const colorMap: Record<string, string> = {
                        blue: 'from-blue-600/20 to-blue-600/5 border-blue-500/20 text-blue-400',
                        purple: 'from-purple-600/20 to-purple-600/5 border-purple-500/20 text-purple-400',
                        emerald: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
                    };
                    return (
                        <div key={exp.id} className={`bg-gradient-to-br ${colorMap[exp.color]} border rounded-xl p-5`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Icon className="w-5 h-5" />
                                <h4 className="font-bold text-white">{exp.label}</h4>
                            </div>
                            <p className="text-gray-600 text-xs mb-4 leading-relaxed">{exp.description}</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleExport(exp.csvUrl, `${exp.id}.csv`, csvKey)}
                                    disabled={loading === csvKey}
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-black/40 hover:bg-black/70 text-gray-300 text-xs font-bold py-2 px-3 rounded-lg border border-white/10 transition-colors disabled:opacity-50"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    {loading === csvKey ? '…' : 'CSV'}
                                </button>
                                <button
                                    onClick={() => handleExport(exp.xlsxUrl, `${exp.id}.xlsx`, xlsxKey)}
                                    disabled={loading === xlsxKey}
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-xs font-bold py-2 px-3 rounded-lg border border-emerald-500/20 transition-colors disabled:opacity-50"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                    {loading === xlsxKey ? '…' : 'XLSX'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main DataExplorer ─────────────────────────────────────────────────────────

export default function DataExplorer() {
    const [selectedDimensions, setSelectedDimensions] = useState<string[]>(['anime_title']);
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['views']);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [limit, setLimit] = useState(10);
    const [chartType, setChartType] = useState<'bar' | 'pie' | 'line' | 'table'>('bar');
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
    const [queryMetadata, setQueryMetadata] = useState<{ dimensions_used: string[]; metrics_used: string[]; row_count?: number } | null>(null);

    const toggleSelection = (item: string, list: string[], setList: (l: string[]) => void) => {
        setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
    };

    const handleRunQuery = async () => {
        if (!selectedDimensions.length || !selectedMetrics.length) {
            alert("Select at least one Dimension and one Metric.");
            return;
        }
        setIsRunning(true);
        try {
            const res = await api.post('/admin/analytics_ds/explorer', {
                dimensions: selectedDimensions, metrics: selectedMetrics,
                start_date: startDate || undefined, end_date: endDate || undefined, limit,
            });
            setResults(res.data.data);
            setQueryMetadata(res.data.query_info);
        } catch (err) {
            alert("Error: " + (apiErrorDetail(err) || errorMessage(err)));
        } finally { setIsRunning(false); }
    };

    const handleExportCSV = () => {
        if (!results?.length) return;
        const keys = Object.keys(results[0]);
        const csv = "data:text/csv;charset=utf-8," + keys.join(",") + "\n"
            + results.map(r => keys.map(k => `"${r[k]}"`).join(",")).join("\n");
        const a = document.createElement("a");
        a.href = encodeURI(csv);
        a.download = `explorer_${Date.now()}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const renderChart = () => {
        if (!results?.length) return <div className="text-center py-20 text-gray-500">No data found.</div>;
        const xKey = queryMetadata?.dimensions_used[0] || 'id';
        const metrics = queryMetadata?.metrics_used || [];

        if (chartType === 'table') {
            const keys = Object.keys(results[0]);
            return (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs uppercase bg-black/50 text-gray-500">
                            <tr>{keys.map(k => <th key={k} className="px-4 py-3">{k}</th>)}</tr>
                        </thead>
                        <tbody>
                            {results.map((row, i) => (
                                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                    {keys.map(k => <td key={k} className="px-4 py-3">{String(row[k] ?? '')}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (chartType === 'pie') {
            const pieData = results.map(r => ({ name: r[xKey], value: Number(r[metrics[0]]) }));
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <RechartsPie>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={80} outerRadius={150}
                            fill="#8884d8" paddingAngle={2} dataKey="value"
                            label={({ name, percent }) => `${name} (${((percent as number || 0) * 100).toFixed(0)}%)`}>
                            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: '#333' }} />
                        <Legend />
                    </RechartsPie>
                </ResponsiveContainer>
            );
        }

        if (chartType === 'line') {
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={results} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis dataKey={xKey} tick={{ fill: '#9ca3af' }} />
                        <YAxis tick={{ fill: '#9ca3af' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: '#333', color: '#fff' }} />
                        <Legend />
                        {metrics.map((m: string, i: number) => (
                            <Line key={m} type="monotone" dataKey={m} stroke={COLORS[i % COLORS.length]} strokeWidth={3} activeDot={{ r: 8 }} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            );
        }

        return (
            <ResponsiveContainer width="100%" height={400}>
                <BarChart data={results} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey={xKey} tick={{ fill: '#9ca3af' }} />
                    <YAxis tick={{ fill: '#9ca3af' }} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#000', borderColor: '#333', color: '#fff' }} />
                    <Legend />
                    {metrics.map((m: string, i: number) => (
                        <Bar key={m} dataKey={m} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        );
    };

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <Database className="w-8 h-8 text-orange-500" />
                    Data Explorer & Export
                </h2>
                <p className="text-gray-400">BI Query Builder + one-click CSV/XLSX exports for all tables.</p>
            </div>

            <ExportCenter />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
                        <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex items-center gap-2">
                            <Filter className="w-4 h-4 text-blue-400" />
                            <h3 className="font-bold text-white text-sm uppercase">Dimensions</h3>
                        </div>
                        <div className="p-3 space-y-2">
                            {DIMENSIONS.map(d => (
                                <button key={d.id} onClick={() => toggleSelection(d.id, selectedDimensions, setSelectedDimensions)}
                                    className={`w-full text-left px-3 py-2 text-sm rounded transition-colors
                                        ${selectedDimensions.includes(d.id) ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-black/50 text-gray-400 border border-white/5 hover:bg-white/5 hover:text-white'}`}>
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
                        <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-400" />
                            <h3 className="font-bold text-white text-sm uppercase">Metrics</h3>
                        </div>
                        <div className="p-3 space-y-2">
                            {METRICS.map(m => (
                                <button key={m.id} onClick={() => toggleSelection(m.id, selectedMetrics, setSelectedMetrics)}
                                    className={`w-full text-left px-3 py-2 text-sm rounded transition-colors
                                        ${selectedMetrics.includes(m.id) ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-black/50 text-gray-400 border border-white/5 hover:bg-white/5 hover:text-white'}`}>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-4">
                        <h3 className="font-bold text-white text-sm uppercase border-b border-white/10 pb-2">Filters & Limits</h3>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Start Date</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-black border border-white/10 text-white text-sm rounded p-2" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">End Date</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-black border border-white/10 text-white text-sm rounded p-2" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Row Limit</label>
                            <input type="number" min="1" max="1000" value={limit} onChange={e => setLimit(Number(e.target.value))} className="w-full bg-black border border-white/10 text-white text-sm rounded p-2" />
                        </div>
                    </div>

                    <button onClick={handleRunQuery} disabled={isRunning}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                        <Play className="w-5 h-5" fill="currentColor" />
                        {isRunning ? 'Executing SQL...' : 'Run Query Engine'}
                    </button>
                </div>

                {/* Canvas */}
                <div className="lg:col-span-3">
                    <div className="bg-[#111] border border-white/10 rounded-xl h-full flex flex-col overflow-hidden">
                        <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex flex-wrap justify-between items-center gap-4">
                            <div className="flex gap-2 bg-black/50 p-1 rounded-lg border border-white/5">
                                <button onClick={() => setChartType('bar')} className={`p-2 rounded ${chartType === 'bar' ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-white'}`}><BarChart2 className="w-4 h-4" /></button>
                                <button onClick={() => setChartType('line')} className={`p-2 rounded ${chartType === 'line' ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-white'}`}><Activity className="w-4 h-4" /></button>
                                <button onClick={() => setChartType('pie')} className={`p-2 rounded ${chartType === 'pie' ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-white'}`}><PieChart className="w-4 h-4" /></button>
                                <button onClick={() => setChartType('table')} className={`p-2 rounded ${chartType === 'table' ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-white'}`}><Database className="w-4 h-4" /></button>
                            </div>
                            <button onClick={handleExportCSV} disabled={!results?.length}
                                className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-white/10 text-white text-sm font-medium rounded-lg border border-white/10 transition-colors disabled:opacity-50">
                                <Download className="w-4 h-4" /> Export Query CSV
                            </button>
                        </div>
                        <div className="flex-1 p-6 relative min-h-[500px]">
                            {results ? (
                                <>
                                    {renderChart()}
                                    <div className="absolute top-2 right-4 text-xs font-mono text-gray-500 text-right">
                                        Rows: {queryMetadata?.row_count}<br />
                                        Dims: {queryMetadata?.dimensions_used?.join(', ')}<br />
                                        Mets: {queryMetadata?.metrics_used?.join(', ')}
                                    </div>
                                </>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-600">
                                    <Database className="w-16 h-16 mb-4 opacity-20" />
                                    <p className="text-lg">BI Workbench is empty.</p>
                                    <p className="text-sm mt-2">Select dimensions and metrics, then click <b>Run Query</b>.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
