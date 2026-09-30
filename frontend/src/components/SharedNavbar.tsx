import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Menu, X, User as UserIcon, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import type { Anime } from '../api/types';
import { getImageUrl } from '../utils/imageUrl';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBell from './NotificationBell';

export default function SharedNavbar() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [isAtTop, setIsAtTop] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Anime[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { user, logout } = useAuth();

    // Scroll behavior
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY && currentScrollY > 50) {
                setIsNavVisible(false);
            } else {
                setIsNavVisible(true);
            }
            setLastScrollY(currentScrollY);
            setIsAtTop(currentScrollY < 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced live search
    const liveSearch = useCallback(async (q: string) => {
        if (!q.trim() || q.length < 2) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }
        setIsSearching(true);
        try {
            const response = await api.get<Anime[]>('/animes/', { params: { search: q, limit: 6 } });
            setSearchResults(response.data.slice(0, 6));
            setShowDropdown(true);
        } catch {
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const q = e.target.value;
        setSearchQuery(q);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => liveSearch(q), 300);
    };

    const handleSearch = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        // Log telemetry
        try {
            await api.post('/animes/search-log', { query: searchQuery, results_count: searchResults.length });
        } catch { /* non-critical */ }

        if (searchResults.length === 1) {
            // Direct navigate if only one result
            navigate(`/anime/${searchResults[0].id}`);
        } else {
            navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
        }
        setSearchQuery('');
        setShowDropdown(false);
    };

    const handleSelectResult = (anime: Anime) => {
        navigate(`/anime/${anime.id}`);
        setSearchQuery('');
        setShowDropdown(false);
    };

    const handleLogout = () => {
        logout();
        setIsMenuOpen(false);
    };

    const SearchDropdown = ({ results }: { results: Anime[] }) => (
        <AnimatePresence>
            {showDropdown && (
                <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full mt-2 left-0 right-0 bg-[#0d0d1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50"
                >
                    {isSearching && (
                        <div className="px-4 py-3 text-sm text-gray-400 text-center">Searching...</div>
                    )}
                    {!isSearching && results.length === 0 && searchQuery.length >= 2 && (
                        <div className="px-4 py-3 text-sm text-gray-400 text-center">No results for "{searchQuery}"</div>
                    )}
                    {!isSearching && results.map((anime) => (
                        <button
                            key={anime.id}
                            onClick={() => handleSelectResult(anime)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-b-0"
                        >
                            <img
                                src={getImageUrl(anime.image_url || '')}
                                alt={anime.title}
                                className="w-10 h-14 object-cover rounded flex-shrink-0"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <div>
                                <p className="text-white font-semibold text-sm line-clamp-1">{anime.title}</p>
                                <p className="text-gray-400 text-xs line-clamp-1">{anime.section || ''} {anime.year ? `· ${anime.year}` : ''}</p>
                            </div>
                        </button>
                    ))}
                    {!isSearching && results.length > 0 && (
                        <button
                            onClick={handleSearch}
                            className="w-full px-4 py-2 text-xs text-primary hover:bg-white/5 transition-colors text-center border-t border-white/10"
                        >
                            See all results for "{searchQuery}" →
                        </button>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <>
            <motion.nav
                animate={{ y: isNavVisible ? 0 : '-100%' }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className={`
          fixed top-0 w-full z-40 py-4 transition-all duration-500
          ${isAtTop
                        ? 'bg-transparent border-transparent'
                        : 'bg-black/60 border-b border-white/10 backdrop-blur-md'
                    }
        `}
            >
                <div className="max-w-[1400px] mx-auto px-6">
                    <div className="flex items-center justify-end lg:justify-between gap-6">

                        {/* Logo */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <Link to="/" className="hidden lg:flex items-center cursor-pointer shrink-0">
                                <img
                                    src="/aniflow-logo.svg"
                                    alt="AniFlow"
                                    className="h-14 w-auto object-contain mix-blend-screen"
                                />
                            </Link>
                        </motion.div>

                        {/* Desktop Search with Live Dropdown */}
                        <motion.div
                            ref={searchRef}
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="hidden lg:block flex-1 max-w-2xl mx-auto relative"
                        >
                            <form onSubmit={handleSearch} className="relative w-full">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={handleQueryChange}
                                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                                    placeholder="Search anime..."
                                    className="w-full bg-white text-black px-6 py-3 rounded-sm font-bold focus:outline-none placeholder:text-gray-500"
                                />
                                <button type="submit" className="absolute right-4 top-3">
                                    <Search className="w-5 h-5 text-black hover:text-red-500 transition-colors" />
                                </button>
                            </form>
                            <SearchDropdown results={searchResults} />
                        </motion.div>

                        {/* Menu & Auth */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                            className="flex items-center gap-6 shrink-0"
                        >
                            <div className="hidden lg:flex items-center gap-8 text-xs font-bold tracking-[0.2em] text-gray-300">
                                <Link to="/news" className="hover:text-white transition-colors">{t('nav.news').toUpperCase()}</Link>
                                <Link to="/blog" className="hover:text-white transition-colors">{t('nav.blog').toUpperCase()}</Link>
                                <Link to="/clips" className="hover:text-white transition-colors">{t('nav.clips').toUpperCase()}</Link>
                            </div>

                            {/* Auth & Language */}
                            <div className="flex items-center gap-3">
                                <LanguageSwitcher />

                                {user && <NotificationBell />}
                                {user && user.role === 'admin' && (
                                    <Link to="/admin" className="hidden lg:block px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded transition-colors text-xs tracking-widest uppercase border border-white/10">
                                        {t('nav.admin')}
                                    </Link>
                                )}
                                {user ? (
                                    <div className="flex items-center gap-2 group relative cursor-pointer">
                                        <Link to="/profile" className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-600 to-red-400 p-[2px] hover:scale-110 transition-transform duration-300 block">
                                            <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                                                {user.avatar_url ? (
                                                    <img src={getImageUrl(user.avatar_url)} alt="avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <UserIcon className="w-5 h-5 text-white" />
                                                )}
                                            </div>
                                        </Link>
                                        <div className="absolute top-full right-0 mt-2 w-48 bg-black border border-white/10 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                                            <Link to="/profile" className="w-full text-left px-4 py-3 text-white hover:bg-white/5 flex items-center gap-2">
                                                <UserIcon className="w-4 h-4" /> {t('nav.profile')}
                                            </Link>
                                            <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-red-500 hover:bg-white/5 flex items-center gap-2">
                                                <LogOut className="w-4 h-4" /> {t('nav.logout')}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <Link to="/login" className="hidden lg:block px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded transition-colors text-xs tracking-widest uppercase">
                                        {t('nav.login')}
                                    </Link>
                                )}
                            </div>

                            <button onClick={() => setIsMenuOpen(true)} className="text-white hover:text-gray-300 transition-colors">
                                <Menu className="w-8 h-8" />
                            </button>
                        </motion.div>
                    </div>

                    {/* Mobile Search */}
                    <motion.div
                        ref={searchRef}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="mt-8 lg:hidden w-full relative"
                    >
                        <form onSubmit={handleSearch} className="relative w-full">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={handleQueryChange}
                                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                                placeholder="Search anime..."
                                className="w-full bg-white text-black px-4 py-3 rounded-sm font-bold focus:outline-none placeholder:text-gray-500"
                            />
                            <button type="submit" className="absolute right-4 top-3">
                                <Search className="w-5 h-5 text-black hover:text-red-500 transition-colors" />
                            </button>
                        </form>
                        <SearchDropdown results={searchResults} />
                    </motion.div>
                </div>
            </motion.nav>

            {/* Mobile Menu Overlay */}
            <div
                className={`fixed inset-0 bg-black/80 z-50 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsMenuOpen(false)}
            />

            {/* Mobile Menu Sidebar */}
            <div
                className={`fixed top-0 left-0 h-full w-[300px] bg-black/80 backdrop-blur-xl border-r border-white/10 text-white z-[60] shadow-2xl transform transition-transform duration-300 ease-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="p-8 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-10">
                        <span className="font-black text-xl tracking-tighter">MENU</span>
                        <button onClick={() => setIsMenuOpen(false)}>
                            <X className="w-8 h-8 text-white hover:text-red-600 transition-colors" />
                        </button>
                    </div>

                    <div className="flex flex-col gap-6 text-xl font-black tracking-wider uppercase mb-auto">
                        {user && user.role === 'admin' && (
                            <Link to="/admin" onClick={() => setIsMenuOpen(false)} className="text-yellow-500 hover:text-yellow-400 transition-colors">{t('nav.admin')}</Link>
                        )}
                        {user && (
                            <Link to="/profile" onClick={() => setIsMenuOpen(false)} className="hover:text-red-600 transition-colors">{t('nav.profile')}</Link>
                        )}
                        <Link to="/news" onClick={() => setIsMenuOpen(false)} className="hover:text-red-600 transition-colors">{t('nav.news')}</Link>
                        <Link to="/blog" onClick={() => setIsMenuOpen(false)} className="hover:text-red-600 transition-colors">{t('nav.blog')}</Link>
                        <Link to="/clips" onClick={() => setIsMenuOpen(false)} className="hover:text-red-600 transition-colors">{t('nav.clips')}</Link>
                        <Link to="/search" onClick={() => setIsMenuOpen(false)} className="hover:text-red-600 transition-colors">Search</Link>

                        {!user ? (
                            <>
                                <Link to="/login" onClick={() => setIsMenuOpen(false)} className="text-white hover:text-red-600 transition-colors">{t('nav.login')}</Link>
                                <Link to="/register" onClick={() => setIsMenuOpen(false)} className="text-white hover:text-red-600 transition-colors">{t('nav.register')}</Link>
                            </>
                        ) : (
                            <button onClick={handleLogout} className="text-red-500 hover:text-red-400 transition-colors text-left uppercase font-black">{t('nav.logout')}</button>
                        )}
                    </div>

                    <div className="pt-8 border-t border-white/10 mt-8 flex items-center justify-between">
                        <LanguageSwitcher />
                        {user && <NotificationBell />}
                    </div>
                </div>
            </div>
        </>
    );
}
