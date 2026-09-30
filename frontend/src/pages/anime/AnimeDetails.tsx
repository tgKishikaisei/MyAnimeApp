import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Home, Folder, RotateCw, MoreVertical, SlidersHorizontal, Download, Flag, Bookmark, BookmarkCheck, ChevronDown } from 'lucide-react';
import { animeApi } from '../../api/anime';
import { downloadApi } from '../../api/downloadApi';
import type { Anime, SeasonInfo, WatchStatus, WatchlistStatusOut } from '../../api/types';
import ReportModal from '../../components/layout/ReportModal';
import AnimeComments from './AnimeComments';
import AnimeReviews from './AnimeReviews';
import SharedNavbar from '../../components/SharedNavbar';
import SharedFooter from '../../components/SharedFooter';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const WATCH_STATUSES: { value: WatchStatus; label: string; emoji: string }[] = [
    { value: 'watching', label: 'Collecting', emoji: '⬇️' },
    { value: 'planned', label: 'Want to Download', emoji: '📌' },
    { value: 'completed', label: 'Collected', emoji: '✅' },
    { value: 'dropped', label: 'Skipped', emoji: '⏭️' },
];

export default function AnimeDetails() {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [anime, setAnime] = useState<Anime | null>(null);
    const [seasons, setSeasons] = useState<SeasonInfo[]>([]);
    const [selectedSeasons, setSelectedSeasons] = useState<Set<number>>(new Set());
    const [cardMenuOpen, setCardMenuOpen] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [reportOpen, setReportOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'seasons' | 'comments' | 'reviews'>('seasons');
    const cardMenuRef = useRef<HTMLDivElement>(null);

    // Watchlist state
    const [watchlistStatus, setWatchlistStatus] = useState<WatchlistStatusOut | null>(null);
    const [watchlistLoading, setWatchlistLoading] = useState(false);
    const [showWatchlistMenu, setShowWatchlistMenu] = useState(false);
    const watchlistMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            try {
                setLoading(true);
                const [animeData, seasonsData] = await Promise.all([
                    animeApi.getById(Number(id)),
                    animeApi.getSeasons(Number(id))
                ]);
                setAnime(animeData);
                setSeasons(seasonsData);

                // Record view
                if (animeData.slug) {
                    animeApi.recordView(animeData.slug);
                }
            } catch (error) {
                console.error("Failed to fetch anime details", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    // Fetch watchlist status when anime loads
    useEffect(() => {
        if (!user || !id) return;
        api.get<WatchlistStatusOut>(`/watchlist/${id}/status`)
            .then(r => setWatchlistStatus(r.data))
            .catch(() => setWatchlistStatus({ in_list: false }));
    }, [id, user]);

    // Close watchlist menu on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (watchlistMenuRef.current && !watchlistMenuRef.current.contains(e.target as Node)) {
                setShowWatchlistMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleWatchlistChange = useCallback(async (status: WatchStatus) => {
        if (!id || !user) { navigate('/login'); return; }
        setWatchlistLoading(true);
        setShowWatchlistMenu(false);
        try {
            const { data } = await api.put(`/watchlist/${id}`, { status });
            setWatchlistStatus({ in_list: true, status, entry_id: data.id });
        } catch {
            /* silent */
        } finally {
            setWatchlistLoading(false);
        }
    }, [id, user, navigate]);

    const handleRemoveFromWatchlist = useCallback(async () => {
        if (!id) return;
        setWatchlistLoading(true);
        setShowWatchlistMenu(false);
        try {
            await api.delete(`/watchlist/${id}`);
            setWatchlistStatus({ in_list: false });
        } catch {
            /* silent */
        } finally {
            setWatchlistLoading(false);
        }
    }, [id]);

    // Close card menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (cardMenuRef.current && !cardMenuRef.current.contains(event.target as Node)) {
                setCardMenuOpen(null);
            }
        };
        if (cardMenuOpen !== null) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [cardMenuOpen]);

    const toggleSeasonSelection = (seasonNumber: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedSeasons(prev => {
            const newSet = new Set(prev);
            if (newSet.has(seasonNumber)) {
                newSet.delete(seasonNumber);
            } else {
                newSet.add(seasonNumber);
            }
            return newSet;
        });
    };

    const handleCardDownload = (seasonNumber: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setCardMenuOpen(null);
        if (anime) {
            downloadApi.downloadSeason(anime.id, seasonNumber);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white font-sans flex flex-col">
                <SharedNavbar />
                <div className="flex-1 max-w-[1600px] mx-auto px-4 sm:px-6 w-full pt-32 pb-20">
                    {/* Skeleton Hero */}
                    <div className="flex flex-col md:flex-row gap-8 items-center md:items-start animate-pulse">
                        <div className="w-40 sm:w-56 md:w-72 aspect-[2/3] bg-white/10 rounded-xl shrink-0" />
                        <div className="flex-1 w-full space-y-4 pt-4">
                            <div className="h-8 bg-white/10 rounded-lg w-3/4" />
                            <div className="h-5 bg-white/10 rounded-lg w-1/2" />
                            <div className="h-4 bg-white/10 rounded w-full" />
                            <div className="h-4 bg-white/10 rounded w-5/6" />
                            <div className="h-4 bg-white/10 rounded w-4/5" />
                            <div className="flex gap-3 pt-4">
                                <div className="h-11 w-36 bg-white/10 rounded-lg" />
                                <div className="h-11 w-28 bg-white/10 rounded-lg" />
                                <div className="h-11 w-28 bg-white/10 rounded-lg" />
                            </div>
                        </div>
                    </div>
                    {/* Skeleton Season Grid */}
                    <div className="mt-16 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="h-10 bg-white/10 rounded animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!anime) {
        return (
            <div className="min-h-screen bg-black text-white font-sans flex flex-col">
                <SharedNavbar />
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
                    <span className="text-6xl">🎌</span>
                    <h2 className="text-2xl font-black text-white">Anime not found</h2>
                    <p className="text-gray-400 text-sm">This anime may have been removed or the link is incorrect.</p>
                    <Link to="/" className="mt-4 px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg transition-colors font-medium">
                        ← Go Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans flex flex-col">
            {/* Global Navbar */}
            <SharedNavbar />

            {/* Secondary Actions Bar */}
            <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 mt-16 lg:mt-20">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5">
                    {/* Breadcrumbs & Actions */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-gray-400 text-xs sm:text-sm min-w-0">
                            <Link to="/" className="hover:text-white transition-colors shrink-0">
                                <Home className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Link>
                            <span>›</span>
                            {selectedSeasons.size > 0 ? (
                                <>
                                    <Link to={`/anime/${id}`} className="hover:text-white transition-colors truncate max-w-[80px] sm:max-w-none">{anime.title}</Link>
                                    <span>›</span>
                                    <span className="text-white font-medium whitespace-nowrap">({selectedSeasons.size}) {t('anime.selected')}</span>
                                </>
                            ) : (
                                <span className="text-white font-medium truncate max-w-[120px] sm:max-w-[300px]">{anime.title}</span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 sm:gap-4 text-gray-400 shrink-0">
                            <button onClick={() => setReportOpen(true)} className="hover:text-red-500 transition-colors" title="Report Anime"><Flag className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                            <button className="hover:text-white transition-colors hidden sm:block"><SlidersHorizontal className="w-5 h-5" /></button>
                            <button className="hover:text-white transition-colors hidden sm:block"><MoreVertical className="w-5 h-5" /></button>
                            <button onClick={() => window.location.reload()} className="hover:text-white transition-colors"><RotateCw className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cinematic Hero Section */}
            <div className="relative w-full overflow-hidden bg-black pt-8 pb-12 md:pt-12 md:pb-20">
                {/* Blurred Background Image */}
                <div
                    className="absolute inset-0 z-0 opacity-40 blur-3xl scale-110"
                    style={{
                        backgroundImage: `url(${anime.image})`,
                        backgroundPosition: 'center',
                        backgroundSize: 'cover',
                    }}
                />

                {/* Gradient Overlay for Readability */}
                <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                <div className="absolute inset-0 z-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />

                {/* Foreground Hero Content */}
                <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 flex flex-col md:flex-row gap-6 md:gap-10 items-center md:items-stretch">
                    {/* Left: Poster Image — smaller on mobile */}
                    <div className="shrink-0 w-40 sm:w-56 md:w-80 group perspective-1000">
                        <div className="relative w-full aspect-[2/3] rounded-xl md:rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-white/10 group-hover:border-white/20 transition-all duration-300">
                            <img
                                src={anime.image}
                                alt={anime.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>
                    </div>

                    {/* Right: Info */}
                    <div className="flex-1 flex flex-col justify-end py-2 md:py-4 text-center md:text-left">
                        <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white leading-tight mb-3 md:mb-4 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
                            {anime.title}
                        </h1>

                        {/* Metadata Badges */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4 md:mb-6 text-sm font-medium justify-center md:justify-start">
                            <span className="flex items-center gap-1 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-yellow-500 shadow-xl">
                                ⭐️ {anime.rating?.toFixed(1) || '0.0'}
                            </span>
                            <span className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-white shadow-xl">
                                {anime.year || 'Unknown Year'}
                            </span>
                            <span className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-white uppercase tracking-wider text-xs shadow-xl">
                                {anime.section || 'POPULAR'}
                            </span>
                            <span className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-gray-300 shadow-xl">
                                16+
                            </span>
                        </div>

                        {/* Synopsis — hidden on very small screens */}
                        <p className="hidden sm:block text-gray-300 text-sm md:text-lg leading-relaxed max-w-4xl line-clamp-3 md:line-clamp-4 mb-6 md:mb-8 drop-shadow-md">
                            {anime.description || "No description available."}
                        </p>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 justify-center md:justify-start">

                            {/* PRIMARY: Browse Clips */}
                            <button
                                onClick={() => document.getElementById('clips-section')?.scrollIntoView({ behavior: 'smooth' })}
                                className="flex items-center gap-2 bg-primary hover:bg-cyan-400 text-black px-5 md:px-8 py-2.5 md:py-3.5 rounded-lg font-bold text-sm md:text-base transition-all shadow-lg shadow-primary/30 hover:shadow-primary/50 focus:ring-4 focus:ring-primary/40 focus:outline-none"
                            >
                                <Download className="w-4 h-4 md:w-5 md:h-5" />
                                <span>{t('anime.browse_clips')}</span>
                            </button>

                            {/* Download All as ZIP */}
                            <button
                                onClick={() => downloadApi.downloadSeason(anime.id, 1)}
                                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 md:px-6 py-2.5 md:py-3.5 rounded-lg font-medium transition-all backdrop-blur-sm focus:outline-none group text-sm md:text-base"
                                title="Download all clips as ZIP archive"
                            >
                                <Folder className="w-4 h-4 md:w-5 md:h-5 group-hover:text-yellow-400 transition-colors" />
                                <span className="hidden sm:inline">{t('anime.download_all')}</span>
                            </button>

                            {/* Navigate to /clips filtered */}
                            <button
                                onClick={() => navigate(`/clips?anime=${anime.id}`)}
                                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 md:px-5 py-2.5 md:py-3.5 rounded-lg font-medium transition-all backdrop-blur-sm focus:outline-none text-sm md:text-base"
                                title="View all clips for this anime"
                            >
                                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
                                <span className="hidden sm:inline">{t('anime.all_clips')}</span>
                            </button>

                            {/* Watchlist Button with Dropdown */}
                            <div ref={watchlistMenuRef} className="relative">
                                <button
                                    onClick={() => setShowWatchlistMenu(v => !v)}
                                    disabled={watchlistLoading}
                                    className={`flex items-center gap-2 border text-white px-4 md:px-5 py-2.5 md:py-3.5 rounded-lg font-medium transition-all backdrop-blur-sm focus:outline-none text-sm md:text-base ${watchlistStatus?.in_list
                                        ? 'bg-primary/20 border-primary/50 hover:bg-primary/30'
                                        : 'bg-white/10 border-white/20 hover:bg-white/20'
                                        } disabled:opacity-60`}
                                >
                                    {watchlistStatus?.in_list
                                        ? <BookmarkCheck className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                                        : <Bookmark className="w-4 h-4 md:w-5 md:h-5" />
                                    }
                                    <span className="hidden sm:inline">
                                        {watchlistStatus?.in_list
                                            ? WATCH_STATUSES.find(s => s.value === watchlistStatus.status) ? t(`watchlist.${watchlistStatus.status}`) : t('watchlist.in_list')
                                            : t('watchlist.add_to_list')
                                        }
                                    </span>
                                    <ChevronDown className="w-4 h-4 opacity-60" />
                                </button>

                                <AnimatePresence>
                                    {showWatchlistMenu && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute top-full mt-2 left-0 w-52 bg-[#0d0d1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50"
                                        >
                                            {WATCH_STATUSES.map(s => (
                                                <button
                                                    key={s.value}
                                                    onClick={() => handleWatchlistChange(s.value)}
                                                    className={`w-full px-4 py-3 text-sm text-left flex items-center gap-2 hover:bg-white/5 transition-colors ${watchlistStatus?.status === s.value ? 'text-primary font-bold' : 'text-gray-300'
                                                        }`}
                                                >
                                                    <span>{s.emoji}</span> {t(`watchlist.${s.value}`)}
                                                </button>
                                            ))}
                                            {watchlistStatus?.in_list && (
                                                <>
                                                    <div className="border-t border-white/10" />
                                                    <button
                                                        onClick={handleRemoveFromWatchlist}
                                                        className="w-full px-4 py-3 text-sm text-left text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                                                    >
                                                        🗑️ {t('watchlist.remove_from_list')}
                                                    </button>
                                                </>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}

            <div id="clips-section" className="flex-1 px-6 py-6 max-w-[1600px] mx-auto w-full relative z-20">
                {/* Tabs */}
                <div className="flex gap-6 border-b border-white/10 mb-6">
                    <button
                        onClick={() => setActiveTab('seasons')}
                        className={`pb-3 font-bold text-sm uppercase tracking-wider transition-colors ${activeTab === 'seasons' ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {t('anime.seasons_tab')}
                    </button>
                    <button
                        onClick={() => setActiveTab('comments')}
                        className={`pb-3 font-bold text-sm uppercase tracking-wider transition-colors ${activeTab === 'comments' ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {t('anime.comments_tab')}
                    </button>
                    <button
                        onClick={() => setActiveTab('reviews')}
                        className={`pb-3 font-bold text-sm uppercase tracking-wider transition-colors ${activeTab === 'reviews' ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {t('anime.reviews_tab')}
                    </button>
                </div>

                {/* Seasons Grid */}
                <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 ${activeTab !== 'seasons' ? 'hidden' : ''}`}>
                    {seasons.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            {t('anime.no_seasons')}
                        </div>
                    ) : (
                        seasons.map((season) => {
                            const isSelected = selectedSeasons.has(season.season_number);
                            const isCardMenuOpenForThis = cardMenuOpen === season.season_number;

                            return (
                                <div
                                    key={season.season_number}
                                    onClick={() => navigate(`/anime/${id}/season/${season.season_number}`)}
                                    className={`relative bg-[#1a1a1a] border ${isSelected ? 'border-white/30 bg-[#2a2a2a]' : 'border-white/5'} px-3 py-2.5 rounded cursor-pointer hover:bg-[#2a2a2a] transition-all flex items-center gap-2.5 group`}
                                >
                                    {/* Folder icon - hidden on hover, replaced by checkbox */}
                                    <div className={`shrink-0 ${isSelected ? 'hidden' : 'group-hover:hidden'}`}>
                                        <Folder className="w-5 h-5 text-gray-500" />
                                    </div>

                                    {/* Checkbox circle - visible on hover or when selected */}
                                    <div
                                        onClick={(e) => toggleSeasonSelection(season.season_number, e)}
                                        className={`shrink-0 ${isSelected ? 'block' : 'hidden group-hover:block'} cursor-pointer`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border-2 ${isSelected ? 'border-white bg-white' : 'border-white/60 bg-transparent'} flex items-center justify-center transition-all`}>
                                            {isSelected && (
                                                <div className="w-2.5 h-2.5 rounded-full bg-black"></div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Season name */}
                                    <span className="text-white text-sm font-medium truncate flex-1">
                                        {t('anime.season')} {season.season_number}
                                    </span>


                                    {/* Per-card three dots - visible on hover */}
                                    <div className="relative shrink-0">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCardMenuOpen(isCardMenuOpenForThis ? null : season.season_number);
                                            }}
                                            className={`text-gray-500 hover:text-white transition-colors p-0.5 ${isCardMenuOpenForThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>

                                        {/* Per-card dropdown */}
                                        {isCardMenuOpenForThis && (
                                            <div
                                                ref={cardMenuRef}
                                                className="absolute right-0 top-full mt-1 w-40 bg-[#111] border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden"
                                            >
                                                <button
                                                    onClick={(e) => handleCardDownload(season.season_number, e)}
                                                    className="w-full px-4 py-2.5 text-left hover:bg-white/5 transition-colors flex items-center gap-2.5 text-gray-300 hover:text-white text-sm"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    <span>{t('anime.download')}</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Additional Component Rendering */}
                {activeTab === 'comments' && anime.slug && (
                    <AnimeComments animeSlug={anime.slug} />
                )}
                {activeTab === 'reviews' && anime.slug && (
                    <AnimeReviews animeSlug={anime.slug} />
                )}
            </div>

            {/* Footer */}
            <div className="mt-auto">
                <SharedFooter />
            </div>

            <ReportModal
                isOpen={reportOpen}
                onClose={() => setReportOpen(false)}
                targetType="anime"
                targetId={Number(id)}
            />
        </div>
    );
}
