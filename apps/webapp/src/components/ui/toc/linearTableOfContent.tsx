import React, { useState, useEffect, useRef, useCallback } from "react";

interface Heading {
  id: string;
  text: string;
  level: number;
  element: HTMLElement;
}

interface LinearTableOfContentProps {
  containerId: string;
  topOffset?: number;
}

export function LinearTableOfContent({
  containerId,
  topOffset = 100,
}: LinearTableOfContentProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, opacity: 0 });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const scrollRafRef = useRef<number | null>(null);
  const scrollRootRef = useRef<HTMLElement | Window | null>(null);

  useEffect(() => {
    const extractHeadings = () => {
      const contentEl = document.getElementById(containerId) as HTMLElement | null;
      if (!contentEl) return;

      const headingElements = Array.from(
        contentEl.querySelectorAll("h1, h2, h3, h4, h5, h6")
      ) as HTMLElement[];

      const extractedHeadings = headingElements.map((element, index) => {
        const id = element.id || `heading-${index}`;
        if (!element.id) {
          element.id = id;
        }
        return {
          id,
          text: element.textContent || "",
          level: parseInt(element.tagName.substring(1)),
          element,
        };
      });

      setHeadings(extractedHeadings);

      if (extractedHeadings.length > 0) {
        setActiveId(extractedHeadings[0].id);
      }
    };

    extractHeadings();
    const rafId = window.requestAnimationFrame(extractHeadings);
    let attempts = 0;
    let retryRafId: number;
    const retry = () => {
      attempts += 1;
      extractHeadings();
      const contentEl = document.getElementById(containerId) as HTMLElement | null;
      if (attempts >= 20 || contentEl?.querySelector("h1, h2, h3, h4, h5, h6")) {
        return;
      }
      retryRafId = window.requestAnimationFrame(retry);
    };
    retryRafId = window.requestAnimationFrame(retry);

    const observer = new MutationObserver(() => {
      extractHeadings();
    });
    const contentEl = document.getElementById(containerId) as HTMLElement | null;
    if (contentEl) {
      observer.observe(contentEl, { childList: true, subtree: true });
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.cancelAnimationFrame(retryRafId);
      observer.disconnect();
    };
  }, [containerId]);

  const handleScroll = useCallback(() => {
    if (headings.length === 0) return;

    if (scrollRafRef.current !== null) {
      window.cancelAnimationFrame(scrollRafRef.current);
    }

    scrollRafRef.current = window.requestAnimationFrame(() => {
      const contentEl = document.getElementById(containerId) as HTMLElement | null;
      if (!contentEl) return;

      const scrollRoot = scrollRootRef.current ?? window;
      const scrollTop = scrollRoot instanceof Window ? window.scrollY : scrollRoot.scrollTop;

      const upperBound = scrollTop + topOffset;
      let currentActive = headings[0];
      let withinRange: Heading | null = null;

      for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];
        const elementTop =
          heading.element.getBoundingClientRect().top +
          (scrollRoot instanceof Window ? window.scrollY : scrollRoot.scrollTop);

        if (elementTop >= scrollTop && elementTop <= upperBound) {
          withinRange = heading;
          break;
        }

        if (elementTop <= upperBound) {
          currentActive = heading;
        } else {
          break;
        }
      }

      if (withinRange) {
        currentActive = withinRange;
      }

      if (currentActive) {
        setActiveId(currentActive.id);
      }

      scrollRafRef.current = null;
    });
  }, [containerId, headings, topOffset]);

  useEffect(() => {
    handleScroll();
    const root = document.getElementById("app-scroll-root") ?? window;
    scrollRootRef.current = root;
    if (root instanceof Window) {
      window.addEventListener("scroll", handleScroll, { passive: true });
    } else {
      root.addEventListener("scroll", handleScroll, { passive: true });
    }
    return () => {
      if (root instanceof Window) {
        window.removeEventListener("scroll", handleScroll);
      } else {
        root.removeEventListener("scroll", handleScroll);
      }
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, [handleScroll]);

  useEffect(() => {
    const activeItem = itemRefs.current[activeId];
    if (activeItem) {
      setIndicatorStyle({
        top: activeItem.offsetTop,
        height: activeItem.offsetHeight,
        opacity: 1,
      });
    } else {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
    }
  }, [activeId, headings]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const root = scrollRootRef.current ?? window;
      const rootTop = root instanceof Window ? 0 : root.getBoundingClientRect().top;
      const currentScroll = root instanceof Window ? window.scrollY : root.scrollTop;
      const elementTop = element.getBoundingClientRect().top - rootTop + currentScroll;
      if (root instanceof Window) {
        window.scrollTo({ top: elementTop - topOffset, behavior: "smooth" });
      } else {
        root.scrollTo({ top: elementTop - topOffset, behavior: "smooth" });
      }
    }
  };

  if (headings.length === 0) return null;

  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <div className="relative text-sm dark:font-[300] max-w-[300px] w-full h-fit">
      <div
        ref={scrollContainerRef}
        className="max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-border" />

          <div
            className="absolute left-[-0.5px] w-[2px] bg-foreground transition-all duration-300 ease-in-out rounded-full"
            style={{
              top: `${indicatorStyle.top}px`,
              height: `${indicatorStyle.height}px`,
              opacity: indicatorStyle.opacity,
            }}
          />

          <ul className="flex flex-col relative list-none m-0 p-0">
            {headings.map((heading) => (
              <li
                key={heading.id}
                id={`toc-item-${heading.id}`}
                ref={(el) => {
                  itemRefs.current[heading.id] = el;
                }}
                className="relative"
              >
                <a
                  href={`#${heading.id}`}
                  onClick={(e) => handleClick(e, heading.id)}
                  className={`block py-1.5 transition-colors truncate hover:text-foreground ${
                    activeId === heading.id
                      ? "text-foreground font-medium"
                      : "text-foreground/60"
                  }`}
                  style={{
                    paddingLeft: `${(heading.level - minLevel) * 10 + 15}px`,
                  }}
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
