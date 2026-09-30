import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import type { RegisterData } from '../../api/types';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { apiErrorDetail } from '../../utils/apiError';
export default function Register() {
    const { t } = useTranslation();
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterData>();
    const [serverError, setServerError] = useState('');
    const navigate = useNavigate();

    const onSubmit = async (data: RegisterData) => {
        try {
            setServerError('');
            await authApi.register(data);
            alert(t('auth.register_success'));
            navigate('/login');
        } catch (error) {
            console.error('Registration failed:', error);
            setServerError(apiErrorDetail(error) || t('auth.register_error_default'));
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4" style={{ backgroundImage: "url('/bg.jpg')", backgroundSize: 'cover' }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            <div className="relative w-full max-w-md bg-black/80 border border-white/10 p-8 rounded-xl shadow-2xl">
                <div className="text-center mb-8">
                    <img src="/aniflow-logo.svg" alt="Logo" className="h-16 mx-auto mb-4 mix-blend-screen" />
                    <h2 className="text-2xl font-bold text-white uppercase tracking-widest">{t('auth.create_account')}</h2>
                    <p className="text-gray-400 text-sm mt-2">{t('auth.join_desc')}</p>
                </div>

                {serverError && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm text-center">
                        {serverError}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('auth.email')}</label>
                        <input
                            {...register('email', {
                                required: t('auth.email_required') as string,
                                pattern: {
                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                    message: t('auth.invalid_email') as string
                                }
                            })}
                            type="email"
                            className="w-full bg-[#1a1a1a] border border-white/10 text-white rounded p-3 focus:border-red-600 focus:outline-none transition-colors"
                            placeholder="name@example.com"
                        />
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('auth.username')}</label>
                        <input
                            {...register('username', {
                                required: t('auth.username_required') as string,
                                minLength: { value: 3, message: t('auth.username_length') as string }
                            })}
                            type="text"
                            className="w-full bg-[#1a1a1a] border border-white/10 text-white rounded p-3 focus:border-red-600 focus:outline-none transition-colors"
                            placeholder="username"
                        />
                        {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('auth.full_name')}</label>
                        <input
                            {...register('full_name')}
                            type="text"
                            className="w-full bg-[#1a1a1a] border border-white/10 text-white rounded p-3 focus:border-red-600 focus:outline-none transition-colors"
                            placeholder={t('auth.your_name')}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('auth.password')}</label>
                        <input
                            {...register('password', {
                                required: t('auth.password_required') as string,
                                minLength: { value: 6, message: t('auth.password_length') as string }
                            })}
                            type="password"
                            className="w-full bg-[#1a1a1a] border border-white/10 text-white rounded p-3 focus:border-red-600 focus:outline-none transition-colors"
                            placeholder="••••••••"
                        />
                        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting && <Loader2 className="animate-spin w-4 h-4" />}
                        {isSubmitting ? t('auth.creating_account') : t('auth.sign_up')}
                    </button>
                </form>

                <p className="text-center text-gray-500 text-sm mt-6">
                    {t('auth.have_account')} <Link to="/login" className="text-white hover:text-red-500 font-bold transition-colors">{t('auth.sign_in')}</Link>
                </p>
            </div>
        </div>
    );
}
