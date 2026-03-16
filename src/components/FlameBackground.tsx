'use client';

import { useEffect, useState } from 'react';

const NUM_PARTICLES = 30;

export default function FlameBackground() {
    const [particles, setParticles] = useState<Array<{
        id: number; left: string; size: number; duration: number; delay: number;
        drift: number; opacity: number;
    }>>([]);

    useEffect(() => {
        const newParticles = Array.from({ length: NUM_PARTICLES }).map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            size: Math.random() * 4 + 2,
            duration: Math.random() * 10 + 10,
            delay: Math.random() * 10,
            drift: Math.random() * 50 - 25,
            opacity: 0.5 + Math.random() * 0.3,
        }));
        setParticles(newParticles);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Ambient Glow */}
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-orange-900/20 to-transparent opacity-50" />

            {/* Rising Embers — pure CSS */}
            {particles.map((particle) => (
                <div
                    key={particle.id}
                    className="flame-particle"
                    style={{
                        position: 'absolute',
                        left: particle.left,
                        bottom: '-5%',
                        width: particle.size,
                        height: particle.size,
                        borderRadius: '50%',
                        backgroundColor: '#fb923c',
                        '--flame-drift': `${particle.drift}px`,
                        '--flame-travel': '-120vh',
                        '--flame-opacity': particle.opacity,
                        '--flame-duration': `${particle.duration}s`,
                        '--flame-delay': `${particle.delay}s`,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
}
