import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ListVideo, Plus, Globe, Lock, Trash2, Copy, Check, Loader2, PlaySquare, ExternalLink } from 'lucide-react';
import { playlistApi, type Playlist, type PlaylistDetail } from '../../api/playlistApi';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';

// ── Helper ──────────────────────────────────────────────────────────────────

function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => { });
}

// ── Playlist Card ────────────────────────────────────────────────────────────

function PlaylistCard({
    playlist,
    onDelete,
    onTogglePublic,
}: {
    playlist: Playlist;
    onDelete: (id: number) => void;
    onTogglePublic: (id: number, val: boolean) => void;
}) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [detail, setDetail] = useState<PlaylistDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const handleExpand = async () => {
        if (expanded) { setExpanded(false); return; }
        setExpanded(true);
        if (detail) return;
        setLoadingDetail(true);
        try {
            const d = await playlistApi.getById(playlist.id);
            setDetail(d);
        } finally { setLoadingDetail(false); }
    };

    const handleCopy = () => {
        const url = `${window.location.origin}/playlists/${playlist.slug}`;
        copyToClipboard(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden transition-all hover:border-white/15">
            {/* Header */}
            <div className="p-5">
                <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/30 to-purple-600/30 border border-white/10 flex items-center justify-center shrink-0">
                        <ListVideo className="w-6 h-6 text-blue-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-bold text-white truncate">{playlist.title}</h3>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider
                                ${playlist.is_public ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-500/15 text-gray-400'}`}>
                                {playlist.is_public ? t('playlists.public') : t('playlists.private')}
                            </span>
                        </div>
                        {playlist.description && (
                            <p className="text-gray-500 text-xs truncate">{playlist.description}</p>
                        )}
                        <p className="text-gray-600 text-xs mt-1">{t('playlists.clips_count', { count: playlist.clip_count })}</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <button
                        onClick={handleExpand}
                        className="flex items-center gap-1.5 text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        <PlaySquare className="w-3.5 h-3.5" />
                        {expanded ? t('playlists.hide_clips') : t('playlists.view_clips')}
                    </button>

                    {playlist.is_public && (
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? t('common.copied') : t('playlists.share_link')}
                        </button>
                    )}

                    <button
                        onClick={() => onTogglePublic(playlist.id, !playlist.is_public)}
                        className="flex items-center gap-1.5 text-xs bg-white/5 hover:bg-white/10 text-gray-400 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        {playlist.is_public ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                        {playlist.is_public ? t('playlists.make_private') : t('playlists.make_public')}
                    </button>

                    <button
                        onClick={() => onDelete(playlist.id)}
                        className="flex items-center gap-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg transition-colors ml-auto"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('common.delete')}
                    </button>
                </div>
            </div>

            {/* Expanded clip list */}
            {expanded && (
                <div className="border-t border-white/8 px-5 py-4">
                    {loadingDetail ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                        </div>
                    ) : !detail || detail.clips.length === 0 ? (
                        <p className="text-center text-gray-600 text-sm py-4">{t('playlists.no_clips_yet')}</p>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {detail.clips.map(clip => (
                                <Link
                                    key={clip.id}
                                    to={`/anime/${clip.anime_id}/season/${clip.season}/episode/${clip.episode}?clip=${clip.id}`}
                                    className="group relative aspect-video bg-[#1a1a1a] rounded-lg overflow-hidden hover:ring-1 hover:ring-white/30 transition-all"
                                >
                                    {clip.thumbnail_path ? (
                                        <img
                                            src={`${import.meta.env.VITE_API_URL}/static/${clip.thumbnail_path}`}
                                            alt={clip.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <PlaySquare className="w-4 h-4 text-gray-600" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                        <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <p className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 px-1 py-0.5 text-[9px] text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                        {clip.title}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PlaylistsPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newPublic, setNewPublic] = useState(true);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!user) return;
        playlistApi.getAll()
            .then(setPlaylists)
            .finally(() => setLoading(false));
    }, [user]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) return;
        setCreating(true);
        try {
            const pl = await playlistApi.create(newTitle.trim(), newDesc.trim() || undefined, newPublic);
            setPlaylists(prev => [pl, ...prev]);
            setNewTitle(''); setNewDesc(''); setShowCreate(false);
        } catch { alert(t('common.error')); }
        finally { setCreating(false); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('common.delete') + '?')) return;
        await playlistApi.delete(id);
        setPlaylists(prev => prev.filter(p => p.id !== id));
    };

    const handleTogglePublic = async (id: number, isPublic: boolean) => {
        await playlistApi.update(id, { is_public: isPublic });
        setPlaylists(prev => prev.map(p => p.id === id ? { ...p, is_public: isPublic } : p));
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
                <ListVideo className="w-12 h-12 text-gray-600" />
                <p className="text-gray-400">{t('playlists.login_to_view')}</p>
                <Link to="/login" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-bold transition-colors">
                    {t('nav.login')}
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans">
            <div className="max-w-4xl mx-auto px-6 py-10">
                {/* Title */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-white flex items-center gap-3">
                            <ListVideo className="w-8 h-8 text-blue-400" />
                            {t('nav.playlists')}
                        </h1>
                        <p className="text-gray-500 mt-1 text-sm">
                            {t('playlists.clips_count', { count: playlists.length }).replace('clip', 'playlist').replace('clipp', 'playlist')}
                            {/* Handled dynamically basically since playlist and clip count use same plural structure */}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        {t('playlists.new_playlist')}
                    </button>
                </div>

                {/* Create form */}
                {showCreate && (
                    <form onSubmit={handleCreate} className="bg-[#111] border border-white/10 rounded-2xl p-5 mb-6 space-y-3">
                        <h2 className="font-bold text-white mb-1">{t('playlists.create')}</h2>
                        <input
                            autoFocus
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            placeholder={t('playlists.name_placeholder')}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 text-sm"
                        />
                        <textarea
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                            placeholder={t('playlists.description')}
                            rows={2}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 text-sm resize-none"
                        />
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={newPublic}
                                    onChange={e => setNewPublic(e.target.checked)}
                                    className="accent-blue-500"
                                />
                                {t('playlists.public_hint')}
                            </label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setShowCreate(false)}
                                    className="text-sm text-gray-500 hover:text-white px-4 py-2 rounded-xl transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={creating || !newTitle.trim()}
                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold px-5 py-2 rounded-xl flex items-center gap-2 transition-colors">
                                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    Create
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                {/* List */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
                    </div>
                ) : playlists.length === 0 ? (
                    <div className="text-center py-20 text-gray-600">
                        <ListVideo className="w-14 h-14 mx-auto mb-4 opacity-20" />
                        <p className="text-lg">{t('playlists.empty')}</p>
                        <p className="text-sm mt-1">{t('playlists.create_hint')}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {playlists.map(pl => (
                            <PlaylistCard
                                key={pl.id}
                                playlist={pl}
                                onDelete={handleDelete}
                                onTogglePublic={handleTogglePublic}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
