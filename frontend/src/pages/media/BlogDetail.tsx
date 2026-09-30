import React, { useState, useRef, useEffect } from 'react';
import { Search, Menu, X, ChevronUp } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { blogApi } from '../../api/blog';
import type { BlogPost } from '../../api/types';

// ── Renders a block of content text supporting:
//    ## Heading        → big bold section header
//    [IMAGE:url]       → inline full-width image
//    [IMG2:url1,url2]  → two images side by side
//    blank line        → space between paragraphs
//    everything else   → regular paragraph
function renderContent(content: string) {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();

        // Section heading: ## Title
        if (line.startsWith('## ')) {
            elements.push(
                <h2
                    key={i}
                    className="text-3xl md:text-5xl font-black text-white uppercase leading-tight mt-16 mb-6"
                >
                    {line.slice(3)}
                </h2>
            );
            i++;
            continue;
        }

        // Two side-by-side images: [IMG2:url1,url2]
        if (line.startsWith('[IMG2:') && line.endsWith(']')) {
            const urls = line.slice(6, -1).split(',').map(u => u.trim());
            elements.push(
                <div key={i} className="grid grid-cols-2 gap-4 my-8">
                    {urls.map((url, idx) => (
                        <img key={idx} src={url} alt="" className="w-full rounded" />
                    ))}
                </div>
            );
            i++;
            continue;
        }

        // Single inline image: [IMAGE:url]
        if (line.startsWith('[IMAGE:') && line.endsWith(']')) {
            const url = line.slice(7, -1).trim();
            elements.push(
                <img key={i} src={url} alt="" className="w-full rounded my-8" />
            );
            i++;
            continue;
        }

        // Empty line → spacer
        if (line === '') {
            elements.push(<div key={i} className="h-2" />);
            i++;
            continue;
        }

        // Regular paragraph
        elements.push(
            <p key={i} className="text-sm text-[#aaa] leading-relaxed">
                {line}
            </p>
        );
        i++;
    }

    return elements;
}

export default function BlogDetail() {
    const { id } = useParams<{ id: string }>();

    const [post, setPost] = useState<BlogPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [isAtTop, setIsAtTop] = useState(true);
    const lastScrollY = useRef(0);
    const [showScrollTop, setShowScrollTop] = useState(false);

    useEffect(() => {
        const fetchPost = async () => {
            try {
                const data = await blogApi.getById(Number(id));
                setPost(data);
            } catch {
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        };
        fetchPost();
    }, [id]);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            setIsNavVisible(currentScrollY <= lastScrollY.current || currentScrollY <= 50);
            lastScrollY.current = currentScrollY;
            setIsAtTop(currentScrollY < 10);
            setShowScrollTop(currentScrollY > 300);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    return (
        <div className="min-h-screen text-white pb-20 font-sans relative overflow-x-hidden">

            {/* BG */}
            <div className="fixed inset-0 z-[-1] bg-black" />

            {/* NAVBAR */}
            <motion.nav
                animate={{ y: isNavVisible ? 0 : '-100%' }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className={`fixed top-0 w-full z-40 py-4 transition-all duration-500 ${isAtTop ? 'bg-transparent border-transparent' : 'bg-black/80 border-b border-white/10 backdrop-blur-md'}`}
            >
                <div className="max-w-[1400px] mx-auto px-6">
                    <div className="flex items-center justify-end lg:justify-between gap-6">
                        <Link to="/" className="hidden lg:flex items-center cursor-pointer shrink-0">
                            <img src="/aniflow-logo.svg" alt="AniFlow" className="h-14 w-auto object-contain mix-blend-screen" />
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
                                <Link to="/blog" className="text-white border-b-2 border-white pb-1">BLOG</Link>
                                <Link to="/clips" className="hover:text-white transition-colors">CLIPS</Link>
                            </div>
                            <button onClick={() => setIsMenuOpen(true)} className="text-white hover:text-gray-300 transition-colors">
                                <Menu className="w-8 h-8" />
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 lg:hidden w-full">
                        <div className="relative w-full">
                            <Search className="absolute left-4 top-3.5 w-5 h-5 text-black opacity-60" strokeWidth={1.5} />
                            <input type="text" placeholder="Search anime" className="w-full bg-[#f2f2f2] text-black pl-12 pr-4 py-3 rounded-md font-medium focus:outline-none placeholder:text-black" />
                        </div>
                    </div>
                </div>
            </motion.nav>

            {/* SIDEBAR */}
            <div className={`fixed inset-0 bg-black/80 z-50 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMenuOpen(false)} />
            <div className={`fixed top-0 left-0 h-full w-[300px] bg-black/80 backdrop-blur-xl border-r border-white/10 text-white z-[60] shadow-2xl transform transition-transform duration-300 ease-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-8 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-10">
                        <span className="font-black text-xl tracking-tighter">MENU</span>
                        <button onClick={() => setIsMenuOpen(false)}><X className="w-8 h-8 text-white hover:text-red-500 transition-colors" /></button>
                    </div>
                    <div className="flex flex-col gap-6 text-xl font-black tracking-wider uppercase">
                        <Link to="/news" onClick={() => setIsMenuOpen(false)} className="hover:text-red-600 transition-colors">News</Link>
                        <Link to="/blog" onClick={() => setIsMenuOpen(false)} className="hover:text-red-600 transition-colors text-red-600">Blog</Link>
                        <Link to="/clips" onClick={() => setIsMenuOpen(false)} className="hover:text-red-600 transition-colors">Clips</Link>
                    </div>
                </div>
            </div>

            {/* ARTICLE CONTENT */}
            <main className="max-w-[860px] mx-auto px-6 pt-36 pb-20">

                {loading && (
                    <div className="space-y-6 animate-pulse">
                        <div className="h-12 bg-white/5 rounded w-3/4" />
                        <div className="h-4 bg-white/5 rounded w-full" />
                        <div className="h-4 bg-white/5 rounded w-5/6" />
                        <div className="h-4 bg-white/5 rounded w-4/6" />
                    </div>
                )}

                {notFound && (
                    <div className="text-center py-32">
                        <p className="text-5xl font-black text-white/10 mb-4">404</p>
                        <p className="text-gray-500 text-sm mb-8">Blog post not found.</p>
                        <Link to="/blog" className="text-xs font-bold text-[#666] hover:text-white transition-colors lowercase tracking-wide">← back to blog</Link>
                    </div>
                )}

                {post && (
                    <motion.article
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    >
                        {/* Back link */}
                        <Link to="/blog" className="text-xs font-bold text-[#555] hover:text-white transition-colors lowercase tracking-widest mb-10 block">
                            ← blog
                        </Link>

                        {/* Main title */}
                        <h1 className="text-4xl md:text-6xl font-black text-white uppercase leading-[0.95] tracking-tight mb-10">
                            {post.title}
                        </h1>

                        {/* Thin divider */}
                        <div className="w-full h-[1px] bg-white/8 mb-10" />

                        {/* Hero image */}
                        {post.image && (
                            <img
                                src={post.image}
                                alt={post.title}
                                className="w-full rounded mb-10 opacity-90"
                            />
                        )}

                        {/* Body content */}
                        {post.content ? (
                            <div className="space-y-4">
                                {renderContent(post.content)}
                            </div>
                        ) : (
                            <p className="text-sm text-[#555] italic">No content yet.</p>
                        )}

                        {/* Bottom divider + back */}
                        <div className="w-full h-[1px] bg-white/5 mt-16 mb-8" />
                        <Link to="/blog" className="text-xs font-bold text-[#555] hover:text-white transition-colors lowercase tracking-widest">
                            ← back to blog
                        </Link>
                    </motion.article>
                )}
            </main>

            {/* FOOTER */}
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
                                <a href="#" className="hover:scale-90 transition-transform">
                                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-transparent stroke-white stroke-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
                                </a>
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
                            <Link to="/terms-and-conditions" className="text-gray-400 hover:text-white transition-colors text-sm">Terms & Conditions</Link>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-end border-t border-white/5 pt-8">
                        <div className="text-xs text-gray-500 font-medium space-y-2">
                            <p>© 2026 AniFlow · Behruz Avezmatov</p>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Scroll to top */}
            <button
                onClick={scrollToTop}
                className={`fixed bottom-10 right-10 z-50 p-3 rounded-full bg-black text-white shadow-lg shadow-black/50 transition-all duration-300 ease-in-out hover:text-[#00FF00] hover:scale-110 ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
            >
                <ChevronUp className="w-6 h-6" strokeWidth={3} />
            </button>

        </div>
    );
}
