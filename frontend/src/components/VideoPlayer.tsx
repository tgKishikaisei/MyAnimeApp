import { X, Scissors, Music, Loader2, Share2, PictureInPicture, CheckCheck } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { Clip } from '../api/types';
import { getVideoUrl, isYouTubeClip } from '../utils/videoUrl';
import { animeApi } from '../api/anime';
import api from '../api/client';
import ClipStudioModal from './clips/ClipStudioModal';
import ClipTimecodeComments from './ClipTimecodeComments';
import { useTranslation } from 'react-i18next';

interface VideoPlayerProps {
    clip: Clip;
    onClose: () => void;
    startAt?: number; // ?t=123 support
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer({ clip, onClose, startAt }: VideoPlayerProps) {
    const { t } = useTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);
    const isYouTube = isYouTubeClip(clip);
    const videoUrl = getVideoUrl(clip);

    // Studio State
    const [isStudioOpen, setIsStudioOpen] = useState(false);
    const [isExtractingAudio, setIsExtractingAudio] = useState(false);

    // New UX states
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [copied, setCopied] = useState(false);

    // Telemetry tracking
    const maxTimeWatched = useRef(0);
    const hasSentTelemetry = useRef(false);
    const startOpenTime = useRef(Date.now());
    const watchedSeconds = useRef<Set<number>>(new Set());

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const currentSecond = Math.floor(videoRef.current.currentTime);
            maxTimeWatched.current = Math.max(maxTimeWatched.current, currentSecond);
            watchedSeconds.current.add(currentSecond);
        }
    };

    // Broadcast to Live Globe & Fire Scrubbing Heatmap
    useEffect(() => {
        api.post('/analytics/stream', {
            anime_title: clip.title,
            anime_id: clip.anime_id
        }).catch(err => console.debug('Live broadcast ping failed', err));

        // Heatmap Batch Sender (Every 10 seconds of playback)
        const heatmapInterval = setInterval(() => {
            if (watchedSeconds.current.size > 0) {
                const payload = Array.from(watchedSeconds.current);
                watchedSeconds.current.clear();
                api.patch(`/analytics/heatmap/${clip.anime_id}`, {
                    watched_seconds: payload
                }).catch(err => console.debug('Heatmap ping failed', err));
            }
        }, 10000);

        return () => clearInterval(heatmapInterval);
    }, [clip.id]);

    // Telemetry on unmount
    useEffect(() => {
        return () => {
            if (hasSentTelemetry.current) return;
            hasSentTelemetry.current = true;

            let durationWatched = maxTimeWatched.current;
            let totalDuration = 0;

            if (isYouTube) {
                durationWatched = (Date.now() - startOpenTime.current) / 1000;
                totalDuration = clip.duration || 0;
            } else if (videoRef.current) {
                totalDuration = videoRef.current.duration || clip.duration || 0;
            }

            const isCompleted = totalDuration > 0 && durationWatched >= totalDuration * 0.9;
            const episodeNum = clip.episode || 1;
            let bandwidthEstimate = 0;
            if (!isYouTube) {
                bandwidthEstimate = durationWatched * 0.08;
            }

            animeApi.logVideoSession(
                clip.id,
                clip.anime_id,
                Math.floor(durationWatched),
                Math.floor(totalDuration),
                Boolean(isCompleted),
                episodeNum,
                Number(bandwidthEstimate.toFixed(2))
            ).catch(console.error);
        };
    }, [clip.id, clip.anime_id, clip.episode, clip.duration, isYouTube]);

    // Jump to startAt time once video loads
    useEffect(() => {
        if (!isYouTube && startAt && videoRef.current) {
            const setTime = () => {
                if (videoRef.current) videoRef.current.currentTime = startAt;
            };
            videoRef.current.addEventListener('loadedmetadata', setTime, { once: true });
        }
    }, [isYouTube, startAt]);

    // Auto-play
    useEffect(() => {
        if (!isYouTube && videoRef.current) {
            videoRef.current.play().catch(console.error);
        }
    }, [isYouTube]);

    // Playback speed sync
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackSpeed;
        }
    }, [playbackSpeed]);

    // 🎹 Keyboard Shortcuts
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const video = videoRef.current;
        if (!video || isYouTube) return;

        // Ignore when typing in an input/textarea
        if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

        switch (e.key) {
            case ' ':
            case 'k':
                e.preventDefault();
                if (video.paused) void video.play(); else video.pause();
                break;
            case 'ArrowRight':
                e.preventDefault();
                video.currentTime = Math.min(video.duration, video.currentTime + 5);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                video.currentTime = Math.max(0, video.currentTime - 5);
                break;
            case 'm':
            case 'M':
                e.preventDefault();
                video.muted = !video.muted;
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                } else {
                    video.requestFullscreen?.();
                }
                break;
            case 'Escape':
                onClose();
                break;
        }
    }, [isYouTube, onClose]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // ⬛⬛  Double-click fullscreen
    const handleDoubleClick = () => {
        if (!videoRef.current || isYouTube) return;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            videoRef.current?.requestFullscreen?.();
        }
    };

    // 🖼️ Picture-in-Picture
    const handlePiP = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!videoRef.current) return;
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await videoRef.current?.requestPictureInPicture();
            }
        } catch (err) {
            console.error('PiP failed', err);
        }
    };

    // 🔗 Share button with ?t= timestamp
    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const currentTime = videoRef.current ? Math.floor(videoRef.current.currentTime) : 0;
        const shareUrl = `${window.location.origin}/clips?clip=${clip.id}&t=${currentTime}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            alert(shareUrl);
        }
    };

    const handleExtractAudio = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExtractingAudio(true);
        try {
            const response = await api.get(`/clips/${clip.id}/audio`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${clip.title.replace(/\s+/g, '_')}_Audio.mp3`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to extract audio', err);
            alert(t('player.extract_audio_failed'));
        } finally {
            setIsExtractingAudio(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-6xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors"
                >
                    <X className="w-8 h-8" />
                </button>

                {/* Video Title and Actions */}
                <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
                    <h2 className="text-white text-2xl font-bold">{clip.title}</h2>

                    <div className="flex items-center gap-2 relative z-10">
                        {/* Share Button */}
                        <button
                            onClick={handleShare}
                            title="Copy shareable link with timestamp"
                            className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                        >
                            {copied ? <CheckCheck className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
                            <span className="hidden md:inline">{copied ? t('player.copied') : t('player.share')}</span>
                        </button>

                        {/* Playback Speed */}
                        {!isYouTube && (
                            <div className="relative">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }}
                                    className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg font-bold flex items-center gap-1 transition-colors min-w-[56px] justify-center"
                                >
                                    {playbackSpeed}x
                                </button>
                                {showSpeedMenu && (
                                    <div className="absolute bottom-full mb-2 right-0 bg-[#1a1a1a] border border-white/20 rounded-lg overflow-hidden shadow-xl z-20">
                                        {SPEEDS.map(speed => (
                                            <button
                                                key={speed}
                                                onClick={(e) => { e.stopPropagation(); setPlaybackSpeed(speed); setShowSpeedMenu(false); }}
                                                className={`w-full px-5 py-2 text-sm text-left hover:bg-white/10 transition-colors ${playbackSpeed === speed ? 'text-white font-bold' : 'text-gray-400'}`}
                                            >
                                                {speed}x
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* PiP Button */}
                        {!isYouTube && (
                            <button
                                onClick={handlePiP}
                                title={t('player.pip')}
                                className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                            >
                                <PictureInPicture className="w-4 h-4" />
                            </button>
                        )}

                        {/* MP3 + Clip Studio */}
                        {!isYouTube && (
                            <>
                                <button
                                    onClick={handleExtractAudio}
                                    disabled={isExtractingAudio}
                                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {isExtractingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4" />}
                                    <span className="hidden md:inline">MP3</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsStudioOpen(true);
                                        if (videoRef.current) videoRef.current.pause();
                                    }}
                                    className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                                >
                                    <Scissors className="w-4 h-4" /> {t('player.clip_studio')}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Video Player */}
                <div className="bg-black rounded-lg overflow-hidden aspect-video">
                    {isYouTube ? (
                        <iframe
                            src={videoUrl}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    ) : (
                        <video
                            ref={videoRef}
                            src={videoUrl}
                            controls
                            className="w-full h-full"
                            autoPlay
                            onTimeUpdate={handleTimeUpdate}
                            onDoubleClick={handleDoubleClick}
                            title={t('player.keyboard_hints')}
                        >
                            {t('player.browser_no_support')}
                        </video>
                    )}
                </div>

                {/* Keyboard Shortcut Hint */}
                {!isYouTube && (
                    <p className="text-center text-xs text-gray-600 mt-2 select-none">
                        {t('player.keyboard_hints')}
                    </p>
                )}

                {/* Timecode Comments — only for local video clips */}
                {!isYouTube && (
                    <ClipTimecodeComments
                        clipId={clip.id}
                        duration={videoRef.current?.duration || clip.duration || 60}
                        videoRef={videoRef}
                    />
                )}
            </div>

            {/* Studio Modal Overlay */}
            {isStudioOpen && !isYouTube && (
                <ClipStudioModal
                    clipId={clip.id}
                    clipTitle={clip.title}
                    videoUrl={videoUrl}
                    duration={videoRef.current?.duration || clip.duration || 15}
                    onClose={() => setIsStudioOpen(false)}
                />
            )}
        </div>
    );
}
