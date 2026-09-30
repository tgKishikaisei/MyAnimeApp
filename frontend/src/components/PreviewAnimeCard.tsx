import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getImageUrl } from '../utils/imageUrl';
import { getVideoUrl } from '../utils/videoUrl';
import type { Anime } from '../api/types';

interface PreviewAnimeCardProps {
  anime: Anime;
  className?: string;
  isDraggingRef?: React.MutableRefObject<boolean>;
}

export default function PreviewAnimeCard({ anime, className = '', isDraggingRef }: PreviewAnimeCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Use the first clip for video preview if available
  const hasLocalVideo = anime?.clips && anime.clips.length > 0 && anime.clips[0].video_path;
  const videoUrl = hasLocalVideo ? getVideoUrl(anime.clips![0]) : null;

  const handleMouseEnter = () => {
    if (!hasLocalVideo) return;
    hoverTimer.current = setTimeout(() => {
      setIsHovered(true);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    }, 400); // 400ms delay like Netflix
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <Link
      to={`/anime/${anime.id}`}
      className={`relative group overflow-hidden block ${className} transition-transform duration-300 ${isHovered && videoLoaded ? 'scale-[1.03] shadow-lg shadow-black/80 z-10 border-white/40' : ''}`}
      onClick={(e) => {
        if (isDraggingRef && isDraggingRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      draggable={false}
    >
      <div className="w-full h-full pointer-events-none">
        <img
          src={getImageUrl(anime.image)}
          alt={anime.title}
          className={`absolute inset-0 w-full h-full object-cover opacity-80 brightness-125 transition-all duration-500 ease-in-out group-hover:opacity-100 group-hover:brightness-100 ${isHovered && videoLoaded ? 'opacity-0 group-hover:opacity-0' : 'group-hover:scale-105'}`}
          draggable={false}
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            img.onerror = null;
            img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='600' viewBox='0 0 400 600'%3E%3Crect width='400' height='600' fill='%231a1a1a'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='16' fill='%23555'%3ENo Image%3C/text%3E%3C/svg%3E";
          }}
        />
        {hasLocalVideo && (
          <video
            ref={videoRef}
            src={videoUrl!}
            muted
            loop
            playsInline
            preload="none"
            onLoadedData={() => setVideoLoaded(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isHovered && videoLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        <div className={`absolute inset-0 transition-colors duration-500 ${isHovered && videoLoaded ? 'bg-black/10' : 'bg-black/40 group-hover:bg-black/10'}`} />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
          <h3 className={`text-xl font-black uppercase tracking-tighter drop-shadow-xl leading-none text-center transition-all duration-500 ${isHovered && videoLoaded ? 'text-white/90 scale-95 translate-y-6 opacity-0' : 'text-white'}`}>
            {anime.title}
          </h3>
          {/* Rating badge — shown on non-video hover */}
          {!isHovered && anime.rating && (
            <span className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-xs bg-black/60 backdrop-blur-sm text-yellow-400 px-2 py-0.5 rounded-full font-bold">
              ⭐ {anime.rating.toFixed(1)}
            </span>
          )}

          {isHovered && videoLoaded && (
            <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 animate-in fade-in zoom-in duration-300">
               <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
               PREVIEW
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
