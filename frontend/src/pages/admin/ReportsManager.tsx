import { useState, useEffect } from 'react';
import { adminApi, type Report } from '../../api/admin';
import { Flag, Trash2, CheckCircle, XCircle, Search } from 'lucide-react';

import { apiErrorDetail } from '../../utils/apiError';
export default function ReportsManager() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');

    // Bulk select
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const fetchReports = async () => {
        try {
            const data = await adminApi.getReports();
            setReports(data);
        } catch (err) {
            setError(apiErrorDetail(err) || 'Failed to fetch reports');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReports(); }, []);

    const handleUpdateStatus = async (reportId: number, status: 'resolved' | 'dismissed') => {
        if (!confirm(`Mark this report as ${status}?`)) return;
        try {
            await adminApi.updateReportStatus(reportId, status);
            await fetchReports();
        } catch (err) {
            alert(apiErrorDetail(err) || `Failed to mark report as ${status}`);
        }
    };

    const handleDelete = async (reportId: number) => {
        if (!confirm('Are you sure you want to completely delete this report?')) return;
        try {
            await adminApi.deleteReport(reportId);
            setSelectedIds(prev => { const next = new Set(prev); next.delete(reportId); return next; });
            await fetchReports();
        } catch (err) {
            alert(apiErrorDetail(err) || 'Failed to delete report');
        }
    };

    const filtered = reports.filter(r => {
        const matchSearch = !searchTerm || r.reason?.toLowerCase().includes(searchTerm.toLowerCase()) || String(r.target_id).includes(searchTerm);
        const matchStatus = statusFilter === 'all' || r.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const allSelected = filtered.length > 0 && filtered.every(r => selectedIds.has(r.id));
    const someSelected = filtered.some(r => selectedIds.has(r.id));

    const toggleSelect = (id: number) => setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const toggleSelectAll = () => {
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(filtered.map(r => r.id)));
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedIds.size} selected reports?`)) return;
        setIsBulkDeleting(true);
        let failed = 0;
        for (const id of Array.from(selectedIds)) {
            try { await adminApi.deleteReport(id); } catch { failed++; }
        }
        setSelectedIds(new Set());
        await fetchReports();
        setIsBulkDeleting(false);
        if (failed > 0) alert(`${failed} items failed.`);
    };

    if (loading) return <div className="p-8 text-white">Loading reports...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                    <Flag className="w-8 h-8 text-red-500" />
                    Moderation Reports
                </h1>
            </div>

            {error && <div className="bg-red-500/10 text-red-500 p-4 rounded mb-6 font-bold">{error}</div>}

            <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="text-white font-bold text-base">Reports</span>
                        {someSelected && (
                            <>
                                <span className="text-gray-600">›</span>
                                <span className="text-white font-medium">({selectedIds.size}) selected</span>
                                <button onClick={() => setSelectedIds(new Set())} className="text-gray-500 hover:text-white text-xs ml-1">✕ clear</button>
                            </>
                        )}
                    </div>
                    {someSelected && (
                        <button
                            onClick={handleBulkDelete}
                            disabled={isBulkDeleting}
                            className="flex items-center gap-2 bg-red-700/80 hover:bg-red-600 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm font-bold transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            {isBulkDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
                        </button>
                    )}
                </div>

                {/* Status filters */}
                <div className="px-6 py-3 border-b border-white/10 flex gap-1">
                    {(['all', 'pending', 'resolved', 'dismissed'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${statusFilter === s ? 'bg-white text-black' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="px-6 py-3 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search by reason or target ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 text-white rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 placeholder-gray-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-black/30 text-xs uppercase tracking-widest text-gray-600 font-bold">
                                <th className="px-4 py-3 w-10">
                                    <div
                                        onClick={toggleSelectAll}
                                        className="w-5 h-5 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center border-white/40 hover:border-white"
                                        style={allSelected ? { borderColor: 'white', background: 'white' } : someSelected ? { borderColor: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.15)' } : {}}
                                    >
                                        {allSelected && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                                        {someSelected && !allSelected && <div className="w-1.5 h-1.5 rounded-full bg-white/70" />}
                                    </div>
                                </th>
                                <th className="px-4 py-3">Reporter</th>
                                <th className="px-4 py-3">Target</th>
                                <th className="px-4 py-3">Reason</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12">
                                        <Flag className="w-8 h-8 mx-auto mb-2 opacity-20 text-gray-500" />
                                        <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">No reports found</p>
                                    </td>
                                </tr>
                            ) : filtered.map((report) => {
                                const isSelected = selectedIds.has(report.id);
                                return (
                                    <tr key={report.id} className={`transition-colors group ${isSelected ? 'bg-white/5' : 'hover:bg-white/[0.03]'}`}>
                                        <td className="px-4 py-3">
                                            <div
                                                onClick={() => toggleSelect(report.id)}
                                                className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center ${isSelected ? 'border-white bg-white' : 'border-white/30 bg-transparent group-hover:border-white/60'}`}
                                            >
                                                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-white font-mono text-sm">{report.user_id ? `#${report.user_id}` : 'Anonymous'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold uppercase tracking-wider text-xs text-blue-400">{report.target_type}</span>
                                                <span className="text-xs font-mono text-gray-500">ID: {report.target_id}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate" title={report.reason}>{report.reason}</td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(report.created_at).toLocaleDateString()}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${report.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : report.status === 'resolved' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-400'}`}>
                                                {report.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {report.status === 'pending' && (
                                                    <>
                                                        <button onClick={() => handleUpdateStatus(report.id, 'resolved')} className="p-1.5 hover:bg-green-500/20 text-green-500 rounded transition-colors" title="Mark Resolved">
                                                            <CheckCircle className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleUpdateStatus(report.id, 'dismissed')} className="p-1.5 hover:bg-gray-500/20 text-gray-400 rounded transition-colors" title="Dismiss">
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                <button onClick={() => handleDelete(report.id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors" title="Delete">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
