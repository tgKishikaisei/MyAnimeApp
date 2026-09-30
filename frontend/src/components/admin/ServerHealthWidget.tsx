import { useState, useEffect } from 'react';
import { adminApi, type ServerHealth } from '../../api/admin';
import { Activity, Cpu, HardDrive, Server, Download, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

import { apiErrorDetail, errorMessage } from '../../utils/apiError';
export default function ServerHealthWidget() {
    const [health, setHealth] = useState<ServerHealth | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const fetchHealth = async () => {
        try {
            const data = await adminApi.getServerHealth();
            setHealth(data);
            setError(null);
        } catch (err) {
            console.error("Failed to fetch server health", err);
            setError("Could not connect to server diagnostics.");
        } finally {
            setLoading(false);
        }
    };

    // Poll every 5 seconds
    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleBackup = async () => {
        if (!window.confirm("Are you sure you want to trigger a full database backup? This may affect performance briefly.")) return;
        setIsExporting(true);
        try {
            await adminApi.exportDatabase();
        } catch (err) {
            console.error("Backup failed", err);
            alert("Database backup failed: " + (apiErrorDetail(err) || errorMessage(err)));
        } finally {
            setIsExporting(false);
        }
    };

    if (loading && !health) {
        return (
            <div className="p-6 rounded-xl border border-white/10 bg-white/5 animate-pulse h-64 flex items-center justify-center">
                <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Loading Diagnostics...</p>
            </div>
        );
    }

    if (error || !health) {
        return (
            <div className="p-6 rounded-xl border border-red-500/20 bg-red-500/5 flex flex-col items-center justify-center h-64 text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mb-3" />
                <p className="text-red-400 font-bold text-sm uppercase tracking-widest">{error}</p>
            </div>
        );
    }

    const metrics = [
        { label: 'CPU Usage', icon: Cpu, percent: health.cpu.percent, details: `${health.cpu.cores} Cores`, color: 'blue' },
        { label: 'RAM Usage', icon: Server, percent: health.ram.percent, details: `${health.ram.used_gb} / ${health.ram.total_gb} GB`, color: 'purple' },
        { label: 'Disk Usage', icon: HardDrive, percent: health.disk.percent, details: `${health.disk.used_gb} / ${health.disk.total_gb} GB`, color: 'emerald' },
    ];

    return (
        <div className="p-6 rounded-xl border border-white/10 bg-white/5 h-full flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-500" />
                        Live Hardware Specs
                    </h2>
                    <span className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Online
                    </span>
                </div>

                <div className="space-y-6">
                    {metrics.map((metric) => (
                        <div key={metric.label}>
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm font-bold text-gray-300 flex items-center gap-2 uppercase tracking-wide">
                                    <metric.icon className={`w-4 h-4 text-${metric.color}-400`} />
                                    {metric.label}
                                </span>
                                <div className="text-right">
                                    <span className="text-xs text-gray-500 font-mono block">{metric.details}</span>
                                    <span className={`text-sm font-black text-${metric.color}-400`}>{metric.percent.toFixed(1)}%</span>
                                </div>
                            </div>
                            <div className="w-full bg-black/50 rounded-full h-2.5 overflow-hidden border border-white/5">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${metric.percent}%` }}
                                    transition={{ type: 'spring', stiffness: 50, damping: 15 }}
                                    className={`h-full rounded-full bg-${metric.color}-500`}
                                    style={{
                                        boxShadow: `0 0 10px var(--tw-color-${metric.color}-500)`
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
                <button
                    onClick={handleBackup}
                    disabled={isExporting}
                    className="w-full relative overflow-hidden group bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-xs py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform disabled:hidden" />
                    {isExporting ? (
                        <>
                            <Activity className="w-4 h-4 animate-spin" />
                            Dumping Database...
                        </>
                    ) : (
                        <>
                            <Download className="w-4 h-4" />
                            1-Click Sub-Zero DB Backup
                        </>
                    )}
                </button>
                <p className="text-[10px] text-gray-500 text-center mt-3 uppercase tracking-widest font-bold">
                    Generates a direct `.sql` dump via pg_dump
                </p>
            </div>
        </div>
    );
}
