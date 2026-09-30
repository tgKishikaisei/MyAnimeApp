import { useState, useEffect } from 'react';
import { animeApi } from '../../api/anime';
import { MessageSquare, Send, Reply, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { useTranslation } from 'react-i18next';

import { apiErrorStatus } from '../../utils/apiError';
// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

interface Comment {
    id: number;
    user_id: number;
    username: string;
    avatar_url: string | null;
    content: string;
    created_at: string;
    parent_id: number | null;
    replies: Comment[];
    reactions: Record<string, number>;   // {"👍": 3, "🔥": 1}
    my_reaction: string | null;          // emoji current user reacted with
}

const EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '👎'] as const;

// ─────────────────────────────────────
// Avatar
// ─────────────────────────────────────

function Avatar({ username, avatar_url }: { username: string; avatar_url: string | null }) {
    return avatar_url ? (
        <img src={avatar_url} alt={username} className="w-9 h-9 rounded-full object-cover ring-2 ring-white/10 shrink-0" />
    ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-white text-sm ring-2 ring-white/10 shrink-0">
            {username.charAt(0).toUpperCase()}
        </div>
    );
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
}

// ─────────────────────────────────────
// Reaction Bar
// ─────────────────────────────────────

interface ReactionBarProps {
    commentId: number;
    reactions: Record<string, number>;
    myReaction: string | null;
    currentUserId?: number;
}

function ReactionBar({ commentId, reactions: initialReactions, myReaction: initialMy, currentUserId }: ReactionBarProps) {
    const [reactions, setReactions] = useState<Record<string, number>>(initialReactions);
    const [myReaction, setMyReaction] = useState<string | null>(initialMy);
    const [showPicker, setShowPicker] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleReact = async (emoji: string) => {
        if (!currentUserId) { alert('Please log in to react.'); return; }
        if (loading) return;

        // Optimistic update
        const prev = { ...reactions };
        const prevMy = myReaction;

        setLoading(true);
        const updated = { ...reactions };

        if (prevMy === emoji) {
            // Toggle off
            updated[emoji] = (updated[emoji] ?? 1) - 1;
            if (updated[emoji] <= 0) delete updated[emoji];
            setMyReaction(null);
        } else {
            if (prevMy) {
                // Remove old
                updated[prevMy] = (updated[prevMy] ?? 1) - 1;
                if (updated[prevMy] <= 0) delete updated[prevMy];
            }
            updated[emoji] = (updated[emoji] ?? 0) + 1;
            setMyReaction(emoji);
        }
        setReactions(updated);
        setShowPicker(false);

        try {
            const result = await animeApi.reactToComment(commentId, emoji);
            setReactions(result.reactions);
            setMyReaction(result.my_reaction);
        } catch {
            // Rollback on error
            setReactions(prev);
            setMyReaction(prevMy);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {/* Existing reaction count pills */}
            {EMOJIS.filter(e => (reactions[e] ?? 0) > 0).map(emoji => (
                <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all
                        ${myReaction === emoji
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                >
                    <span>{emoji}</span>
                    <span>{reactions[emoji]}</span>
                </button>
            ))}

            {/* Add reaction button */}
            <div className="relative">
                <button
                    onClick={() => setShowPicker(p => !p)}
                    className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs text-gray-600 hover:text-gray-300 border border-transparent hover:border-white/10 hover:bg-white/5 transition-all"
                    title="Add reaction"
                >
                    <span>😊</span>
                    <span className="text-xs">+</span>
                </button>

                {/* Emoji picker popup */}
                {showPicker && (
                    <div className="absolute bottom-full left-0 mb-1 bg-[#1a1a1a] border border-white/10 rounded-xl p-1.5 flex gap-1 z-30 shadow-xl shadow-black/50 backdrop-blur-sm"
                        onMouseLeave={() => setShowPicker(false)}>
                        {EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => handleReact(emoji)}
                                className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all hover:scale-125 hover:bg-white/10
                                    ${myReaction === emoji ? 'bg-blue-500/20 ring-1 ring-blue-500/50' : ''}`}
                                title={emoji}
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

// ─────────────────────────────────────
// Single Comment Card (recursive)
// ─────────────────────────────────────

interface CommentCardProps {
    comment: Comment;
    animeSlug: string;
    depth?: number;
    currentUserId?: number;
    onReplyPosted: () => void;
}

function CommentCard({ comment, animeSlug, depth = 0, currentUserId, onReplyPosted }: CommentCardProps) {
    const { t } = useTranslation();
    const [showReplyBox, setShowReplyBox] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showReplies, setShowReplies] = useState(true);
    const [deleted, setDeleted] = useState(false);

    const isOwner = currentUserId === comment.user_id;
    const hasReplies = comment.replies && comment.replies.length > 0;
    const maxDepth = 3;

    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim()) return;
        setSubmitting(true);
        try {
            await animeApi.postComment(animeSlug, replyText.trim(), comment.id);
            setReplyText('');
            setShowReplyBox(false);
            onReplyPosted();
        } catch (err) {
            if (apiErrorStatus(err) === 401) alert(t('comments.login_prompt'));
            else alert(t('common.error'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('common.delete') + '?')) return;
        try {
            await api.delete(`/comments/${comment.id}`);
            setDeleted(true);
        } catch {
            alert(t('common.error'));
        }
    };

    if (deleted) return null;

    return (
        <div className={`flex gap-3 ${depth > 0 ? 'ml-4 sm:ml-8 border-l-2 border-white/5 pl-4' : ''}`}>
            <Avatar username={comment.username} avatar_url={comment.avatar_url} />

            <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-white text-sm">{comment.username}</span>
                    <span className="text-xs text-gray-500">{formatDate(comment.created_at)}</span>
                    {comment.parent_id !== null && (
                        <span className="text-[10px] text-blue-400/60 uppercase tracking-wider font-bold">{t('comments.reply')}</span>
                    )}
                </div>

                {/* Content */}
                <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{comment.content}</p>

                {/* Reactions */}
                <ReactionBar
                    commentId={comment.id}
                    reactions={comment.reactions || {}}
                    myReaction={comment.my_reaction || null}
                    currentUserId={currentUserId}
                />

                {/* Actions */}
                <div className="flex items-center gap-4 mt-2">
                    {depth < maxDepth && (
                        <button
                            onClick={() => setShowReplyBox(!showReplyBox)}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition-colors"
                        >
                            <Reply className="w-3.5 h-3.5" />
                            {showReplyBox ? t('common.cancel') : t('comments.reply')}
                        </button>
                    )}
                    {hasReplies && (
                        <button
                            onClick={() => setShowReplies(!showReplies)}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
                        >
                            {showReplies ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {showReplies ? t('common.close') : t('common.see_all')} ({comment.replies.length})
                        </button>
                    )}
                    {isOwner && (
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-400 transition-colors ml-auto"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {/* Inline Reply Box */}
                {showReplyBox && (
                    <form onSubmit={handleReply} className="mt-3 flex gap-2">
                        <textarea
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder={`${t('comments.reply')} ${comment.username}…`}
                            rows={2}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={submitting || !replyText.trim()}
                            className="self-end bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-2 rounded-lg transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                )}

                {/* Nested Replies */}
                {hasReplies && showReplies && (
                    <div className="mt-4 space-y-4">
                        {comment.replies.map(reply => (
                            <CommentCard
                                key={reply.id}
                                comment={reply}
                                animeSlug={animeSlug}
                                depth={depth + 1}
                                currentUserId={currentUserId}
                                onReplyPosted={onReplyPosted}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────
// Main Export
// ─────────────────────────────────────

export default function AnimeComments({ animeSlug }: { animeSlug: string }) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const fetchComments = async () => {
        try {
            const data = await animeApi.getComments(animeSlug);
            setComments(data);
        } catch (err) {
            console.error('Failed to fetch comments', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchComments(); }, [animeSlug]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setSubmitting(true);
        try {
            await animeApi.postComment(animeSlug, newComment.trim());
            setNewComment('');
            await fetchComments();
        } catch (err) {
            alert(apiErrorStatus(err) === 401 ? t('comments.login_prompt') : t('common.error'));
        } finally {
            setSubmitting(false);
        }
    };

    const totalCount = (list: Comment[]): number =>
        list.reduce((acc, c) => acc + 1 + totalCount(c.replies), 0);

    if (loading) return (
        <div className="py-12 text-center text-gray-500 animate-pulse flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" /> {t('comments.loading')}
        </div>
    );

    return (
        <div className="mt-10">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-white border-b border-white/10 pb-4">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                {t('comments.title')}
                <span className="text-sm font-normal text-gray-500 ml-1">({totalCount(comments)})</span>
            </h3>

            {/* New comment form */}
            <form onSubmit={handleSubmit} className="mb-8 bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex gap-3">
                    {user && <Avatar username={user.username ?? 'U'} avatar_url={user.avatar_url ?? null} />}
                    <div className="flex-1">
                        <textarea
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            placeholder={user ? t('comments.placeholder') : t('comments.login_prompt')}
                            disabled={!user}
                            rows={3}
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none mb-3 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                        />
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting || !newComment.trim() || !user}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
                            >
                                <Send className="w-4 h-4" />
                                {submitting ? t('common.loading') : t('comments.submit')}
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            {/* Comment list */}
            {comments.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-white/[0.02] rounded-xl border border-white/5">
                    <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">{t('comments.no_comments')}</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {comments.map(comment => (
                        <CommentCard
                            key={comment.id}
                            comment={comment}
                            animeSlug={animeSlug}
                            currentUserId={user?.id}
                            onReplyPosted={fetchComments}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
