import { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";

// Декоративный фон. Не грузим движок частиц, если пользователь просит меньше
// движения или устройство без точного указателя (телефон: лишняя нагрузка на CPU).
const shouldAnimate = () =>
    typeof window !== 'undefined' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export default function CyberpunkParticles() {
    const [init, setInit] = useState(false);

    useEffect(() => {
        if (!shouldAnimate()) return;
        initParticlesEngine(async (engine) => {
            await loadFull(engine);
        }).then(() => {
            setInit(true);
        });
    }, []);

    const particlesLoaded = async () => {
        // console.log(container);
    };

    if (!init) {
        return null;
    }

    return (
        <Particles
            aria-hidden="true"
            id="tsparticles"
            particlesLoaded={particlesLoaded}
            options={{
                background: {
                    color: {
                        value: "transparent",
                    },
                },
                fpsLimit: 60,
                interactivity: {
                    events: {
                        onHover: {
                            enable: true,
                            mode: "grab",
                        },
                        resize: {
                            enable: true
                        },
                    },
                    modes: {
                        grab: {
                            distance: 140,
                            links: {
                                opacity: 1
                            }
                        }
                    },
                },
                particles: {
                    color: {
                        value: ["#ff0055", "#00d2ff", "#7a00ff"],
                    },
                    links: {
                        color: "#00d2ff",
                        distance: 150,
                        enable: true,
                        opacity: 0.2,
                        width: 1,
                    },
                    move: {
                        direction: "none",
                        enable: true,
                        outModes: {
                            default: "bounce",
                        },
                        random: false,
                        speed: 1,
                        straight: false,
                    },
                    number: {
                        density: {
                            enable: true,
                            width: 800,
                            height: 800
                        },
                        value: 60,
                    },
                    opacity: {
                        value: 0.4,
                    },
                    shape: {
                        type: "circle",
                    },
                    size: {
                        value: { min: 1, max: 3 },
                    },
                },
                detectRetina: true,
            }}
            className="absolute inset-0 pointer-events-none z-0 mix-blend-screen"
        />
    );
}
