/**
 * BatchDownloader — Floating bottom bar for bulk clip downloads.
 *
 * Appears with a slide-up animation whenever the user has selected ≥ 1 clip.
 * Shows the count, a progress/loading state during download, and quick-action buttons.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, CheckSquare, Square, Loader2, PackageCheck } from 'lucide-react';
import { downloadApi } from '../api/downloadApi';

interface BatchDownloaderProps {
    selectedIds: Set<number>;
    totalCount: number;
    onSelectAll: () => void;
    onClearAll: () => void;
    /** Label shown on the zip file, e.g.  "Naruto_S1_E5" */
    filename?: string;
}

export default function BatchDownloader({
    selectedIds,
    totalCount,
    onSelectAll,
    onClearAll,
    filename = 'anime_clips_batch',
}: BatchDownloaderProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
    const count = selectedIds.size;
    const allSelected = count === totalCount && totalCount > 0;

    const handleDownload = async () => {
        if (count === 0 || status === 'loading') return;
        setStatus('loading');
        try {
            await downloadApi.downloadZip(Array.from(selectedIds), `${filename}.zip`);
            setStatus('done');
            setTimeout(() => setStatus('idle'), 3000);
        } catch {
            setStatus('idle');
            alert('Download failed. Please try again.');
        }
    };

    return (
        <AnimatePresence>
            {count > 0 && (
                <motion.div
                    key="batch-bar"
                    initial={{ y: 120, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 120, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl"
                >
                    {/* Glass card */}
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
                        {/* Backdrop blur + dark glass */}
                        <div className="absolute inset-0 bg-[#111]/90 backdrop-blur-xl border border-white/10" />

                        {/* Animated green accent stripe when done */}
                        <AnimatePresence>
                            {status === 'done' && (
                                <motion.div
                                    key="done-stripe"
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: 1 }}
                                    exit={{ scaleX: 0, opacity: 0 }}
                                    transition={{ duration: 0.5 }}
                                    style={{ originX: 0 }}
                                    className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 to-cyan-400"
                                />
                            )}
                        </AnimatePresence>

                        {/* Content */}
                        <div className="relative flex items-center gap-4 px-5 py-4">
                            {/* Select-all toggle */}
                            <button
                                onClick={allSelected ? onClearAll : onSelectAll}
                                className="shrink-0 text-gray-400 hover:text-white transition-colors"
                                title={allSelected ? 'Deselect all' : 'Select all'}
                            >
                                {allSelected
                                    ? <CheckSquare className="w-5 h-5 text-white" />
                                    : <Square className="w-5 h-5" />
                                }
                            </button>

                            {/* Count label */}
                            <div className="flex-1 min-w-0">
                                {status === 'done' ? (
                                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                        <PackageCheck className="w-4 h-4" />
                                        Download started!
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-white font-bold text-sm">
                                            {count} clip{count !== 1 ? 's' : ''} selected
                                        </p>
                                        <p className="text-gray-500 text-xs">
                                            {allSelected ? 'All clips selected' : `${totalCount - count} remaining`}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Download ZIP button */}
                            <button
                                onClick={handleDownload}
                                disabled={status === 'loading'}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all
                                    ${status === 'loading'
                                        ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                                        : status === 'done'
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-white text-black hover:bg-gray-200 shadow-lg shadow-white/10'
                                    }`}
                            >
                                {status === 'loading' ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Preparing…</>
                                ) : status === 'done' ? (
                                    <><PackageCheck className="w-4 h-4" /> Done!</>
                                ) : (
                                    <><Download className="w-4 h-4" /> Download ZIP</>
                                )}
                            </button>

                            {/* Clear selection */}
                            <button
                                onClick={onClearAll}
                                className="shrink-0 text-gray-600 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                                title="Clear selection"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
