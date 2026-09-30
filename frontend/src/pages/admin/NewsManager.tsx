import { useState, useEffect } from 'react';
import { newsApi } from '../../api/news';
import type { News } from '../../api/types';
import { Plus, Trash2, ExternalLink, Search, X } from 'lucide-react';

import { apiErrorDetail } from '../../utils/apiError';
export default function NewsManager() {
    const [news, setNews] = useState<News[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Bulk select
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        video_id: '',
        image: ''
    });

    useEffect(() => { fetchNews(); }, []);

    const fetchNews = async () => {
        try {
            setIsLoading(true);
            const data = await newsApi.getAll();
            setNews(data);
        } catch (error) {
            console.error("Failed to fetch news", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this news item?')) return;
        try {
            await newsApi.delete(id);
            setNews(news.filter(n => n.id !== id));
            setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        } catch (error) {
            console.error("Failed to delete", error);
            alert(apiErrorDetail(error) || 'Failed to delete news item.');
        }
    };

    const handleCreate = async () => {
        try {
            await newsApi.create(formData);
            setIsModalOpen(false);
            fetchNews();
            setFormData({ title: '', video_id: '', image: '' });
        } catch (error) {
            console.error("Failed to create", error);
        }
    };

    const filtered = news.filter(n => n.title?.toLowerCase().includes(searchTerm.toLowerCase()));
    const allSelected = filtered.length > 0 && filtered.every(n => selectedIds.has(n.id));
    const someSelected = filtered.some(n => selectedIds.has(n.id));

    const toggleSelect = (id: number) => setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const toggleSelectAll = () => {
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(filtered.map(n => n.id)));
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedIds.size} selected news items?`)) return;
        setIsBulkDeleting(true);
        let failed = 0;
        for (const id of Array.from(selectedIds)) {
            try { await newsApi.delete(id); } catch { failed++; }
        }
        setSelectedIds(new Set());
        await fetchNews();
        setIsBulkDeleting(false);
        if (failed > 0) alert(`${failed} items failed to delete.`);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase">News Manager</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-bold transition-colors"
                >
                    <Plus className="w-5 h-5" /> Add News
                </button>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
                {/* Header with selected count */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="text-white font-bold text-base">News List</span>
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

                {/* Search */}
                <div className="px-6 py-3 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search news..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 text-white rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 placeholder-gray-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-gray-400">
                        <thead className="bg-black/30 text-xs uppercase font-bold text-gray-600 border-b border-white/5">
                            <tr>
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
                                <th className="px-4 py-3">Video ID</th>
                                <th className="px-4 py-3">Title</th>
                                <th className="px-4 py-3">Preview</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr><td colSpan={5} className="text-center py-10 text-gray-500">Loading...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-10 text-gray-500">No news found</td></tr>
                            ) : filtered.map((item) => {
                                const isSelected = selectedIds.has(item.id);
                                return (
                                    <tr key={item.id} className={`transition-colors group ${isSelected ? 'bg-white/5' : 'hover:bg-white/[0.03]'}`}>
                                        <td className="px-4 py-3">
                                            <div
                                                onClick={() => toggleSelect(item.id)}
                                                className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center ${isSelected ? 'border-white bg-white' : 'border-white/30 bg-transparent group-hover:border-white/60'}`}
                                            >
                                                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{item.video_id}</td>
                                        <td className="px-4 py-3 font-medium text-white max-w-xs truncate">{item.title}</td>
                                        <td className="px-4 py-3">
                                            <a href={`https://youtu.be/${item.video_id}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm">
                                                Watch <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => handleDelete(item.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-[#111] border border-white/10 p-8 rounded-xl max-w-md w-full">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">Add News Video</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-500 mb-1">YouTube Video ID</label>
                                <input type="text" className="w-full bg-black border border-white/10 text-white rounded p-2 focus:border-red-600 outline-none" value={formData.video_id} onChange={(e) => setFormData({ ...formData, video_id: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-500 mb-1">Title (Optional)</label>
                                <input type="text" className="w-full bg-black border border-white/10 text-white rounded p-2 focus:border-red-600 outline-none" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                            <button onClick={handleCreate} className="px-4 py-2 bg-red-600 text-white rounded font-bold">Create</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
