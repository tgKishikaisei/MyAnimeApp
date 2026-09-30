/**
 * ClipTimecodeComments — комментарии к клипу, привязанные к секунде видео.
 *
 * Фичи:
 *  1. Timeline bar с amber-маркерами в позициях комментариев.
 *     Клик по маркеру → перемотка видео + попап с текстом.
 *  2. Список комментариев, отсортированных по timecode.
 *  3. Форма: пишешь текст → авто-захват текущей секунды плеера.
 */

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Clock, Send, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { useTranslation } from 'react-i18next';

import { apiErrorStatus } from '../utils/apiError';
// ── Types ────────────────────────────────────────────────────────────────────

interface TimecodeComment {
    id: number;
    username: string;
    avatar_url: string | null;
    content: string;
    timecode_seconds: number | null;
    created_at: string;
    reactions?: Record<string, number>;
    my_reaction?: string | null;
}

interface Props {
    clipId: number;
    duration: number;
    videoRef: React.RefObject<HTMLVideoElement | null>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(sec: number | null): string {
    if (sec === null || sec === undefined) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function Avatar({ username, avatar_url }: { username: string; avatar_url: string | null }) {
    return avatar_url ? (
        <img src={avatar_url} alt={username} className="w-6 h-6 rounded-full object-cover shrink-0" />
    ) : (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
            {username.charAt(0).toUpperCase()}
        </div>
    );
}

// ── ReactionBar ──────────────────────────────────────────────────────────────

const EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '👎'] as const;

interface ReactionBarProps {
    commentId: number;
    initialReactions: Record<string, number>;
    initialMyReaction: string | null;
    currentUserId?: number;
    onReact: (commentId: number, emoji: string) => Promise<{ reactions: Record<string, number>, my_reaction: string | null }>;
}

function ReactionBar({ commentId, initialReactions, initialMyReaction, currentUserId, onReact }: ReactionBarProps) {
    const [reactions, setReactions] = useState<Record<string, number>>(initialReactions);
    const [myReaction, setMyReaction] = useState<string | null>(initialMyReaction);
    const [showPicker, setShowPicker] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleReactLocal = async (emoji: string) => {
        if (!currentUserId) { alert('Please log in to react.'); return; }
        if (loading) return;

        const prev = { ...reactions };
        const prevMy = myReaction;

        setLoading(true);
        const updated = { ...reactions };

        if (prevMy === emoji) {
            updated[emoji] = (updated[emoji] ?? 1) - 1;
            if (updated[emoji] <= 0) delete updated[emoji];
            setMyReaction(null);
        } else {
            if (prevMy) {
                updated[prevMy] = (updated[prevMy] ?? 1) - 1;
                if (updated[prevMy] <= 0) delete updated[prevMy];
            }
            updated[emoji] = (updated[emoji] ?? 0) + 1;
            setMyReaction(emoji);
        }
        setReactions(updated);
        setShowPicker(false);

        try {
            const result = await onReact(commentId, emoji);
            setReactions(result.reactions);
            setMyReaction(result.my_reaction);
        } catch {
            setReactions(prev);
            setMyReaction(prevMy);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-1.5 flex-wrap mt-1 lg:mt-2">
            {EMOJIS.filter(e => (reactions[e] ?? 0) > 0).map(emoji => (
                <button
                    key={emoji}
                    onClick={() => handleReactLocal(emoji)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border transition-all
                        ${myReaction === emoji
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                >
                    <span>{emoji}</span>
                    <span>{reactions[emoji]}</span>
                </button>
            ))}

            <div className="relative">
                <button
                    onClick={() => setShowPicker(p => !p)}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] text-gray-600 hover:text-gray-300 border border-transparent hover:border-white/10 hover:bg-white/5 transition-all"
                    title="Add reaction"
                >
                    <span>😊</span>
                    <span className="text-[10px]">+</span>
                </button>

                {showPicker && (
                    <div className="absolute left-0 bottom-full mb-1 bg-[#1a1a1a] border border-white/10 rounded-lg p-1 flex gap-1 z-30 shadow-xl backdrop-blur-sm"
                        onMouseLeave={() => setShowPicker(false)}>
                        {EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => handleReactLocal(emoji)}
                                className={`w-6 h-6 rounded-md text-sm flex items-center justify-center transition-all hover:scale-125 hover:bg-white/10 ${myReaction === emoji ? 'bg-blue-500/20 ring-1 ring-blue-500/50' : ''}`}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClipTimecodeComments({ clipId, duration, videoRef }: Props) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [comments, setComments] = useState<TimecodeComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(true);
    const [newText, setNewText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeMarker, setActiveMarker] = useState<TimecodeComment | null>(null);

    // Следим за позицией видео
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const onTime = () => setCurrentTime(video.currentTime);
        video.addEventListener('timeupdate', onTime);
        return () => video.removeEventListener('timeupdate', onTime);
    }, [videoRef]);

    const fetchComments = useCallback(async () => {
        try {
            const res = await api.get(`/comments/clip/${clipId}`);
            setComments(res.data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [clipId]);

    useEffect(() => { fetchComments(); }, [fetchComments]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newText.trim()) return;
        setSubmitting(true);
        try {
            await api.post(`/comments/clip/${clipId}`, {
                content: newText.trim(),
                timecode_seconds: currentTime > 0.5 ? Math.round(currentTime * 10) / 10 : null,
            });
            setNewText('');
            await fetchComments();
        } catch (err) {
            if (apiErrorStatus(err) === 401) alert(t('comments.login_prompt'));
        } finally { setSubmitting(false); }
    };

    const seekTo = (comment: TimecodeComment) => {
        if (comment.timecode_seconds !== null && videoRef.current) {
            videoRef.current.currentTime = comment.timecode_seconds;
        }
        setActiveMarker(prev => prev?.id === comment.id ? null : comment);
    };

    const timedComments = comments.filter(c => c.timecode_seconds !== null);
    const dur = Math.max(duration || 60, 1);

    return (
        <div className="mt-3 rounded-xl border border-white/8 bg-black/40 overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/4 transition-colors"
            >
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    {t('player.timecode_comments')}
                    <span className="bg-white/10 text-gray-500 text-[10px] px-1.5 py-0.5 rounded-full">{comments.length}</span>
                </span>
                {expanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-3">

                    {/* ── Timeline bar ── */}
                    {timedComments.length > 0 && (
                        <div>
                            <div className="relative h-1.5 bg-white/10 rounded-full mb-1">
                                {timedComments.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => seekTo(c)}
                                        style={{ left: `${Math.min(97, (c.timecode_seconds! / dur) * 100)}%` }}
                                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group z-10"
                                        title={`${c.username} @ ${fmt(c.timecode_seconds)}`}
                                    >
                                        <span className={`block w-2.5 h-2.5 rounded-full border-2 border-black transition-all group-hover:scale-150
                                            ${activeMarker?.id === c.id ? 'bg-blue-400 scale-125' : 'bg-amber-400'}`} />
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-700">{t('player.markers', { count: timedComments.length })} — {t('player.click_to_jump')}</p>
                        </div>
                    )}

                    {/* ── Active marker popup ── */}
                    {activeMarker && (
                        <div className="flex gap-2 items-start bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm">
                            <Avatar username={activeMarker.username} avatar_url={activeMarker.avatar_url} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="font-bold text-white text-xs">{activeMarker.username}</span>
                                    <span className="flex items-center gap-0.5 text-[9px] bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded font-mono">
                                        <Clock className="w-2 h-2" />{fmt(activeMarker.timecode_seconds)}
                                    </span>
                                </div>
                                <p className="text-gray-300 text-xs">{activeMarker.content}</p>
                            </div>
                            <button onClick={() => setActiveMarker(null)} className="text-gray-600 hover:text-white shrink-0">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    {/* ── Comment list ── */}
                    {loading ? (
                        <p className="text-xs text-gray-600 animate-pulse text-center py-3">{t('common.loading')}</p>
                    ) : comments.length === 0 ? (
                        <p className="text-xs text-gray-700 text-center py-3">{t('comments.no_comments')}</p>
                    ) : (
                        <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                            {comments.map(c => (
                                <div key={c.id} className="flex gap-2 items-start">
                                    <Avatar username={c.username} avatar_url={c.avatar_url} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="font-bold text-white text-[11px]">{c.username}</span>
                                            {c.timecode_seconds && (
                                                <button onClick={() => seekTo(c)} className="flex items-center gap-0.5 bg-amber-500/20 text-amber-400 text-[9px] px-1 py-0.5 rounded uppercase tracking-wider font-mono hover:bg-amber-500/40 transition-colors">
                                                    <Clock className="w-2.5 h-2.5" /> {fmt(c.timecode_seconds)}
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-gray-300 text-xs">{c.content}</p>
                                        
                                        <ReactionBar 
                                            commentId={c.id} 
                                            initialReactions={c.reactions || {}}
                                            initialMyReaction={c.my_reaction || null}
                                            currentUserId={user?.id}
                                            onReact={async (cid, emoji) => {
                                                const res = await api.post(`/comments/${cid}/react`, { emoji });
                                                return res.data;
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Post form ── */}
                    {user ? (
                        <form onSubmit={handleSubmit} className="flex gap-2 items-end pt-1 border-t border-white/8">
                            <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 focus-within:border-blue-500/50 transition-colors">
                                <textarea
                                    value={newText}
                                    onChange={e => setNewText(e.target.value)}
                                    placeholder={t('player.comment_at')}
                                    rows={2}
                                    className="w-full bg-transparent text-xs text-white placeholder-gray-700 focus:outline-none resize-none"
                                />
                                {currentTime > 0.5 && (
                                    <p className="text-[9px] text-amber-400/60 flex items-center gap-0.5 mt-0.5">
                                        <Clock className="w-2 h-2" />{t('comments.timecode_hint', { time: fmt(currentTime) })}
                                    </p>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={submitting || !newText.trim()}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white p-2 rounded-lg transition-colors shrink-0"
                            >
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </form>
                    ) : (
                        <p className="text-[11px] text-gray-700 text-center pt-1 border-t border-white/8">{t('player.log_in_to_comment')}</p>
                    )}
                </div>
            )}
        </div>
    );
}
