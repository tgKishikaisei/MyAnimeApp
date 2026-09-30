import { useState, useEffect } from 'react';
import { adminApi } from '../../api/admin';
import { animeApi } from '../../api/anime';
import { Save, Search, AlertCircle, Loader2, FileText } from 'lucide-react';

import { apiErrorDetail } from '../../utils/apiError';
interface AnimeSeoData {
    id: number;
    title: string;
    slug: string;
    description: string;
}

export default function SEOManager() {
    const [animes, setAnimes] = useState<AnimeSeoData[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        fetchAnimes();
    }, []);

    const fetchAnimes = async () => {
        setLoading(true);
        try {
            const data = await animeApi.getAll();
            setAnimes(data.map((item) => ({
                id: item.id,
                title: item.title,
                slug: item.slug || '',
                description: item.description || ''
            })));
        } catch (error) {
            console.error('Failed to fetch animes for SEO', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (id: number, field: keyof AnimeSeoData, value: string) => {
        setAnimes(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
        setDirtyIds(prev => new Set(prev).add(id));
    };

    const handleSave = async () => {
        if (dirtyIds.size === 0) return;

        setSaving(true);
        setSuccessMessage('');
        setErrorMessage('');

        const updates = animes
            .filter(a => dirtyIds.has(a.id))
            .map(a => ({
                id: a.id,
                title: a.title,
                slug: a.slug,
                description: a.description
            }));

        try {
            const res = await adminApi.updateAnimeSeo(updates);
            setSuccessMessage(res.message);
            setDirtyIds(new Set()); // clear dirty state
        } catch (error) {
            console.error('Failed to save SEO updates', error);
            setErrorMessage(apiErrorDetail(error) || 'Failed to apply SEO updates');
        } finally {
            setSaving(false);
            setTimeout(() => setSuccessMessage(''), 3000);
        }
    };

    const filteredAnimes = animes.filter(a => a.title.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="relative pb-20">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                    <FileText className="w-8 h-8 text-blue-500" />
                    Mass SEO Management
                </h1>
            </div>

            {errorMessage && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-bold">{errorMessage}</span>
                </div>
            )}

            <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="text-white font-bold text-base">SEO Fields</span>
                        {dirtyIds.size > 0 && (
                            <>
                                <span className="text-gray-600">›</span>
                                <span className="text-blue-400 font-medium text-xs">{dirtyIds.size} unsaved</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div className="px-6 py-3 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search anime..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 text-white rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 placeholder-gray-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-black/30 border-b border-white/5 text-xs uppercase tracking-widest text-gray-600 text-left font-bold">
                                <th className="px-4 py-3 w-1/4">Title (H1 & Meta)</th>
                                <th className="px-4 py-3 w-1/4">URL Slug</th>
                                <th className="px-4 py-3 w-full">Description (Meta)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-10 text-center text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Loading catalog...
                                    </td>
                                </tr>
                            ) : filteredAnimes.map((anime) => {
                                const isDirty = dirtyIds.has(anime.id);
                                return (
                                    <tr key={anime.id} className={`hover:bg-white/[0.03] transition-colors ${isDirty ? 'bg-blue-900/10' : ''}`}>
                                        <td className="px-4 py-3">
                                            <input
                                                value={anime.title}
                                                onChange={(e) => handleFieldChange(anime.id, 'title', e.target.value)}
                                                className={`w-full bg-black/30 border px-3 py-1.5 rounded text-white text-sm focus:outline-none transition-colors ${isDirty ? 'border-blue-500' : 'border-white/10 focus:border-white/30'}`}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                value={anime.slug}
                                                onChange={(e) => handleFieldChange(anime.id, 'slug', e.target.value)}
                                                className={`w-full bg-black/30 border px-3 py-1.5 rounded text-white text-sm focus:outline-none transition-colors ${isDirty ? 'border-blue-500' : 'border-white/10 focus:border-white/30'}`}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <textarea
                                                value={anime.description}
                                                onChange={(e) => handleFieldChange(anime.id, 'description', e.target.value)}
                                                rows={2}
                                                className={`w-full bg-black/30 border px-3 py-1.5 rounded text-white text-sm focus:outline-none transition-colors resize-y min-h-[40px] ${isDirty ? 'border-blue-500' : 'border-white/10 focus:border-white/30'}`}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Floating Save Bar */}
            {dirtyIds.size > 0 && (
                <div className="fixed bottom-0 left-64 right-0 p-4 bg-black/80 backdrop-blur-xl border-t border-white/10 flex items-center justify-between z-50 animate-in slide-in-from-bottom flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                        <span className="text-white font-bold tracking-wider">{dirtyIds.size} unsaved changes</span>
                    </div>

                    <div className="flex items-center gap-4">
                        {successMessage && <span className="text-green-500 font-bold text-sm tracking-widest uppercase">{successMessage}</span>}
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black tracking-widest uppercase shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? 'Saving...' : 'Deploy SEO Updates'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
