import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, Edit, AlertTriangle, Info, CheckCircle, Power } from 'lucide-react';
import { announcementsApi, type Announcement } from '../../api/announcements';

import { apiErrorDetail } from '../../utils/apiError';
export default function AnnouncementsManager() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        title: '',
        message: '',
        type: 'info',
        is_active: true
    });

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            const data = await announcementsApi.getAllAdmin();
            setAnnouncements(data);
        } catch (err) {
            setError(apiErrorDetail(err) || 'Failed to fetch announcements');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const resetForm = () => {
        setFormData({ title: '', message: '', type: 'info', is_active: true });
        setEditingId(null);
        setIsFormOpen(false);
        setError('');
    };

    const handleEdit = (ann: Announcement) => {
        setFormData({
            title: ann.title,
            message: ann.message,
            type: ann.type,
            is_active: ann.is_active
        });
        setEditingId(ann.id);
        setIsFormOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = { ...formData, type: formData.type as 'info' | 'warning' | 'success' };
            if (editingId) {
                await announcementsApi.update(editingId, payload);
            } else {
                await announcementsApi.create(payload);
            }
            await fetchAnnouncements();
            resetForm();
        } catch (err) {
            setError(apiErrorDetail(err) || 'Failed to save announcement');
        }
    };

    const handleToggleActive = async (ann: Announcement) => {
        try {
            await announcementsApi.update(ann.id, { is_active: !ann.is_active });
            await fetchAnnouncements();
        } catch {
            setError('Failed to update status');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this announcement?')) return;
        try {
            await announcementsApi.delete(id);
            await fetchAnnouncements();
        } catch {
            setError('Failed to delete announcement');
        }
    };

    const getIconForType = (type: string) => {
        switch (type) {
            case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
            case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
            default: return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    if (loading && !announcements.length) return <div className="p-8 text-white">Loading announcements...</div>;

    return (
        <div className="max-w-6xl mx-auto pb-12">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                        <Megaphone className="w-8 h-8 text-amber-500" />
                        Announcements
                    </h1>
                    <p className="text-gray-400 mt-2 font-medium">Broadcast global messages to all active users on the platform.</p>
                </div>
                {!isFormOpen && (
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2.5 rounded font-black tracking-widest uppercase transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        New Broadcast
                    </button>
                )}
            </div>

            {error && <div className="bg-red-500/10 text-red-500 p-4 rounded mb-6 font-bold">{error}</div>}

            {isFormOpen && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
                    <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wider">
                        {editingId ? 'Edit Broadcast' : 'Deploy New Broadcast'}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2 uppercase">Title</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:border-amber-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2 uppercase">Severity Type</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:border-amber-500"
                                >
                                    <option value="info">Info (Blue)</option>
                                    <option value="warning">Warning (Yellow)</option>
                                    <option value="success">Success (Green)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-400 mb-2 uppercase">Message</label>
                            <textarea
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:border-amber-500 min-h-[100px]"
                                required
                            />
                        </div>

                        <div className="flex items-center gap-3 py-2">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                className="w-5 h-5 accent-amber-500"
                            />
                            <label htmlFor="is_active" className="text-white font-bold cursor-pointer">Immediately activate broadcast</label>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-6 py-3 rounded font-bold text-gray-400 hover:text-white uppercase tracking-wider transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 rounded font-black tracking-widest uppercase transition-colors"
                            >
                                Deploy Broadcast
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {announcements.map((ann) => (
                    <div
                        key={ann.id}
                        className={`bg-white/5 border ${ann.is_active ? 'border-amber-500/50' : 'border-white/10'} rounded-xl p-6 flex flex-col md:flex-row gap-6 relative overflow-hidden`}
                    >
                        {!ann.is_active && (
                            <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none"></div>
                        )}

                        <div className="relative z-10 shrink-0">
                            {getIconForType(ann.type)}
                        </div>

                        <div className="relative z-10 flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h3 className={`text-xl font-bold ${ann.is_active ? 'text-white' : 'text-gray-500'}`}>{ann.title}</h3>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${ann.is_active ? 'bg-amber-500/20 text-amber-500' : 'bg-gray-500/20 text-gray-500'
                                    }`}>
                                    {ann.is_active ? 'Active' : 'Offline'}
                                </span>
                            </div>
                            <p className={`${ann.is_active ? 'text-gray-300' : 'text-gray-600'}`}>{ann.message}</p>
                            <div className="mt-4 text-xs font-mono text-gray-500">
                                Created: {new Date(ann.created_at).toLocaleString()}
                            </div>
                        </div>

                        <div className="relative z-10 flex flex-row md:flex-col justify-end gap-2 shrink-0 border-t border-white/10 md:border-t-0 md:border-l md:pl-6 pt-4 md:pt-0">
                            <button
                                onClick={() => handleToggleActive(ann)}
                                className={`p-2 rounded transition-colors flex items-center justify-center ${ann.is_active ? 'text-amber-500 hover:bg-amber-500/10' : 'text-gray-400 hover:bg-white/10'
                                    }`}
                                title={ann.is_active ? 'Deactivate' : 'Activate'}
                            >
                                <Power className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => handleEdit(ann)}
                                className="p-2 text-blue-400 hover:bg-blue-400/10 rounded transition-colors flex items-center justify-center"
                                title="Edit"
                            >
                                <Edit className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => handleDelete(ann.id)}
                                className="p-2 text-red-500 hover:bg-red-500/10 rounded transition-colors flex items-center justify-center"
                                title="Delete"
                            >
                                <Trash2 className="w-4 h-5" />
                            </button>
                        </div>
                    </div>
                ))}

                {announcements.length === 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                        <Megaphone className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-400">No Announcements</h3>
                        <p className="text-gray-500 mt-2">Deploy a new broadcast to reach your users.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
