import React, { useState } from 'react';
import { Search, Loader2, DownloadCloud, X } from 'lucide-react';
import api from '../../api/client';

interface JikanResult {
    mal_id: number;
    title: string;
    image_url: string;
    synopsis: string;
    year: number;
    score: number;
}

interface JikanImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function JikanImportModal({ isOpen, onClose, onSuccess }: JikanImportModalProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<JikanResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [importingId, setImportingId] = useState<number | null>(null);

    if (!isOpen) return null;

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        try {
            const { data } = await api.get(`/admin/jikan/search?q=${encodeURIComponent(query)}`);
            setResults(data);
        } catch (err) {
            console.error("Search failed", err);
            // fallback error handling could go here
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (anime: JikanResult) => {
        setImportingId(anime.mal_id);
        try {
            await api.post('/admin/jikan/import', {
                mal_id: anime.mal_id,
                title: anime.title,
                image_url: anime.image_url,
                synopsis: anime.synopsis,
                year: anime.year
            });
            onSuccess(); // Triggers a reload of the AnimeManager table
            onClose();
        } catch (err) {
            console.error("Import failed", err);
            alert("Failed to import anime. It may already exist.");
        } finally {
            setImportingId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-white/10">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                            <DownloadCloud className="w-6 h-6 text-blue-500" />
                            Auto-Parser (MyAnimeList)
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">Search the vast Jikan database and 1-click import to your server.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-6 bg-white/5">
                    <form onSubmit={handleSearch} className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search anime title on MAL (e.g. Naruto, Bleach...)"
                            className="w-full bg-black border border-white/20 rounded-lg pl-12 pr-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors text-lg"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={loading || !query.trim()}
                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold uppercase disabled:opacity-50 transition-colors"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
                        </button>
                    </form>
                </div>

                {/* Results Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {results.length === 0 && !loading && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4 py-12">
                            <DownloadCloud className="w-16 h-16 opacity-20" />
                            <p>Enter a search query to fetch content from the official database.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {results.map(anime => (
                            <div key={anime.mal_id} className="bg-black border border-white/10 rounded-lg p-4 flex gap-4 group hover:border-blue-500/50 transition-colors">
                                <img src={anime.image_url} alt={anime.title} className="w-24 h-36 object-cover rounded shadow-lg" />
                                <div className="flex-1 flex flex-col">
                                    <h3 className="font-bold text-white line-clamp-2 leading-tight">{anime.title}</h3>
                                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-2 font-mono">
                                        <span className="bg-white/10 px-2 py-0.5 rounded text-blue-400">ID: {anime.mal_id}</span>
                                        {anime.year && <span>{anime.year}</span>}
                                        {anime.score && <span className="text-yellow-500">★ {anime.score}</span>}
                                    </div>
                                    <p className="text-sm text-gray-500 mt-2 line-clamp-3 leading-snug flex-1">
                                        {anime.synopsis || "No synopsis available."}
                                    </p>
                                    <button
                                        onClick={() => handleImport(anime)}
                                        disabled={importingId === anime.mal_id}
                                        className="mt-3 w-full bg-white/5 hover:bg-blue-600 border border-white/10 hover:border-transparent text-white py-2 rounded font-bold uppercase text-xs tracking-wider transition-all disabled:opacity-50"
                                    >
                                        {importingId === anime.mal_id ? 'Importing...' : '1-Click Import'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
