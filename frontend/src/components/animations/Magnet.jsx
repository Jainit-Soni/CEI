"use client";

import React, { useRef, useEffect } from "react";
import { gsap } from "gsap";

export default function Magnet({ children, strength = 40, className = "" }) {
    const magnetRef = useRef(null);

    useEffect(() => {
        const magnet = magnetRef.current;
        if (!magnet) return;

        const handleMouseMove = (e) => {
            const { clientX, clientY } = e;
            const { left, top, width, height } = magnet.getBoundingClientRect();
            
            const centerX = left + width / 2;
            const centerY = top + height / 2;
            
            const distanceX = clientX - centerX;
            const distanceY = clientY - centerY;
            
            // Proximity check (only attract within 150px)
            const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);
            if (distance < 150) {
                gsap.to(magnet, {
                    x: (distanceX / width) * strength,
                    y: (distanceY / height) * strength,
                    duration: 0.4,
                    ease: "power2.out"
                });
            } else {
                gsap.to(magnet, {
                    x: 0,
                    y: 0,
                    duration: 0.6,
                    ease: "elastic.out(1, 0.3)"
                });
            }
        };

        const handleMouseLeave = () => {
            gsap.to(magnet, {
                x: 0,
                y: 0,
                duration: 0.8,
                ease: "elastic.out(1, 0.3)"
            });
        };

        window.addEventListener("mousemove", handleMouseMove);
        magnet.addEventListener("mouseleave", handleMouseLeave);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            magnet.removeEventListener("mouseleave", handleMouseLeave);
        };
    }, [strength]);

    return (
        <div ref={magnetRef} className={`inline-block transition-transform duration-75 ${className}`}>
            {children}
        </div>
    );
}
