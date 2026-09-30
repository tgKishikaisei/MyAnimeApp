import { Folder, MoreVertical, Download } from 'lucide-react';
import type { EpisodeInfo } from '../api/types';

interface EpisodeCardProps {
    episode: EpisodeInfo;
    isSelected: boolean;
    isMenuOpen: boolean;
    onToggleSelection: (e: React.MouseEvent) => void;
    onNavigate: () => void;
    onMenuToggle: (e: React.MouseEvent) => void;
    onDownload: (e: React.MouseEvent) => void;
    menuRef?: React.RefObject<HTMLDivElement | null>;
}

export default function EpisodeCard({
    episode,
    isSelected,
    isMenuOpen,
    onToggleSelection,
    onNavigate,
    onMenuToggle,
    onDownload,
    menuRef
}: EpisodeCardProps) {
    return (
        <div
            onClick={onNavigate}
            className={`relative bg-[#1a1a1a] border ${isSelected ? 'border-white/30 bg-[#2a2a2a]' : 'border-white/5'} px-3 py-2.5 rounded cursor-pointer hover:bg-[#2a2a2a] transition-all flex items-center gap-2.5 group`}
        >
            {/* Folder icon - hidden on hover, replaced by checkbox */}
            <div className={`shrink-0 ${isSelected ? 'hidden' : 'group-hover:hidden'}`}>
                <Folder className="w-5 h-5 text-gray-500" />
            </div>

            {/* Checkbox circle - visible on hover or when selected */}
            <div
                onClick={onToggleSelection}
                className={`shrink-0 ${isSelected ? 'block' : 'hidden group-hover:block'} cursor-pointer`}
            >
                <div className={`w-5 h-5 rounded-full border-2 ${isSelected ? 'border-white bg-white' : 'border-white/60 bg-transparent'} flex items-center justify-center transition-all`}>
                    {isSelected && (
                        <div className="w-2.5 h-2.5 rounded-full bg-black"></div>
                    )}
                </div>
            </div>

            {/* Episode name */}
            <span className="text-white text-sm font-medium truncate flex-1">Episode {episode.episode_number}</span>

            {/* Per-card three dots - visible on hover */}
            <div className="relative shrink-0">
                <button
                    onClick={onMenuToggle}
                    className={`text-gray-500 hover:text-white transition-colors p-0.5 ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                    <MoreVertical className="w-4 h-4" />
                </button>

                {/* Per-card dropdown */}
                {isMenuOpen && (
                    <div
                        ref={menuRef}
                        className="absolute right-0 top-full mt-1 w-40 bg-[#111] border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden"
                    >
                        <button
                            onClick={onDownload}
                            className="w-full px-4 py-2.5 text-left hover:bg-white/5 transition-colors flex items-center gap-2.5 text-gray-300 hover:text-white text-sm"
                        >
                            <Download className="w-4 h-4" />
                            <span>Download</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
