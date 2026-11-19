import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Sparkles, X } from 'lucide-react';

const SLIDES = [
  {
    src: '/carousel/slide-1.png',
    tag: 'On-Campus',
    title: 'Pre-Placement Talks',
    subtitle: 'Direct company briefings and role walkthroughs on campus',
  },
  {
    src: '/carousel/slide-2.png',
    tag: 'Live Rounds',
    title: 'Technical & HR Rounds',
    subtitle: 'Structured interview panels tracked across every stage',
  },
  {
    src: '/carousel/slide-3.png',
    tag: 'Prep Hub',
    title: 'Coding & Innovation Labs',
    subtitle: 'Collaborative prep for online assessments and hackathons',
  },
  {
    src: '/carousel/slide-4.png',
    tag: '2027 Batch',
    title: 'Graduating Cohorts',
    subtitle: 'Connecting eligible students with top recruiting teams',
  },
];

export default function CampusGallery() {
  const [activeIndex, setActiveIndex] = useState(null);
  const [seen, setSeen] = useState(false);
  const sectionRef = useRef(null);
  const closeRef = useRef(null);

  // Fade the section in once it scrolls into view.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !('IntersectionObserver' in window)) {
      setSeen(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Lightbox: keyboard navigation, scroll lock, initial focus.
  useEffect(() => {
    if (activeIndex === null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setActiveIndex(null);
      if (e.key === 'ArrowRight') setActiveIndex((i) => (i + 1) % SLIDES.length);
      if (e.key === 'ArrowLeft') setActiveIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [activeIndex]);

  const activeSlide = activeIndex !== null ? SLIDES[activeIndex] : null;
  // Two copies make the -50% loop seamless.
  const items = [...SLIDES, ...SLIDES];

  return (
    <>
      <section
        ref={sectionRef}
        aria-labelledby="gallery-heading"
        className={`cc-reveal relative isolate overflow-hidden py-14 ${seen ? 'cc-reveal-in' : ''}`}
      >
        {/* Ambient theme-colored glow */}
        <div aria-hidden="true" className="cc-glow -left-24 top-8 h-72 w-72" />
        <div
          aria-hidden="true"
          className="cc-glow -right-20 bottom-4 h-80 w-80"
          style={{ animationDelay: '-6s' }}
        />

        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <span className="pill inline-flex items-center gap-2 bg-prit text-pri">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pri opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-pri" />
            </span>
            <Sparkles size={12} aria-hidden="true" /> Campus Life
          </span>
          <h2 id="gallery-heading" className="mt-3 text-3xl font-extrabold sm:text-4xl">
            Campus &amp; Placement <span className="cc-grad-text">Highlights</span>
          </h2>
          <p className="mt-2 max-w-xl text-sm text-mute sm:text-base">
            From pre-placement sessions to final offers, all in one unified workflow.
          </p>
          <p className="mt-3 hidden text-xs font-medium text-mute sm:block">
            Hover to pause &middot; Click a card to enlarge
          </p>
        </div>

        <div className="cc-gal mt-8">
          <div className="cc-gal-mask">
            <ul className="cc-gal-track m-0 p-0">
              {items.map((item, idx) => {
                const slideIdx = idx % SLIDES.length;
                const isClone = idx >= SLIDES.length;
                return (
                  <li key={`${item.title}-${idx}`} aria-hidden={isClone ? 'true' : undefined}>
                    <button
                      type="button"
                      tabIndex={isClone ? -1 : 0}
                      aria-label={`Open ${item.title}`}
                      onClick={() => setActiveIndex(slideIdx)}
                      className="cc-gal-card group relative block aspect-[4/5] w-64 overflow-hidden rounded-2xl border border-line bg-surf text-left shadow-md transition duration-500 hover:-translate-y-2 hover:border-pri hover:shadow-[0_24px_60px_-24px_var(--pri)] sm:w-72"
                    >
                      <img
                        src={item.src}
                        alt=""
                        loading="lazy"
                        draggable="false"
                        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110"
                      />
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                      />

                      <span className="pill absolute left-3 top-3 bg-prit text-pri shadow-sm">
                        {item.tag}
                      </span>
                      <span
                        aria-hidden="true"
                        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition duration-300 group-hover:opacity-100"
                      >
                        <Maximize2 size={14} />
                      </span>

                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <p className="text-xs font-bold tracking-widest text-white/60">
                          {String(slideIdx + 1).padStart(2, '0')}
                        </p>
                        <h3 className="mt-0.5 text-lg font-bold leading-snug text-white">
                          {item.title}
                        </h3>
                        <div className="cc-gal-sub">
                          <div>
                            <p className="pt-1.5 text-sm text-white/80">{item.subtitle}</p>
                          </div>
                        </div>
                        <span
                          aria-hidden="true"
                          className="mt-3 block h-0.5 w-8 rounded-full bg-pri transition-all duration-500 group-hover:w-full"
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {activeSlide && (
        <div
          className="cc-fade fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lightbox-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveIndex(null);
          }}
        >
          <div className="cc-pop w-full max-w-3xl overflow-hidden rounded-2xl border border-line bg-surf shadow-2xl">
            <div className="relative">
              <img
                key={activeIndex}
                src={activeSlide.src}
                alt={activeSlide.title}
                className="cc-fade max-h-[65vh] w-full object-cover"
              />
              <button
                ref={closeRef}
                type="button"
                aria-label="Close preview"
                onClick={() => setActiveIndex(null)}
                className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white backdrop-blur transition hover:bg-black/80"
              >
                <X size={18} />
              </button>
              <button
                type="button"
                aria-label="Previous highlight"
                onClick={() => setActiveIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur transition hover:scale-110 hover:bg-black/80"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                aria-label="Next highlight"
                onClick={() => setActiveIndex((i) => (i + 1) % SLIDES.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur transition hover:scale-110 hover:bg-black/80"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <span className="pill bg-prit text-pri">{activeSlide.tag}</span>
                <h3 id="lightbox-title" className="mt-2 text-lg font-bold text-ink">
                  {activeSlide.title}
                </h3>
                <p className="mt-0.5 text-sm text-mute">{activeSlide.subtitle}</p>
              </div>
              <div className="flex items-center gap-1.5" aria-label={`Slide ${activeIndex + 1} of ${SLIDES.length}`}>
                {SLIDES.map((s, i) => (
                  <button
                    key={s.title}
                    type="button"
                    aria-label={`Go to ${s.title}`}
                    onClick={() => setActiveIndex(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === activeIndex ? 'w-6 bg-pri' : 'w-2 bg-line hover:bg-mute'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}