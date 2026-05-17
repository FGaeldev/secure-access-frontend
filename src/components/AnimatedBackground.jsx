/**
 * @file AnimatedBackground.jsx
 * @description Four-column infinite carousel background.
 *              Fetches cosplay photos from Unsplash API on mount,
 *              distributes them across columns, then scrolls continuously.
 *
 * @env         VITE_UNSPLASH_ACCESS_KEY — Unsplash API access key
 */

import React, { useEffect, useState } from "react";

const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

const COLUMN_CONFIG = [
  { direction: "up",   speed: "18s" },
  { direction: "down", speed: "24s" },
  { direction: "up",   speed: "14s" },
  { direction: "down", speed: "20s" },
];

// ---------------------------------------------------------------------------
// AnimatedBackground
// ---------------------------------------------------------------------------

function AnimatedBackground() {
  const [columns, setColumns] = useState([[], [], [], []]);

  useEffect(() => {
    async function fetchPhotos() {
      try {
        // Fetch 24 cosplay photos — 6 per column
        const res = await fetch(
          `https://api.unsplash.com/search/photos?query=anime+cosplay&per_page=24&orientation=portrait&client_id=${ACCESS_KEY}`
        );
        const data = await res.json();
        const photos = data.results ?? [];

        if (photos.length === 0) return;

        // Distribute photos evenly across 4 columns
        const cols = [[], [], [], []];
        photos.forEach((photo, i) => {
          cols[i % 4].push({
            src:   photo.urls.small,
            alt:   photo.alt_description ?? "Cosplay photo",
            label: photo.tags?.[0]?.title ?? "Cosplay",
          });
        });

        setColumns(cols);
      } catch (err) {
        // Silently fail — background is decorative, page still works
        console.error("Unsplash fetch failed:", err);
      }
    }

    fetchPhotos();
  }, []);

  return (
    <>
      <style>{`
        @keyframes scroll-up {
          from { transform: translateY(0); }
          to   { transform: translateY(-50%); }
        }
        @keyframes scroll-down {
          from { transform: translateY(-50%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          overflow: "hidden",
          zIndex: 0,
        }}
      >
        {COLUMN_CONFIG.map((col, ci) => (
          <div key={ci} style={{ position: "relative", flex: 1, overflow: "hidden" }}>
            {columns[ci].length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "6px",
                  animation: `scroll-${col.direction} ${col.speed} linear infinite`,
                  willChange: "transform",
                }}
              >
                {/* Duplicate for seamless loop */}
                {[...columns[ci], ...columns[ci]].map((card, ki) => (
                  <CarouselCard key={ki} card={card} />
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Fade masks */}
        <div style={{
          position: "absolute", inset: "0 0 auto 0", height: 140, pointerEvents: "none",
          background: "linear-gradient(to bottom, #020817 0%, transparent 100%)",
        }} />
        <div style={{
          position: "absolute", inset: "auto 0 0 0", height: 140, pointerEvents: "none",
          background: "linear-gradient(to top, #020817 0%, transparent 100%)",
        }} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// CarouselCard
// ---------------------------------------------------------------------------

function CarouselCard({ card }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div style={{
      borderRadius: "10px",
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.08)",
      flexShrink: 0,
      position: "relative",
      aspectRatio: "3 / 4",
      background: "#0f172a", // placeholder color while image loads
    }}>
      <img
        src={card.src}
        alt={card.alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      />

      {/* Label gradient overlay */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        padding: "28px 10px 10px",
        background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)",
      }}>
        <span style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 10,
          fontWeight: 500,
          color: "#e2e8f0",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          {card.label}
        </span>
      </div>
    </div>
  );
}

export default AnimatedBackground;