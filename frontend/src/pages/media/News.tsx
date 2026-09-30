import React, { useState, useRef, useEffect } from 'react';
import { Search, Menu, X, ChevronUp, Plus, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';

// --- ДАННЫЕ ---
import { animeApi } from '../../api/anime';
import { newsApi } from '../../api/news';
import type { Anime, News as NewsType } from '../../api/types';

const FAQ_ITEMS = [
  { question: "Is AniFlow safe?", answer: "Yes. Downloads use short-lived signed links, and the site has no ads." },
  { question: "What are Active Packs?", answer: "Shows airing this season. Their new episodes get clips first." },
  { question: "What format are the anime clips?", answer: "MP4 with H.264 video." },
  { question: "There are no clips/missing episodes on the anime page?", answer: "Press refresh next to the list. If it stays empty, nobody has cut that episode yet." },
  { question: "When do you release new anime clips?", answer: "Whenever an admin uploads them. The news page lists new arrivals." }
];

const Reveal = ({ children, direction = 'up', delay = 0, immediate = false }: { children: React.ReactNode, direction?: 'up' | 'left' | 'right' | 'zoom', delay?: number, immediate?: boolean }) => {
  const variants: Variants = {
    hidden: {
      opacity: 0,
      y: direction === 'up' ? 50 : 0,
      x: direction === 'left' ? -100 : direction === 'right' ? 100 : 0,
      scale: direction === 'zoom' ? 0.9 : 1
    },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      transition: { duration: 1.5, delay: delay, ease: "easeOut" }
    }
  };
  if (immediate) {
    return (
      <motion.div initial="hidden" animate="visible" variants={variants}>
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      variants={variants}
    >
      {children}
    </motion.div>
  );
};

function News() {
  // --- ЛОГИКА ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const lastScrollY = useRef(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [recentAnime, setRecentAnime] = useState<Anime[]>([]);
  const [news, setNews] = useState<NewsType[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recentData, newsData] = await Promise.all([
          animeApi.getAll('recent'),
          newsApi.getAll()
        ]);
        if (recentData) setRecentAnime(recentData);
        if (newsData) setNews(newsData);
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, []);

  // Логика FAQ (Аккордеон)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const toggleFaq = (index: number) => setOpenFaqIndex(openFaqIndex === index ? null : index);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setIsNavVisible(false);
      } else {
        setIsNavVisible(true);
      }
      lastScrollY.current = currentScrollY;
      setIsAtTop(currentScrollY < 10);
      setShowScrollTop(currentScrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="min-h-screen text-white pb-20 font-sans relative overflow-x-hidden">

      {/* ФОН */}
      <div className="fixed inset-0 z-[-1] bg-cover bg-center bg-no-repeat bg-fixed" style={{ backgroundImage: "url('/bg.jpg')" }} />
      <div className="fixed inset-0 z-[-1] bg-black/50" />

      {/* СТИЛИ СКРОЛЛБАРА */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
      `}</style>

      {/* === NAVBAR === */}
      {/* === NAVBAR (ТОЧНАЯ КОПИЯ ГЛАВНОЙ) === */}
      <motion.nav
        animate={{ y: isNavVisible ? 0 : "-100%" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`fixed top-0 w-full z-40 py-4 transition-all duration-500 ${isAtTop ? 'bg-transparent border-transparent' : 'bg-black/60 border-b border-white/10 backdrop-blur-md'}`}
      >
        <div className="max-w-[1400px] mx-auto px-6">

          {/* ВЕРХНЯЯ СТРОКА */}
          <div className="flex items-center justify-end lg:justify-between gap-6">

            {/* 1. ЛОГОТИП (Скрыт на маленьких экранах, как ты хотел) */}
            <Link to="/" className="hidden lg:flex items-center cursor-pointer shrink-0">
              <img
                src="/aniflow-logo.svg"
                alt="AniFlow"
                className="h-14 w-auto object-contain mix-blend-screen"
              />
            </Link>

            {/* 2. ПОИСК ПК (Белый фон, черный текст) */}
            <div className="hidden lg:block flex-1 max-w-2xl mx-auto">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Search anime"
                  className="w-full bg-white text-black px-6 py-3 rounded-sm font-bold focus:outline-none placeholder:text-gray-500"
                />
                <Search className="absolute right-4 top-3 w-5 h-5 text-black" />
              </div>
            </div>

            {/* 3. ПРАВАЯ ЧАСТЬ (Меню) */}
            <div className="flex items-center gap-6 shrink-0">
              <div className="hidden lg:flex items-center gap-8 text-xs font-bold tracking-[0.2em] text-gray-300">
                {/* NEWS подчеркнут */}
                <Link to="/news" className="text-white border-b-2 border-white pb-1">NEWS</Link>
                <Link to="/blog" className="hover:text-white transition-colors">BLOG</Link>
                <Link to="/clips" className="hover:text-white transition-colors">CLIPS</Link>
              </div>

              <button onClick={() => setIsMenuOpen(true)} className="text-white hover:text-gray-300 transition-colors">
                <Menu className="w-8 h-8" />
              </button>
            </div>
          </div>

          {/* 4. ПОИСК МОБИЛЬНЫЙ (Падает вниз на маленьком экране) */}
          <div className="mt-8 lg:hidden w-full">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search anime"
                className="w-full bg-white text-black px-4 py-3 rounded-sm font-bold focus:outline-none placeholder:text-gray-500"
              />
              <Search className="absolute right-4 top-3 w-5 h-5 text-black" />
            </div>
          </div>

        </div>
      </motion.nav>

      {/* SIDEBAR */}
      <div className={`fixed inset-0 bg-black/80 z-50 transition-opacity duration-300 ${isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={() => setIsMenuOpen(false)} />
      <div className={`fixed top-0 left-0 h-full w-[300px] bg-black/80 backdrop-blur-xl border-r border-white/10 text-white z-[60] shadow-2xl transform transition-transform duration-300 ease-out ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-8 flex flex-col h-full">
          <div className="flex justify-between items-center mb-10">
            <span className="font-black text-xl tracking-tighter">MENU</span>
            <button onClick={() => setIsMenuOpen(false)}><X className="w-8 h-8 text-white hover:text-red-500 transition-colors" /></button>
          </div>
          <div className="flex flex-col gap-6 text-xl font-black tracking-wider uppercase">
            <Link to="/news" onClick={() => setIsMenuOpen(false)} className="hover:text-red-600 transition-colors text-red-600">News</Link>
            <Link to="/blog" onClick={() => setIsMenuOpen(false)} className="hover:text-red-600 transition-colors">Blog</Link>
            <Link to="/clips" onClick={() => setIsMenuOpen(false)} className="hover:text-red-600 transition-colors">Clips</Link>
            <a href="#" className="hover:text-red-600 transition-colors">About</a>
            <a href="#" className="hover:text-red-600 transition-colors">Contact</a>
          </div>
        </div>
      </div>

      {/* 1. ACTIVE PACKS (ОБНОВЛЕННЫЙ СПИСОК) */}
      <Reveal direction="left" immediate>
        <section className="max-w-[1400px] mx-auto px-6 pt-40 pb-12">
          <h1 className="text-4xl font-bold mb-8 uppercase text-white">ACTIVE PACKS</h1>

          <div className="mb-12">
            <h3 className="text-xl font-bold text-gray-200 mb-6">Progress - March 2025 (Currently on Hiatus)</h3>
            <ul className="space-y-3 text-sm md:text-base font-medium">
              {/* Оранжевая группа */}
              <li className="text-orange-500 hover:text-orange-400 cursor-pointer transition-colors">Dragon Ball DAIMA – Episode 7</li>
              <li className="text-orange-500 hover:text-orange-400 cursor-pointer transition-colors">Bleach: Thousand-Year Blood War: Cour 3 – Episode 34</li>
              <li className="text-orange-500 hover:text-orange-400 cursor-pointer transition-colors">Blue Lock: Season 2 – Episode 8</li>
              <li className="text-orange-500 hover:text-orange-400 cursor-pointer transition-colors">Blue Exorcist: Season 4 – Episode 5</li>
              <li className="text-orange-500 hover:text-orange-400 cursor-pointer transition-colors">Rurouni Kenshin: Season 2 – Episode 5</li>
              <li className="text-orange-500 hover:text-orange-400 cursor-pointer transition-colors">Dandadan: Season 1 – Episode 8</li>
              <li className="text-orange-500 hover:text-orange-400 cursor-pointer transition-colors">Sakamoto Days – Episode 4</li>
              <li className="text-orange-500 hover:text-orange-400 cursor-pointer transition-colors">Shangri-La Frontier: Season 2 – Episode 6</li>
              <li className="text-orange-500 hover:text-orange-400 cursor-pointer transition-colors">Solo Leveling: Season 2 – Episode 3</li>

              {/* Зеленая группа */}
              <li className="text-green-500 hover:text-green-400 cursor-pointer transition-colors mt-6">Tower of God: Season 2 – Episode 18</li>
              <li className="text-green-500 hover:text-green-400 cursor-pointer transition-colors">One Piece – Episode 1122</li>
              <li className="text-green-500 hover:text-green-400 cursor-pointer transition-colors">Detective Conan – Episode 1135</li>

              {/* Бирюзовая группа */}
              <li className="text-teal-400 hover:text-teal-300 cursor-pointer transition-colors mt-6">Bleach (TV): Bount Assault on Soul Society – Episode 101</li>
              <li className="text-teal-400 hover:text-teal-300 cursor-pointer transition-colors">Hunter x Hunter: Green Island – Episode 75 (Unlike other anime, on release certain arcs will be shown in their entirety rather than in episodes)</li>
              <li className="text-teal-400 hover:text-teal-300 cursor-pointer transition-colors">Naruto Shippuden: Pain Arc – Full Pack</li>

              {/* Голубая группа */}
              <li className="text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors mt-6">Uzumaki: Season 1 – Episode 4</li>
              <li className="text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors">Monogatari Series – Off and Monster Season: Cour 1 – Episode 14</li>
              <li className="text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors">Terminator Zero – Season 1</li>
              <li className="text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors">My Hero Academia: Season 7 – Episode 21</li>
              <li className="text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors">Nier Automata Ver1.1a: Cour 2 – Episode 12</li>
              <li className="text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors">Shoshimin: How to Become Ordinary – Episode 10</li>
              <li className="text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors">Suicide Squad Isekai: Season 1 – Episode 10</li>
              <li className="text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors">Code Geass: Rozé of the Recapture – Episode 9</li>
            </ul>
          </div>

          <h1 className="text-4xl font-bold mb-8 uppercase text-white">EARLY ACCESS</h1>
          <div className="mb-8">

            {/* Блок 1: Март 2025 */}
            <h3 className="text-xl font-bold text-gray-200 mb-6">Progress - March 2025</h3>

            <p className="text-green-200 mb-2 hover:text-white cursor-pointer transition-colors font-medium">
              Angel's Egg
            </p>
            <p className="text-green-200 mb-2 hover:text-white cursor-pointer transition-colors font-medium">
              Maquia: When the Promised Flower Blooms
            </p>

            {/* Блок 2: Сентябрь 2024 */}
            <h3 className="text-xl font-bold text-gray-200 mt-8 mb-6">Progress - September 2024</h3>

            <p className="text-green-200 mb-2 hover:text-white cursor-pointer transition-colors font-medium">
              DanMachi: Arrow of the Orion + OVAs
            </p>
            <p className="text-green-200 hover:text-white cursor-pointer transition-colors font-medium">
              Katsugeki/Touken Ranbu
            </p>

          </div>
        </section>
      </Reveal>

      {/* 2. NEW RELEASES (ВИДЕО) */}
      <Reveal direction="zoom">
        <section className="w-full bg-transparent py-12 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto px-6">
            <h2 className="text-3xl font-bold mb-8 uppercase text-white">NEW RELEASES</h2>
            <div className="relative w-full aspect-video bg-transparent shadow-2xl rounded-sm overflow-hidden">
              <iframe
                className="w-full h-full mix-blend-screen"
                src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(news.length > 0 ? news[0].video_id : 'F6Pm8RPzwmQ')}`}
                title="New Releases"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </section>
      </Reveal>

      {/* 3. КАРТОЧКИ */}
      {/* 3. КАРТОЧКИ (АДАПТИВНЫЙ СКРОЛЛ + АНИМАЦИЯ) */}
      <Reveal direction="up" delay={0.3}>
        <section className="max-w-[1400px] mx-auto px-6 py-8 pb-32">

          <div className="
            h-[500px]              /* Телефон: Высокий блок для 1 колонки */
            md:h-[260px]           /* Планшет: Низкий блок (под 2 ряда) */
            xl:h-[390px]           /* ПК: Высота под 2 ряда больших карточек */
            overflow-y-auto        /* Вертикальный скролл */
            pr-2                   /* Отступ от скроллбара */
            custom-scrollbar       /* Стильный серый скроллбар */
          ">

            {/* СЕТКА: 1 колонка на телефоне, 4 колонки на планшете и ПК */}
            <div className="grid gap-4 group/recent grid-cols-1 md:grid-cols-4">

              {recentAnime.map((anime) => (
                <div
                  key={anime.id}
                  className="
                    relative aspect-video cursor-pointer border border-white/10 rounded-lg overflow-hidden
                    transition-all duration-500 ease-in-out
                    /* Затемняем соседей при наведении на сетку */
                    group-hover/recent:brightness-50
                    /* Выделяем активную карточку */
                    hover:!brightness-110 hover:scale-[1.02] hover:shadow-2xl hover:border-white/30
                  "
                >
                  {/* Картинка: Яркая, полупрозрачная (фон виден) */}
                  <img
                    src={anime.image}
                    alt={anime.title}
                    className="w-full h-full object-cover opacity-80 brightness-125 transition-all duration-500 ease-in-out group-hover:opacity-100 group-hover:brightness-100 hover:scale-[1.02]"
                  />

                  {/* Затемнение внутри */}
                  <div className="absolute inset-0 bg-black/50 group-hover:bg-black/20 transition-colors duration-500" />

                  {/* Текст и Логотипчик */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                    <h3 className="text-sm md:text-lg font-black uppercase tracking-tighter text-white drop-shadow-xl leading-tight">
                      {anime.title.includes(anime.highlight_char || '') ? (
                        <>
                          {anime.title.split(anime.highlight_char || '')[0]}
                          <span className={anime.accent_color}>{anime.highlight_char}</span>
                          {anime.title.split(anime.highlight_char || '')[1]}
                        </>
                      ) : (
                        anime.title
                      )}
                    </h3>

                    {/* <div className="mt-2 opacity-60 flex items-center gap-1 text-[8px] tracking-widest">
                        <span>ANIME</span>
                        <div className="relative w-2 h-2 flex items-center justify-center">
                          <div className="absolute w-full h-[1px] bg-white rotate-45"></div>
                          <div className="absolute w-full h-[1px] bg-white -rotate-45"></div>
                        </div>
                        <span>CLIPS</span>
                     </div> */}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* 4. FAQ (КАК НА СКРИНШОТЕ) */}
      <Reveal direction="up">
        <section className="max-w-[1400px] mx-auto px-6 py-12 pb-32">
          <h2 className="text-4xl font-bold mb-12 text-white">FAQ</h2>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={index} className="group">
                  <button onClick={() => toggleFaq(index)} className="w-full flex items-center gap-4 text-left py-2 transition-all duration-300">
                    <div className={`p-0.5 ${isOpen ? 'text-[#aaa]' : 'text-white group-hover:text-gray-300'}`}>
                      {isOpen ? <Minus className="w-5 h-5 font-black" /> : <Plus className="w-5 h-5 font-black" />}
                    </div>
                    <span className={`text-lg font-bold ${isOpen ? 'text-[#aaa]' : 'text-white group-hover:text-gray-300'}`}>{item.question}</span>
                  </button>
                  <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 mt-2 mb-6' : 'max-h-0 opacity-0'}`}>
                    <p className="text-gray-300 text-sm leading-relaxed pl-9 max-w-4xl">{item.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </Reveal>

      {/* 5. FOOTER (КОЛОНКИ КАК НА ФОТО) */}
      <Reveal direction="up" immediate>
        <footer className="w-full bg-transparent pt-16 pb-8 border-t border-white/10">
          <div className="max-w-[1400px] mx-auto px-6">

            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">

              {/* Колонка 1: Лого + Описание + Соцсети */}
              <div className="md:col-span-1">
                <div className="mb-6">
                  <img
                    src="/aniflow-logo.svg"
                    alt="Logo"
                    // 👇 ИЗМЕНИЛ ЗДЕСЬ: поставил h-12 (аккуратный размер) вместо h-24
                    className="h-30 w-auto object-contain mix-blend-screen cursor-pointer"
                  />
                </div>
                <p className="text-gray-400 text-sm leading-relaxed mb-8">
                  AniFlow is an anime catalogue with episodes, short clips and a studio for cutting your own edits.
                  Built for fans who make AMVs and short edits.
                </p>
                <h4 className="text-white font-bold text-sm mb-4">Find us on other platforms</h4>
                <div className="flex gap-4 items-center">
                  <a href="#" className="hover:scale-90 transition-transform"><svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><rect x="2" y="2" width="4" height="20" /><circle cx="14" cy="9" r="7" /></svg></a>
                  <a href="#" className="hover:scale-90 transition-transform"><svg viewBox="0 0 24 24" className="w-7 h-7 fill-white"><path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418 c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768 C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.861-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z" /></svg></a>
                  <a href="#" className="hover:scale-90 transition-transform"><svg viewBox="0 0 24 24" className="w-6 h-6 fill-transparent stroke-white stroke-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg></a>
                  <a href="#" className="hover:scale-90 transition-transform"><svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><path d="M22.46,6c-0.77,0.35-1.6,0.58-2.46,0.69c0.88-0.53,1.56-1.37,1.88-2.38c-0.83,0.5-1.75,0.85-2.72,1.05 C18.37,4.5,17.26,4,16,4c-2.35,0-4.27,1.92-4.27,4.29c0,0.34,0.04,0.67,0.11,0.98C8.28,9.09,5.11,7.38,3,4.79 C2.63,5.42,2.42,6.16,2.42,6.94c0,1.49,0.76,2.8,1.91,3.57c-0.71-0.02-1.37-0.22-1.95-0.54c0,0.02,0,0.04,0,0.06 c0,2.08,1.48,3.82,3.44,4.21c-0.36,0.1-0.74,0.15-1.13,0.15c-0.27,0-0.54-0.03-0.8-0.08c0.54,1.71,2.13,2.95,4.02,2.99 c-1.47,1.15-3.32,1.84-5.33,1.84c-0.35,0-0.69-0.02-1.03-0.06C2.9,19.33,5.19,20,7.64,20c6.76,0,10.46-5.61,10.46-10.46 c0-0.16,0-0.32-0.01-0.48C18.91,8.43,19.54,7.53,20.06,6.51c-0.66,0.29-1.36,0.49-2.09,0.57c0.76-0.46,1.34-1.18,1.61-2.04 C22.46,6,22.46,6,22.46,6z" /></svg></a>
                </div>
              </div>

              {/* Колонка 2: Explore */}
              <div className="flex flex-col gap-4">
                <h4 className="text-white font-bold text-lg mb-2">Explore</h4>
                <Link to="/news" className="text-gray-400 hover:text-white transition-colors text-sm">News</Link>
                <Link to="/blog" className="text-gray-400 hover:text-white transition-colors text-sm">Blog</Link>
                <Link to="/clips" className="text-gray-400 hover:text-white transition-colors text-sm">Clips</Link>
              </div>

              {/* Колонка 3: Services */}
              <div className="flex flex-col gap-4">
                <h4 className="text-white font-bold text-lg mb-2">Services</h4>
                <Link to="/contact" className="text-gray-400 hover:text-white transition-colors text-sm">Contact Us</Link>
                <Link to="/careers" className="text-gray-400 hover:text-white transition-colors text-sm">Careers</Link>
              </div>

              {/* Колонка 4: Legal */}
              <div className="flex flex-col gap-4">
                <h4 className="text-white font-bold text-lg mb-2">Legal</h4>
                <Link to="/privacy-policy" className="text-gray-400 hover:text-white transition-colors text-sm">Privacy Policy</Link>
                <Link to="/terms-and-conditions" className="text-gray-400 hover:text-white transition-colors text-sm">Terms & Conditions</Link>
              </div>

            </div>

            {/* НИЖНЯЯ ПОЛОСА */}
            <div className="flex flex-col md:flex-row justify-between items-end border-t border-white/5 pt-8">
              <div className="text-xs text-gray-500 font-medium space-y-2">
                <p>© 2026 AniFlow · Behruz Avezmatov</p>
                <p className="max-w-2xl text-[10px] leading-relaxed opacity-60 mt-4">
                  Anime titles, frames and artwork belong to their studios and rights holders. AniFlow is a non-commercial portfolio project.
                </p>
              </div>
            </div>

          </div>
        </footer>
      </Reveal>
      {/* КНОПКА НАВЕРХ */}
      <button onClick={scrollToTop} className={`fixed bottom-10 right-10 z-50 p-3 rounded-full bg-black text-white shadow-lg shadow-black/50 transition-all duration-300 ease-in-out hover:text-[#00FF00] hover:scale-110 ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
        <ChevronUp className="w-6 h-6" strokeWidth={3} />
      </button>

    </div>
  );
}

export default News;