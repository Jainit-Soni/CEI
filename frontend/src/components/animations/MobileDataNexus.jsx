"use client";

import React, { useRef, useEffect } from 'react';

export default function MobileDataNexus({ scrollProgress = 0 }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d'); // Transparent to let CSS Gradient shine

        // Handle strict Retina scaling
        const dpr = window.devicePixelRatio || 1;
        let width, height;

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);
        };
        resize();
        window.addEventListener('resize', resize);

        // Core Matrix Variables
        const nodes = [];
        const nodeCount = 40; // Extremely lightweight for mobile
        const connectionDistance = 150;

        // Colors extracted from brand palette
        const colors = ['#ec4899', '#8b5cf6', '#4f46e5', '#0ea5e9'];

        // Initialize Nodes
        for (let i = 0; i < nodeCount; i++) {
            nodes.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.5, // Slow, deliberate drift
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 2 + 1,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }

        let animationFrameId;

        const render = () => {
            // Clear canvas completely to keep premium CSS animated gradients visible
            ctx.clearRect(0, 0, width, height);

            // Calculate global shift based on scroll (Parallax effect)
            const scrollShiftY = scrollProgress * 200; // Parallax distance

            ctx.save();
            ctx.translate(0, -scrollShiftY);

            // Draw connections first (behind nodes)
            for (let i = 0; i < nodeCount; i++) {
                const nodeA = nodes[i];
                for (let j = i + 1; j < nodeCount; j++) {
                    const nodeB = nodes[j];

                    const dx = nodeA.x - nodeB.x;
                    const dy = nodeA.y - nodeB.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < connectionDistance) {
                        // Dynamic opacity based on proximity
                        const opacity = (1 - (dist / connectionDistance)) * 0.4;
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(79, 70, 229, ${opacity + (scrollProgress * 0.3)})`; // Indigo tint, becomes more visible on scroll
                        ctx.lineWidth = 1;
                        ctx.moveTo(nodeA.x, nodeA.y);
                        ctx.lineTo(nodeB.x, nodeB.y);
                        ctx.stroke();
                    }
                }
            }

            // Update & Draw Nodes
            for (let i = 0; i < nodeCount; i++) {
                const node = nodes[i];

                // Drift logic
                node.x += node.vx;
                node.y += node.vy;

                // Bounce off soft boundaries (add extra height to account for parallax overflow)
                if (node.x < -50 || node.x > width + 50) node.vx *= -1;
                if (node.y < -50 || node.y > height + 300) node.vy *= -1;

                // Draw solid node
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                ctx.fillStyle = node.color;
                ctx.fill();

                // Draw subtle glow ring
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius * 3, 0, Math.PI * 2);
                ctx.fillStyle = `${node.color}20`; // Hex transparency
                ctx.fill();
            }

            ctx.restore();

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, [scrollProgress]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1
            }}
        />
    );
}
