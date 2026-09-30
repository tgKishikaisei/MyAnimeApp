/**
 * ClipCard — карточка клипа с hover-превью (как Netflix/TikTok).
 *
 * При наведении мышки: thumbnail плавно скрывается, а muted видео
 * начинает воспроизводиться автоматически. При уходе мышки — видео
 * останавливается и перематывается в начало, thumbnail появляется снова.
 *
 * Работает только для клипов с локальным video_path.
 * YouTube-клипы показывают только thumbnail без hover-превью.
 */

import { useRef, useState, useCallback } from 'react';
import { Download, Bookmark } from 'lucide-react';
import { downloadApi } from '../api/downloadApi';
import type { Clip } from '../api/types';
import { getThumbnailUrl, getVideoUrl } from '../utils/videoUrl';
import AddToPlaylistModal from './AddToPlaylistModal';

interface ClipCardProps {
    clip: Clip;
    isSelected: boolean;
    isResumeClip: boolean;
    resumePosition?: number;
    onClick: () => void;
    onToggleSelect: (e: React.MouseEvent) => void;
}

export default function ClipCard({
    clip,
    isSelected,
    isResumeClip,
    resumePosition = 0,
    onClick,
    onToggleSelect,
}: ClipCardProps) {
    const thumbnailUrl = getThumbnailUrl(clip);
    const videoUrl = getVideoUrl(clip);
    const hasLocalVideo = !!clip.video_path;

    const videoRef = useRef<HTMLVideoElement>(null);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showVideo, setShowVideo] = useState(false);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const [showPlaylistModal, setShowPlaylistModal] = useState(false);

    // Hover in — небольшая задержка (400ms) как на Netflix, чтобы случайные hover не запускали видео
    const handleMouseEnter = useCallback(() => {
        if (!hasLocalVideo) return;
        hoverTimer.current = setTimeout(() => {
            setShowVideo(true);
            if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(() => {/* autoplay may be blocked */ });
            }
        }, 400);
    }, [hasLocalVideo]);

    // Hover out — сбрасываем
    const handleMouseLeave = useCallback(() => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setShowVideo(false);
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    }, []);

    return (
        <div
            className={`relative aspect-video bg-[#1a1a1a] rounded overflow-hidden cursor-pointer
                transition-all duration-200 group
                ${isResumeClip ? 'border border-primary/60' : 'border border-transparent hover:border-white/30'}
                ${showVideo && videoLoaded ? 'scale-[1.02] z-10 shadow-xl shadow-black/60' : ''}
            `}
            onClick={onClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* ── Thumbnail (всегда присутствует, скрывается при hover видео) ── */}
            <img
                src={thumbnailUrl}
                alt={clip.title}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300
                    ${showVideo && videoLoaded ? 'opacity-0' : 'opacity-100'}`}
                onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.onerror = null; // prevent infinite loop
                    img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'%3E%3Crect width='320' height='180' fill='%231a1a1a'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%23666'%3ENo Preview%3C/text%3E%3C/svg%3E";
                }}
            />

            {/* ── Hover Video Preview ── */}
            {hasLocalVideo && (
                <video
                    ref={videoRef}
                    src={videoUrl}
                    muted
                    loop
                    playsInline
                    preload="none"
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300
                        ${showVideo && videoLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoadedData={() => setVideoLoaded(true)}
                />
            )}

            {/* ── Hover overlay: gradient + title ── */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent
                transition-opacity duration-300 ${showVideo && videoLoaded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <div className="absolute bottom-6 left-2 right-2 px-1">
                    <p className="text-white text-xs font-semibold line-clamp-1 drop-shadow-lg">{clip.title}</p>
                </div>
            </div>

            {/* ── Resume progress bar ── */}
            {isResumeClip && resumePosition > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 z-10">
                    <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, (resumePosition / (clip.duration || 1)) * 100)}%` }}
                    />
                </div>
            )}

            {/* ── Checkbox (bottom center, shown on hover or when selected) ── */}
            <div
                onClick={onToggleSelect}
                className={`absolute bottom-2 left-1/2 -translate-x-1/2 z-20
                    ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                    transition-opacity cursor-pointer`}
            >
                <div className={`w-6 h-6 rounded-full border-2
                    ${isSelected ? 'border-white bg-white' : 'border-white/70 bg-black/30'}
                    flex items-center justify-center transition-all drop-shadow-lg`}
                >
                    {isSelected && <div className="w-3 h-3 rounded-full bg-black" />}
                </div>
            </div>

            {/* ── Download button (top right) ── */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    downloadApi.downloadClip(clip.id, clip.title);
                }}
                className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100
                    transition-opacity p-1.5 bg-black/60 hover:bg-black/90 rounded-full text-white"
                title="Download Clip"
            >
                <Download className="w-4 h-4" />
            </button>

            {/* ── Save to playlist (top left) ── */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setShowPlaylistModal(true);
                }}
                className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100
                    transition-opacity p-1.5 bg-black/60 hover:bg-black/90 rounded-full text-white"
                title="Save to Playlist"
            >
                <Bookmark className="w-4 h-4" />
            </button>

            {/* ── AddToPlaylist Modal ── */}
            {showPlaylistModal && (
                <AddToPlaylistModal
                    clipId={clip.id}
                    clipTitle={clip.title}
                    onClose={() => setShowPlaylistModal(false)}
                />
            )}

            {/* ── "LIVE" badge while video is playing ── */}
            {showVideo && videoLoaded && (
                <div className="absolute top-2 left-2 z-20 bg-black/70 backdrop-blur-sm
                    text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    PREVIEW
                </div>
            )}
        </div>
    );
}
