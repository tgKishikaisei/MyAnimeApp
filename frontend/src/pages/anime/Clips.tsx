import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import SharedNavbar from '../../components/SharedNavbar';
import { animeApi } from '../../api/anime';
import type { Anime } from '../../api/types';
import { getImageUrl } from '../../utils/imageUrl';
import PreviewAnimeCard from '../../components/PreviewAnimeCard';







// --- EMPTY STATE COMPONENTS ---
const EmptyGrid = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center border border-white/5 rounded-xl bg-white/[0.02]">
      <div className="text-5xl mb-4 opacity-20">🎌</div>
      <p className="text-white font-black uppercase tracking-widest text-sm">{t('home.no_anime_yet')}</p>
      <p className="text-gray-500 text-xs mt-2">{t('home.add_anime_hint')}</p>
    </div>
  );
};

const EmptySection = ({ title }: { title: string }) => (
  <section>
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-2xl font-black uppercase tracking-widest text-white drop-shadow-md">{title}</h2>
    </div>
    <EmptyGrid />
  </section>
);

// --- ВНУТРЕННИЙ КОМПОНЕНТ СЛАЙДЕРА (ОБНОВЛЕННАЯ ЛОГИКА) ---
const DragSlider = ({ title, data, fullWidth = false }: { title: string, data: Anime[], fullWidth?: boolean }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  // Координаты и состояние
  const startX = useRef(0);
  const sliderScrollLeft = useRef(0);
  const isDown = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  // Время последнего действия выставляется в эффекте (Date.now() в рендере — нечистая функция).
  const lastActionTime = useRef(0);
  useEffect(() => { lastActionTime.current = Date.now(); }, []);

  // Дублируем данные для бесконечности
  const ITEMS = [...data, ...data, ...data];

  // 1. Остановка анимации
  const stopAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  // 2. Функция движения (Ease-Out Quint)
  const smoothScrollTo = (target: number, duration: number) => {
    const container = scrollRef.current;
    if (!container) return;

    stopAnimation();

    const start = container.scrollLeft;
    const change = target - start;
    const startTime = performance.now();

    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 5); // Ease-Out Quint

      container.scrollLeft = start + (change * ease);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animateScroll);
      } else {
        animationRef.current = null;
      }
    };
    animationRef.current = requestAnimationFrame(animateScroll);
  };

  // 3. Магнит (Плавное прилипание)
  const snapToNearest = () => {
    const container = scrollRef.current;
    if (!container) return;

    const cardElement = container.firstElementChild as HTMLElement;
    if (!cardElement) return;

    // Используем getBoundingClientRect для точных сабпикселей
    const itemWidth = cardElement.getBoundingClientRect().width + 16; // Карточка + отступ(gap-4=16px)

    const currentPosition = container.scrollLeft;
    const nearestIndex = Math.round(currentPosition / itemWidth);
    const targetPosition = nearestIndex * itemWidth;

    // Более быстрая и четкая парковка (500ms)
    smoothScrollTo(targetPosition, 500);
  };

  // 4. Умная авто-прокрутка (Continuous)
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || data.length === 0) return;

    const getFullItemWidth = () => {
      const cardEl = container.firstElementChild as HTMLElement;
      return cardEl ? cardEl.getBoundingClientRect().width + 16 : 300;
    };

    // Устанавливаем начальный скролл, если он в 0
    if (container.scrollLeft === 0) {
      container.scrollLeft = getFullItemWidth() * data.length;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceAction = now - lastActionTime.current;

      if (!isDown.current && timeSinceAction > 3000) {
        const itemWidth = getFullItemWidth();
        const currentScroll = container.scrollLeft;
        const oneSetWidth = itemWidth * data.length;

        if (currentScroll >= oneSetWidth * 2) {
          container.scrollLeft = currentScroll - oneSetWidth;
        } else if (currentScroll <= 0) {
          container.scrollLeft = oneSetWidth;
        }

        smoothScrollTo(container.scrollLeft + itemWidth, 1500);
        lastActionTime.current = Date.now();
      }
    }, 4500);

    return () => {
      clearInterval(interval);
      stopAnimation();
    };
  }, [data.length]);

  const isDraggingRef = useRef(false);

  // Глобальные обработчики для drag
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDown.current) {
        isDown.current = false;

        setTimeout(() => {
          setIsDragging(false);
          isDraggingRef.current = false;
        }, 50);

        lastActionTime.current = Date.now();
        snapToNearest();
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDown.current || !scrollRef.current) return;

      e.preventDefault();
      lastActionTime.current = Date.now();

      const x = e.pageX - scrollRef.current.offsetLeft;
      const walk = (x - startX.current) * 1.5; // Скорость скролла
      scrollRef.current.scrollLeft = sliderScrollLeft.current - walk;

      // Strict check: any movement > 1px counts as drag
      if (Math.abs(walk) > 1) {
        setIsDragging(true);
        isDraggingRef.current = true;
      }
    };

    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      // Small timeout to allow CSS to calculate new widths before snapping
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (scrollRef.current && !isDown.current) {
          snapToNearest();
        }
      }, 300);
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;

    // Только левая кнопка мыши
    if (e.button !== 0) return;

    lastActionTime.current = Date.now();
    isDown.current = true;

    // Reset drag state
    isDraggingRef.current = false;
    setIsDragging(false);

    stopAnimation();

    startX.current = e.pageX - scrollRef.current.offsetLeft;
    sliderScrollLeft.current = scrollRef.current.scrollLeft;
  };

  // Подготовим строку классов для отзывчивости
  // Если слайдер fullWidth (на всю страницу), покажем больше карточек.
  // Если он в секции 50% (grid-cols-2), покажем меньше карточек.
  const responsiveClasses = fullWidth
    ? "w-[calc(100vw-3rem)] sm:w-[calc((100%-16px)/2)] md:w-[calc((100%-32px)/3)] lg:w-[calc((100%-48px)/4)] xl:w-[calc((100%-64px)/5)]"
    : "w-[calc(100vw-3rem)] sm:w-[calc((100%-16px)/2)] md:w-[calc((100%-32px)/3)] lg:w-[calc((100%-16px)/2)] xl:w-[calc((100%-32px)/3)]";

  return (
    <section>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-white drop-shadow-md">
          {title}
        </h2>
      </div>

      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        // Убрали onMouseMove/Up/Leave отсюда, они теперь глобальные
        className={`flex gap-4 overflow-x-auto pb-6 select-none no-scrollbar ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {ITEMS.map((anime, index) => (
          <PreviewAnimeCard 
            key={`${anime.id}-${index}`}
            anime={anime}
            className={`aspect-video border border-white/10 rounded-lg flex-shrink-0 bg-transparent ${responsiveClasses}`}
            isDraggingRef={isDraggingRef}
          />
        ))}
      </div>
    </section>
  );
};

// --- ГЛАВНЫЙ КОМПОНЕНТ СТРАНИЦЫ ---
function Clips() {
  const { t } = useTranslation();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [searchParams] = useSearchParams();
  const animeIdFilter = searchParams.get('anime') ? Number(searchParams.get('anime')) : null;

  // Логика для FAQ
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const toggleFaq = (index: number) => setOpenFaqIndex(openFaqIndex === index ? null : index);

  // --- DATA STATE ---
  const [popular, setPopular] = useState<Anime[]>([]);
  const [recent, setRecent] = useState<Anime[]>([]);
  const [series, setSeries] = useState<Anime[]>([]);
  const [movies, setMovies] = useState<Anime[]>([]);
  const [upcoming, setUpcoming] = useState<Anime[]>([]);
  const [earlyAccess, setEarlyAccess] = useState<Anime[]>([]);
  const [activePacks, setActivePacks] = useState<Anime[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [pop, rec, ser, mov, up, early, packs] = await Promise.all([
          animeApi.getAll('popular'),
          animeApi.getAll('recent'),
          animeApi.getAll('series'),
          animeApi.getAll('movies'), // Changed 'movie' to 'movies' to match Enum
          animeApi.getAll('coming_soon'), // Changed 'upcoming' to 'coming_soon' to match Enum
          animeApi.getAll('early_access'),
          animeApi.getAll('active_packs')
        ]);

        const filterItems = (arr: Anime[] | undefined) => {
          if (!arr) return [];
          return animeIdFilter ? arr.filter(a => a.id === animeIdFilter) : arr;
        };

        if (pop) setPopular(filterItems(pop));
        if (rec) setRecent(filterItems(rec));
        if (ser) setSeries(filterItems(ser));
        if (mov) setMovies(filterItems(mov));
        if (up) setUpcoming(filterItems(up));
        if (early) setEarlyAccess(filterItems(early));
        if (packs) setActivePacks(filterItems(packs));
      } catch (e) {
        console.error("Failed to fetch clips data", e);
      }
    };
    fetchAll();
  }, [animeIdFilter]);


  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
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

      {/* СТИЛИ */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
      `}</style>

      {/* NAVBAR */}
      <SharedNavbar />

      {/* ОТСТУП СВЕРХУ (чтобы не наезжало на шапку) */}
      <div className="pt-32"></div>

      {/* ОТСТУП СВЕРХУ */}
      <div className="pt-32"></div>

      {/* === ДВЕ КОЛОНКИ: MOST POPULAR + ACTIVE PACKS === */}
      <section className="max-w-[1400px] mx-auto px-6 py-12 border-b border-white/5">

        {/* Grid сетка: 
            grid-cols-1 (телефон) -> одна под другой
            lg:grid-cols-2 (большой экран) -> рядом (50% / 50%)
            gap-12 -> расстояние между ними
        */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 overflow-hidden">

          {/* Левая колонка */}
          <div className="min-w-0">
            {popular.length > 0 ? (
              <DragSlider title={t('home.most_popular')} data={popular} />
            ) : (
              <EmptySection title={t('home.most_popular')} />
            )}
          </div>

          {/* Правая колонка */}
          <div className="min-w-0">
            {activePacks.length > 0 ? (
              <DragSlider title={t('collections.active_packs')} data={activePacks} />
            ) : (
              <EmptySection title={t('collections.active_packs')} />
            )}
          </div>

        </div>
      </section>

      {/* === 3. RECENTLY ADDED (SMART SCROLL) === */}
      <section className="max-w-[1400px] mx-auto px-6 py-12 pb-24">
        <h2 className="text-3xl font-bold mb-8 uppercase tracking-widest text-white">{t('home.recently_added')}</h2>

        <div className="
          h-[380px] xl:h-[380px] 
          overflow-y-auto 
          overflow-x-hidden
          pr-2 
          custom-scrollbar
          scroll-smooth
        ">

          {recent.length === 0 ? (
            <EmptyGrid />
          ) : (
            <div className="grid gap-4 group/recent grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {recent.map((anime, index) => (
                <Link
                  to={`/anime/${anime.id}`}
                  key={`${anime.id}-${index}`}
                  className="
                    relative aspect-video cursor-pointer border border-white/10 rounded-lg overflow-hidden
                    bg-transparent w-full block
                    transition-all duration-500 ease-in-out
                    group-hover/recent:brightness-50
                    hover:!brightness-110 hover:scale-[1.02] hover:border-white/30
                  "
                >
                  <img src={getImageUrl(anime.image)} alt={anime.title} className="w-full h-full object-cover opacity-80 brightness-125 transition-all duration-500 ease-in-out hover:opacity-100 hover:brightness-100" />
                  <div className="absolute inset-0 bg-black/50 hover:bg-black/20 transition-colors duration-500" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                    <h3 className="text-sm md:text-lg font-black uppercase tracking-tighter text-white drop-shadow-xl leading-tight">
                      {anime.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* === 4. CATEGORIES (COMING SOON) === */}
      <section className="max-w-[1400px] mx-auto px-6 py-16 pb-20">
        <h2 className="text-3xl font-bold mb-2 uppercase tracking-widest text-white">
          {t('collections.categories_title')}
        </h2>
        <p className="text-sm text-gray-500 italic mb-8">
          *this feature will only be available on desktop version
        </p>

        <div className="space-y-4 text-gray-300 font-medium text-sm md:text-base leading-relaxed max-w-4xl">
          <p>
            {t('collections.categories_desc1')}
          </p>
          <p>
            {t('collections.categories_desc2')} <span className="text-green-500 font-bold underline decoration-1 underline-offset-4">ULTRA</span> member.
          </p>
          <p>
            {t('collections.categories_desc3')}
          </p>
        </div>
      </section>


      {/* === 5. SERIES (SMART SCROLL) === */}
      <section className="max-w-[1400px] mx-auto px-6 py-12 pb-32">
        <h2 className="text-3xl font-bold mb-8 uppercase tracking-widest text-white">{t('collections.series')}</h2>

        <div className="
          h-[580px] 
          overflow-y-auto 
          overflow-x-hidden
          pr-2 
          custom-scrollbar
          /* 👇 Включаем магнит */
          scroll-smooth
        ">

          {series.length === 0 ? (
            <EmptyGrid />
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

              {series.map((anime, index) => (
                <PreviewAnimeCard
                  key={`${anime.id}-${index}`}
                  anime={anime}
                  className="aspect-video cursor-pointer border border-white/10 rounded-lg bg-transparent w-full transition-all duration-500 ease-in-out hover:scale-[1.02] hover:border-white/30 hover:shadow-2xl"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* === 6. MOVIES (СКРОЛЛ + ПРОЖЕКТОР + 3 КОЛОНКИ) === */}
      <section className="max-w-[1400px] mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold mb-8 uppercase tracking-widest text-white">{t('collections.movies')}</h2>

        {/* Окно с прокруткой */}
        <div className="
          h-[500px] md:h-[560px] xl:h-[500px] /* Высота под 1 ряд */
          overflow-y-auto 
          overflow-x-hidden
          pr-2 
          custom-scrollbar
          scroll-smooth
        ">

          {movies.length === 0 ? (
            <EmptyGrid />
          ) : (
            <div className="grid gap-4 group/movies grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {movies.map((anime, index) => (
                <PreviewAnimeCard
                  key={`${anime.id}-${index}`}
                  anime={anime}
                  className="aspect-video cursor-pointer border border-white/10 rounded-lg bg-transparent w-full transition-all duration-500 ease-in-out hover:scale-[1.02] hover:border-white/30 hover:shadow-2xl"
                />
              ))}
            </div>
          )}
        </div>
      </section>


      {/* === 7. EARLY ACCESS (ОБЫЧНЫЙ БЕЗ СКРОЛЛА) === */}
      <section className="max-w-[1400px] mx-auto px-6 py-12 pb-32">
        <h2 className="text-3xl font-bold mb-8 uppercase tracking-widest text-white">{t('collections.early_access')}</h2>

        {earlyAccess.length === 0 ? (
          <EmptyGrid />
        ) : (
          <div className="grid gap-4 group/early grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
            {earlyAccess.map((anime, index) => (
              <PreviewAnimeCard
                key={`${anime.id}-${index}`}
                anime={anime}
                className="aspect-[2/3] cursor-pointer border border-white/10 rounded-lg bg-transparent w-full transition-all duration-500 ease-in-out hover:scale-[1.02] hover:border-white/30 hover:shadow-2xl"
              />
            ))}
          </div>
        )}
      </section>

      {/* === 8. COMING SOON === */}
      <section className="max-w-[1400px] mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold mb-8 uppercase tracking-widest text-white">{t('collections.coming_soon')}</h2>

        {upcoming.length === 0 ? (
          <EmptyGrid />
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
            {upcoming.map((anime) => (
              <Link
                to={`/anime/${anime.id}`}
                key={anime.id}
                className="
                  relative aspect-video cursor-pointer border border-white/10 rounded-lg overflow-hidden
                  bg-transparent w-full
                  transition-all duration-500 ease-in-out
                  hover:scale-[1.02] hover:border-white/30 hover:shadow-2xl
                "
              >
                <img src={getImageUrl(anime.image)} alt={anime.title} className="w-full h-full object-cover opacity-80 brightness-110 transition-all duration-500 ease-in-out hover:opacity-100 hover:brightness-100" />
                <div className="absolute inset-0 bg-black/50 hover:bg-black/20 transition-colors duration-500" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <h3 className="text-sm md:text-lg font-black uppercase tracking-tighter text-white drop-shadow-xl leading-tight">{anime.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* === 9. DISCLAIMER === */}
      <section className="max-w-[1400px] mx-auto px-6 py-8">
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">{t('home.disclaimer')}</h3>
        <p className="text-xs text-gray-500 leading-relaxed max-w-4xl">
          {t('home.disclaimer_text')}
        </p>
      </section>

      <section className="max-w-[1400px] mx-auto px-6 py-12 pb-32">
        <h2 className="text-3xl font-bold mb-8 uppercase text-white">{t('home.faq_title')}</h2>
        <div className="space-y-2">
          {[1,2,3,4,5,6,7].map((n, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div key={index} className="group">
                <button onClick={() => toggleFaq(index)} className="w-full flex items-center gap-4 text-left py-2 transition-all duration-300">
                  <div className={`p-0.5 ${isOpen ? 'text-[#aaa]' : 'text-white group-hover:text-gray-300'}`}>
                    {isOpen ? <Minus className="w-5 h-5 font-black" /> : <Plus className="w-5 h-5 font-black" />}
                  </div>
                  <span className={`text-lg font-bold ${isOpen ? 'text-[#aaa]' : 'text-white group-hover:text-gray-300'}`}>{t(`home.faq_q${n}`)}</span>
                </button>
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 mt-2 mb-6' : 'max-h-0 opacity-0'}`}>
                  <p className="text-gray-300 text-sm leading-relaxed pl-9 max-w-4xl">{t(`home.faq_a${n}`)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full bg-transparent pt-16 pb-8 border-t border-white/10">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
            <div className="md:col-span-1">
              <div className="mb-8"><img src="/aniflow-logo.svg" alt="Logo" className="h-20 w-auto object-contain mix-blend-screen" /></div>
              <p className="text-gray-400 text-sm leading-relaxed mb-8">AniFlow: anime episodes, clips and a studio for your own edits.</p>
              <h4 className="text-white font-bold text-sm mb-4">{t('home.community')}</h4>
              <div className="flex gap-4 items-center">
                <a href="#" className="hover:scale-90 transition-transform"><svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><rect x="2" y="2" width="4" height="20" /><circle cx="14" cy="9" r="7" /></svg></a>
                <a href="#" className="hover:scale-90 transition-transform"><svg viewBox="0 0 24 24" className="w-7 h-7 fill-white"><path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418 c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z" /></svg></a>
                <a href="#" className="hover:scale-90 transition-transform"><svg viewBox="0 0 24 24" className="w-6 h-6 fill-transparent stroke-white stroke-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg></a>
                <a href="#" className="hover:scale-90 transition-transform"><svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><path d="M22.46,6c-0.77,0.35-1.6,0.58-2.46,0.69c0.88-0.53,1.56-1.37,1.88-2.38c-0.83,0.5-1.75,0.85-2.72,1.05 C18.37,4.5,17.26,4,16,4c-2.35,0-4.27,1.92-4.27,4.29c0,0.34,0.04,0.67,0.11,0.98C8.28,9.09,5.11,7.38,3,4.79 C2.63,5.42,2.42,6.16,2.42,6.94c0,1.49,0.76,2.8,1.91,3.57c-0.71-0.02-1.37-0.22-1.95-0.54c0,0.02,0,0.04,0,0.06 c0,2.08,1.48,3.82,3.44,4.21c-0.36,0.1-0.74,0.15-1.13,0.15c-0.27,0-0.54-0.03-0.8-0.08c0.54,1.71,2.13,2.95,4.02,2.99 c-1.47,1.15-3.32,1.84-5.33,1.84c-0.35,0-0.69-0.02-1.03-0.06C2.9,19.33,5.19,20,7.64,20c6.76,0,10.46-5.61,10.46-10.46 c0-0.16,0-0.32-0.01-0.48C18.91,8.43,19.54,7.53,20.06,6.51c-0.66,0.29-1.36,0.49-2.09,0.57c0.76-0.46,1.34-1.18,1.61-2.04 C22.46,6,22.46,6,22.46,6z" /></svg></a>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="text-white font-bold text-lg mb-2">{t('home.explore')}</h4>
              <Link to="/news" className="text-gray-400 hover:text-white transition-colors text-sm">{t('nav.news')}</Link>
              <Link to="/blog" className="text-gray-400 hover:text-white transition-colors text-sm">{t('nav.blog')}</Link>
              <Link to="/clips" className="text-gray-400 hover:text-white transition-colors text-sm">{t('nav.clips')}</Link>
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="text-white font-bold text-lg mb-2">{t('home.services')}</h4>
              <Link to="/contact" className="text-gray-400 hover:text-white transition-colors text-sm">Contact Us</Link>
              <Link to="/careers" className="text-gray-400 hover:text-white transition-colors text-sm">Careers</Link>
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="text-white font-bold text-lg mb-2">{t('home.legal')}</h4>
              <Link to="/privacy-policy" className="text-gray-400 hover:text-white transition-colors text-sm">Privacy Policy</Link>
              <Link to="/terms-and-conditions" className="text-gray-400 hover:text-white transition-colors text-sm">Terms & Conditions</Link>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-end border-t border-white/5 pt-8">
            <div className="text-xs text-gray-500 font-medium space-y-2"><p>© 2026 AniFlow · Behruz Avezmatov</p></div>
          </div>
        </div>
      </footer>
      <button onClick={scrollToTop} className={`fixed bottom-10 right-10 z-50 p-3 rounded-full bg-black text-white shadow-lg shadow-black/50 transition-all duration-300 ease-in-out hover:text-[#00FF00] hover:scale-110 ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}><ChevronUp className="w-6 h-6" strokeWidth={3} /></button>
    </div>
  );
}

export default Clips;