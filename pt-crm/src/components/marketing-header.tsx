"use client";

import { useEffect, useState } from "react";
import { PublicSiteHeader } from "@/components/public-site-header";
import { TRAINER_SECTION_NAV } from "@/lib/site/copy";

export function MarketingHeader() {
  const [active, setActive] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sections = TRAINER_SECTION_NAV.map((n) =>
      document.getElementById(n.id)
    ).filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0)
          );
        if (visible[0]?.target?.id) {
          setActive(visible[0].target.id);
        }
      },
      {
        rootMargin: "-22% 0px -52% 0px",
        threshold: [0, 0.12, 0.3, 0.5],
      }
    );

    for (const el of sections) observer.observe(el);
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <PublicSiteHeader
      variant="marketing"
      scrolled={scrolled}
      sectionNav={TRAINER_SECTION_NAV}
      activeSectionId={active}
    />
  );
}
