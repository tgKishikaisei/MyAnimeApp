import React, { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { reportsApi } from '../../api/reports';

import { apiErrorDetail } from '../../utils/apiError';
interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetType: string;
    targetId: number;
}

export default function ReportModal({ isOpen, onClose, targetType, targetId }: ReportModalProps) {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) {
            setError('Please provide a reason');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            await reportsApi.createReport(targetType, targetId, reason);
            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
                setReason('');
            }, 2000);
        } catch (err) {
            setError(apiErrorDetail(err) || 'Failed to submit report. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-md overflow-hidden relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-6 border-b border-white/10 flex items-center gap-3">
                    <Flag className="w-6 h-6 text-red-500" />
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-wider">Report Content</h2>
                        <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Help us keep the community safe</p>
                    </div>
                </div>

                <div className="p-6">
                    {success ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Flag className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Report Submitted</h3>
                            <p className="text-sm text-gray-400">Our moderation team will review this shortly.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && <div className="p-3 bg-red-500/10 text-red-500 rounded border border-red-500/20 text-sm font-bold uppercase tracking-wider text-center">{error}</div>}

                            <div>
                                <label className="block text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">Reason</label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="What's wrong with this content? (Spam, inappropriate, broken, etc.)"
                                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors resize-none"
                                    rows={4}
                                    required
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-gray-400 hover:text-white font-bold text-sm tracking-wider uppercase transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded font-black tracking-widest uppercase transition-colors disabled:opacity-50"
                                >
                                    {submitting ? 'Submitting...' : 'Submit Report'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
