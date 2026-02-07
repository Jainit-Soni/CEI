import { useEffect } from "react";

export default function useScrollReveal(selector = ".reveal") {
  useEffect(() => {
    const nodes = document.querySelectorAll(selector);
    if (!nodes.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [selector]);
}
