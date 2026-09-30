import { ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function SharedFooter() {
    // 👇 1. Состояние для кнопки "Наверх"
    const [showScrollTop, setShowScrollTop] = useState(false);

    // 👇 2. Следим за прокруткой
    useEffect(() => {
        const handleScroll = () => {
            // Если прокрутили больше 300px — показываем кнопку
            if (window.scrollY > 300) {
                setShowScrollTop(true);
            } else {
                setShowScrollTop(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // 👇 3. Функция прокрутки наверх
    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <>
            {/* === FOOTER === */}
            <footer className="w-full bg-transparent pt-10 pb-6 border-t border-white/10 relative z-20">
                <div className="max-w-[1400px] mx-auto px-6">

                    {/* 1. ЛОГОТИП (ТВОЙ) */}
                    <div className="mb-6">
                        <img
                            src="/aniflow-logo.svg"
                            alt="Logo"
                            className="h-24 w-auto object-contain mix-blend-screen cursor-pointer"
                        />
                    </div>

                    {/* 2. ТЕКСТ */}
                    <div className="max-w-lg text-gray-400 font-medium text-sm leading-relaxed mb-12">
                        <p>AniFlow is an anime catalogue with episodes, short clips and a studio for cutting your own edits.</p>
                        <p>Built for fans who make AMVs and short edits.</p>
                    </div>

                    {/* 3. СОЦСЕТИ */}
                    <div className="mb-20">
                        <h4 className="text-white font-bold mb-4">Find us on other platforms</h4>
                        <div className="flex gap-4 items-center">

                            {/* 1. PATREON */}
                            <a href="#" className="group transition-transform hover:scale-90">
                                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                                    <rect x="2" y="2" width="4" height="20" />
                                    <circle cx="14" cy="9" r="7" />
                                </svg>
                            </a>

                            {/* 2. YOUTUBE */}
                            <a href="#" className="group transition-transform hover:scale-90">
                                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                                    <path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418 c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768 C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.861-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z" />
                                </svg>
                            </a>

                            {/* 3. INSTAGRAM */}
                            <a href="#" className="group transition-transform hover:scale-90">
                                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-transparent stroke-white stroke-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                            </a>

                            {/* 4. TWITTER (X) */}
                            <a href="#" className="group transition-transform hover:scale-90">
                                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                                    <path d="M22.46,6c-0.77,0.35-1.6,0.58-2.46,0.69c0.88-0.53,1.56-1.37,1.88-2.38c-0.83,0.5-1.75,0.85-2.72,1.05 C18.37,4.5,17.26,4,16,4c-2.35,0-4.27,1.92-4.27,4.29c0,0.34,0.04,0.67,0.11,0.98C8.28,9.09,5.11,7.38,3,4.79 C2.63,5.42,2.42,6.16,2.42,6.94c0,1.49,0.76,2.8,1.91,3.57c-0.71-0.02-1.37-0.22-1.95-0.54c0,0.02,0,0.04,0,0.06 c0,2.08,1.48,3.82,3.44,4.21c-0.36,0.1-0.74,0.15-1.13,0.15c-0.27,0-0.54-0.03-0.8-0.08c0.54,1.71,2.13,2.95,4.02,2.99 c-1.47,1.15-3.32,1.84-5.33,1.84c-0.35,0-0.69-0.02-1.03-0.06C2.9,19.33,5.19,20,7.64,20c6.76,0,10.46-5.61,10.46-10.46 c0-0.16,0-0.32-0.01-0.48C18.91,8.43,19.54,7.53,20.06,6.51c-0.66,0.29-1.36,0.49-2.09,0.57c0.76-0.46,1.34-1.18,1.61-2.04 C22.46,6,22.46,6,22.46,6z" />
                                </svg>
                            </a>
                        </div>
                    </div>

                    {/* 4. НИЖНЯЯ ЧАСТЬ */}
                    <div className="flex flex-col md:flex-row justify-between items-end border-t border-white/5 pt-6">
                        <div className="text-xs text-gray-500 font-bold space-y-1">
                            <p>© 2026 AniFlow · Behruz Avezmatov</p>
                        </div>
                    </div>

                </div>
            </footer>

            {/* === ПЛАВАЮЩАЯ КНОПКА "НАВЕРХ" === */}
            <button
                onClick={scrollToTop}
                aria-label="Scroll to top"
                className={`
                fixed bottom-6 right-6 md:bottom-10 md:right-10 z-50 p-3 rounded-full 
                bg-black/60 backdrop-blur-sm border border-white/20 text-white shadow-lg shadow-black/50
                transition-all duration-300 ease-in-out 
                hover:text-green-400 hover:border-green-400/50 hover:scale-110 hover:shadow-green-400/20

                ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}
                `}
            >
                <ChevronUp className="w-5 h-5" strokeWidth={2.5} />
            </button>
        </>
    );
}
