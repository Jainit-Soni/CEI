"use client";
import { useEffect, useRef, useState } from 'react';

export default function MotionReveal({
    children,
    animation = "fadeInUp",
    delay = 0,
    duration = 600,
    className = "",
    threshold = 0.1
}) {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    // Optional: Stop observing once revealed for one-time animation
                    if (ref.current) observer.unobserve(ref.current);
                }
            },
            {
                root: null,
                rootMargin: '50px',
                threshold: threshold,
            }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => {
            if (ref.current) observer.unobserve(ref.current);
        };
    }, [threshold]);

    const style = {
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: 'opacity, transform'
    };

    return (
        <div ref={ref} style={style} className={className}>
            {children}
        </div>
    );
}
