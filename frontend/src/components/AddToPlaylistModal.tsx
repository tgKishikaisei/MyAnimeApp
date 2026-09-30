/**
 * AddToPlaylistModal — попап для добавления клипа в плейлист.
 * Показывает список плейлистов пользователя. Можно добавить клип в
 * существующий или создать новый прямо в этом модале.
 */

import { useState, useEffect } from 'react';
import { X, Plus, ListVideo, Check, Loader2, Lock, Globe } from 'lucide-react';
import { playlistApi, type Playlist } from '../api/playlistApi';
import { useTranslation } from 'react-i18next';

interface Props {
    clipId: number;
    clipTitle: string;
    onClose: () => void;
}

export default function AddToPlaylistModal({ clipId, clipTitle, onClose }: Props) {
    const { t } = useTranslation();
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState<number | null>(null);
    const [added, setAdded] = useState<Set<number>>(new Set());
    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newPublic, setNewPublic] = useState(true);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        playlistApi.getAll()
            .then(setPlaylists)
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const handleAdd = async (playlistId: number) => {
        setAdding(playlistId);
        try {
            await playlistApi.addClip(playlistId, clipId);
            setAdded(prev => new Set(prev).add(playlistId));
        } catch { /*already added or error*/ }
        finally { setAdding(null); }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) return;
        setCreating(true);
        try {
            const pl = await playlistApi.create(newTitle.trim(), '', newPublic);
            setPlaylists(prev => [pl, ...prev]);
            await playlistApi.addClip(pl.id, clipId);
            setAdded(prev => new Set(prev).add(pl.id));
            setShowCreate(false);
            setNewTitle('');
        } catch { alert(t('common.error')); }
        finally { setCreating(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            <div
                className="relative bg-[#111] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl shadow-black/60 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <div>
                        <h2 className="text-white font-bold flex items-center gap-2">
                            <ListVideo className="w-5 h-5 text-blue-400" />
                            {t('playlists.add_to')}
                        </h2>
                        <p className="text-gray-500 text-xs mt-0.5 truncate max-w-[280px]">{clipTitle}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Playlist list */}
                <div className="max-h-64 overflow-y-auto px-3 py-3 space-y-1">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                        </div>
                    ) : playlists.length === 0 ? (
                        <p className="text-center py-6 text-gray-500 text-sm">{t('playlists.empty')}</p>
                    ) : (
                        playlists.map(pl => {
                            const isAdded = added.has(pl.id);
                            const isAdding = adding === pl.id;
                            return (
                                <button
                                    key={pl.id}
                                    onClick={() => !isAdded && handleAdd(pl.id)}
                                    disabled={isAdded || isAdding}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all
                                        ${isAdded
                                            ? 'bg-blue-500/10 border border-blue-500/30 cursor-default'
                                            : 'hover:bg-white/5 border border-transparent'}`}
                                >
                                    {/* Icon */}
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                                        ${isAdded ? 'bg-blue-500/20' : 'bg-white/5'}`}>
                                        {isAdding
                                            ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                            : isAdded
                                                ? <Check className="w-4 h-4 text-blue-400" />
                                                : <ListVideo className="w-4 h-4 text-gray-400" />
                                        }
                                    </div>
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-medium text-sm truncate ${isAdded ? 'text-blue-300' : 'text-white'}`}>
                                            {pl.title}
                                        </p>
                                        <p className="text-gray-500 text-xs flex items-center gap-1">
                                            {pl.is_public
                                                ? <Globe className="w-3 h-3" />
                                                : <Lock className="w-3 h-3" />}
                                            {t('playlists.clips_count', { count: pl.clip_count })}
                                        </p>
                                    </div>
                                    {isAdded && <span className="text-blue-400 text-xs font-bold">{t('playlists.added')}</span>}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Create new */}
                <div className="px-5 pb-4 pt-2 border-t border-white/10">
                    {showCreate ? (
                        <form onSubmit={handleCreate} className="space-y-2">
                            <input
                                autoFocus
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                                placeholder={t('playlists.name')}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                            />
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={newPublic}
                                        onChange={e => setNewPublic(e.target.checked)}
                                        className="accent-blue-500"
                                    />
                                    {t('playlists.public_hint')}
                                </label>
                                <div className="flex gap-2 ml-auto">
                                    <button type="button" onClick={() => setShowCreate(false)}
                                        className="text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
                                        {t('common.cancel')}
                                    </button>
                                    <button type="submit" disabled={creating || !newTitle.trim()}
                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                                        {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                        {t('playlists.create')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="w-full flex items-center gap-2 text-sm text-gray-400 hover:text-white py-2 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            {t('playlists.create')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
