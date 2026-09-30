import React, { useState, useRef, useEffect } from 'react';
import { Search, Menu, X, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';

// --- КОМПОНЕНТ АНИМАЦИИ ---
const Reveal = ({ children, direction = 'up', delay = 0, immediate = false }: { children: React.ReactNode, direction?: 'up' | 'left' | 'right' | 'zoom', delay?: number, immediate?: boolean }) => {
    const variants: Variants = {
        hidden: { opacity: 0, y: direction === 'up' ? 50 : 0, x: direction === 'left' ? -100 : direction === 'right' ? 100 : 0, scale: direction === 'zoom' ? 0.9 : 1 },
        visible: { opacity: 1, y: 0, x: 0, scale: 1, transition: { duration: 1.0, delay: delay, ease: "easeOut" } }
    };
    if (immediate) {
        return (
            <motion.div initial="hidden" animate="visible" variants={variants}>
                {children}
            </motion.div>
        );
    }
    return (
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={variants}>
            {children}
        </motion.div>
    );
};

function TermsConditions() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [isAtTop, setIsAtTop] = useState(true);
    const lastScrollY = useRef(0);
    const [showScrollTop, setShowScrollTop] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY.current && currentScrollY > 50) setIsNavVisible(false);
            else setIsNavVisible(true);
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
            <div className="fixed inset-0 z-[-1] bg-black/90" />

            {/* NAVBAR */}
            <motion.nav
                animate={{ y: isNavVisible ? 0 : "-100%" }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className={`fixed top-0 w-full z-40 py-4 transition-all duration-500 ${isAtTop ? 'bg-transparent border-transparent' : 'bg-black/60 border-b border-white/10 backdrop-blur-md'}`}
            >
                <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-end lg:justify-between gap-6">
                    <Link to="/" className="hidden lg:flex items-center cursor-pointer shrink-0">
                        <img
                            src="/aniflow-logo.svg"
                            alt="AniFlow"
                            className="h-14 w-auto object-contain mix-blend-screen"
                        />
                    </Link>
                    <div className="hidden lg:block flex-1 max-w-2xl mx-auto">
                        <div className="relative w-full">
                            <Search className="absolute left-4 top-3.5 w-5 h-5 text-black opacity-60" strokeWidth={1.5} />
                            <input type="text" placeholder="Search anime" className="w-full bg-[#f2f2f2] text-black pl-12 pr-4 py-3 rounded-md font-medium focus:outline-none placeholder:text-black" />
                        </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                        <div className="hidden lg:flex items-center gap-8 text-xs font-bold tracking-[0.2em] text-gray-300">
                            <Link to="/news" className="hover:text-white transition-colors">NEWS</Link>
                            <Link to="/blog" className="hover:text-white transition-colors">BLOG</Link>
                            <Link to="/clips" className="hover:text-white transition-colors">CLIPS</Link>
                        </div>
                        <button onClick={() => setIsMenuOpen(true)} className="text-white hover:text-gray-300 transition-colors">
                            <Menu className="w-8 h-8" />
                        </button>
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
                        <Link to="/news" onClick={() => setIsMenuOpen(false)}>News</Link>
                        <Link to="/blog" onClick={() => setIsMenuOpen(false)}>Blog</Link>
                        <Link to="/clips" onClick={() => setIsMenuOpen(false)}>Clips</Link>
                    </div>
                </div>
            </div>

            {/* === КОНТЕНТ TERMS & CONDITIONS === */}
            <Reveal direction="up" immediate>
                <section className="max-w-[1000px] mx-auto px-6 pt-40 pb-20">

                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-12 uppercase tracking-wide">
                        TERMS & CONDITIONS
                    </h1>

                    <div className="space-y-12 text-gray-300 leading-relaxed font-normal text-base">

                        <div>
                            <p>
                                AniFlow is a non-commercial portfolio project. By using the site you accept the rules below. If you disagree with them, please close the site.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">Your account</h2>
                            <p>
                                You answer for what happens under your account, so keep your password to yourself. Admins may block an account that posts spam or breaks these rules.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">Anime content</h2>
                            <p>
                                Anime titles, frames and artwork belong to their studios and rights holders. AniFlow claims no rights to them. Clips are here for fan edits and reviews; commercial use needs permission from the rights holder.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">Comments and uploads</h2>
                            <p>You must not post:</p>
                            <ul className="list-disc pl-6 space-y-2 mt-2">
                                <li>content you have no right to share;</li>
                                <li>personal data of other people;</li>
                                <li>links to malware or phishing pages;</li>
                                <li>insults and harassment.</li>
                            </ul>
                            <p className="mt-4">Admins remove such posts without notice.</p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">Requests from rights holders</h2>
                            <p>
                                If you hold the rights to a clip and want it removed, send a link to the clip to <span className="text-red-500">support@aniflow.example</span>. An admin checks the request and takes the clip down.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">Your privacy</h2>
                            <p>
                                The <Link to="/privacy-policy" className="text-red-500 hover:underline">Privacy Policy</Link> lists the data the site stores.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">No warranty</h2>
                            <p>
                                The site runs as is and costs you nothing. It may go offline, lose data or change without notice, and the author accepts no liability for losses caused by that.
                            </p>
                        </div>
                    </div>
                </section>
            </Reveal>

            {/* FOOTER (КОЛОНКИ) */}
            <Reveal direction="up" immediate>
                <footer className="w-full bg-transparent pt-16 pb-8 border-t border-white/10">
                    <div className="max-w-[1400px] mx-auto px-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
                            <div className="md:col-span-1">
                                <div className="mb-8">
                                    <img src="/aniflow-logo.svg" alt="Logo" className="h-20 w-auto object-contain mix-blend-screen" />
                                </div>
                                <p className="text-gray-400 text-sm leading-relaxed mb-8">
                                    AniFlow is an anime catalogue with episodes, short clips and a studio for cutting your own edits.
                                </p>
                                <h4 className="text-white font-bold text-sm mb-4">Find us on other platforms</h4>
                                <div className="flex gap-4 items-center">
                                    <a href="#" className="hover:scale-90 transition-transform"><svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><rect x="2" y="2" width="4" height="20" /><circle cx="14" cy="9" r="7" /></svg></a>
                                    <a href="#" className="hover:scale-90 transition-transform"><svg viewBox="0 0 24 24" className="w-7 h-7 fill-white"><path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418 c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768 C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.861-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z" /></svg></a>
                                    <a href="#" className="hover:scale-90 transition-transform">
                                        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-transparent stroke-white stroke-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
                                    </a>
                                    <a href="#" className="hover:scale-90 transition-transform"><svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><path d="M22.46,6c-0.77,0.35-1.6,0.58-2.46,0.69c0.88-0.53,1.56-1.37,1.88-2.38c-0.83,0.5-1.75,0.85-2.72,1.05 C18.37,4.5,17.26,4,16,4c-2.35,0-4.27,1.92-4.27,4.29c0,0.34,0.04,0.67,0.11,0.98C8.28,9.09,5.11,7.38,3,4.79 C2.63,5.42,2.42,6.16,2.42,6.94c0,1.49,0.76,2.8,1.91,3.57c-0.71-0.02-1.37-0.22-1.95-0.54c0,0.02,0,0.04,0,0.06 c0,2.08,1.48,3.82,3.44,4.21c-0.36,0.1-0.74,0.15-1.13,0.15c-0.27,0-0.54-0.03-0.8-0.08c0.54,1.71,2.13,2.95,4.02,2.99 c-1.47,1.15-3.32,1.84-5.33,1.84c-0.35,0-0.69-0.02-1.03-0.06C2.9,19.33,5.19,20,7.64,20c6.76,0,10.46-5.61,10.46-10.46 c0-0.16,0-0.32-0.01-0.48C18.91,8.43,19.54,7.53,20.06,6.51c-0.66,0.29-1.36,0.49-2.09,0.57c0.76-0.46,1.34-1.18,1.61-2.04 C22.46,6,22.46,6,22.46,6z" /></svg></a>
                                </div>
                            </div>
                            <div className="flex flex-col gap-4">
                                <h4 className="text-white font-bold text-lg mb-2">Explore</h4>
                                <Link to="/news" className="text-gray-400 hover:text-white transition-colors text-sm">News</Link>
                                <Link to="/blog" className="text-gray-400 hover:text-white transition-colors text-sm">Blog</Link>
                                <Link to="/clips" className="text-gray-400 hover:text-white transition-colors text-sm">Clips</Link>
                            </div>
                            <div className="flex flex-col gap-4">
                                <h4 className="text-white font-bold text-lg mb-2">Services</h4>
                                <Link to="/contact" className="text-gray-400 hover:text-white transition-colors text-sm">Contact Us</Link>
                                <Link to="/careers" className="text-gray-400 hover:text-white transition-colors text-sm">Careers</Link>
                            </div>
                            <div className="flex flex-col gap-4">
                                <h4 className="text-white font-bold text-lg mb-2">Legal</h4>
                                <Link to="/privacy-policy" className="text-gray-400 hover:text-white transition-colors text-sm">Privacy Policy</Link>
                                <Link to="/terms-and-conditions" className="text-white text-sm">Terms & Conditions</Link>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row justify-between items-end border-t border-white/5 pt-8">
                            <div className="text-xs text-gray-500 font-medium space-y-2">
                                <p>© 2026 AniFlow · Behruz Avezmatov</p>
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

export default TermsConditions;
