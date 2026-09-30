import { useState, useEffect } from 'react';
import { adminApi } from '../../api/admin';
import { Star, Trash2, CheckCircle, XCircle, Search, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';


import type { AdminReview as Review } from '../../api/admin';
export default function ReviewsManager() {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all');

    // Bulk select
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    useEffect(() => { fetchReviews(); }, []);

    const fetchReviews = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getReviews(0, 100);
            setReviews(data.items);
        } catch (error) {
            console.error('Failed to fetch reviews:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleApproval = async (id: number, currentStatus: boolean) => {
        try {
            await adminApi.updateReviewStatus(id, !currentStatus);
            setReviews(prev => prev.map(r => r.id === id ? { ...r, is_approved: !currentStatus } : r));
        } catch (error) {
            console.error('Failed to update review status:', error);
            alert('Failed to update review status');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this review?')) return;
        try {
            await adminApi.deleteReview(id);
            setReviews(prev => prev.filter(r => r.id !== id));
            setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        } catch (error) {
            console.error('Failed to delete review:', error);
            alert('Failed to delete review');
        }
    };

    const filtered = reviews.filter(r => {
        const matchSearch = r.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.anime_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.content && r.content.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchStatus = statusFilter === 'all' ||
            (statusFilter === 'approved' && r.is_approved) ||
            (statusFilter === 'pending' && !r.is_approved);
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
        if (!confirm(`Delete ${selectedIds.size} selected reviews?`)) return;
        setIsBulkDeleting(true);
        let failed = 0;
        for (const id of Array.from(selectedIds)) {
            try { await adminApi.deleteReview(id); } catch { failed++; }
        }
        setSelectedIds(new Set());
        await fetchReviews();
        setIsBulkDeleting(false);
        if (failed > 0) alert(`${failed} items failed.`);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                    <Star className="w-8 h-8 text-yellow-500" fill="currentColor" />
                    Reviews & Ratings
                </h1>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="text-white font-bold text-base">All Reviews</span>
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

                {/* Status filter pills */}
                <div className="px-6 py-3 border-b border-white/10 flex gap-1">
                    {(['all', 'approved', 'pending'] as const).map(s => (
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
                            placeholder="Search by user, anime, or content..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 text-white rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 placeholder-gray-500"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-20 text-gray-500 font-bold tracking-widest uppercase">
                        <Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading Reviews...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 flex flex-col items-center">
                        <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-bold tracking-widest uppercase text-xs">No reviews found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {/* Select-all bar */}
                        <div className="px-6 py-2 flex items-center gap-3 bg-black/20">
                            <div
                                onClick={toggleSelectAll}
                                className="w-5 h-5 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center border-white/40 hover:border-white"
                                style={allSelected ? { borderColor: 'white', background: 'white' } : someSelected ? { borderColor: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.15)' } : {}}
                            >
                                {allSelected && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                                {someSelected && !allSelected && <div className="w-1.5 h-1.5 rounded-full bg-white/70" />}
                            </div>
                            <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Select all visible</span>
                        </div>

                        {filtered.map(review => {
                            const isSelected = selectedIds.has(review.id);
                            return (
                                <div key={review.id} className={`p-6 transition-colors group ${isSelected ? 'bg-white/5' : 'hover:bg-white/[0.03]'} ${!review.is_approved ? '' : ''}`}>
                                    <div className="flex items-start gap-4">
                                        {/* Radio selector */}
                                        <div
                                            onClick={() => toggleSelect(review.id)}
                                            className={`mt-1 shrink-0 w-5 h-5 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center ${isSelected ? 'border-white bg-white' : 'border-white/30 bg-transparent group-hover:border-white/60'}`}
                                        >
                                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="font-bold text-white">{review.username}</span>
                                                <span className="text-gray-500 text-sm">on</span>
                                                <span className="text-blue-400 font-bold">{review.anime_title}</span>
                                                <span className="text-gray-600 text-xs">• {format(new Date(review.created_at), 'MMM d, yyyy')}</span>
                                                {!review.is_approved && (
                                                    <span className="px-2 py-0.5 bg-red-500/20 text-red-500 text-xs font-bold rounded uppercase tracking-wider">Hidden</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 mb-3">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'text-yellow-500' : 'text-gray-700'}`} fill={i < review.rating ? "currentColor" : "transparent"} />
                                                ))}
                                                <span className="text-xs font-bold text-gray-400 ml-2">{review.rating} / 5</span>
                                            </div>
                                            <p className="text-gray-300 text-sm whitespace-pre-wrap">
                                                {review.content || <span className="italic text-gray-600">No written content provided.</span>}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => handleToggleApproval(review.id, review.is_approved)}
                                                className={`p-2 rounded-lg border transition-all ${review.is_approved ? 'border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10' : 'bg-green-600 border-green-500 text-white hover:bg-green-500'}`}
                                                title={review.is_approved ? "Hide Review" : "Approve Review"}
                                            >
                                                {review.is_approved ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(review.id)}
                                                className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                                title="Delete Review"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
