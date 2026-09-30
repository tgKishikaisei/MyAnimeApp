import { getImageUrl } from '../../utils/imageUrl';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Calendar, Shield, Camera, Play, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import EditProfileModal from '../../components/EditProfileModal';
import SharedNavbar from '../../components/SharedNavbar';
import SharedFooter from '../../components/SharedFooter';
import { useTranslation } from 'react-i18next';
import { watchlistApi } from '../../api/watchlist';
import type { WatchlistEntry, WatchStatus } from '../../api/watchlist';

export default function Profile() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [avatarHover, setAvatarHover] = useState(false);

    // Watchlist state
    const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
    const [activeTab, setActiveTab] = useState<WatchStatus | 'all'>('all');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user) {
            watchlistApi.getWatchlist()
                .then(data => {
                    setWatchlist(data);
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error('Failed to fetch watchlist', err);
                    setIsLoading(false);
                });
        }
        
        // Триггер анимации прокрутки
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-in');
                    }
                });
            },
            { threshold: 0.1 }
        );

        document.querySelectorAll('.fade-in-section').forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [user]);

    if (!user) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col font-sans">
                <SharedNavbar />
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-2xl">{t('profile.login_to_view')}</p>
                </div>
                <SharedFooter />
            </div>
        );
    }

    // Используем текущую дату, так как created_at еще нет в типе User
    const joinDate = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    return (
        <div className="min-h-screen relative flex flex-col overflow-x-hidden bg-black font-sans">
            <SharedNavbar />

            {/* Кинематографичный размытый фон */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <div
                    className="absolute inset-0 bg-cover bg-center blur-[100px] opacity-40 scale-125 saturate-150"
                    style={{
                        backgroundImage: user.avatar_url
                            ? `url(${getImageUrl(user.avatar_url)})`
                            : 'url(/wallpaper-fallback.jpg)',
                        backgroundColor: '#1a1010' // fallback deep red-black
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/80" />
            </div>

            {/* Обертка контента профиля */}
            <div className="flex-1 w-full flex items-center justify-center px-6 py-32 relative z-10">
                {/* Центральная стеклянная карточка */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="relative z-10 w-full max-w-md bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
                >
                    {/* Верхняя декоративная градиентная линия */}
                    <div className="h-1 w-full bg-gradient-to-r from-red-600 via-purple-500 to-blue-500" />

                    <div className="px-8 pt-10 pb-8 flex flex-col items-center">

                        {/* Контейнер аватара */}
                        <div className="relative mb-6">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.5, delay: 0.2, type: "spring", bounce: 0.5 }}
                                onMouseEnter={() => setAvatarHover(true)}
                                onMouseLeave={() => setAvatarHover(false)}
                                className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-gray-700 to-gray-400 shadow-xl cursor-pointer"
                            >
                                <div className="w-full h-full rounded-full bg-black overflow-hidden flex items-center justify-center">
                                    {user.avatar_url ? (
                                        <img
                                            src={getImageUrl(user.avatar_url)}
                                            alt={user.username}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <User className="w-16 h-16 text-gray-400" />
                                    )}
                                </div>
                            </motion.div>

                            {/* Оверлей камеры при наведении */}
                            <motion.div
                                initial={false}
                                animate={{ opacity: avatarHover ? 1 : 0 }}
                                className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full cursor-pointer pointer-events-none"
                            >
                                <Camera className="w-8 h-8 text-white" />
                            </motion.div>

                            {/* Индикатор статуса */}
                            <div className="absolute bottom-1 right-3 w-5 h-5 bg-emerald-500 rounded-full border-4 border-[#121111] shadow-lg" title={t('profile.online')} />
                        </div>

                        {/* Идентификаторы */}
                        <h1 className="text-2xl font-black text-white tracking-tight mb-1 text-center">
                            {user.full_name || user.email.split('@')[0]}
                        </h1>
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-6 font-semibold">
                            {user.role || 'USER'}
                        </p>

                        {/* Быстрые бейджи (Опционально/Эстетика) */}
                        <div className="flex gap-2 mb-8">
                            <span className="bg-red-500/10 text-red-500 text-xs font-bold px-3 py-1 rounded-full border border-red-500/20">
                                ANIME FAN
                            </span>
                            <span className="bg-purple-500/10 text-purple-400 text-xs font-bold px-3 py-1 rounded-full border border-purple-500/20">
                                VERIFIED
                            </span>
                        </div>

                        {/* Горизонтальный ряд статистики */}
                        <div className="w-full flex justify-between items-center py-4 border-y border-white/5 mb-6">
                            <div className="flex flex-col items-center flex-1">
                                <Calendar className="w-5 h-5 text-gray-400 mb-1" />
                                <span className="text-white font-bold text-sm">{joinDate}</span>
                                <span className="text-[#888] text-[10px] uppercase font-bold tracking-wider mt-0.5">{t('profile.joined')}</span>
                            </div>
                            <div className="w-px h-10 bg-white/5" />
                            <div className="flex flex-col items-center flex-1">
                                <Mail className="w-5 h-5 text-gray-400 mb-1" />
                                <span className="text-white font-bold text-sm truncate max-w-[100px]" title={user.email}>
                                    {user.email.split('@')[0]}
                                </span>
                                <span className="text-[#888] text-[10px] uppercase font-bold tracking-wider mt-0.5">Email</span>
                            </div>
                            <div className="w-px h-10 bg-white/5" />
                            <div className="flex flex-col items-center flex-1">
                                <Shield className="w-5 h-5 text-gray-400 mb-1" />
                                <span className="text-white font-bold text-sm uppercase">{user.role || 'USER'}</span>
                                <span className="text-[#888] text-[10px] uppercase font-bold tracking-wider mt-0.5">{t('profile.status')}</span>
                            </div>
                        </div>

                        {/* Секция "О себе" */}
                        <div className="w-full text-center px-4 mb-8">
                            <p className="text-sm leading-relaxed text-gray-300">
                                {user.bio ? user.bio : t('profile.default_bio')}
                            </p>
                        </div>

                        {/* Плейсхолдеры для соцсетей/ссылок (как на референсном изображении) */}
                        <div className="flex items-center gap-6 mb-8 border-b border-white/5 w-full justify-center pb-6">
                            <a href="#" className="text-gray-500 hover:text-white transition-colors"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" /></svg></a>
                            <a href="#" className="text-gray-500 hover:text-white transition-colors"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm3 8h-1.35c-.538 0-.65.221-.65.778v1.222h2l-.209 2h-1.791v7h-3v-7h-2v-2h2v-2.308c0-1.769.931-2.692 3.029-2.692h1.971v3z" /></svg></a>
                            <a href="#" className="text-gray-500 hover:text-white transition-colors"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg></a>
                        </div>

                        {/* Кнопка действия */}
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className="w-full max-w-[200px] bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all uppercase tracking-widest text-xs font-bold py-3.5 rounded-full outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                            {isEditing ? t('profile.cancel_edit') : t('profile.edit_profile')}
                        </button>

                    </div>
                </motion.div>

                {/* Контейнер модального окна редактирования профиля */}
                <EditProfileModal
                    isOpen={isEditing}
                    onClose={() => setIsEditing(false)}
                    currentUser={user}
                    onUpdate={async () => {
                        window.location.reload();
                    }}
                />
            </div>

            {/* WATCHLIST SECTION */}
            <div className="w-full max-w-6xl mx-auto px-6 pb-32 relative z-10">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-black text-white uppercase tracking-wider">My <span className="text-emerald-500">Watchlist</span></h2>
                    <div className="flex gap-2 bg-white/5 p-1 rounded-xl backdrop-blur-sm border border-white/10 hidden md:flex">
                        {(['all', 'watching', 'completed', 'plan_to_watch', 'on_hold', 'dropped'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-emerald-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                {tab.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mobile tabs */}
                <div className="flex md:hidden overflow-x-auto pb-4 mb-4 gap-2 scrollbar-none">
                     {(['all', 'watching', 'completed', 'plan_to_watch', 'on_hold', 'dropped'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-emerald-500 text-white flex-shrink-0' : 'text-gray-400 bg-white/5 flex-shrink-0'}`}
                        >
                            {tab.replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="w-full py-20 flex justify-center">
                        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                        <AnimatePresence mode="popLayout">
                            {watchlist
                                .filter(item => activeTab === 'all' || item.status === activeTab)
                                .map((item) => (
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.2 }}
                                    key={item.id}
                                    className="group relative bg-white/5 rounded-2xl overflow-hidden border border-white/10 hover:border-emerald-500/50 transition-colors"
                                >
                                    <Link to={`/anime/${item.anime?.slug || item.anime_id}`}>
                                        <div className="aspect-[2/3] relative overflow-hidden">
                                            <img 
                                                src={getImageUrl(item.anime?.image)} 
                                                alt={item.anime?.title || 'Anime'} 
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                            
                                            {/* Status Badge */}
                                            <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                                {item.status === 'watching' && <><Play className="w-3 h-3 text-blue-400"/> Watch</>}
                                                {item.status === 'completed' && <><CheckCircle className="w-3 h-3 text-emerald-400"/> Done</>}
                                                {item.status === 'plan_to_watch' && <><Clock className="w-3 h-3 text-purple-400"/> Plan</>}
                                                {item.status === 'on_hold' && <><Clock className="w-3 h-3 text-yellow-400"/> Hold</>}
                                                {item.status === 'dropped' && <><XCircle className="w-3 h-3 text-red-400"/> Drop</>}
                                            </div>

                                            <div className="absolute bottom-3 left-3 right-3">
                                                <h3 className="text-white font-bold text-sm line-clamp-2 leading-tight drop-shadow-lg mb-1">{item.anime?.title || 'Unknown Anime'}</h3>
                                                {item.status === 'watching' && (
                                                    <p className="text-emerald-400 text-xs font-semibold">Ep {item.progress_episode}</p>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                    <button 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (confirm('Remove from watchlist?')) {
                                                watchlistApi.removeFromWatchlist(item.anime_id).then(() => {
                                                    setWatchlist(prev => prev.filter(w => w.id !== item.id));
                                                });
                                            }
                                        }}
                                        className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/60 hover:bg-red-500/80 text-white/70 hover:text-white backdrop-blur transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            ))}
                            
                            {watchlist.filter(item => activeTab === 'all' || item.status === activeTab).length === 0 && (
                                <div className="col-span-full py-12 text-center bg-white/5 rounded-2xl border border-white/5 border-dashed">
                                    <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-400 font-medium">No anime found in this category.</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            <SharedFooter />
        </div>
    );
}
