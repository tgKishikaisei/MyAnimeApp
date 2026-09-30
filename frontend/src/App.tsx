import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';

// ─── Lazy-loaded pages (Code Splitting — каждый чанк грузится только при визите) ───
const AnimeClips = lazy(() => import('./pages/anime/AnimeClips'));
const News = lazy(() => import('./pages/media/News'));
const Blog = lazy(() => import('./pages/media/Blog'));
const BlogDetail = lazy(() => import('./pages/media/BlogDetail'));
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'));
const TermsConditions = lazy(() => import('./pages/legal/TermsConditions'));
const ContactUs = lazy(() => import('./pages/info/ContactUs'));
const Careers = lazy(() => import('./pages/info/Careers'));
const Clips = lazy(() => import('./pages/anime/Clips'));
const AnimeDetails = lazy(() => import('./pages/anime/AnimeDetails'));
const AnimeSeason = lazy(() => import('./pages/anime/AnimeSeason'));
const AnimeEpisode = lazy(() => import('./pages/anime/AnimeEpisode'));
const SearchPage = lazy(() => import('./pages/anime/SearchPage'));
const PlaylistsPage = lazy(() => import('./pages/anime/PlaylistsPage'));
const NotFound = lazy(() => import('./pages/info/NotFound'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const Profile = lazy(() => import('./pages/profile_page/Profile'));

// Admin pages — loaded only for admin users
const RequireAdmin = lazy(() => import('./components/admin/RequireAdmin'));
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const UsersManager = lazy(() => import('./pages/admin/UsersManager'));
const AnimeManager = lazy(() => import('./pages/admin/AnimeManager'));
const ClipsManager = lazy(() => import('./pages/admin/ClipsManager'));
const NewsManager = lazy(() => import('./pages/admin/NewsManager'));
const BlogManager = lazy(() => import('./pages/admin/BlogManager'));
const ReportsManager = lazy(() => import('./pages/admin/ReportsManager'));
const AnnouncementsManager = lazy(() => import('./pages/admin/AnnouncementsManager'));
const CommentsManager = lazy(() => import('./pages/admin/CommentsManager'));
const Settings = lazy(() => import('./pages/admin/Settings'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const MediaManager = lazy(() => import('./pages/admin/MediaManager'));
const SEOManager = lazy(() => import('./pages/admin/SEOManager'));
const ReviewsManager = lazy(() => import('./pages/admin/ReviewsManager'));
const LiveActivity = lazy(() => import('./pages/admin/LiveActivity'));
const ContentRadar = lazy(() => import('./pages/admin/ContentRadar'));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const RetentionFunnels = lazy(() => import('./pages/admin/RetentionFunnels'));
const RecommendationTuning = lazy(() => import('./pages/admin/RecommendationTuning'));
const DataExplorer = lazy(() => import('./pages/admin/DataExplorer'));

// Non-lazy — small, used on every page
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { LiveActivityProvider } from './context/LiveActivityContext';
import MaintenanceOverlay from './components/layout/MaintenanceOverlay';
import GlobalAnnouncements from './components/layout/GlobalAnnouncements';
import ScrollToTop from './components/ScrollToTop';
import api from './api/client';

// Minimal loading spinner shown while a lazy chunk is fetching
const PageLoader = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

function MainApp() {
  const { user } = useAuth();
  const { settings } = useSettings();

  // Phase 5: Stealth Ad-Block Detection
  useEffect(() => {
    const runAdTest = setTimeout(() => {
      const adTest = document.createElement('div');
      adTest.innerHTML = '&nbsp;';
      adTest.className = 'adsbox ad-banner doubleclick-ad sponsored-ad banner-ad rectangle-ad';
      adTest.style.position = 'absolute';
      adTest.style.top = '-9999px';
      adTest.style.left = '-9999px';
      adTest.style.height = '10px';
      adTest.style.width = '10px';
      document.body.appendChild(adTest);

      setTimeout(() => {
        const isBlocked = adTest.offsetHeight === 0 ||
          window.getComputedStyle(adTest).display === 'none' ||
          window.getComputedStyle(adTest).visibility === 'hidden';

        if (isBlocked) {
          api.post('/analytics/adblock').catch(() => { });
        }

        adTest.remove();
      }, 500);
    }, 2000);

    return () => clearTimeout(runAdTest);
  }, []);

  const isLockedOut = settings?.maintenance_mode && user?.role !== 'admin';

  return (
    <>
      {isLockedOut && <MaintenanceOverlay />}
      <div className={isLockedOut ? 'hidden' : ''}>
        <GlobalAnnouncements />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<AnimeClips />} />
            <Route path="/Clips" element={<Clips />} />
            <Route path="/news" element={<News />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:id" element={<BlogDetail />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-and-conditions" element={<TermsConditions />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/anime/:id" element={<AnimeDetails />} />
            <Route path="/anime/:id/season/:seasonId" element={<AnimeSeason />} />
            <Route path="/anime/:id/season/:seasonId/episode/:episodeId" element={<AnimeEpisode />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/playlists" element={<PlaylistsPage />} />
            <Route path="/playlists/:slug" element={<PlaylistsPage />} />

            {/* Admin Routes — loaded only when visiting /admin */}
            <Route path="/admin" element={
              <RequireAdmin>
                <LiveActivityProvider>
                  <AdminLayout />
                </LiveActivityProvider>
              </RequireAdmin>
            }>
              <Route index element={<Dashboard />} />
              <Route path="live" element={<LiveActivity />} />
              <Route path="radar" element={<ContentRadar />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="funnels" element={<RetentionFunnels />} />
              <Route path="recommendations" element={<RecommendationTuning />} />
              <Route path="explorer" element={<DataExplorer />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="users" element={<UsersManager />} />
              <Route path="anime" element={<AnimeManager />} />
              <Route path="clips" element={<ClipsManager />} />
              <Route path="/admin/news" element={<RequireAdmin><NewsManager /></RequireAdmin>} />
              <Route path="/admin/blog" element={<RequireAdmin><BlogManager /></RequireAdmin>} />
              <Route path="/admin/reports" element={<RequireAdmin><ReportsManager /></RequireAdmin>} />
              <Route path="/admin/announcements" element={<RequireAdmin><AnnouncementsManager /></RequireAdmin>} />
              <Route path="/admin/comments" element={<RequireAdmin><CommentsManager /></RequireAdmin>} />
              <Route path="/admin/reviews" element={<RequireAdmin><ReviewsManager /></RequireAdmin>} />
              <Route path="/admin/seo" element={<RequireAdmin><SEOManager /></RequireAdmin>} />
              <Route path="/admin/media" element={<RequireAdmin><MediaManager /></RequireAdmin>} />
              <Route path="/admin/settings" element={<RequireAdmin><Settings /></RequireAdmin>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <ScrollToTop />
          <MainApp />
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;