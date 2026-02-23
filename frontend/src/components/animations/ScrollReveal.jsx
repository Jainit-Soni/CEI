import { useEffect, useRef, useMemo } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './ScrollReveal.css';

if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
}

const ScrollReveal = ({
    children,
    scrollContainerRef,
    enableBlur = true,
    baseOpacity = 0.1,
    baseRotation = 3,
    blurStrength = 4,
    containerClassName = '',
    textClassName = '',
    rotationEnd = 'bottom bottom',
    wordAnimationEnd = 'bottom bottom',
    as = 'h2' // Dynamic tag support
}) => {
    const containerRef = useRef(null);

    const splitText = useMemo(() => {
        const text = typeof children === 'string' ? children : '';
        return text.split(/(\s+)/).map((word, index) => {
            if (word.match(/^\s+$/)) return word;
            return (
                <span className="word" key={index}>
                    {word}
                </span>
            );
        });
    }, [children]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const scroller = (scrollContainerRef && scrollContainerRef.current) ? scrollContainerRef.current : window;

        // Use gsap.context for proper scoping and cleanup
        const ctx = gsap.context(() => {
            // We wait a tick to ensure the children (split text) are rendered
            const rafId = requestAnimationFrame(() => {
                const words = el.querySelectorAll('.word');
                if (!words || words.length === 0) return;

                // Overall Container Animation
                gsap.fromTo(
                    el,
                    { transformOrigin: '0% 50%', rotate: baseRotation },
                    {
                        ease: 'none',
                        rotate: 0,
                        scrollTrigger: {
                            trigger: el,
                            scroller,
                            start: 'top bottom',
                            end: rotationEnd,
                            scrub: true,
                            invalidateOnRefresh: true,
                        }
                    }
                );

                // Individual Word Animations
                gsap.fromTo(
                    words,
                    { opacity: baseOpacity, willChange: 'opacity' },
                    {
                        ease: 'none',
                        opacity: 1,
                        stagger: 0.05,
                        scrollTrigger: {
                            trigger: el,
                            scroller,
                            start: 'top bottom-=20%',
                            end: wordAnimationEnd,
                            scrub: true,
                        }
                    }
                );

                if (enableBlur) {
                    gsap.fromTo(
                        words,
                        { filter: `blur(${blurStrength}px)` },
                        {
                            ease: 'none',
                            filter: 'blur(0px)',
                            stagger: 0.05,
                            scrollTrigger: {
                                trigger: el,
                                scroller,
                                start: 'top bottom-=20%',
                                end: wordAnimationEnd,
                                scrub: true,
                            }
                        }
                    );
                }
            });

            return () => cancelAnimationFrame(rafId);
        }, el);

        return () => {
            ctx.revert();
            // Deep cleanup of any orphaned triggers for this specific element
            ScrollTrigger.getAll().forEach(st => {
                const target = st.trigger || (st.vars && st.vars.trigger);
                if (target === el) {
                    st.kill();
                }
            });
        };
    }, [scrollContainerRef, enableBlur, baseRotation, baseOpacity, rotationEnd, wordAnimationEnd, blurStrength, children]);

    const Tag = as;

    return (
        <Tag ref={containerRef} className={`scroll-reveal ${containerClassName}`}>
            <span className={`scroll-reveal-text ${textClassName}`}>{splitText}</span>
        </Tag>
    );
};

export default ScrollReveal;
