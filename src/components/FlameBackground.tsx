'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const NUM_PARTICLES = 30;

export default function FlameBackground() {
    const [particles, setParticles] = useState<Array<{ id: number; left: string; size: number; duration: number; delay: number }>>([]);

    useEffect(() => {
        // Generate random particles on client side only to avoid hydration mismatch
        const newParticles = Array.from({ length: NUM_PARTICLES }).map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            size: Math.random() * 4 + 2, // Size between 2px and 6px
            duration: Math.random() * 10 + 10, // Duration between 10s and 20s
            delay: Math.random() * 10,
        }));
        setParticles(newParticles);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Ambient Glow */}
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-orange-900/20 to-transparent opacity-50" />

            {/* Rising Embers */}
            {particles.map((particle) => (
                <motion.div
                    key={particle.id}
                    initial={{
                        opacity: 0,
                        y: '110vh',
                        x: 0
                    }}
                    animate={{
                        opacity: [0, 0.8, 0],
                        y: '-10vh',
                        x: [0, Math.random() * 50 - 25, Math.random() * 50 - 25] // Wiggle effect
                    }}
                    transition={{
                        duration: particle.duration,
                        repeat: Infinity,
                        delay: particle.delay,
                        ease: "linear"
                    }}
                    style={{
                        position: 'absolute',
                        left: particle.left,
                        width: particle.size,
                        height: particle.size,
                        borderRadius: '50%',
                        backgroundColor: '#fb923c', // orange-400
                        boxShadow: '0 0 10px #fb923c, 0 0 20px #c2410c', // glowing effect
                    }}
                />
            ))}
        </div>
    );
}
