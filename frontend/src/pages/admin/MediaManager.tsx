import { getStaticUrl } from '../../utils/imageUrl';
import { useState, useEffect, useRef } from 'react';
import { adminApi } from '../../api/admin';
import { Folder, File as FileIcon, Upload, Trash2, ArrowLeft, Loader2, HardDrive } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

interface MediaItem {
    name: string;
    is_dir: boolean;
    size: number;
    path: string;
}

export default function MediaManager() {
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentFolder, setCurrentFolder] = useState<string>('');
    const [uploading, setUploading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchMedia();
    }, [currentFolder]);

    const fetchMedia = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getMedia(currentFolder);
            setMediaItems(data);
        } catch (error) {
            console.error('Failed to fetch media:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (path: string) => {
        setCurrentFolder(path);
    };

    const handleNavigateUp = () => {
        if (!currentFolder) return;
        const parts = currentFolder.split('/');
        parts.pop();
        setCurrentFolder(parts.join('/'));
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            await adminApi.uploadMedia(file, currentFolder);
            await fetchMedia();
        } catch (error) {
            console.error('Failed to upload file:', error);
            alert('Failed to upload file');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (path: string) => {
        if (!window.confirm(`Are you sure you want to delete ${path}?`)) return;

        try {
            await adminApi.deleteMedia(path);
            setMediaItems(prev => prev.filter(item => item.path !== path));
        } catch (error) {
            console.error('Failed to delete file:', error);
            alert('Failed to delete file. Only files can be deleted.');
        }
    };

    const getIcon = (item: MediaItem) => {
        if (item.is_dir) return <Folder className="w-12 h-12 text-blue-500" />;
        const ext = item.name.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext || '')) {
            return (
                <div className="w-full h-32 bg-black/50 rounded-lg flex items-center justify-center overflow-hidden mb-2 relative group-hover:opacity-80 transition-opacity">
                    <img src={getStaticUrl(item.path)} alt={item.name} className="w-full h-full object-cover" />
                </div>
            );
        }
        return <FileIcon className="w-12 h-12 text-gray-400" />;
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                    <HardDrive className="w-8 h-8 text-blue-500" />
                    Media Browser
                </h1>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleNavigateUp}
                            disabled={!currentFolder}
                            className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30 transition-colors rounded hover:bg-white/5"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span className="text-white font-bold text-base">Media Browser</span>
                            {currentFolder && (
                                <>
                                    <span className="text-gray-600">›</span>
                                    <span className="text-gray-400 font-mono text-xs">{currentFolder}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                        <button
                            onClick={handleUploadClick}
                            disabled={uploading}
                            className="flex items-center gap-2 bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm font-bold transition-colors"
                        >
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Upload
                        </button>
                    </div>
                </div>

                {/* Path breadcrumb */}
                <div className="px-6 py-2 border-b border-white/5 bg-black/20">
                    <code className="text-xs text-gray-500 font-mono">/static/{currentFolder || ''}</code>
                </div>

                {/* Grid */}
                <div className="p-6 flex-1 bg-[url('https://transparenttextures.com/patterns/cubes.png')] bg-repeat">
                    {loading ? (
                        <div className="flex items-center justify-center h-64 text-gray-500 flex-col gap-4">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <p className="font-bold uppercase tracking-widest text-sm">Loading Directory...</p>
                        </div>
                    ) : mediaItems.length === 0 ? (
                        <div className="flex items-center justify-center h-64 text-gray-500 font-bold uppercase tracking-widest text-sm">
                            Directory is empty
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6">
                            {mediaItems.map((item) => (
                                <div key={item.path} className="group relative flex flex-col items-center">
                                    {/* Action Overlays */}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-2">
                                        {!item.is_dir && (
                                            <button
                                                onClick={() => handleDelete(item.path)}
                                                className="p-1.5 bg-red-600 text-white rounded shadow hover:bg-red-700"
                                                title="Delete File"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Item Icon / Thumbnail */}
                                    <button
                                        onClick={() => item.is_dir ? handleNavigate(item.path) : null}
                                        className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center p-4 transition-all ${item.is_dir ? 'bg-blue-900/10 border border-blue-500/20 hover:bg-blue-900/30 cursor-pointer' : 'bg-white/5 border border-white/10 hover:border-white/30 cursor-default'}`}
                                    >
                                        {getIcon(item)}
                                        {item.is_dir && <span className="mt-2 text-xs font-bold text-gray-300 truncate w-full text-center">{item.name}</span>}
                                    </button>

                                    {/* Item Info Line */}
                                    {!item.is_dir && (
                                        <div className="mt-2 w-full text-center">
                                            <p className="text-xs font-bold text-gray-300 truncate px-1" title={item.name}>{item.name}</p>
                                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">{formatBytes(item.size)}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
