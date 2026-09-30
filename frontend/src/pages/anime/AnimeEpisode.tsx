import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Home, RotateCw, MoreVertical, ArrowLeft, PlayCircle } from 'lucide-react';
import ClipCard from '../../components/ClipCard';
import { animeApi } from '../../api/anime';
import { downloadApi } from '../../api/downloadApi';
import type { Anime, Clip } from '../../api/types';
import VideoPlayer from '../../components/VideoPlayer';

import SortMenu from '../../components/SortMenu';
import type { SortBy, SortOrder } from '../../components/SortMenu';
import ContextMenu from '../../components/ContextMenu';
import api from '../../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import BatchDownloader from '../../components/BatchDownloader';
import { useTranslation, Trans } from 'react-i18next';

// Format seconds → "MM:SS"
function formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AnimeEpisode() {
    const { t } = useTranslation();
    const { id, seasonId, episodeId } = useParams<{ id: string; seasonId: string; episodeId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [anime, setAnime] = useState<Anime | null>(null);
    const [clips, setClips] = useState<Clip[]>([]);
    const [sortBy, setSortBy] = useState<SortBy>('name');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [selectedClips, setSelectedClips] = useState<Set<number>>(new Set());
    const [menuOpen, setMenuOpen] = useState(false);
    const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
    const [loading, setLoading] = useState(true);

    // Resume Watching state
    const [resumePosition, setResumePosition] = useState<number>(0);
    const [resumeClip, setResumeClip] = useState<Clip | null>(null);

    // ?t= URL param — startAt for the VideoPlayer
    const startAtParam = Number(searchParams.get('t') ?? 0);
    const clipIdParam = Number(searchParams.get('clip') ?? 0);

    useEffect(() => {
        const fetchData = async () => {
            if (!id || !seasonId || !episodeId) return;
            try {
                setLoading(true);
                const [animeData, clipsData] = await Promise.all([
                    animeApi.getById(Number(id)),
                    animeApi.getEpisodeClips(Number(id), Number(seasonId), Number(episodeId))
                ]);
                setAnime(animeData);
                setClips(clipsData);

                // If ?clip=X&t=Y in URL, open that clip at that timestamp directly
                if (clipIdParam) {
                    const targetClip = clipsData.find((c: Clip) => c.id === clipIdParam);
                    if (targetClip) setSelectedClip(targetClip);
                }
            } catch (error) {
                console.error("Failed to fetch episode clips", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, seasonId, episodeId]);

    // Fetch resume positions for all clips; find the best one to resume
    useEffect(() => {
        if (clips.length === 0) return;
        // Check first clip as representative — or check each clip (cost-efficient: check on hover)
        // For simplicity: auto-check first local clip (non-YouTube)
        const localClips = clips.filter(c => c.video_path);
        if (localClips.length === 0) return;

        // Check the most recently watched clip in this episode
        const checkResume = async () => {
            for (const clip of localClips.slice(0, 5)) { // Check up to 5 clips
                try {
                    const { data } = await api.get(`/analytics/resume/${clip.id}`);
                    if (data.has_progress && data.position > 0) {
                        setResumePosition(data.position);
                        setResumeClip(clip);
                        break; // Show banner for first clip with progress
                    }
                } catch { /* silent */ }
            }
        };
        checkResume();
    }, [clips]);

    // Sort clips
    const sortedClips = useMemo(() => {
        const sorted = [...clips];
        sorted.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'name') {
                comparison = a.title.localeCompare(b.title);
            } else if (sortBy === 'date') {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                comparison = dateA - dateB;
            } else if (sortBy === 'size') {
                comparison = a.id - b.id;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
        return sorted;
    }, [clips, sortBy, sortOrder]);

    const handleSortChange = (newSortBy: SortBy, newSortOrder: SortOrder) => {
        setSortBy(newSortBy);
        setSortOrder(newSortOrder);
    };

    const toggleClipSelection = (clipId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedClips(prev => {
            const newSet = new Set(prev);
            if (newSet.has(clipId)) newSet.delete(clipId);
            else newSet.add(clipId);
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedClips.size === clips.length && clips.length > 0) {
            setSelectedClips(new Set());
        } else {
            setSelectedClips(new Set(clips.map(c => c.id)));
        }
    };

    const handleDownloadSelected = () => {
        if (selectedClips.size === 0) return;
        downloadApi.downloadZip(Array.from(selectedClips), `Anime_Clips_Batch.zip`);
    };


    if (loading) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center">{t('anime.loading')}</div>;
    }

    if (!anime) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center">Anime not found</div>;
    }

    // Compute startAt: use ?t= param OR resume position if it's for the selected clip
    const effectiveStartAt = selectedClip && selectedClip.id === resumeClip?.id
        ? (startAtParam || resumePosition)
        : startAtParam || 0;

    return (
        <div className="min-h-screen bg-black text-white font-sans flex flex-col">
            {/* Top Nav */}
            <div className="sticky top-0 z-10 bg-black border-b border-white/10">
                <div className="max-w-[1600px] mx-auto px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <Link to="/" className="hover:text-white transition-colors">
                                <Home className="w-5 h-5" />
                            </Link>
                            <span>/</span>
                            <Link to={`/anime/${id}`} className="hover:text-white transition-colors">{anime.title}</Link>
                            <span>/</span>
                            <Link to={`/anime/${id}/season/${seasonId}`} className="hover:text-white transition-colors">{t('anime.season')} {seasonId}</Link>
                            <span>/</span>
                            <span className="text-white font-medium">
                                {t('anime.episode')} {episodeId}
                                {selectedClips.size > 0 && ` • (${selectedClips.size}) ${t('anime.selected')}`}
                            </span>
                        </div>

                        <div className="flex items-center gap-4 text-gray-400 relative">
                            <SortMenu
                                sortBy={sortBy}
                                sortOrder={sortOrder}
                                onSortChange={handleSortChange}
                            />
                            <button
                                onClick={() => setMenuOpen(!menuOpen)}
                                className="hover:text-white transition-colors"
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>
                            <ContextMenu
                                selectedCount={selectedClips.size}
                                totalCount={clips.length}
                                onSelectAll={handleSelectAll}
                                onDownloadSelected={handleDownloadSelected}
                                isOpen={menuOpen}
                                onClose={() => setMenuOpen(false)}
                            />
                            <button onClick={() => window.location.reload()} className="hover:text-white transition-colors"><RotateCw className="w-5 h-5" /></button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <input
                        type="text"
                        placeholder={t('anime.search')}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:border-white/40"
                    />
                </div>
            </div>

            {/* Resume Banner */}
            <AnimatePresence>
                {resumeClip && resumePosition > 0 && !selectedClip && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-primary/10 border-b border-primary/30 px-6 py-3"
                    >
                        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 text-sm text-gray-300">
                                <PlayCircle className="w-5 h-5 text-primary flex-shrink-0" />
                                <span>
                                    <Trans
                                        i18nKey="player.resume_banner"
                                        values={{ time: formatTime(resumePosition), clip: resumeClip.title }}
                                        components={{
                                            1: <span className="text-white font-bold" />,
                                            2: <span className="text-white font-medium" />
                                        }}
                                    />
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedClip(resumeClip)}
                                    className="text-sm bg-primary text-black font-bold px-4 py-1.5 rounded-lg hover:bg-cyan-400 transition-colors"
                                >
                                    {t('player.resume')}
                                </button>
                                <button
                                    onClick={() => { setResumeClip(null); setResumePosition(0); }}
                                    className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                                >
                                    {t('player.dismiss')}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="flex-1 px-6 py-6 max-w-[1600px] mx-auto w-full">
                {/* Clips Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    {/* Previous Folder */}
                    <div
                        onClick={() => navigate(`/anime/${id}/season/${seasonId}`)}
                        className="aspect-video bg-[#222] rounded flex items-center justify-center cursor-pointer hover:bg-[#333] transition-colors"
                    >
                        <div className="flex flex-col items-center gap-2 text-gray-400">
                            <ArrowLeft className="w-6 h-6" />
                            <span className="text-xs font-bold">{t('anime.previous_folder')}</span>
                        </div>
                    </div>

                    {/* Clips */}
                    {sortedClips.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            {t('anime.no_clips_episode')}
                        </div>
                    ) : (
                        sortedClips.map((clip) => (
                            <ClipCard
                                key={clip.id}
                                clip={clip}
                                isSelected={selectedClips.has(clip.id)}
                                isResumeClip={clip.id === resumeClip?.id}
                                resumePosition={clip.id === resumeClip?.id ? resumePosition : 0}
                                onClick={() => setSelectedClip(clip)}
                                onToggleSelect={(e) => toggleClipSelection(clip.id, e)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-white/10 py-8 px-6 mt-auto">
                <div className="max-w-[1600px] mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                        <div className="text-left">
                            <img src="/aniflow-logo.svg" alt="AniFlow" className="h-12 mb-3 mix-blend-screen" />
                            <p className="text-sm text-gray-400 max-w-md">
                                AniFlow is an anime catalogue with episodes, short clips and a studio for cutting your own edits.
                                Built for fans who make AMVs and short edits.
                            </p>
                        </div>
                        <div className="mt-6 pt-6 border-t border-white/10 text-center w-full md:w-auto md:border-t-0 md:pt-0 md:mt-0">
                            <p className="text-xs text-gray-500">© 2026 AniFlow · Behruz Avezmatov</p>
                            <p className="text-xs text-gray-500 mt-1">Anime titles, frames and artwork belong to their studios and rights holders. AniFlow is a non-commercial portfolio project.</p>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Batch Downloader floating bar — appears when clips are selected */}
            <BatchDownloader
                selectedIds={selectedClips}
                totalCount={clips.length}
                onSelectAll={handleSelectAll}
                onClearAll={() => setSelectedClips(new Set())}
                filename={anime ? `${anime.title.replace(/[^a-z0-9]/gi, '_')}_S${seasonId}_E${episodeId}` : 'anime_clips'}
            />

            {/* Video Player Modal — passes startAt for ?t= and resume */}
            {selectedClip && (
                <VideoPlayer
                    clip={selectedClip}
                    onClose={() => setSelectedClip(null)}
                    startAt={effectiveStartAt || undefined}
                />
            )}
        </div>
    );
}
