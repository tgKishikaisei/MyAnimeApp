import { Download, CheckCircle } from 'lucide-react';
import { useRef, useEffect } from 'react';

interface ContextMenuProps {
    selectedCount: number;
    totalCount: number;
    onSelectAll: () => void;
    onDownloadSelected: () => void;
    isOpen: boolean;
    onClose: () => void;
}

export default function ContextMenu({
    selectedCount,
    totalCount,
    onSelectAll,
    onDownloadSelected,
    isOpen,
    onClose
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const allSelected = selectedCount === totalCount && totalCount > 0;

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={menuRef}
            className="absolute right-0 top-full mt-2 w-64 bg-[#222] border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden"
        >
            {/* Select All */}
            <button
                onClick={() => {
                    onSelectAll();
                    onClose();
                }}
                className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3 text-gray-300 hover:text-white"
            >
                <CheckCircle className={`w-5 h-5 ${allSelected ? 'text-blue-500' : ''}`} />
                <span>{allSelected ? 'Deselect all' : 'Select all'}</span>
            </button>

            {/* Download Selected */}
            <button
                onClick={() => {
                    onDownloadSelected();
                    onClose();
                }}
                disabled={selectedCount === 0}
                className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 ${selectedCount === 0
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
            >
                <Download className="w-5 h-5" />
                <span>Download selected ({selectedCount})</span>
            </button>
        </div>
    );
}
