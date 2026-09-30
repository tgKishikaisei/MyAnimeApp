import React, { useState, useRef, useEffect } from 'react';
import { Search, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';

// --- КОМПОНЕНТ АНИМАЦИИ (REVEAL) ---
const Reveal = ({ children, direction = 'up', delay = 0 }: { children: React.ReactNode, direction?: 'up' | 'left' | 'right' | 'zoom', delay?: number }) => {
  const variants: Variants = {
    hidden: { opacity: 0, y: direction === 'up' ? 50 : 0, scale: direction === 'zoom' ? 0.9 : 1 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 1, delay: delay, ease: "easeOut" } }
  };
  return (
    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={variants}>
      {children}
    </motion.div>
  );
};

function NotFound() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) setIsNavVisible(false);
      else setIsNavVisible(true);
      lastScrollY.current = currentScrollY;
      setIsAtTop(currentScrollY < 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
      
    <div className="min-h-screen text-white pb-20 font-sans relative overflow-x-hidden">
      
      {/* ФОН */}
      <div className="fixed inset-0 z-[-1] bg-cover bg-center bg-no-repeat bg-fixed" style={{ backgroundImage: "url('/bg.jpg')" }} />
      {/* Затемнение всего 50%, чтобы картинку сзади было хорошо видно */}
      <div className="fixed inset-0 z-[-1] bg-black/60" />

      {/* === NAVBAR === */}
      <motion.nav
        animate={{ y: isNavVisible ? 0 : "-100%" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        
        // 👇 ЗДЕСЬ МАГИЯ СТИЛЕЙ:
        className={`
          fixed top-0 w-full z-40 py-4 transition-all duration-500
          ${isAtTop 
            ? 'bg-transparent border-transparent'  // Если наверху: ПОЛНОСТЬЮ ПРОЗРАЧНАЯ
            : 'bg-black/60 border-b border-white/10 backdrop-blur-md' // Если скроллим: СТЕКЛО
          }
        `}
      >
        <div className="max-w-[1400px] mx-auto px-6">
          
          {/* ВЕРХНЯЯ СТРОКА */}
          {/* Изменил md:justify-between на lg:justify-between */}
          <div className="flex items-center justify-end lg:justify-between gap-6">
            {/* 1. Логотип (Появляется слева) */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* 1. Логотип (Теперь скрыт до LARGE экрана: hidden lg:flex) */}
              <Link to="/" className="hidden lg:flex items-center cursor-pointer shrink-0">
                <img 
                  src="/aniflow-logo.svg" 
                  alt="AniFlow" 
                  className="h-14 w-auto object-contain mix-blend-screen" 
                />
              </Link>
            </motion.div>  
    
            {/* 2. Поиск ПК (Только для LARGE: hidden lg:block) */}
            
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden lg:block flex-1 max-w-2xl mx-auto"
            >
              <div className="relative w-full">
                <input type="text" placeholder="Search anime" className="w-full bg-white text-black px-6 py-3 rounded-sm font-bold focus:outline-none placeholder:text-gray-500" />
                <Search className="absolute right-4 top-3 w-5 h-5 text-black" />
              </div>
            </motion.div>
    
            {/* 3. Правая часть: Меню */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex items-center gap-6 shrink-0"
            >
              <div className="hidden lg:flex items-center gap-8 text-xs font-bold tracking-[0.2em] text-gray-300">
                <Link to="/news" className="hover:text-white transition-colors">NEWS</Link>
                <Link to="/blog" className="hover:text-white transition-colors">BLOG</Link>
                {/* CLIPS подчеркнут, так как мы на этой странице */}
                <Link to="/clips" className="text-white border-b-2 border-white pb-1">CLIPS</Link>
              </div>
              
              {/* Кнопка Гамбургер */}
              <button onClick={() => setIsMenuOpen(true)} className="text-white hover:text-gray-300 transition-colors">
                <Menu className="w-8 h-8" />
              </button>
            </motion.div>
          </div>
    
          {/* 4. Поиск (ДЛЯ ВСЕХ ЭКРАНОВ МЕНЬШЕ LARGE: lg:hidden) */}
          {/* Теперь он будет внизу даже на планшетах */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 lg:hidden w-full"
          >
            <div className="relative w-full">
              <input type="text" placeholder="Search anime" className="w-full bg-white text-black px-4 py-3 rounded-sm font-bold focus:outline-none placeholder:text-gray-500" />
              <Search className="absolute right-4 top-3 w-5 h-5 text-black" />
            </div>
          </motion.div>
        </div>
      </motion.nav>

      {/* SIDEBAR */}
      <div className={`fixed inset-0 bg-black/80 z-50 transition-opacity ${isMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={() => setIsMenuOpen(false)} />
      <div className={`fixed top-0 left-0 h-full w-[300px] bg-black/90 backdrop-blur-xl z-[60] transform transition-transform duration-300 ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-8 flex flex-col gap-6 uppercase font-black text-xl">
          <button onClick={() => setIsMenuOpen(false)} className="self-end mb-4"><X className="w-8 h-8" /></button>
          <Link to="/news" onClick={() => setIsMenuOpen(false)}>News</Link>
          <Link to="/blog" onClick={() => setIsMenuOpen(false)}>Blog</Link>
          <Link to="/clips" onClick={() => setIsMenuOpen(false)}>Clips</Link>
        </div>
      </div>

      {/* === ЦЕНТРАЛЬНЫЙ БЛОК ОШИБКИ === */}
      <Reveal direction="zoom">
        {/* Добавляем большой pt-48 для ПК и pt-64 для мобилок, чтобы не налезать на поиск */}
        <div className="flex flex-col items-center text-center px-6 pt-64 md:pt-48 pb-20">
          
          {/* Круглая картинка */}
          <div className="w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden mb-10 border-4 border-white/5 shadow-2xl">
            <img src="/404-girl.png" alt="Not Found" className="w-full h-full object-cover" />
          </div>

          {/* Текст ошибки */}
          <h1 className="text-6xl md:text-8xl font-black mb-6 tracking-tighter">
            Error 404
          </h1>
          
          <p className="text-gray-400 text-lg md:text-xl font-medium mb-10 max-w-md">
            We can’t seem to find the page you’re looking for.
          </p>

          {/* Ссылка назад */}
          <Link 
            to="/" 
            className="text-red-600 font-bold text-lg hover:text-red-500 transition-colors underline underline-offset-8 decoration-2"
          >
            Go back to homepage
          </Link>

        </div>
      </Reveal>

      {/* === FOOTER ДЛЯ СТРАНИЦЫ 404 === */}
      <Reveal direction="up" delay={0.4}>
        <footer className="w-full bg-transparent pt-20 pb-10 border-t border-white/10 mt-20">
          <div className="max-w-[1400px] mx-auto px-6 text-left">
            
            {/* 1. ТВОЙ ЛОГОТИП */}
            <div className="mb-8">
              <img 
                src="/aniflow-logo.svg" 
                alt="Logo" 
                className="h-24 w-auto object-contain mix-blend-screen opacity-90" 
              />
            </div>

            {/* 2. ОПИСАНИЕ */}
            <div className="max-w-xl text-gray-400 font-medium text-sm leading-relaxed mb-12">
              <p>AniFlow is an anime catalogue with episodes, short clips and a studio for cutting your own edits.</p>
              <p>Built for fans who make AMVs and short edits.</p>
            </div>

            {/* 3. СОЦСЕТИ (УМЕНЬШАЮТСЯ ПРИ НАВЕДЕНИИ) */}
            <div className="mb-20">
              <h4 className="text-white font-bold text-sm mb-6 uppercase tracking-wider">Find us on other platforms</h4>
              <div className="flex gap-6 items-center">
                
                {/* Patreon */}
                <a href="#" className="transition-transform hover:scale-90">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
                    <rect x="2" y="2" width="4" height="20" /><circle cx="14" cy="9" r="7" />
                  </svg>
                </a>
                
                {/* YouTube */}
                <a href="#" className="transition-transform hover:scale-90">
                  <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
                    <path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418 c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768 C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.861-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z" />
                  </svg>
                </a>

                {/* Instagram */}
                <a href="#" className="transition-transform hover:scale-90">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 fill-transparent stroke-white stroke-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                </a>

                {/* Twitter */}
                <a href="#" className="transition-transform hover:scale-90">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
                    <path d="M22.46,6c-0.77,0.35-1.6,0.58-2.46,0.69c0.88-0.53,1.56-1.37,1.88-2.38c-0.83,0.5-1.75,0.85-2.72,1.05 C18.37,4.5,17.26,4,16,4c-2.35,0-4.27,1.92-4.27,4.29c0,0.34,0.04,0.67,0.11,0.98C8.28,9.09,5.11,7.38,3,4.79 C2.63,5.42,2.42,6.16,2.42,6.94c0,1.49,0.76,2.8,1.91,3.57c-0.71-0.02-1.37-0.22-1.95-0.54c0,0.02,0,0.04,0,0.06 c0,2.08,1.48,3.82,3.44,4.21c-0.36,0.1-0.74,0.15-1.13,0.15c-0.27,0-0.54-0.03-0.8-0.08c0.54,1.71,2.13,2.95,4.02,2.99 c-1.47,1.15-3.32,1.84-5.33,1.84c-0.35,0-0.69-0.02-1.03-0.06C2.9,19.33,5.19,20,7.64,20c6.76,0,10.46-5.61,10.46-10.46 c0-0.16,0-0.32-0.01-0.48C18.91,8.43,19.54,7.53,20.06,6.51c-0.66,0.29-1.36,0.49-2.09,0.57c0.76-0.46,1.34-1.18,1.61-2.04 C22.46,6,22.46,6,22.46,6z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* 4. КОПИРАЙТ И ДИСКЛЕЙМЕР */}
            <div className="border-t border-white/5 pt-10">
              <div className="text-[11px] text-gray-500 font-bold space-y-2 uppercase tracking-wider">
                <p>© 2026 AniFlow · Behruz Avezmatov</p>
                <p className="max-w-3xl opacity-50 normal-case font-medium leading-loose">
                  Anime titles, frames and artwork belong to their studios and rights holders. AniFlow is a non-commercial portfolio project.
                </p>
              </div>
            </div>

          </div>
        </footer>
      </Reveal>
    </div>
  );
}

export default NotFound;