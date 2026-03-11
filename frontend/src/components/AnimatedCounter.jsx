"use client";
import { useEffect, useState } from 'react';

export default function AnimatedCounter({
    end,
    duration = 2000,
    prefix = "",
    suffix = "",
    className = ""
}) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);

            // Easing function: easeOutExpo
            const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

            setCount(Math.floor(easeProgress * end));

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                setCount(end); // Ensure exact finish
            }
        };

        window.requestAnimationFrame(step);
    }, [end, duration]);

    // Format with commas if over 999
    const formattedCount = count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return (
        <span className={`counter-number ${className}`}>
            {prefix}{formattedCount}{suffix}
        </span>
    );
}
