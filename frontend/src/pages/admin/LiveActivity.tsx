import { useEffect, useState, useRef } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import { Activity } from 'lucide-react';
import { useLiveActivity } from '../../context/LiveActivityContext';


interface GlobeArc {
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    color: string[];
    label: string;
}
export default function LiveActivity() {
    const globeEl = useRef<GlobeMethods | undefined>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);
    const { streamEvents } = useLiveActivity();
    const [arcsData, setArcsData] = useState<GlobeArc[]>([]);
    const [globeWidth, setGlobeWidth] = useState<number>(800);
    const prevEventsLength = useRef<number>(0);

    // Dynamic resizing
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setGlobeWidth(containerRef.current.clientWidth);
            }
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    // Watch for new stream events to generate arcs
    useEffect(() => {
        if (streamEvents.length > prevEventsLength.current) {
            // New events were added!
            // Assuming streamEvents is Prepended (newest first) in context, but to be robust 
            // we'll just take the top difference
            const diffCount = streamEvents.length - prevEventsLength.current;
            const newEvents = streamEvents.slice(0, diffCount);

            const serverLocation = { lat: 35.6762, lng: 139.6503 }; // Tokyo

            newEvents.forEach(evt => {
                const newArc = {
                    startLat: serverLocation.lat,
                    startLng: serverLocation.lng,
                    endLat: evt.lat,
                    endLng: evt.lng,
                    color: ['#00e5ff', '#b400ff'], // Neon cyan to purple
                    label: evt.anime_title,
                };

                setArcsData(prev => [...prev, newArc]);
                setTimeout(() => {
                    setArcsData(current => current.filter(arc => arc !== newArc));
                }, 3000);
            });
        }
        prevEventsLength.current = streamEvents.length;
    }, [streamEvents]);

    // Globe automatic rotation logic
    useEffect(() => {
        if (globeEl.current) {
            const g = globeEl.current;
            g.controls().autoRotate = true;
            g.controls().autoRotateSpeed = 1.0;
            // Center the globe and zoom out slightly
            g.pointOfView({ lat: 0, lng: 0, altitude: 2.2 }, 0);
        }
    }, [globeWidth]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <Activity className="w-8 h-8 text-cyan-400" />
                    The Command Center
                </h2>
                <p className="text-gray-400">Real-time global stream activity tracking via WebSockets & WebGL.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* Globe View */}
                <div className="lg:col-span-3 bg-[#0a0a0b] border border-white/5 rounded-2xl overflow-hidden relative" style={{ height: '700px' }}>

                    <div ref={containerRef} className="absolute inset-0 cursor-move flex items-center justify-center">
                        <Globe
                            ref={globeEl}
                            width={globeWidth}
                            height={700}
                            // Use a highly realistic night Earth map with city lights
                            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
                            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
                            backgroundColor="rgba(0,0,0,0)"
                            showAtmosphere={true}
                            atmosphereColor="#3a228a"
                            atmosphereAltitude={0.15}

                            // Render arcs for stream connections
                            arcsData={arcsData}
                            arcColor="color"
                            arcDashLength={0.4}
                            arcDashGap={0.2}
                            arcDashAnimateTime={1500}
                            arcStroke={1.5}

                            // Points for destination markers
                            pointsData={streamEvents}
                            pointColor={() => '#00e5ff'}
                            pointAltitude={0.05}
                            pointRadius={0.5}
                            pointsMerge={true}
                        />
                    </div>

                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-cyan-500/30 flex items-center gap-2 pointer-events-none">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                        </span>
                        <span className="text-cyan-400 font-bold text-sm tracking-widest uppercase">Live Connection Active</span>
                    </div>
                </div>

                {/* Live Feed Event Log */}
                <div className="bg-[#111] border border-white/10 rounded-xl p-6 flex flex-col">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 border-b border-white/10 pb-4">
                        Live Stream Feed
                    </h3>

                    <div className="flex-1 overflow-y-auto space-y-3">
                        {streamEvents.length === 0 ? (
                            <p className="text-gray-500 text-sm italic text-center mt-10">Waiting for global streams...</p>
                        ) : (
                            streamEvents.map((ev, idx) => (
                                <div key={idx} className="bg-white/5 border border-white/10 p-3 rounded-lg flex flex-col gap-1 animate-in slide-in-from-top-2 fade-in duration-300">
                                    <div className="flex justify-between items-start">
                                        <span className="text-cyan-400 font-bold text-sm">{ev.anime_title}</span>
                                        <span className="text-xs text-gray-500">Just now</span>
                                    </div>
                                    <div className="text-xs text-gray-400 flex justify-between">
                                        <span>Geo-Ping Received</span>
                                        <span className="font-mono text-cyan-500/70">{ev.lat.toFixed(2)}, {ev.lng.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
