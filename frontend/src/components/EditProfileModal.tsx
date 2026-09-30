import { useState, useRef, type SVGProps } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Save, Loader2, Upload } from 'lucide-react';
import { userApi } from '../api/user';
import type { User } from '../api/types';
import { useTranslation } from 'react-i18next';

import { apiErrorDetail, errorMessage } from '../utils/apiError';
interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
    onUpdate: () => void;
}

export default function EditProfileModal({ isOpen, onClose, currentUser, onUpdate }: EditProfileModalProps) {
    const { t } = useTranslation();
    // const { login } = useAuth(); // We might need to update auth context if critical info changes
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'details' | 'password'>('details');

    // Form States
    const [formData, setFormData] = useState({
        full_name: currentUser.full_name || '',
        username: currentUser.username || '',
        bio: currentUser.bio || '',
        email: currentUser.email || ''
    });

    const [passwordData, setPasswordData] = useState({
        newPassword: '',
        confirmPassword: ''
    });

    // Avatar State
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(currentUser.avatar_url || null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            // 1. Update Profile Details
            if (activeTab === 'details') {
                const updateData: Parameters<typeof userApi.updateProfile>[0] = {};
                if (formData.full_name !== currentUser.full_name) updateData.full_name = formData.full_name;
                if (formData.username !== currentUser.username) updateData.username = formData.username;
                if (formData.bio !== currentUser.bio) updateData.bio = formData.bio;

                if (Object.keys(updateData).length > 0) {
                    await userApi.updateProfile(updateData);
                }

                // 2. Upload Avatar if changed
                if (avatarFile) {
                    await userApi.uploadAvatar(avatarFile);
                }
            }
            // 3. Update Password
            else if (activeTab === 'password') {
                if (passwordData.newPassword !== passwordData.confirmPassword) {
                    throw new Error("Passwords do not match");
                }
                if (passwordData.newPassword.length < 8) {
                    throw new Error("Password must be at least 8 characters");
                }
                await userApi.updateProfile({ password: passwordData.newPassword });
            }

            onUpdate(); // Refresh parent data
            onClose();
        } catch (err) {
            console.error("Update failed", err);
            setError(apiErrorDetail(err) || errorMessage(err) || "Failed to update profile");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#111]">
                        <h2 className="text-xl font-bold text-white">{t('profile.edit_profile')}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex">
                        {/* Sidebar Tabs */}
                        <div className="w-48 border-r border-white/10 bg-[#0e0e0e] p-4 hidden sm:block">
                            <button
                                onClick={() => setActiveTab('details')}
                                className={`w-full text-left px-4 py-3 rounded-xl mb-2 transition-all ${activeTab === 'details' ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                {t('profile.profile_details')}
                            </button>
                            <button
                                onClick={() => setActiveTab('password')}
                                className={`w-full text-left px-4 py-3 rounded-xl transition-all ${activeTab === 'password' ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                {t('profile.password')}
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {error && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                {activeTab === 'details' && (
                                    <div className="space-y-6">
                                        {/* Avatar Upload */}
                                        <div className="flex flex-col items-center gap-4 py-4">
                                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-white/30 transition-colors">
                                                    {avatarPreview ? (
                                                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-white/5 flex items-center justify-center text-gray-400">
                                                            <UserIcon className="w-10 h-10" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                                                    <Camera className="w-8 h-8 text-white" />
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-2"
                                            >
                                                <Upload className="w-4 h-4" /> {t('profile.change_avatar')}
                                            </button>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                hidden
                                                accept="image/*"
                                                onChange={handleFileChange}
                                            />
                                        </div>

                                        {/* Fields */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm text-gray-400">{t('auth.full_name')}</label>
                                                <input
                                                    type="text"
                                                    value={formData.full_name}
                                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-white/30"
                                                    placeholder="John Doe"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm text-gray-400">{t('auth.username')}</label>
                                                <input
                                                    type="text"
                                                    value={formData.username}
                                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-white/30"
                                                    placeholder="johndoe"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm text-gray-400">{t('profile.bio')}</label>
                                            <textarea
                                                value={formData.bio}
                                                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 min-h-[100px]"
                                                placeholder={t('profile.bio_placeholder')}
                                            />
                                        </div>

                                        <div className="space-y-2 opacity-50 pointer-events-none">
                                            <label className="text-sm text-gray-400">{t('profile.email_read_only')}</label>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                readOnly
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-gray-400"
                                            />
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'password' && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-sm text-gray-400">{t('profile.new_password')}</label>
                                            <input
                                                type="password"
                                                value={passwordData.newPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-white/30"
                                                placeholder={t('profile.min_8_chars')}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm text-gray-400">{t('profile.confirm_password')}</label>
                                            <input
                                                type="password"
                                                value={passwordData.confirmPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-white/30"
                                                placeholder={t('profile.re_enter_password')}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="mt-8 pt-6 border-t border-white/10 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-6 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="px-6 py-2.5 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center gap-2"
                                    >
                                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        {t('profile.save_changes')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

// Icon helper
function UserIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    )
}
