import { useState, useEffect, useRef } from 'react';
import { adminApi, type SystemSettings } from '../../api/admin';
import { Save, Settings2, Globe, ShieldAlert, Users, Image as ImageIcon, Type, MessageSquare, Upload, Download } from 'lucide-react';

import { apiErrorDetail } from '../../utils/apiError';
export default function Settings() {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const data = await adminApi.getSettings();
                setSettings(data);
            } catch {
                setError('Failed to load system settings');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!settings) return;
        const { name, value, type } = e.target;

        let parsedValue: string | boolean = value;
        if (type === 'checkbox') {
            parsedValue = (e.target as HTMLInputElement).checked;
        }

        setSettings({
            ...settings,
            [name]: parsedValue
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const updated = await adminApi.updateSettings(settings);
            setSettings(updated);
            setSuccess('Settings saved successfully!');
            setTimeout(() => setSuccess(''), 3000);
        } catch {
            setError('Failed to update settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-white">Loading settings...</div>;

    if (!settings) return <div className="p-8 text-red-500">Error loading settings.</div>;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                        <Settings2 className="w-8 h-8 text-red-500" />
                        Global Configuration
                    </h1>
                    <p className="text-gray-400 mt-2 font-medium">Control the core behavior, branding, and accessibility of the platform.</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg mb-6 font-bold uppercase tracking-widest text-sm text-center">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg mb-6 font-bold uppercase tracking-widest text-sm text-center">
                    {success}
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-8">

                {/* Branding Section */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2 border-b border-white/10 pb-4">
                        <Type className="w-5 h-5 text-purple-500" />
                        Branding & SEO
                    </h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">Site Name</label>
                            <input
                                type="text"
                                name="site_name"
                                value={settings.site_name}
                                onChange={handleChange}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                                placeholder="AniFlow"
                            />
                            <p className="text-xs text-gray-500 mt-1 uppercase">Used in page titles and navigation</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">Global SEO Description</label>
                            <textarea
                                name="seo_description"
                                value={settings.seo_description || ''}
                                onChange={handleChange}
                                rows={3}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors resize-none"
                                placeholder="The ultimate destination for anime streaming..."
                            />
                            <p className="text-xs text-gray-500 mt-1 uppercase">Meta description for search engines</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">Home Hero Banner URL</label>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        name="hero_banner_url"
                                        value={settings.hero_banner_url || ''}
                                        onChange={handleChange}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                                        placeholder="https://example.com/banner.jpg"
                                    />
                                </div>
                                {settings.hero_banner_url && (
                                    <div className="w-12 h-12 shrink-0 rounded border border-white/10 overflow-hidden bg-black flex items-center justify-center">
                                        <img src={settings.hero_banner_url} alt="hero" className="w-full h-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                                        <ImageIcon className="w-4 h-4 text-gray-700 absolute -z-10" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Integrations Section */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2 border-b border-white/10 pb-4">
                        <MessageSquare className="w-5 h-5 text-green-500" />
                        Webhooks & Notifications
                    </h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">Telegram Bot Token</label>
                            <input
                                type="text"
                                name="telegram_bot_token"
                                value={settings.telegram_bot_token || ''}
                                onChange={handleChange}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
                                placeholder="123456789:ABCdefGHIjklmNOPqrstUVWxyz"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">Telegram Chat ID</label>
                            <input
                                type="text"
                                name="telegram_chat_id"
                                value={settings.telegram_chat_id || ''}
                                onChange={handleChange}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
                                placeholder="-1001234567890"
                            />
                            <p className="text-xs text-gray-500 mt-1 uppercase">Where to send Telegram alerts</p>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <label className="block text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">Discord Webhook URL</label>
                            <input
                                type="text"
                                name="discord_webhook_url"
                                value={settings.discord_webhook_url || ''}
                                onChange={handleChange}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                placeholder="https://discord.com/api/webhooks/..."
                            />
                            <p className="text-xs text-gray-500 mt-1 uppercase">URL for the Discord server channel</p>
                        </div>
                    </div>
                </div>

                {/* Operations Section */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2 border-b border-white/10 pb-4">
                        <Globe className="w-5 h-5 text-blue-500" />
                        Server Operations
                    </h2>

                    <div className="space-y-6">
                        {/* Bulk CSV Sync */}
                        <div className="p-4 rounded-lg border border-purple-500/30 bg-purple-900/10 mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-white font-bold tracking-wider uppercase mb-1">Anime Catalog Sync (CSV)</h3>
                                <p className="text-gray-400 text-sm">Download or bulk-import the Anime database using CSV.</p>
                            </div>
                            <div className="flex gap-3">
                                <input
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        try {
                                            setImporting(true);
                                            const res = await adminApi.importAnimeCsv(file);
                                            setSuccess(res.message);
                                        } catch (err) {
                                            setError(apiErrorDetail(err) || "Failed to import CSV");
                                        } finally {
                                            setImporting(false);
                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={importing}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold tracking-wider shadow-lg transition-colors whitespace-nowrap flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Upload className="w-4 h-4" />
                                    {importing ? 'Importing...' : 'Import CSV'}
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            await adminApi.exportAnimeCsv();
                                        } catch {
                                            alert("Failed to export anime CSV");
                                        }
                                    }}
                                    className="px-4 py-2 bg-transparent border border-purple-500 text-purple-400 hover:bg-purple-500/10 rounded font-bold tracking-wider transition-colors whitespace-nowrap flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Export CSV
                                </button>
                            </div>
                        </div>

                        <div className="p-4 rounded-lg border border-red-500/30 bg-red-900/10 mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-white font-bold tracking-wider uppercase mb-1">System Database Backup</h3>
                                <p className="text-gray-400 text-sm">Download a complete, raw .sql snapshot of the current Postgres database.</p>
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        await adminApi.downloadSystemBackup();
                                    } catch {
                                        alert("Failed to download backup via pg_dump");
                                    }
                                }}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold tracking-wider shadow-lg transition-colors whitespace-nowrap"
                            >
                                Download Backup
                            </button>
                        </div>

                        <label className="flex items-start gap-4 p-4 rounded-lg border border-white/5 bg-black/30 cursor-pointer hover:bg-white/5 transition-colors">
                            <div className="relative flex items-center mt-1">
                                <input
                                    type="checkbox"
                                    name="allow_registrations"
                                    checked={settings.allow_registrations}
                                    onChange={handleChange}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-bold flex items-center gap-2">
                                    <Users className="w-4 h-4 text-green-500" />
                                    Allow Public Registrations
                                </p>
                                <p className="text-xs text-gray-400 mt-1 uppercase tracking-wide">If disabled, new users cannot create accounts. Invite-only mode.</p>
                            </div>
                        </label>

                        <label className="flex items-start gap-4 p-4 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors cursor-pointer">
                            <div className="relative flex items-center mt-1">
                                <input
                                    type="checkbox"
                                    name="maintenance_mode"
                                    checked={settings.maintenance_mode}
                                    onChange={handleChange}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                            </div>
                            <div className="flex-1">
                                <p className="text-red-400 font-black flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4" />
                                    MAINTENANCE MODE
                                </p>
                                <p className="text-xs text-red-400/70 mt-1 uppercase tracking-wider">Locks out all non-admin users with a "Be back soon" screen.</p>
                            </div>
                        </label>

                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-lg font-black tracking-widest uppercase transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <span className="animate-pulse">Saving...</span>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Save Configuration
                            </>
                        )}
                    </button>
                </div>

            </form>
        </div>
    );
}
