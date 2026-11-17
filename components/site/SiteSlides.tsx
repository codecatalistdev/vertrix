'use client'

import { useEffect, useState } from 'react'

const SLIDES = [
  {
    src: '/site/room.jpg',
    alt: 'A dark glass room with a laptop and city lights',
    kicker: '01',
    title: 'The remote room is ready before the call.',
    body: 'A time, a link, and a seat. The remote interview is on the desk before anyone joins.',
  },
  {
    src: '/site/interview.jpg',
    alt: 'Two people talking across a light wood table',
    kicker: '02',
    title: 'A prepared person on the remote call.',
    body: 'The proxy interviewer joins from their own desk and takes only the calls assigned to them.',
  },
  {
    src: '/site/desk.jpg',
    alt: 'A laptop and a resume on a dark desk with a cyan light',
    kicker: '03',
    title: 'The remote role stays on the record.',
    body: 'Resume, note, and a result for intro, tech, final, and offer.',
  },
  {
    src: '/site/studio.jpg',
    alt: 'A bright modern meeting room with glass walls',
    kicker: '04',
    title: 'One slot. Two clocks.',
    body: 'Supporters place each remote interview on a Monday calendar. Central European time leads. US Eastern sits beside it.',
  },
  {
    src: '/site/office.jpg',
    alt: 'A long modern office corridor in dark blue',
    kicker: '05',
    title: 'One agency. Three seats.',
    body: 'Administrator, interview supporter, and proxy interviewer. Each one sees the work that belongs to them.',
  },
]

const RAIL = [
  { src: '/site/portrait.jpg', alt: 'A person with a laptop by a window' },
  { src: '/site/studio.jpg', alt: 'A sunlit meeting room' },
  { src: '/site/interview.jpg', alt: 'An interview across a table' },
  { src: '/site/office.jpg', alt: 'A dark modern office hall' },
  { src: '/site/desk.jpg', alt: 'A desk prepared for an interview' },
  { src: '/site/room.jpg', alt: 'A night-time interview room' },
]

export function SiteMarquee() {
  return (
    <div className="site-marquee" aria-hidden="true">
      <div>
        {Array.from({ length: 2 }, (_, copy) => (
          <p suppressHydrationWarning key={copy}>
            <span>Intro</span>
            <span>Tech</span>
            <span>Final</span>
            <span>Offer</span>
            <span>CET</span>
            <span>EST</span>
            <span>Passed</span>
            <span>Hold</span>
            <span>Waiting</span>
          </p>
        ))}
      </div>
    </div>
  )
}

export function SiteSlides({ start = 0, compact = false }: { start?: number; compact?: boolean }) {
  const [index, setIndex] = useState(start)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length)
    }, 5600)
    return () => window.clearInterval(timer)
  }, [paused])

  function step(direction: number) {
    setIndex((current) => (current + direction + SLIDES.length) % SLIDES.length)
  }

  return (
    <section className={compact ? 'site-show is-compact' : 'site-show'} aria-label="Vertrix in pictures">
      <div
        className="site-slider"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="site-slider-stage">
          {SLIDES.map((slide, slideIndex) => (
            <figure className={slideIndex === index ? 'is-on' : undefined} key={slide.src}>
              <img src={slide.src} alt={slide.alt} />
              <figcaption>
                <span>{slide.kicker}</span>
                <strong>{slide.title}</strong>
                <p suppressHydrationWarning>{slide.body}</p>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="site-slider-bar">
          <div className="site-progress" aria-hidden="true">
            <span key={paused ? `hold-${index}` : index} className={paused ? 'is-held' : undefined} />
          </div>
          <div className="site-slider-controls">
            <button type="button" onClick={() => step(-1)} aria-label="Previous slide">
              ‹
            </button>
            <div className="site-dots">
              {SLIDES.map((slide, slideIndex) => (
                <button
                  key={slide.src}
                  type="button"
                  className={slideIndex === index ? 'is-on' : undefined}
                  aria-label={`Show slide ${slideIndex + 1}`}
                  aria-current={slideIndex === index ? 'true' : undefined}
                  onClick={() => setIndex(slideIndex)}
                />
              ))}
            </div>
            <button type="button" onClick={() => step(1)} aria-label="Next slide">
              ›
            </button>
          </div>
        </div>
      </div>
      {compact ? null : (
        <div className="site-rail" aria-hidden="true">
          <div className="site-rail-track">
            {[...RAIL, ...RAIL].map((item, itemIndex) => (
              <img key={`${item.src}-${itemIndex}`} src={item.src} alt="" />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
