import { useState, useEffect } from 'react';
import { Settings2, Search, Zap, Star, Calendar, Eye, Save, Activity, CheckCircle2 } from 'lucide-react';
import api from '../../api/client';

interface Weights {
    tag_match_weight: number;
    year_proximity_weight: number;
    rating_weight: number;
    popularity_weight: number;
    min_rating_threshold: number;
}

interface DebugResult {
    user_id: number;
    status: string;
    top_user_tags: { name: string; affinity: number }[];
    weights_used: Record<string, number>;
    recommendations: {
        anime_id: number;
        title: string;
        final_score: number;
        breakdown: Record<string, string>;
    }[];
}

export default function RecommendationTuning() {
    const [weights, setWeights] = useState<Weights | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Debugger state
    const [debugUserId, setDebugUserId] = useState<string>('');
    const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
    const [isDebugging, setIsDebugging] = useState(false);

    useEffect(() => {
        const loadWeights = async () => {
            try {
                const res = await api.get('/admin/recommendations/config');
                setWeights(res.data);
            } catch (err) {
                console.error("Failed to load weights", err);
            }
        };
        loadWeights();
    }, []);

    const handleSaveWeights = async () => {
        if (!weights) return;
        setIsSaving(true);
        try {
            await api.post('/admin/recommendations/config', weights);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            console.error("Failed to save weights", err);
            alert("Failed to save weights. Ensure total weight > 0.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDebug = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!debugUserId) return;

        setIsDebugging(true);
        try {
            const res = await api.get(`/admin/recommendations/debug/${debugUserId}`);
            setDebugResult(res.data);
        } catch (err) {
            console.error("Failed to debug user", err);
            alert("Error running debugger. User might not exist.");
        } finally {
            setIsDebugging(false);
        }
    };

    if (!weights) return <div>Loading Tuning Matrix...</div>;

    // Calculate sum of main 4 weights to show warning if it exceeds 100% too much, though technically our algorithm handles relative weights fine.
    const totalWeight = weights.tag_match_weight + weights.year_proximity_weight + weights.rating_weight + weights.popularity_weight;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <Settings2 className="w-8 h-8 text-blue-500" />
                    Recommendation Engine Tuning
                </h2>
                <p className="text-gray-400">Tweak the ML algorithm weights that powers the "For You" feeds.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Panel 1: The Sliders */}
                <div className="bg-[#111] border border-white/10 rounded-xl p-6 h-fit">
                    <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                        <h3 className="text-xl font-bold text-white uppercase flex items-center gap-2">
                            <Activity className="w-5 h-5 text-emerald-500" />
                            Algorithm Weights
                        </h3>
                        {/* Overall balance indicator */}
                        <div className={`px-3 py-1 text-xs font-bold rounded-full ${totalWeight > 1.2 ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            Sys Sum: {(totalWeight * 100).toFixed(0)}%
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Tag Match */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-purple-400" /> Tag Affinity Match
                                </label>
                                <span className="text-sm font-mono text-purple-400">{(weights.tag_match_weight * 100).toFixed(0)}%</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={weights.tag_match_weight}
                                onChange={e => setWeights({ ...weights, tag_match_weight: parseFloat(e.target.value) })}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                            <p className="text-xs text-gray-500">How much user's watch history genres should match the anime's genres.</p>
                        </div>

                        {/* Rating */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                    <Star className="w-4 h-4 text-orange-400" /> Site Rating
                                </label>
                                <span className="text-sm font-mono text-orange-400">{(weights.rating_weight * 100).toFixed(0)}%</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={weights.rating_weight}
                                onChange={e => setWeights({ ...weights, rating_weight: parseFloat(e.target.value) })}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                            />
                            <p className="text-xs text-gray-500">Importance of the anime's overall site rating (1-10).</p>
                        </div>

                        {/* Year Proximity */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-400" /> Release Freshness
                                </label>
                                <span className="text-sm font-mono text-blue-400">{(weights.year_proximity_weight * 100).toFixed(0)}%</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={weights.year_proximity_weight}
                                onChange={e => setWeights({ ...weights, year_proximity_weight: parseFloat(e.target.value) })}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <p className="text-xs text-gray-500">Prioritize newer releases over older classics.</p>
                        </div>

                        {/* Popularity */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-emerald-400" /> Global Views
                                </label>
                                <span className="text-sm font-mono text-emerald-400">{(weights.popularity_weight * 100).toFixed(0)}%</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={weights.popularity_weight}
                                onChange={e => setWeights({ ...weights, popularity_weight: parseFloat(e.target.value) })}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <p className="text-xs text-gray-500">Tendency to recommend what everyone else is currently watching.</p>
                        </div>

                        <div className="pt-4 border-t border-white/10">
                            <label className="text-sm font-medium text-gray-300 block mb-2">Hard Minimum Rating Threshold</label>
                            <input
                                type="number" step="0.1" min="0" max="10"
                                value={weights.min_rating_threshold}
                                onChange={e => setWeights({ ...weights, min_rating_threshold: parseFloat(e.target.value) })}
                                className="bg-black border border-white/10 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            />
                            <p className="text-xs text-gray-500 mt-1">Never recommend anime below this rating, regardless of tag match.</p>
                        </div>

                        <button
                            onClick={handleSaveWeights}
                            disabled={isSaving}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${saveSuccess
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                        >
                            {saveSuccess ? (
                                <><CheckCircle2 className="w-5 h-5" /> Saved & Deployed Live</>
                            ) : (
                                <><Save className="w-5 h-5" /> Deploy Algorithm Config</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Panel 2: The Debugger */}
                <div className="bg-[#111] border border-white/10 rounded-xl p-6 flex flex-col h-[700px]">
                    <h3 className="text-xl font-bold text-white uppercase mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                        <Search className="w-5 h-5 text-gray-400" />
                        Tracer Debugger
                    </h3>

                    <form onSubmit={handleDebug} className="flex gap-2 mb-6">
                        <input
                            type="number"
                            placeholder="Enter User ID..."
                            value={debugUserId}
                            onChange={(e) => setDebugUserId(e.target.value)}
                            className="bg-black border border-white/10 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 flex-1 p-2.5"
                            required
                        />
                        <button
                            type="submit"
                            disabled={isDebugging}
                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                            {isDebugging ? 'Tracing...' : 'Run Trace'}
                        </button>
                    </form>

                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/50 p-4 rounded-lg border border-white/5 space-y-6">
                        {!debugResult ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <Zap className="w-12 h-12 mb-2 opacity-20" />
                                <span>Input a User ID to see exactly why algorithms recommend what they do.</span>
                                <span>(Hint: try user ID 1 or 2)</span>
                            </div>
                        ) : (
                            <>
                                {/* User Profile */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Compiled User Profile</h4>
                                    {debugResult.top_user_tags.length === 0 ? (
                                        <div className="text-sm text-yellow-500 bg-yellow-500/10 p-2 rounded">No watch history. Cold Start mechanism active.</div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {debugResult.top_user_tags.map(tag => (
                                                <span key={tag.name} className="bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded border border-purple-500/30">
                                                    {tag.name} <span className="opacity-50 blur-[0.2px]">{(tag.affinity * 100).toFixed(0)}%</span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Results Trace */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Live Recommendation Trace (Top 10)</h4>
                                    <div className="space-y-3">
                                        {debugResult.recommendations.map((rec, idx) => (
                                            <div key={rec.anime_id} className="bg-[#1a1a1a] p-3 rounded-lg border border-white/5">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-bold text-white text-sm">#{idx + 1} {rec.title}</span>
                                                    <span className="bg-blue-500/20 text-blue-400 text-xs font-mono px-2 py-1 rounded">Score: {rec.final_score}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-xs font-mono text-gray-400">
                                                    <div className="truncate"><span className="text-purple-400">Tag:</span> {rec.breakdown.tag_match}</div>
                                                    <div className="truncate"><span className="text-orange-400">Rtg:</span> {rec.breakdown.rating}</div>
                                                    <div className="truncate"><span className="text-blue-400">Age:</span> {rec.breakdown.year_proximity}</div>
                                                    <div className="truncate"><span className="text-emerald-400">Pop:</span> {rec.breakdown.popularity}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
