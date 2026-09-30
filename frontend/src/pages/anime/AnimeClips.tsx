import React, { useState, useRef, useEffect } from 'react';
import Tilt from 'react-parallax-tilt';
import { Minus, Plus } from 'lucide-react';

import { motion, type Variants } from 'framer-motion';
import SharedNavbar from '../../components/SharedNavbar';
import { useTranslation } from 'react-i18next';
import { animeApi } from '../../api/anime';
import { newsApi } from '../../api/news';
import { blogApi } from '../../api/blog';
import SharedFooter from '../../components/SharedFooter';
import PreviewAnimeCard from '../../components/PreviewAnimeCard';



import type { Anime, BlogPost, News } from '../../api/types';
const FAQ_ITEMS = [
  {
    question: "What is AniFlow?",
    answer: "AniFlow is a catalogue of anime episodes and short clips. Clips keep the source frame rate, and the built-in studio lets you cut and export your own fragment. It is a portfolio project, not a streaming service."
  },
  {
    question: "Is AniFlow safe?",
    answer: "Downloads go through signed links that expire after ten minutes. Uploads are checked by type and size, and the database keeps only an Argon2 hash of your password. The site shows no ads."
  },
  {
    question: "What are Active Packs?",
    answer: "Active Packs collect the shows airing this season. New episodes of those shows get their clips first."
  },
  {
    question: "There are no clips/missing episodes on the anime page?",
    answer: "The clips probably failed to load: press the refresh button next to the list. If the episode stays empty, nobody has uploaded clips for it yet."
  },
  {
    question: "When do you release new anime clips?",
    answer: "An admin adds clips through the dashboard, so new episodes appear once someone cuts them. Follow the news page to see what landed."
  },
  {
    question: "What format are the anime clips?",
    answer: "MP4 with H.264 video. Every editor opens it, and the files stay small enough to download quickly."
  },
  {
    question: "How do you encode (render) the anime clips?",
    answer: "The studio runs FFmpeg on the server: it trims the fragment, applies the audio preset you picked and encodes the result to H.264."
  },
  {
    question: "Does AniFlow have a mobile app?",
    answer: "No, but the site works as a PWA. Open it in a mobile browser and choose “Add to Home Screen”."
  },
  {
    question: "I get the error Network Failed after downloading a folder?",
    answer: "ZIP archives have a limit on the number of clips and their total size. Pick fewer clips or download them one by one."
  }
];


// --- КОМПОНЕНТ СЛАЙДЕРА POPULAR (ВЫНЕСЕН ДЛЯ ИЗОЛЯЦИИ ЛОГИКИ) ---
const DragSliderPopular = ({ data }: { data: Anime[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const startX = useRef(0);
  const sliderScrollLeft = useRef(0);
  const isDown = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  // Время последнего действия выставляется в эффекте (Date.now() в рендере — нечистая функция).
  const lastActionTime = useRef(0);
  useEffect(() => { lastActionTime.current = Date.now(); }, []);

  // 1. Остановка анимации
  const stopAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  // 2. Движение
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
      const ease = 1 - Math.pow(1 - progress, 5);
      container.scrollLeft = start + (change * ease);
      if (progress < 1) animationRef.current = requestAnimationFrame(animateScroll);
      else animationRef.current = null;
    };
    animationRef.current = requestAnimationFrame(animateScroll);
  };

  // 3. Магнит
  const snapToNearest = () => {
    const container = scrollRef.current;
    if (!container) return;
    if (!container.firstElementChild) return;

    // Получаем ширину первого элемента (через getBoundingClientRect для точных сабпикселей) + отступ (gap-4 = 16px)
    const itemWidth = container.firstElementChild.getBoundingClientRect().width + 16;
    const currentPosition = container.scrollLeft;
    const nearestIndex = Math.round(currentPosition / itemWidth);
    const targetPosition = nearestIndex * itemWidth;
    smoothScrollTo(targetPosition, 500); // 500ms парковка
  };

  const isDraggingRef = useRef(false); // Ref for immediate access

  // 4. Глобальные листенеры перетаскивания
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDown.current) {
        isDown.current = false;

        // Delay resetting drag state slightly to block subsequent clicks
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
      const walk = (x - startX.current) * 1.5;
      scrollRef.current.scrollLeft = sliderScrollLeft.current - walk;

      // Strict check: any movement counts as drag
      if (Math.abs(walk) > 1) {
        setIsDragging(true);
        isDraggingRef.current = true;
      }
    };

    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
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

  // 5. Автоскролл (Step-by-Step)
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || data.length === 0) return;

    // Инит скролл (центруем)
    const cardElement = container.firstElementChild as HTMLElement;
    const itemWidth = cardElement ? cardElement.getBoundingClientRect().width + 16 : 300;

    // Check if data is tripled (heuristic or prop?)
    // In AnimeClips usage, 'data' is INFINITE_POPULAR which is 3 sets.
    // So distinct set length is data.length / 3.
    const realSetLength = Math.max(Math.floor(data.length / 3), 1);
    const oneSetWidth = itemWidth * realSetLength;

    // Если мы в начале - прыгаем в середину
    if (container.scrollLeft === 0) {
      container.scrollLeft = oneSetWidth;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceAction = now - lastActionTime.current;

      // Если мышь не нажата и прошло 3 секунды тишины
      if (!isDown.current && timeSinceAction > 3000) {
        const currentScroll = container.scrollLeft;

        // Бесшовная петля ("Телепорт")
        if (currentScroll >= oneSetWidth * 2) {
          container.scrollLeft = currentScroll - oneSetWidth;
        } else if (currentScroll <= 0) {
          container.scrollLeft = oneSetWidth;
        }

        // Скроллим ровно на одну карточку вперед
        smoothScrollTo(container.scrollLeft + itemWidth, 1500);

        // Обновляем таймер
        lastActionTime.current = Date.now();
      }
    }, 4500);

    return () => {
      clearInterval(interval);
      stopAnimation();
    };
  }, [data.length]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    if (e.button !== 0) return;
    lastActionTime.current = Date.now();
    isDown.current = true;

    // Reset drag state on mouse down
    isDraggingRef.current = false;
    setIsDragging(false);

    stopAnimation();
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    sliderScrollLeft.current = scrollRef.current.scrollLeft;
  };

  return (
    <div
      ref={scrollRef}
      onMouseDown={handleMouseDown}
      className={`flex gap-4 overflow-x-auto pb-6 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {data.map((anime, index) => (
        <PreviewAnimeCard
          key={`${anime.id}-${index}`}
          anime={anime}
          className="aspect-video border border-white/10 rounded-lg flex-shrink-0 w-[calc(100vw-3rem)] sm:w-[calc((100%-16px)/2)] md:w-[calc((100%-32px)/3)] lg:w-[calc((100%-48px)/4)] xl:w-[calc((100%-64px)/5)] bg-transparent block"
          isDraggingRef={isDraggingRef}
        />
      ))}
    </div>
  );
};

// --- КОМПОНЕНТ ДЛЯ АНИМАЦИИ ПОЯВЛЕНИЯ ---
const Reveal = ({ children, direction = 'up', delay = 0 }: { children: React.ReactNode, direction?: 'up' | 'left' | 'right' | 'zoom', delay?: number }) => {

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
      transition: { duration: 2.0, delay: delay, ease: "easeOut" }
    }
  };

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

function AnimeClips() {
  const { t } = useTranslation();
  // Храним индекс открытого вопроса (null = все закрыты)
  // По умолчанию открыт первый (индекс 0), как на фото
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    // Если нажали на уже открытый - закрываем, иначе открываем новый
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  // --- ДАННЫЕ С БЭКЕНДА ---
  const [popularAnime, setPopularAnime] = useState<Anime[]>([]);
  const [recentAnime, setRecentAnime] = useState<Anime[]>([]);
  const [newsItems, setNewsItems] = useState<News[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [popular, recent, news, blog] = await Promise.all([
          animeApi.getAll('popular'),
          animeApi.getAll('recent'),
          newsApi.getAll(),
          blogApi.getAll()
        ]);
        setPopularAnime(popular || []);
        setRecentAnime(recent || []);
        setNewsItems(news || []);
        setBlogPosts(blog || []);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };
    fetchData();
  }, []);

  const INFINITE_POPULAR = [...popularAnime, ...popularAnime, ...popularAnime];

  // target = куда ехать, duration = за сколько времени


  // ... другие переменные ...

  return (

    <div className="min-h-screen text-white pb-20 font-sans relative overflow-x-hidden">

      {/* СТИЛИ ДЛЯ СКРОЛЛБАРА (чтобы он был серым, как на фото) */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #555;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #777;
        }
      `}</style>

      {/* ФОН */}
      <div className="fixed inset-0 z-[-1] bg-cover bg-center bg-no-repeat bg-fixed" style={{ backgroundImage: "url('/bg.jpg')" }} />
      {/* Затемнение всего 50%, чтобы картинку сзади было хорошо видно */}
      <div className="fixed inset-0 z-[-1] bg-black/60" />

      {/* === NAVBAR (Shared) === */}
      <SharedNavbar />

      {/* === 1. ВИДЕО === */}
      <Reveal direction="up">
        {/* 👇 ИЗМЕНЕНИЯ ЗДЕСЬ: */}
        {/* pt-48 (192px) — для мобильных (высокий отступ) */}
        {/* lg:pt-28 — для больших экранов (вернет старый отступ) */}
        <section className="w-full bg-transparent pt-48 lg:pt-28 pb-6 border-b border-white/10">
          <div className="max-w-[1400px] mx-auto px-6">
            {/* Сам плеер */}
            <div className="relative w-full aspect-video bg-transparent rounded-sm overflow-hidden">
              <iframe
                className="w-full h-full mix-blend-screen" // 👈 ДОБАВИЛ mix-blend-screen
                src="https://www.youtube-nocookie.com/embed/F6Pm8RPzwmQ"
              ></iframe>
            </div>
          </div>
        </section>
      </Reveal>
      {/* === 2. NEWS (3D) === */}
      <Reveal direction="left">
        <section className="max-w-[1400px] mx-auto px-6 py-8 border-b border-white/5">
          <h2 className="text-3xl font-bold mb-8 uppercase tracking-widest text-white">{t('nav.news')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {newsItems.map((item) => (
              <Tilt
                key={item.id}
                tiltMaxAngleX={5} tiltMaxAngleY={5} scale={1.02} transitionSpeed={400}
                className="parallax-effect-glare-scale" perspective={500} glareEnable={true} glareMaxOpacity={0.4} glareColor="#ffffff"
              >
                <div className="relative aspect-[16/9] group cursor-pointer rounded-xl overflow-hidden">

                  <img src={`https://img.youtube.com/vi/${encodeURIComponent(item.video_id)}/maxresdefault.jpg`}
                    alt="News Thumbnail"
                    // 👇 ГЛАВНЫЙ СЕКРЕТ: brightness вместо opacity
                    // brightness-75 = затемненная, стильная
                    // group-hover:brightness-110 = яркая при наведении 
                    className="
                    w-full h-full object-cover 
                    
                    opacity-80                /* Прозрачность (фон виден) */
                    
                    brightness-110            /* Немного яркости */
                    saturate-150              /* 🔥 ГЛАВНОЕ: Сочность цветов (+50%) */
                    contrast-125              /* 🔥 ГЛАВНОЕ: Глубина и четкость (+25%) */
                    
                    transition-all duration-500 ease-in-out 
                    
                    /* При наведении делаем оригинал */
                    group-hover:opacity-100 
                    group-hover:brightness-100 
                    group-hover:saturate-100 
                    group-hover:contrast-100
                    group-hover:scale-105
                  " />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-500" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    {/* <h3 className="text-2xl md:text-5xl font-black uppercase tracking-tighter text-white drop-shadow-xl">
                      NEW RE<span className="text-green-500">L</span>EASES
                    </h3> */}
                    <p className="mt-2 text-xs md:text-sm font-bold text-gray-300 tracking-widest bg-black/50 px-3 py-1 rounded-sm backdrop-blur-sm">
                    </p>
                  </div>
                </div>
              </Tilt>
            ))}
          </div>
        </section>
      </Reveal>
      {/* === BLOG (SPOTLIGHT EFFECT) === */}
      <Reveal direction="right">
        <section className="max-w-[1400px] mx-auto px-6 py-8 border-b border-white/5">
          <h2 className="text-2xl font-bold mb-8 uppercase tracking-widest text-gray-200">{t('nav.blog')}</h2>

          {/* Добавили класс group/blog в родителя */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 group/blog">
            {blogPosts.map((post) => (
              <div
                key={post.id}
                className="
                  relative aspect-[16/9] group cursor-pointer rounded-xl overflow-hidden border border-white/10 shadow-2xl
                  
                  /* МАГИЯ ЗДЕСЬ: */
                  /* 1. Когда мы наводим на ОБЩУЮ сетку (group-hover), все становятся темными (brightness-50) */
                  group-hover/blog:brightness-50
                  
                  /* 2. Но когда наводим на КОНКРЕТНУЮ карточку (hover), она становится яркой (!brightness-110) */
                  hover:!brightness-110 hover:scale-[1.02] hover:shadow-2xl
                "
              >
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover opacity-80 brightness-125 transition-all duration-500 ease-in-out group-hover:opacity-100 group-hover:brightness-100 group-hover:scale-105"
                />

                {/* Легкое затемнение всегда, чтобы текст читался (но не черное пятно) */}
                {/* Затемнение текста (исчезает при наведении) */}
                <div className="absolute inset-0 bg-black/40 transition-colors duration-500" />

                {/* Текст */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <h3 className=" text-lg md:text-2xl font-black uppercase leading-tight tracking-tighter text-white drop-shadow-lg">
                    {post.title}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* 4. MOST POPULAR (ОКОНЧАТЕЛЬНОЕ ИСПРАВЛЕНИЕ) */}
      <Reveal direction="zoom">
        <section className="max-w-[1400px] mx-auto px-6 py-8">
          <h2 className="text-2xl font-bold mb-8 uppercase tracking-widest text-gray-200">{t('home.most_popular')}</h2>

          {popularAnime.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center border border-white/5 rounded-xl bg-white/[0.02]">
              <div className="text-5xl mb-4 opacity-20">🎌</div>
              <p className="text-white font-black uppercase tracking-widest text-sm">{t('home.no_anime_yet')}</p>
              <p className="text-gray-500 text-xs mt-2">{t('home.add_anime_hint')}</p>
            </div>
          ) : (
            <DragSliderPopular data={INFINITE_POPULAR} />
          )}

        </section>
      </Reveal>

      {/* === 5. RECENTLY ADDED (VERTICAL SCROLL) === */}
      <Reveal direction="up">
        <section className="max-w-[1400px] mx-auto px-6 py-8 pb-24">
          <h2 className="text-2xl font-bold mb-8 uppercase tracking-widest text-gray-200">{t('home.recently_added')}</h2>

          <div className="
              h-[500px]              
              md:h-[260px]           
              xl:h-[390px]           
              overflow-y-auto        
              pr-2                   
              custom-scrollbar       
            ">
            {recentAnime.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center border border-white/5 rounded-xl bg-white/[0.02]">
                <div className="text-5xl mb-4 opacity-20">🎌</div>
                <p className="text-white font-black uppercase tracking-widest text-sm">{t('home.no_anime_yet')}</p>
                <p className="text-gray-500 text-xs mt-2">{t('home.add_anime_hint')}</p>
              </div>
            ) : (
              <div className="grid gap-4 group/recent grid-cols-1 md:grid-cols-4">
                {recentAnime.map((anime, index) => (
                  <PreviewAnimeCard
                    key={anime.id || index}
                    anime={anime}
                    className="aspect-video cursor-pointer border border-white/10 rounded-lg transition-all duration-500 ease-in-out group-hover/recent:brightness-50 hover:!brightness-110 hover:scale-[1.02] hover:shadow-2xl hover:border-white/30 block"
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </Reveal>

      {/* === 6. AMV PROMOTION === */}
      <Reveal direction="left">
        <section className="max-w-[1400px] mx-auto px-6 py-8 pb-32">
          <h2 className="text-2xl font-bold mb-8 uppercase tracking-widest text-white">
            {t('home.amv_promotion')}
          </h2>

          <div className="relative w-full aspect-video bg-transparent rounded-sm overflow-hidden">
            <iframe
              className="w-full h-full mix-blend-screen"
              src="https://www.youtube.com/embed/7juYyFLXg2Q?"
              title="AMV Promotion"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </section>
      </Reveal>

      {/* === 7. PROMOTED === */}
      <Reveal direction="right">
        <section className="max-w-[1400px] mx-auto px-6 py-8 pb-16">
          <h2 className="text-2xl font-bold mb-8 uppercase tracking-widest text-white">
            {t('home.promoted')}
          </h2>

          <div className="relative w-full aspect-video bg-transparent rounded-sm overflow-hidden">
            <iframe
              className="w-full h-full mix-blend-screen"
              src="https://www.youtube.com/embed/G3D66o6roZw?si=aM1pSHzGj-yvwIEL"
              title="Promoted Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </section>
      </Reveal>

      {/* === 8. STUDIO SECTION (WHITE -> DIMMED) === */}
      < Reveal direction="up" >
        <section className="max-w-[1400px] mx-auto px-6 py-8 pb-16">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-12">

            {/* ЛЕВАЯ ЧАСТЬ */}
            <div className="max-w-lg">

              {/* Заголовок-ссылка на клипы */}
              <a
                href="/Clips"
                className="
                  inline-flex items-center gap-3 mb-6 group cursor-pointer
                  transition-opacity duration-300 hover:opacity-50 /* 👈 При наведении станет тусклым */
                "
              >
                {/* Полоска (Чисто белая) */}
                <div className="w-1.5 h-8 bg-white" />
                {/* Круг (Чисто белый) */}
                <div className="w-8 h-8 rounded-full bg-white" />
                {/* Текст (Чисто белый) */}
                <span className="text-3xl font-black tracking-widest text-white">STUDIO</span>
              </a>

              {/* Текст описания */}
              <div className="space-y-4 text-sm font-medium text-white leading-relaxed"> {/* Сделал текст белым (text-white) */}
                <p>Cut any clip right in the browser: set the start and the end, pick a format and download the result.</p>
                <p>Make a GIF, a vertical video for TikTok and Shorts, or keep just the audio.</p>
                <p>
                  The server renders with FFmpeg,<br />
                  so your laptop stays cool.
                </p>

                <a href="/Clips" className="inline-block text-white underline decoration-1 underline-offset-4 hover:text-gray-400 transition-colors">
                  Open the clips
                </a>

                <p className="text-xs text-white mt-6">
                  The studio needs an account: sign in to render and download.
                </p>
              </div>
            </div>

            {/* ПРАВАЯ ЧАСТЬ: ФОТО-ЛОГОТИП */}
            <div className="hidden md:block">
              <div
                className="
                  relative w-80 h-80 flex items-center justify-center cursor-pointer
                  transition-transform duration-500 ease-out hover:scale-90
                "
              >
                {/* 👇 ВОТ ТУТ ТВОЯ КАРТИНКА */}
                <img
                  src="/aniflow-mark.svg"
                  alt="AniFlow"
                  className="w-full h-full object-contain mix-blend-screen"
                />
              </div>
            </div>
          </div>
        </section>
      </Reveal >

      {/* === 9. FAQ SECTION === */}
      < Reveal direction="up" delay={0.2} >
        <section className="max-w-[1400px] mx-auto px-6 py-8 pb-16">
          <h2 className="text-4xl font-bold mb-12 text-white">{t('home.faq_title')}</h2>

          <div className="space-y-2">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaqIndex === index;

              return (
                <div key={index} className="group">
                  {/* ЗАГОЛОВОК ВОПРОСА */}
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full flex items-center gap-4 text-left py-2 transition-all duration-300"
                  >
                    {/* Иконка: Меняется + на - и цвет */}
                    <div className={`p-0.5 ${isOpen ? 'text-[#333]' : 'text-white group-hover:text-gray-300'}`}>
                      {isOpen ? <Minus className="w-5 h-5 font-black" /> : <Plus className="w-5 h-5 font-black" />}
                    </div>

                    {/* Текст вопроса: Если открыт - темнеет (гаснет свет), если закрыт - белый */}
                    <span className={`text-lg font-bold ${isOpen ? 'text-[#333]' : 'text-white group-hover:text-gray-300'}`}>
                      {item.question}
                    </span>
                  </button>

                  {/* ОТВЕТ (Выпадает) */}
                  <div
                    className={`
                      overflow-hidden transition-all duration-500 ease-in-out
                      ${isOpen ? 'max-h-[500px] opacity-100 mt-2 mb-6' : 'max-h-0 opacity-0'}
                    `}
                  >
                    <p className="text-white text-gray-400 text-sm leading-relaxed pl-9 max-w-4xl">
                      {item.answer}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </Reveal >

      <SharedFooter />
    </div >
  );
}

export default AnimeClips;

