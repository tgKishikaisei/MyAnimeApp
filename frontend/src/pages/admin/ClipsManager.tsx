import { useState, useEffect, useRef } from 'react';
import { clipsApi } from '../../api/clips';
import { animeApi } from '../../api/anime';
import type { Clip, Anime } from '../../api/types';
import { Plus, Trash2, Search, Upload, X } from 'lucide-react';

import { apiErrorDetail } from '../../utils/apiError';
interface UploadTask {
    id: string;
    videoFile: File;
    thumbnailFile: File | null;
    title: string;
    season: number;
    episode: number;
    progress: number;
    status: 'idle' | 'uploading' | 'success' | 'error';
}

export default function ClipsManager() {
    const [clips, setClips] = useState<Clip[]>([]);
    const [animes, setAnimes] = useState<Anime[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [animeFilter, setAnimeFilter] = useState<number | 'all'>('all');

    // Bulk select
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Upload state
    const [selectedAnime, setSelectedAnime] = useState<number | null>(null);
    const [defaultSeason, setDefaultSeason] = useState(1);
    const [uploadQueue, setUploadQueue] = useState<UploadTask[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);
    const [thumbnailTargetId, setThumbnailTargetId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [clipsData, animesData] = await Promise.all([
                clipsApi.getAll(),
                animeApi.getAll()
            ]);
            setClips(clipsData);
            setAnimes(animesData);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const newTasks: UploadTask[] = Array.from(e.target.files).map((file, idx) => {
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            return {
                id: Math.random().toString(36).substring(2, 9),
                videoFile: file,
                thumbnailFile: null,
                title: nameWithoutExt,
                season: defaultSeason,
                episode: uploadQueue.length + idx + 1,
                progress: 0,
                status: 'idle'
            };
        });
        setUploadQueue([...uploadQueue, ...newTasks]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const updateTaskStatus = (id: string, status: UploadTask['status']) => {
        setUploadQueue(q => q.map(t => t.id === id ? { ...t, status } : t));
    };

    const updateTaskProgress = (id: string, progress: number) => {
        setUploadQueue(q => q.map(t => t.id === id ? { ...t, progress } : t));
    };

    const handleUploadAll = async () => {
        if (!selectedAnime) {
            alert('Please select an anime first');
            return;
        }
        if (uploadQueue.length === 0) {
            alert('Please add files to the queue');
            return;
        }

        setIsUploading(true);
        let hasErrors = false;

        for (let i = 0; i < uploadQueue.length; i++) {
            const task = uploadQueue[i];
            if (task.status === 'success') continue;

            updateTaskStatus(task.id, 'uploading');

            try {
                await clipsApi.uploadClip(
                    task.videoFile,
                    task.thumbnailFile,
                    {
                        title: task.title,
                        anime_id: selectedAnime,
                        season: task.season,
                        episode: task.episode
                    },
                    (percent) => updateTaskProgress(task.id, percent)
                );
                updateTaskStatus(task.id, 'success');
                updateTaskProgress(task.id, 100);
            } catch (error) {
                console.error("Failed to upload clip", task.title, error);
                updateTaskStatus(task.id, 'error');
                hasErrors = true;
            }
        }

        setIsUploading(false);
        await fetchData();

        if (hasErrors) {
            alert('Some uploads failed. Check the queue for details.');
        }
    };

    const removeTask = (id: string) => {
        setUploadQueue(q => q.filter(t => t.id !== id));
    };

    const updateTaskField = <K extends keyof UploadTask>(id: string, field: K, value: UploadTask[K]) => {
        setUploadQueue(q => q.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const handleThumbnailSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length || !thumbnailTargetId) return;
        updateTaskField(thumbnailTargetId, 'thumbnailFile', e.target.files[0]);
        setThumbnailTargetId(null);
        if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this clip?')) return;
        try {
            await clipsApi.delete(id);
            setClips(clips.filter(c => c.id !== id));
            setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        } catch (error) {
            console.error("Failed to delete", error);
            alert(apiErrorDetail(error) || 'Failed to delete clip. Check the server.');
        }
    };

    const filteredClips = clips.filter(clip => {
        const matchSearch = clip.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchAnime = animeFilter === 'all' || clip.anime_id === animeFilter;
        return matchSearch && matchAnime;
    });

    const allSelected = filteredClips.length > 0 && filteredClips.every(c => selectedIds.has(c.id));
    const someSelected = filteredClips.some(c => selectedIds.has(c.id));

    const toggleSelect = (id: number) => setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const toggleSelectAll = () => {
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredClips.map(c => c.id)));
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedIds.size} selected clips?`)) return;
        setIsBulkDeleting(true);
        let failed = 0;
        for (const id of Array.from(selectedIds)) {
            try { await clipsApi.delete(id); } catch { failed++; }
        }
        setSelectedIds(new Set());
        await fetchData();
        setIsBulkDeleting(false);
        if (failed > 0) alert(`${failed} items failed to delete.`);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Clips Manager</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-bold transition-colors"
                >
                    <Plus className="w-5 h-5" /> Upload Clip
                </button>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="text-white font-bold text-base">Clips List</span>
                        {someSelected && (
                            <>
                                <span className="text-gray-600">›</span>
                                <span className="text-white font-medium">({selectedIds.size}) selected</span>
                                <button onClick={() => setSelectedIds(new Set())} className="text-gray-500 hover:text-white text-xs ml-1">✕ clear</button>
                            </>
                        )}
                    </div>
                    {someSelected && (
                        <button
                            onClick={handleBulkDelete}
                            disabled={isBulkDeleting}
                            className="flex items-center gap-2 bg-red-700/80 hover:bg-red-600 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm font-bold transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            {isBulkDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
                        </button>
                    )}
                </div>

                {/* Anime filter pills */}
                <div className="px-6 py-3 border-b border-white/10 flex gap-1 flex-wrap">
                    <button
                        onClick={() => setAnimeFilter('all')}
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${animeFilter === 'all' ? 'bg-white text-black' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                    >All</button>
                    {animes.map(a => (
                        <button
                            key={a.id}
                            onClick={() => setAnimeFilter(a.id)}
                            className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider transition-colors ${animeFilter === a.id ? 'bg-white text-black' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                        >
                            {a.title.length > 20 ? a.title.slice(0, 20) + '…' : a.title}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="px-6 py-3 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search clips..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 text-white rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 placeholder-gray-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-gray-400">
                        <thead className="bg-black/30 text-xs uppercase font-bold text-gray-600 border-b border-white/5">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <div
                                        onClick={toggleSelectAll}
                                        className="w-5 h-5 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center border-white/40 hover:border-white"
                                        style={allSelected ? { borderColor: 'white', background: 'white' } : someSelected ? { borderColor: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.15)' } : {}}
                                    >
                                        {allSelected && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                                        {someSelected && !allSelected && <div className="w-1.5 h-1.5 rounded-full bg-white/70" />}
                                    </div>
                                </th>
                                <th className="px-4 py-3">Title</th>
                                <th className="px-4 py-3">Anime</th>
                                <th className="px-4 py-3">S/E</th>
                                <th className="px-4 py-3">Size</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr><td colSpan={6} className="text-center py-10 text-gray-500">Loading...</td></tr>
                            ) : filteredClips.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-10 text-gray-500">No clips found</td></tr>
                            ) : filteredClips.map((clip) => {
                                const anime = animes.find(a => a.id === clip.anime_id);
                                const isSelected = selectedIds.has(clip.id);
                                return (
                                    <tr key={clip.id} className={`transition-colors group ${isSelected ? 'bg-white/5' : 'hover:bg-white/[0.03]'}`}>
                                        <td className="px-4 py-3">
                                            <div
                                                onClick={() => toggleSelect(clip.id)}
                                                className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center ${isSelected ? 'border-white bg-white' : 'border-white/30 bg-transparent group-hover:border-white/60'}`}
                                            >
                                                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-white max-w-xs truncate">{clip.title}</td>
                                        <td className="px-4 py-3 text-gray-400 text-sm">{anime?.title || 'Unknown'}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 rounded bg-white/5 text-xs text-gray-400">S{clip.season}E{clip.episode}</span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">{clip.file_size || 'N/A'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(clip.id)}
                                                className="text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Upload Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <div className="bg-[#111] border border-white/10 p-8 rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-white">Upload Queue</h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                                {/* Configuration */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-400 mb-2">Anime *</label>
                                        <select
                                            value={selectedAnime || ''}
                                            onChange={(e) => setSelectedAnime(Number(e.target.value))}
                                            className="w-full bg-black border border-white/10 text-white rounded-md px-4 py-2 focus:outline-none focus:border-red-600"
                                            disabled={isUploading}
                                        >
                                            <option value="">Select Anime</option>
                                            {animes.map(anime => (
                                                <option key={anime.id} value={anime.id}>{anime.title}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-400 mb-2">Default Season</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={defaultSeason}
                                            onChange={(e) => setDefaultSeason(Number(e.target.value))}
                                            className="w-full bg-black border border-white/10 text-white rounded-md px-4 py-2 focus:outline-none focus:border-red-600"
                                            disabled={isUploading}
                                        />
                                    </div>
                                </div>

                                {/* Queue List */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-bold text-white">Files ({uploadQueue.length})</h3>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            <Upload className="w-4 h-4" /> Add Files
                                        </button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="video/*"
                                            multiple
                                            onChange={handleFilesSelected}
                                            className="hidden"
                                        />
                                        <input
                                            ref={thumbnailInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleThumbnailSelected}
                                            className="hidden"
                                        />
                                    </div>

                                    {uploadQueue.length === 0 ? (
                                        <div className="border-2 border-dashed border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-gray-500">
                                            <Upload className="w-12 h-12 mb-4 opacity-50" />
                                            <p>No files in queue. Click 'Add Files' to begin.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {uploadQueue.map(task => (
                                                <div key={task.id} className="bg-black/50 border border-white/5 rounded-lg p-4 relative">
                                                    {task.status !== 'idle' && (
                                                        <div className="absolute top-2 right-2 flex items-center gap-2">
                                                            {task.status === 'uploading' && <span className="text-blue-400 text-xs font-bold animate-pulse">Uploading {Math.round(task.progress)}%</span>}
                                                            {task.status === 'success' && <span className="text-green-500 text-xs font-bold">Success</span>}
                                                            {task.status === 'error' && <span className="text-red-500 text-xs font-bold">Failed</span>}
                                                        </div>
                                                    )}
                                                    <div className="grid grid-cols-12 gap-4 items-end">
                                                        <div className="col-span-5">
                                                            <label className="block text-xs text-gray-500 mb-1">Title</label>
                                                            <input
                                                                type="text"
                                                                value={task.title}
                                                                onChange={(e) => updateTaskField(task.id, 'title', e.target.value)}
                                                                disabled={isUploading || task.status === 'success'}
                                                                className="w-full bg-white/5 border border-white/10 text-white rounded px-2 py-1 text-sm focus:outline-none focus:border-white/30"
                                                            />
                                                            <p className="text-[10px] text-gray-600 mt-1 truncate">{task.videoFile.name}</p>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="block text-xs text-gray-500 mb-1">Season</label>
                                                            <input
                                                                type="number"
                                                                value={task.season}
                                                                onChange={(e) => updateTaskField(task.id, 'season', Number(e.target.value))}
                                                                disabled={isUploading || task.status === 'success'}
                                                                className="w-full bg-white/5 border border-white/10 text-white rounded px-2 py-1 text-sm"
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="block text-xs text-gray-500 mb-1">Episode</label>
                                                            <input
                                                                type="number"
                                                                value={task.episode}
                                                                onChange={(e) => updateTaskField(task.id, 'episode', Number(e.target.value))}
                                                                disabled={isUploading || task.status === 'success'}
                                                                className="w-full bg-white/5 border border-white/10 text-white rounded px-2 py-1 text-sm"
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="block text-xs text-gray-500 mb-1">Thumbnail</label>
                                                            <button
                                                                onClick={() => {
                                                                    setThumbnailTargetId(task.id);
                                                                    thumbnailInputRef.current?.click();
                                                                }}
                                                                disabled={isUploading || task.status === 'success'}
                                                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 rounded px-2 py-1 text-sm truncate"
                                                            >
                                                                {task.thumbnailFile ? 'Selected' : 'Optional'}
                                                            </button>
                                                        </div>
                                                        <div className="col-span-1 flex justify-end">
                                                            <button
                                                                onClick={() => removeTask(task.id)}
                                                                disabled={isUploading || task.status === 'success'}
                                                                className="text-gray-500 hover:text-red-500 p-1 disabled:opacity-50"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Progress Bar */}
                                                    {(task.status === 'uploading' || task.status === 'success' || task.status === 'error') && (
                                                        <div className="mt-3">
                                                            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                                <div
                                                                    className={`h-full transition-all duration-300 ${task.status === 'error' ? 'bg-red-500' : task.status === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}
                                                                    style={{ width: `${Math.max(2, task.progress)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                                <button
                                    onClick={() => {
                                        setIsModalOpen(false);
                                        // Auto-clear success tasks on close
                                        setUploadQueue(q => q.filter(t => t.status !== 'success'));
                                    }}
                                    disabled={isUploading}
                                    className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={handleUploadAll}
                                    disabled={isUploading || uploadQueue.length === 0 || !selectedAnime}
                                    className="px-6 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                    {isUploading ? 'Uploading...' : 'Start Upload'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
