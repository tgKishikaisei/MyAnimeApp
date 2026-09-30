import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { animeApi } from '../../api/anime';
import type { Anime } from '../../api/types';
import { getImageUrl } from '../../utils/imageUrl';
import SharedNavbar from '../../components/SharedNavbar';
import SharedFooter from '../../components/SharedFooter';
import { motion, AnimatePresence } from 'framer-motion';

const SECTIONS = ['All', 'popular', 'recent', 'series', 'movies', 'coming_soon', 'early_access', 'active_packs'];

export default function SearchPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const inputRef = useRef<HTMLInputElement>(null);


    const q = searchParams.get('q') ?? '';
    const sectionParam = searchParams.get('section') ?? '';

    const [query, setQuery] = useState(q);
    // Результат хранится вместе с ключом запроса: loading/results вычисляются, а не
    // выставляются синхронно в эффекте, и ответ на устаревший запрос не перетрёт новый.
    const requestKey = `${q}|${sectionParam}`;
    const [fetched, setFetched] = useState<{ key: string; results: Anime[] } | null>(null);
    const searched = Boolean(q);
    const loading = searched && fetched?.key !== requestKey;
    const results = searched && fetched?.key === requestKey ? fetched.results : [];

    // Focus input on mount
    useEffect(() => { inputRef.current?.focus(); }, []);

    // Search when q or section changes in URL
    useEffect(() => {
        if (!q) return;
        let cancelled = false;
        animeApi.search(q, 50)
            .then(data => (sectionParam ? data.filter(a => a.section === sectionParam) : data))
            .catch(() => [] as Anime[])
            .then(list => {
                if (!cancelled) setFetched({ key: requestKey, results: list });
            });
        return () => { cancelled = true; };
    }, [q, sectionParam, requestKey]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        const params: Record<string, string> = { q: query.trim() };
        if (sectionParam) params.section = sectionParam;
        setSearchParams(params);
    };

    const handleClear = () => {
        setQuery('');
        setSearchParams({});
        inputRef.current?.focus();
    };

    const setSection = (sec: string) => {
        const params: Record<string, string> = {};
        if (q) params.q = q;
        if (sec && sec !== 'All') params.section = sec;
        setSearchParams(params);
    };

    const activeSection = sectionParam || 'All';

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Fixed background */}
            <div className="fixed inset-0 z-[-1] bg-cover bg-center" style={{ backgroundImage: "url('/bg.jpg')" }} />
            <div className="fixed inset-0 z-[-1] bg-black/70" />

            <SharedNavbar />

            <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 pt-32 pb-24">
                {/* Search Form */}
                <form onSubmit={handleSubmit} className="mb-10">
                    <div className="relative group max-w-2xl mx-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors pointer-events-none" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search anime by title…"
                            className="w-full bg-white/5 border border-white/10 focus:border-primary/50 rounded-2xl pl-12 pr-12 py-4 text-lg text-white placeholder-gray-500 outline-none transition-all ring-0 focus:ring-2 focus:ring-primary/20"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </form>

                {/* Section Filters */}
                <div className="flex flex-wrap gap-2 justify-center mb-10">
                    {SECTIONS.map(sec => (
                        <button
                            key={sec}
                            onClick={() => setSection(sec)}
                            className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize border transition-all ${activeSection === sec
                                ? 'bg-primary text-black border-primary'
                                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            {sec.replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>

                {/* Results */}
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex justify-center py-24"
                        >
                            <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        </motion.div>
                    ) : searched && results.length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-center py-24"
                        >
                            <div className="text-6xl mb-6">🔍</div>
                            <p className="text-xl font-bold text-white mb-2">No results for &ldquo;{q}&rdquo;</p>
                            <p className="text-gray-500 text-sm">Try a different spelling or check back later.</p>
                        </motion.div>
                    ) : !searched ? (
                        <motion.div
                            key="prompt"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-center py-24"
                        >
                            <div className="text-6xl mb-6 opacity-20">🎌</div>
                            <p className="text-gray-500">Type to search across all anime…</p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key={`results-${q}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            <p className="text-sm text-gray-500 mb-6">
                                Found <span className="text-white font-bold">{results.length}</span> result{results.length !== 1 ? 's' : ''} for &ldquo;<span className="text-primary">{q}</span>&rdquo;
                                {sectionParam && <span> in <span className="text-white font-bold capitalize">{sectionParam.replace(/_/g, ' ')}</span></span>}
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {results.map((anime, i) => (
                                    <motion.div
                                        key={anime.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.03 }}
                                    >
                                        <Link
                                            to={`/anime/${anime.id}`}
                                            className="block group relative aspect-[2/3] rounded-xl overflow-hidden border border-white/10 hover:border-primary/40 transition-all duration-300 shadow-lg hover:shadow-primary/10"
                                        >
                                            <img
                                                src={getImageUrl(anime.image)}
                                                alt={anime.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                                            <div className="absolute bottom-0 left-0 right-0 p-3">
                                                <h3 className="text-xs font-bold text-white leading-tight line-clamp-2 drop-shadow">{anime.title}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {anime.year && <span className="text-[10px] text-gray-400">{anime.year}</span>}
                                                    <span className="text-[10px] text-primary uppercase font-semibold">{anime.section}</span>
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <SharedFooter />
        </div>
    );
}
