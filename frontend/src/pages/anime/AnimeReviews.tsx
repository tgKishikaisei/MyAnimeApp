import { useState, useEffect } from 'react';
import { animeApi } from '../../api/anime';
import { Star, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { apiErrorStatus } from '../../utils/apiError';
interface Review {
    id: number;
    user_id: number;
    username: string;
    avatar_url: string | null;
    rating: number;
    content: string;
    created_at: string;
}

export default function AnimeReviews({ animeSlug }: { animeSlug: string }) {
    const { t } = useTranslation();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);

    const [rating, setRating] = useState(5);
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchReviews();
    }, [animeSlug]);

    const fetchReviews = async () => {
        try {
            const data = await animeApi.getReviews(animeSlug);
            setReviews(data);
        } catch (error) {
            console.error('Failed to fetch reviews', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await animeApi.postReview(animeSlug, rating, content);
            // Refresh reviews to show the new one
            await fetchReviews();
            setContent('');
            setRating(5);
        } catch (error) {
            console.error('Failed to post review', error);
            if (apiErrorStatus(error) === 401 || apiErrorStatus(error) === 403) {
                alert(t('reviews.login_prompt'));
            } else {
                alert(t('common.error'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="py-8 text-center text-gray-500 animate-pulse">{t('common.loading')}</div>;

    // Calculate average
    const avgRating = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : '0';

    return (
        <div className="mt-8">
            <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                    <Star className="w-5 h-5 text-yellow-500" fill="currentColor" />
                    {t('reviews.title')} ({reviews.length})
                </h3>
                {reviews.length > 0 && (
                    <div className="flex items-center gap-2 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
                        <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                        <span className="font-bold text-yellow-500">{avgRating} {t('reviews.avg')}</span>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="mb-10 bg-[#1a1a1a] p-5 rounded-xl border border-white/10">
                <h4 className="font-bold text-white mb-4">{t('reviews.write_review')}</h4>
                <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-2">{t('reviews.rating')}</label>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(star => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => setRating(star)}
                                className={`p-1 transition-transform hover:scale-110 ${rating >= star ? 'text-yellow-500' : 'text-gray-600'}`}
                            >
                                <Star className="w-8 h-8" fill={rating >= star ? "currentColor" : "none"} />
                            </button>
                        ))}
                    </div>
                </div>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={t('reviews.placeholder')}
                    rows={4}
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors resize-none mb-4"
                />
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 transition-colors"
                    >
                        <Send className="w-4 h-4" />
                        {submitting ? t('reviews.submitting') : t('reviews.submit')}
                    </button>
                </div>
            </form>

            <div className="grid gap-4 md:grid-cols-2">
                {reviews.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500 bg-[#111] rounded-xl border border-white/5">
                        {t('reviews.no_reviews')}
                    </div>
                ) : (
                    reviews.map(review => (
                        <div key={review.id} className="bg-[#111] p-5 rounded-xl border border-white/5">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    {review.avatar_url ? (
                                        <img src={review.avatar_url} alt={review.username} className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center font-bold">
                                            {review.username.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <div className="font-bold text-white">{review.username}</div>
                                        <div className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                <div className="flex bg-black/50 px-2 py-1 rounded border border-white/5">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'text-yellow-500' : 'text-gray-700'}`} fill={i < review.rating ? "currentColor" : "transparent"} />
                                    ))}
                                </div>
                            </div>
                            {review.content && (
                                <p className="text-gray-300 text-sm whitespace-pre-wrap">{review.content}</p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
