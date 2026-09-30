import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Film, Video, Newspaper, FileText, LogOut, Home, Users, Settings, Flag, Megaphone, MessageSquare, LineChart, HardDrive, Star, Activity, Flame, History, Filter, Sparkles, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
    const location = useLocation();
    const { logout } = useAuth();

    const navItems = [
        { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/admin/live', icon: Activity, label: 'Live Activity' },
        { path: '/admin/radar', icon: Flame, label: 'Content Radar' },
        { path: '/admin/analytics', icon: LineChart, label: 'Analytics' },
        { path: '/admin/funnels', icon: Filter, label: 'Funnels' },
        { path: '/admin/recommendations', icon: Sparkles, label: 'ML Engine' },
        { path: '/admin/explorer', icon: Database, label: 'BI Explorer' },
        { path: '/admin/audit-logs', icon: History, label: 'Audit Logs' },
        { path: '/admin/users', icon: Users, label: 'Users' },
        { path: '/admin/anime', icon: Film, label: 'Anime' },
        { path: '/admin/clips', icon: Video, label: 'Clips' },
        { path: '/admin/news', icon: Newspaper, label: 'News' },
        { path: '/admin/blog', icon: FileText, label: 'Blog' },
        { path: '/admin/reports', icon: Flag, label: 'Reports' },
        { path: '/admin/announcements', icon: Megaphone, label: 'Announcements' },
        { path: '/admin/comments', icon: MessageSquare, label: 'Comments' },
        { path: '/admin/reviews', icon: Star, label: 'Reviews' },
        { path: '/admin/seo', icon: FileText, label: 'Mass SEO' },
        { path: '/admin/media', icon: HardDrive, label: 'Media Browser' },
        { path: '/admin/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <div className="flex h-screen bg-black text-white font-sans">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/10 bg-black/50 backdrop-blur-xl flex flex-col">
                <div className="p-6 border-b border-white/10 flex items-center gap-3">
                    <img src="/aniflow-logo.svg" alt="Logo" className="h-8 w-auto mix-blend-screen" />
                    <span className="font-bold tracking-wider text-xs uppercase text-gray-400">Admin Panel</span>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 ${isActive ? 'bg-red-600/20 text-red-500 font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="text-sm tracking-wide uppercase">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-white/10 space-y-2">
                    <Link to="/" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
                        <Home className="w-5 h-5" />
                        <span className="text-sm tracking-wide uppercase">Back to Site</span>
                    </Link>
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="text-sm tracking-wide uppercase">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-[#0a0a0a]">
                <div className="p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
