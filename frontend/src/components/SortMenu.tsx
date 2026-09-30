import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';

export type SortBy = 'name' | 'date' | 'size';
export type SortOrder = 'asc' | 'desc';

interface SortMenuProps {
    sortBy: SortBy;
    sortOrder: SortOrder;
    onSortChange: (sortBy: SortBy, sortOrder: SortOrder) => void;
}

export default function SortMenu({ sortBy, sortOrder, onSortChange }: SortMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-gray-400 hover:text-white transition-colors"
            >
                <SlidersHorizontal className="w-5 h-5" />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-8 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-50 min-w-[200px]">
                    {/* Sort By Section */}
                    <div className="py-2">
                        <div className="px-4 py-2 text-xs text-gray-500 uppercase">Sort by</div>

                        <button
                            onClick={() => onSortChange('name', sortOrder)}
                            className="w-full px-4 py-2 text-left hover:bg-white/5 flex items-center justify-between"
                        >
                            <span className="text-white">Name</span>
                            {sortBy === 'name' && <Check className="w-4 h-4 text-white" />}
                        </button>

                        <button
                            onClick={() => onSortChange('size', sortOrder)}
                            className="w-full px-4 py-2 text-left hover:bg-white/5 flex items-center justify-between"
                        >
                            <span className="text-white">Size</span>
                            {sortBy === 'size' && <Check className="w-4 h-4 text-white" />}
                        </button>

                        <button
                            onClick={() => onSortChange('date', sortOrder)}
                            className="w-full px-4 py-2 text-left hover:bg-white/5 flex items-center justify-between"
                        >
                            <span className="text-white">Modified</span>
                            {sortBy === 'date' && <Check className="w-4 h-4 text-white" />}
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-white/10" />

                    {/* Order Section */}
                    <div className="py-2">
                        <button
                            onClick={() => onSortChange(sortBy, 'asc')}
                            className="w-full px-4 py-2 text-left hover:bg-white/5 flex items-center justify-between"
                        >
                            <span className="text-white">Ascending</span>
                            {sortOrder === 'asc' && <Check className="w-4 h-4 text-white" />}
                        </button>

                        <button
                            onClick={() => onSortChange(sortBy, 'desc')}
                            className="w-full px-4 py-2 text-left hover:bg-white/5 flex items-center justify-between"
                        >
                            <span className="text-white">Descending</span>
                            {sortOrder === 'desc' && <Check className="w-4 h-4 text-white" />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
