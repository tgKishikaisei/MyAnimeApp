import { useState, useRef, useEffect } from 'react';
import { Scissors, Download, Loader2, Play, Image as ImageIcon, Type, X, Smartphone, Music } from 'lucide-react';
import api from '../../api/client';


type AudioEffect = 'none' | 'normalize' | 'bass_boost';
interface ClipStudioModalProps {
    clipId: number;
    clipTitle: string;
    videoUrl: string;
    duration: number; // in seconds
    onClose: () => void;
}

export default function ClipStudioModal({ clipId, clipTitle, videoUrl, duration, onClose }: ClipStudioModalProps) {
    // Trim State
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(Math.min(10, duration)); // Default 10s crop

    // Config State
    const [format, setFormat] = useState<'mp4' | 'gif' | 'mobile'>('mp4');
    const [quality, setQuality] = useState<'standard' | 'upscale'>('standard');
    const [fps, setFps] = useState<24 | 60>(24);
    const [speed, setSpeed] = useState<number>(1.0);
    const [audioEffect, setAudioEffect] = useState<AudioEffect>('none');
    const [memeText, setMemeText] = useState('');

    // Player State
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Processing State
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Ensure end time doesn't exceed duration
    useEffect(() => {
        if (endTime > duration) setEndTime(duration);
    }, [duration]);

    const handlePlayPause = () => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    // Keep video playback within trim bounds
    const handleTimeUpdate = () => {
        if (!videoRef.current) return;
        if (videoRef.current.currentTime >= endTime) {
            videoRef.current.pause();
            videoRef.current.currentTime = startTime;
            setIsPlaying(false);
        }
    };

    const handleStartChange = (val: number) => {
        let newStart = val;
        if (newStart >= endTime) newStart = endTime - 1; // Prevent overlap
        setStartTime(newStart);
        if (videoRef.current) videoRef.current.currentTime = newStart;
    };

    const handleEndChange = (val: number) => {
        let newEnd = val;
        if (newEnd <= startTime) newEnd = startTime + 1; // Prevent overlap
        if (newEnd > duration) newEnd = duration;

        // Enforce 15 second max for studio to prevent server overload
        if ((newEnd - startTime) > 15) {
            newEnd = startTime + 15;
        }

        setEndTime(newEnd);
    };

    const handleCreate = async () => {
        setIsProcessing(true);
        setProgress(0);
        setError(null);

        const clipDuration = endTime - startTime;
        // Estimate rendering time based on settings. 
        // Base: 1x real time. Upscale: +2x. 60fps: +1x. GIF: +0.5x.
        let estimatedRenderSeconds = clipDuration * 0.5; // base speed
        if (quality === 'upscale') estimatedRenderSeconds += clipDuration * 1.5;
        if (fps === 60) estimatedRenderSeconds += clipDuration * 1.0;
        if (format === 'gif') estimatedRenderSeconds += clipDuration * 0.8;

        // Ensure at least 3 seconds
        estimatedRenderSeconds = Math.max(3, estimatedRenderSeconds);

        // Start simulated progress bar
        const progressInterval = setInterval(() => {
            setProgress(prev => {
                // Decay the speed as it gets closer to 95%
                const remaining = 95 - prev;
                const increment = remaining / (estimatedRenderSeconds * 10); // assuming 100ms interval
                return Math.min(95, prev + Math.max(0.1, increment));
            });
        }, 100);

        try {
            const payload = {
                start_time: startTime,
                end_time: endTime,
                format: format,
                quality: quality,
                fps: fps,
                speed: speed,
                audio_effect: audioEffect,
                add_text: memeText ? memeText : undefined
            };

            const response = await api.post(`/clips/${clipId}/studio`, payload, {
                responseType: 'blob'
            });

            clearInterval(progressInterval);
            setProgress(100); // Jump to 100% on success

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${clipTitle.replace(/\s+/g, '_')}_${format}_MyAnimeClip.${format === 'gif' ? 'gif' : 'mp4'}`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);

            setTimeout(() => onClose(), 500); // Close after showing 100% briefly
        } catch (err) {
            console.error(err);
            clearInterval(progressInterval);
            setProgress(0);
            setError("Failed to process video via FFmpeg. Error output should be in backend logs.");
        } finally {
            setIsProcessing(false);
            clearInterval(progressInterval);
        }
    };

    const handleExtractAudio = async () => {
        setIsProcessing(true);
        setProgress(0);
        setError(null);

        const progressInterval = setInterval(() => {
            setProgress(p => Math.min(95, p + 5));
        }, 200);

        try {
            const response = await api.get(`/clips/${clipId}/audio`, { responseType: 'blob' });
            clearInterval(progressInterval);
            setProgress(100);

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${clipTitle.replace(/\s+/g, '_')}_Audio.mp3`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);

            setTimeout(() => onClose(), 500);
        } catch (err) {
            console.error(err);
            clearInterval(progressInterval);
            setProgress(0);
            setError("Failed to extract audio.");
        } finally {
            setIsProcessing(false);
            clearInterval(progressInterval);
        }
    };

    const trimDuration = (endTime - startTime).toFixed(1);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={(e) => {
                e.stopPropagation(); // Stop click from reaching VideoPlayer backdrop
                onClose(); // Optional: clicking outside the studio box closes the studio
            }}
        >
            <div
                className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden w-full max-w-4xl flex flex-col md:flex-row shadow-2xl"
                onClick={(e) => e.stopPropagation()} // Stop click inside the studio box from closing it
            >

                {/* Visual Video Preview Area */}
                <div className="flex-1 bg-black relative flex flex-col justify-center border-b md:border-b-0 md:border-r border-white/10">
                    <button onClick={onClose} className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded-full text-white/50 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>

                    <div className="relative aspect-video bg-black/50 flex items-center justify-center">
                        <video
                            ref={videoRef}
                            src={videoUrl}
                            className="max-w-full max-h-full"
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={() => { if (videoRef.current) videoRef.current.currentTime = startTime }}
                        />
                        {memeText && format === 'gif' && (
                            <div className="absolute bottom-4 left-0 right-0 text-center px-8 z-10">
                                <span className="text-white text-3xl font-black uppercase tracking-tight drop-shadow-[0_4px_4px_rgba(0,0,0,1)]" style={{ "textShadow": "2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000" }}>
                                    {memeText}
                                </span>
                            </div>
                        )}
                        {!isPlaying && (
                            <button onClick={handlePlayPause} className="absolute inset-0 m-auto w-16 h-16 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full flex items-center justify-center transition-colors">
                                <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
                            </button>
                        )}
                    </div>

                    {/* Dark Minimalist Timelines Controller */}
                    <div className="p-4 bg-[#0a0a0a]">
                        <div className="flex justify-between text-xs text-gray-500 font-mono mb-2">
                            <span>{startTime.toFixed(1)}s</span>
                            <span className={Number(trimDuration) > 15 ? "text-red-500 font-bold" : "text-emerald-400"}>Crop Length: {trimDuration}s (Max 15s)</span>
                            <span>{endTime.toFixed(1)}s</span>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 uppercase tracking-widest block mb-1">Start Time</label>
                                <input
                                    type="range"
                                    min="0" max={duration} step="0.1"
                                    value={startTime}
                                    onChange={(e) => handleStartChange(parseFloat(e.target.value))}
                                    className="w-full accent-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 uppercase tracking-widest block mb-1">End Time</label>
                                <input
                                    type="range"
                                    min="0" max={duration} step="0.1"
                                    value={endTime}
                                    onChange={(e) => handleEndChange(parseFloat(e.target.value))}
                                    className="w-full accent-rose-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Configurations Panel */}
                <div className="w-full md:w-96 flex flex-col bg-[#111]">
                    {/* Header */}
                    <div className="p-6 pb-4 border-b border-white/5 flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-orange-500/20 text-orange-500">
                            <Scissors className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white leading-tight">Clip Studio</h2>
                            <p className="text-xs text-gray-500">AMV & TikTok Toolkit.</p>
                        </div>
                    </div>

                    {/* Scrollable Settings */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                        {/* Format Switcher */}
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-3">Output Format</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => setFormat('mp4')}
                                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all ${format === 'mp4' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-black/50 border-white/5 text-gray-500 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <Play className="w-4 h-4" /> <span className="text-xs">16:9 MP4</span>
                                </button>
                                <button
                                    onClick={() => setFormat('mobile')}
                                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all ${format === 'mobile' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-black/50 border-white/5 text-gray-500 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <Smartphone className="w-4 h-4" /> <span className="text-xs">9:16 TikTok</span>
                                </button>
                                <button
                                    onClick={() => setFormat('gif')}
                                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all ${format === 'gif' ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-400' : 'bg-black/50 border-white/5 text-gray-500 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <ImageIcon className="w-4 h-4" /> <span className="text-xs">HQ GIF</span>
                                </button>
                            </div>
                        </div>

                        {/* Video FX Suite */}
                        {format !== 'gif' && (
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-3">Video FX</label>
                                <div className="space-y-2">
                                    <label className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                                        <span className="text-sm text-gray-300">4K Lanczos Upscale</span>
                                        <input type="checkbox" checked={quality === 'upscale'} onChange={e => setQuality(e.target.checked ? 'upscale' : 'standard')} className="accent-orange-500 w-4 h-4" />
                                    </label>
                                    <label className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                                        <span className="text-sm text-gray-300">60 FPS Interpolation</span>
                                        <input type="checkbox" checked={fps === 60} onChange={e => setFps(e.target.checked ? 60 : 24)} className="accent-orange-500 w-4 h-4" />
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Speed Control */}
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2 flex items-center justify-between">
                                <span>Playback Speed</span>
                                <span className={speed !== 1.0 ? "text-orange-500 font-bold" : "text-gray-500"}>{speed}x</span>
                            </label>
                            <input
                                type="range" min="0.5" max="2.0" step="0.25"
                                value={speed}
                                onChange={e => setSpeed(parseFloat(e.target.value))}
                                className="w-full accent-orange-500"
                            />
                            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                                <span>Slow-mo</span>
                                <span>Normal</span>
                                <span>Fast</span>
                            </div>
                        </div>

                        {/* Audio FX */}
                        {format !== 'gif' && (
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-3">Audio Mastering</label>
                                <select
                                    value={audioEffect}
                                    onChange={e => setAudioEffect(e.target.value as AudioEffect)}
                                    className="w-full bg-black border border-white/10 text-white p-3 text-sm rounded-lg focus:outline-none focus:border-orange-500 transition-colors"
                                >
                                    <option value="none">Original Audio</option>
                                    <option value="normalize">Normalize (Clear Dialogue)</option>
                                    <option value="bass_boost">Bass Boost (Epic AMV)</option>
                                </select>
                            </div>
                        )}

                        {/* Meme Text */}
                        <div className={format === 'gif' ? 'opacity-100' : 'opacity-50'}>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-3 flex items-center gap-2">
                                <Type className="w-3 h-3" /> Meme Generator Text
                            </label>
                            <input
                                type="text"
                                placeholder={format === 'gif' ? "Impact font overlay..." : "Only for GIF mode"}
                                value={memeText}
                                onChange={e => setMemeText(e.target.value)}
                                maxLength={60}
                                disabled={format !== 'gif'}
                                className="w-full bg-black border border-white/10 text-white p-3 text-sm rounded-lg focus:outline-none focus:border-fuchsia-500 transition-colors disabled:cursor-not-allowed"
                            />
                        </div>
                    </div>

                    {/* Action Block */}
                    <div className="p-6 pt-4 bg-[#0a0a0a] border-t border-white/5 relative">
                        {/* Progress Bar Overlay */}
                        {isProcessing && (
                            <div className="absolute top-0 left-0 w-full h-1 bg-white/10 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-orange-500 to-fuchsia-500 transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg mb-4 text-center">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleCreate}
                            disabled={isProcessing || Number(trimDuration) > 15 || Number(trimDuration) <= 0}
                            className="w-full bg-white hover:bg-gray-200 text-black font-black uppercase tracking-wider py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                        >
                            {isProcessing ? (
                                <span className="flex items-center gap-2 z-10 relative">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {Math.round(progress)}% - RENDERING...
                                </span>
                            ) : (
                                <><Download className="w-5 h-5 group-hover:translate-y-1 transition-transform" /> Create & Download</>
                            )}

                            {/* Inner progress fill for the button */}
                            {isProcessing && (
                                <div
                                    className="absolute left-0 top-0 h-full bg-orange-500/30 transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            )}
                        </button>

                        <button
                            onClick={handleExtractAudio}
                            disabled={isProcessing}
                            className="w-full mt-3 border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 uppercase text-xs font-bold tracking-widest py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Music className="w-4 h-4" /> Extract Audio Only (MP3)
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
