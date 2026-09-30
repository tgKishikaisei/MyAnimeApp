import { useState, useEffect } from 'react';
import { adminApi } from '../../api/admin';
import { MessageSquare, Trash2, Search } from 'lucide-react';

interface AdminComment {
    id: number;
    content: string;
    created_at: string;
    is_deleted: boolean;
    target_type: string;
    target_id: number;
    user_id: number;
    username: string;
    avatar_url?: string | null;
}

export default function CommentsManager() {
    const [comments, setComments] = useState<AdminComment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    // Bulk select
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    useEffect(() => { fetchComments(); }, []);

    const fetchComments = async () => {
        setIsLoading(true);
        try {
            const data = await adminApi.getComments();
            setComments(data);
        } catch (error) {
            console.error('Failed to fetch comments', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure? This comment will be replaced with a [Deleted] tombstone.')) return;
        try {
            await adminApi.deleteComment(id);
            setComments(prev => prev.map(c => c.id === id ? { ...c, is_deleted: true, content: '[Deleted by Administrator]' } : c));
            setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        } catch (error) {
            console.error('Failed to delete comment', error);
            alert('Error deleting comment');
        }
    };

    const targetTypes = ['all', ...Array.from(new Set(comments.map(c => c.target_type).filter(Boolean)))];

    const filtered = comments.filter(c => {
        const matchSearch = !searchTerm || c.username?.toLowerCase().includes(searchTerm.toLowerCase()) || c.content?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchType = typeFilter === 'all' || c.target_type === typeFilter;
        return matchSearch && matchType;
    });

    const activeFiltered = filtered.filter(c => !c.is_deleted);
    const allSelected = activeFiltered.length > 0 && activeFiltered.every(c => selectedIds.has(c.id));
    const someSelected = activeFiltered.some(c => selectedIds.has(c.id));

    const toggleSelect = (id: number) => setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const toggleSelectAll = () => {
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(activeFiltered.map(c => c.id)));
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedIds.size} selected comments?`)) return;
        setIsBulkDeleting(true);
        let failed = 0;
        for (const id of Array.from(selectedIds)) {
            try { await adminApi.deleteComment(id); } catch { failed++; }
        }
        setSelectedIds(new Set());
        await fetchComments();
        setIsBulkDeleting(false);
        if (failed > 0) alert(`${failed} items failed.`);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                    <MessageSquare className="w-8 h-8 text-blue-500" />
                    Comments Hub
                </h1>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="text-white font-bold text-base">All Comments</span>
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

                {/* Type filter pills */}
                <div className="px-6 py-3 border-b border-white/10 flex gap-1 flex-wrap">
                    {targetTypes.map(t => (
                        <button
                            key={t}
                            onClick={() => setTypeFilter(t)}
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${typeFilter === t ? 'bg-white text-black' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                        >
                            {t === 'all' ? 'All' : t}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="px-6 py-3 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search by username or content..."
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
                                <th className="px-4 py-3">Author</th>
                                <th className="px-4 py-3">Target</th>
                                <th className="px-4 py-3">Content</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12">
                                        <div className="flex flex-col items-center gap-3 text-gray-500">
                                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-xs uppercase tracking-widest font-bold">Loading Feed...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-12 text-gray-500 font-bold uppercase tracking-widest text-xs">No comments found</td></tr>
                            ) : filtered.map((comment) => {
                                const isSelected = !comment.is_deleted && selectedIds.has(comment.id);
                                return (
                                    <tr key={comment.id} className={`transition-colors group ${isSelected ? 'bg-white/5' : 'hover:bg-white/[0.03]'} ${comment.is_deleted ? 'opacity-40' : ''}`}>
                                        <td className="px-4 py-4">
                                            {!comment.is_deleted && (
                                                <div
                                                    onClick={() => toggleSelect(comment.id)}
                                                    className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center ${isSelected ? 'border-white bg-white' : 'border-white/30 bg-transparent group-hover:border-white/60'}`}
                                                >
                                                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                {comment.avatar_url ? (
                                                    <img src={comment.avatar_url} alt={comment.username} className="w-8 h-8 rounded-full border border-white/10" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold border border-blue-500/30 text-sm">
                                                        {comment.username?.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-white font-bold text-sm">{comment.username}</p>
                                                    <p className="text-xs text-gray-600">ID: {comment.user_id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="px-2 py-0.5 rounded bg-white/5 text-xs text-gray-400 uppercase tracking-wider">
                                                {comment.target_type} #{comment.target_id}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-gray-300 text-sm max-w-xs truncate">{comment.content}</td>
                                        <td className="px-4 py-4 text-gray-500 text-xs whitespace-nowrap">{new Date(comment.created_at).toLocaleString()}</td>
                                        <td className="px-4 py-4 text-right">
                                            {!comment.is_deleted && (
                                                <button
                                                    onClick={() => handleDelete(comment.id)}
                                                    className="text-gray-500 hover:text-red-400 transition-colors"
                                                    title="Delete Comment"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
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
