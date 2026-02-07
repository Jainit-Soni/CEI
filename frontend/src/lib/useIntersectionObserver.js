"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useIntersectionObserver - Custom hook for scroll-triggered reveal animations
 * 
 * @param {Object} options - IntersectionObserver options
 * @param {number} options.threshold - Visibility threshold (0-1)
 * @param {string} options.rootMargin - Margin around root
 * @param {boolean} options.triggerOnce - Only trigger once
 * @returns {[React.RefObject, boolean]} - [ref to attach, isVisible state]
 * 
 * Usage:
 * const [ref, isVisible] = useIntersectionObserver({ threshold: 0.1 });
 * return <div ref={ref} className={isVisible ? "revealed" : ""}>Content</div>
 */
export function useIntersectionObserver({
    threshold = 0.1,
    rootMargin = "0px 0px -50px 0px",
    triggerOnce = true,
} = {}) {
    const ref = useRef(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        // Skip animation for reduced motion
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            // eslint-disable-next-line
            setIsVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    if (triggerOnce) {
                        observer.unobserve(element);
                    }
                } else if (!triggerOnce) {
                    setIsVisible(false);
                }
            },
            { threshold, rootMargin }
        );

        observer.observe(element);

        return () => {
            observer.unobserve(element);
        };
    }, [threshold, rootMargin, triggerOnce]);

    return [ref, isVisible];
}

/**
 * useStaggeredReveal - Hook for staggered reveal of multiple children
 * 
 * @param {number} itemCount - Number of items to reveal
 * @param {Object} options - Observer options plus stagger delay
 * @returns {[React.RefObject, boolean[]]} - [container ref, array of visibility states]
 */
export function useStaggeredReveal(itemCount, {
    threshold = 0.1,
    rootMargin = "0px 0px -50px 0px",
    staggerDelay = 100,
} = {}) {
    const containerRef = useRef(null);
    const [visibleItems, setVisibleItems] = useState(
        Array(itemCount).fill(false)
    );
    const revealedRef = useRef(false);
    const [containerVisible, setContainerVisible] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Skip animation for reduced motion
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setVisibleItems(Array(itemCount).fill(true));
            setContainerVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !revealedRef.current) {
                    revealedRef.current = true;
                    setContainerVisible(true);
                    observer.unobserve(container);

                    // Stagger reveal each item
                    for (let i = 0; i < itemCount; i++) {
                        setTimeout(() => {
                            setVisibleItems((prev) => {
                                const next = [...prev];
                                next[i] = true;
                                return next;
                            });
                        }, i * staggerDelay);
                    }
                }
            },
            { threshold, rootMargin }
        );

        observer.observe(container);

        return () => {
            observer.unobserve(container);
        };
    }, [itemCount, threshold, rootMargin, staggerDelay]);

    return [containerRef, visibleItems];
}

/**
 * RevealOnScroll - Component wrapper for easy scroll reveal
 * 
 * Usage:
 * <RevealOnScroll>
 *   <div>This content will fade in on scroll</div>
 * </RevealOnScroll>
 */
export function RevealOnScroll({
    children,
    className = "",
    delay = 0,
    threshold = 0.1,
    as: Component = "div",
}) {
    const [ref, isVisible] = useIntersectionObserver({ threshold });

    const style = delay > 0 ? { transitionDelay: `${delay}ms` } : undefined;

    return (
        <Component
            ref={ref}
            className={`reveal ${isVisible ? "revealed" : ""} ${className}`}
            style={style}
        >
            {children}
        </Component>
    );
}

export default useIntersectionObserver;
