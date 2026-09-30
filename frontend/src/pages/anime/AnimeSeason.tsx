import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Home, MoreVertical, ArrowLeft, RotateCw } from 'lucide-react';
import { animeApi } from '../../api/anime';
import { downloadApi } from '../../api/downloadApi';
import type { Anime, EpisodeInfo } from '../../api/types';
import SortMenu from '../../components/SortMenu';
import type { SortBy, SortOrder } from '../../components/SortMenu';
import ContextMenu from '../../components/ContextMenu';
import { useTranslation } from 'react-i18next';
import EpisodeCard from '../../components/EpisodeCard';
import SharedFooter from '../../components/SharedFooter';

export default function AnimeSeason() {
    const { t } = useTranslation();
    const { id, seasonId } = useParams<{ id: string; seasonId: string }>();
    const navigate = useNavigate();
    const [anime, setAnime] = useState<Anime | null>(null);
    const [episodes, setEpisodes] = useState<EpisodeInfo[]>([]);
    const [sortBy, setSortBy] = useState<SortBy>('name');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [selectedEpisodes, setSelectedEpisodes] = useState<Set<number>>(new Set());
    const [menuOpen, setMenuOpen] = useState(false);
    const [cardMenuOpen, setCardMenuOpen] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const cardMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!id || !seasonId) return;
            try {
                setLoading(true);
                const [animeData, episodesData] = await Promise.all([
                    animeApi.getById(Number(id)),
                    animeApi.getEpisodes(Number(id), Number(seasonId))
                ]);
                setAnime(animeData);
                setEpisodes(episodesData);
            } catch (error) {
                console.error("Failed to fetch season data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, seasonId]);

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

    // Sort episodes based on sort settings
    const sortedEpisodes = useMemo(() => {
        const sorted = [...episodes];

        sorted.sort((a, b) => {
            let comparison = 0;

            if (sortBy === 'name') {
                comparison = a.episode_number - b.episode_number;
            } else if (sortBy === 'size') {
                comparison = a.clip_count - b.clip_count;
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return sorted;
    }, [episodes, sortBy, sortOrder]);

    const handleSortChange = (newSortBy: SortBy, newSortOrder: SortOrder) => {
        setSortBy(newSortBy);
        setSortOrder(newSortOrder);
    };

    const toggleEpisodeSelection = (episodeNumber: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedEpisodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(episodeNumber)) {
                newSet.delete(episodeNumber);
            } else {
                newSet.add(episodeNumber);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedEpisodes.size === episodes.length && episodes.length > 0) {
            setSelectedEpisodes(new Set());
        } else {
            setSelectedEpisodes(new Set(episodes.map(ep => ep.episode_number)));
        }
    };

    const handleDownloadSelected = () => {
        if (selectedEpisodes.size === 0) return;
        if (anime && seasonId) {
            downloadApi.downloadSelectedEpisodes(anime.id, Number(seasonId), Array.from(selectedEpisodes));
        }
    };

    const handleCardDownload = (episodeNumber: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setCardMenuOpen(null);
        if (anime && seasonId) {
            downloadApi.downloadEpisode(anime.id, Number(seasonId), episodeNumber);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white font-sans flex flex-col">
                <header className="border-b border-white/10 bg-black/95 py-4 px-4 sm:px-6">
                    <div className="max-w-[1600px] mx-auto">
                        <div className="h-5 w-48 bg-white/10 rounded animate-pulse mb-3" />
                        <div className="h-9 bg-white/10 rounded-lg animate-pulse" />
                    </div>
                </header>
                <div className="flex-1 px-4 sm:px-6 py-6 max-w-[1600px] mx-auto w-full">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                        {Array.from({ length: 20 }).map((_, i) => (
                            <div key={i} className="h-10 bg-white/10 rounded animate-pulse" style={{ animationDelay: `${i * 30}ms` }} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!anime) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
                <span className="text-5xl">📁</span>
                <h2 className="text-2xl font-black">Season not found</h2>
                <Link to="/" className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors font-medium">
                    ← Go Home
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans flex flex-col">
            {/* Header */}
            <header className="border-b border-white/10 sticky top-0 z-10 bg-black/95 backdrop-blur-sm">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3">
                    {/* Breadcrumbs & Actions */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 text-gray-400 text-xs sm:text-sm min-w-0">
                            <Link to="/" className="hover:text-white transition-colors shrink-0">
                                <Home className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Link>
                            <span>›</span>
                            <Link to={`/anime/${id}`} className="hover:text-white transition-colors truncate max-w-[80px] sm:max-w-[200px]">{anime.title}</Link>
                            <span>›</span>
                            {selectedEpisodes.size > 0 ? (
                                <span className="text-white font-medium whitespace-nowrap">({selectedEpisodes.size}) {t('anime.selected')}</span>
                            ) : (
                                <span className="text-white font-medium whitespace-nowrap">{t('anime.season')} {seasonId}</span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 sm:gap-4 text-gray-400 relative shrink-0">
                            <SortMenu
                                sortBy={sortBy}
                                sortOrder={sortOrder}
                                onSortChange={handleSortChange}
                            />
                            <button
                                onClick={() => setMenuOpen(!menuOpen)}
                                className="hover:text-white transition-colors"
                            >
                                <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                            <ContextMenu
                                selectedCount={selectedEpisodes.size}
                                totalCount={episodes.length}
                                onSelectAll={handleSelectAll}
                                onDownloadSelected={handleDownloadSelected}
                                isOpen={menuOpen}
                                onClose={() => setMenuOpen(false)}
                            />
                            <button onClick={() => window.location.reload()} className="hover:text-white transition-colors"><RotateCw className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <input
                        type="text"
                        placeholder={t('anime.search')}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 sm:py-2.5 text-sm sm:text-base text-white placeholder-gray-400 focus:outline-none focus:border-white/40"
                    />
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6 max-w-[1600px] mx-auto w-full">
                {/* Episodes Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 sm:gap-2">
                    {/* Previous Folder */}
                    <div
                        onClick={() => navigate(`/anime/${id}`)}
                        className="bg-[#1a1a1a] border border-white/5 px-3 py-2.5 rounded cursor-pointer hover:bg-[#2a2a2a] transition-colors flex items-center gap-2.5"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-400 shrink-0" />
                        <span className="text-white text-sm font-medium truncate">{t('anime.previous_folder')}</span>
                    </div>

                    {/* Episodes */}
                    {sortedEpisodes.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            {t('anime.no_episodes')}
                        </div>
                    ) : (
                        sortedEpisodes.map((episode) => {
                            const isSelected = selectedEpisodes.has(episode.episode_number);
                            const isCardMenuOpenForThis = cardMenuOpen === episode.episode_number;

                            return (
                                <EpisodeCard
                                    key={episode.episode_number}
                                    episode={episode}
                                    isSelected={isSelected}
                                    isMenuOpen={isCardMenuOpenForThis}
                                    onToggleSelection={(e) => toggleEpisodeSelection(episode.episode_number, e)}
                                    onNavigate={() => navigate(`/anime/${id}/season/${seasonId}/episode/${episode.episode_number}`)}
                                    onMenuToggle={(e) => {
                                        e.stopPropagation();
                                        setCardMenuOpen(isCardMenuOpenForThis ? null : episode.episode_number);
                                    }}
                                    onDownload={(e) => handleCardDownload(episode.episode_number, e)}
                                    menuRef={isCardMenuOpenForThis ? cardMenuRef : undefined}
                                />
                            );
                        })
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-auto">
                <SharedFooter />
            </div>
        </div>
    );
}
