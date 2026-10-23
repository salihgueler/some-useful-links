"use client";

import { Globe2 } from "lucide-react";
import type { CountryCount } from "@/lib/services/interfaces/visit-tracker.interface";

/**
 * Where visits came from, as a ranked list and a dot map.
 *
 * The data behind this is day-granular and holds no IP address: CloudFront
 * resolves the country at the edge and only a two-letter code is ever stored.
 * "ZZ" means the CDN did not supply one, which also covers a deployment where
 * the header is not forwarded -- so the panel degrades to "Unknown" instead of
 * disappearing.
 *
 * The map is a genuine equirectangular projection of the centroids below, drawn
 * over a graticule rather than traced coastlines: an approximate hand-drawn
 * landmass reads as amateur, whereas a labelled dot grid is honest geometry.
 */

/** Country centroids, [latitude, longitude]. Unlisted codes still list, just unplotted. */
const CENTROIDS: Record<string, [number, number]> = {
  AE: [23.4, 53.8], AR: [-38.4, -63.6], AT: [47.5, 14.6], AU: [-25.3, 133.8],
  BE: [50.5, 4.5], BG: [42.7, 25.5], BR: [-14.2, -51.9], CA: [56.1, -106.3],
  CH: [46.8, 8.2], CL: [-35.7, -71.5], CN: [35.9, 104.2], CO: [4.6, -74.3],
  CZ: [49.8, 15.5], DE: [51.2, 10.5], DK: [56.3, 9.5], EE: [58.6, 25.0],
  EG: [26.8, 30.8], ES: [40.5, -3.7], FI: [61.9, 25.7], FR: [46.2, 2.2],
  GB: [55.4, -3.4], GR: [39.1, 21.8], HK: [22.4, 114.1], HR: [45.1, 15.2],
  HU: [47.2, 19.5], ID: [-0.8, 113.9], IE: [53.4, -8.2], IL: [31.0, 34.9],
  IN: [20.6, 79.0], IS: [65.0, -19.0], IT: [41.9, 12.6], JP: [36.2, 138.3],
  KE: [-0.02, 37.9], KR: [35.9, 127.8], LT: [55.2, 23.9], LU: [49.8, 6.1],
  LV: [56.9, 24.6], MA: [31.8, -7.1], MX: [23.6, -102.6], MY: [4.2, 101.98],
  NG: [9.1, 8.7], NL: [52.1, 5.3], NO: [60.5, 8.5], NZ: [-40.9, 174.9],
  PE: [-9.2, -75.0], PH: [12.9, 121.8], PK: [30.4, 69.3], PL: [51.9, 19.1],
  PT: [39.4, -8.2], RO: [45.9, 25.0], RS: [44.0, 21.0], RU: [61.5, 105.3],
  SA: [23.9, 45.1], SE: [60.1, 18.6], SG: [1.35, 103.8], SI: [46.2, 15.0],
  SK: [48.7, 19.7], TH: [15.9, 101.0], TR: [39.0, 35.2], TW: [23.7, 121.0],
  UA: [48.4, 31.2], US: [37.1, -95.7], VN: [14.06, 108.3], ZA: [-30.6, 22.9],
};

/**
 * Equirectangular, cropped to the inhabited latitudes.
 *
 * A full -90..90 plot spends its lower third on Antarctica and its top on empty
 * ocean, which left the frame looking broken. 75N..55S keeps every populated
 * landmass and still maps longitude and latitude linearly, so relative
 * positions stay truthful.
 */
const LAT_TOP = 75;
const LAT_BOTTOM = -55;
const LAT_SPAN = LAT_TOP - LAT_BOTTOM;
const MAP_WIDTH = 720;
const MAP_HEIGHT = Math.round((MAP_WIDTH * LAT_SPAN) / 360);

function project(lat: number, lon: number) {
  return {
    x: ((lon + 180) / 360) * MAP_WIDTH,
    y: ((LAT_TOP - lat) / LAT_SPAN) * MAP_HEIGHT,
  };
}

function countryName(code: string) {
  if (code === "ZZ") return "Unknown";
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}

export function CountryPanel({ countries }: { countries: CountryCount[] }) {
  const rows = countries.filter((row) => row.visits > 0);
  const total = rows.reduce((sum, row) => sum + row.visits, 0);
  const plotted = rows.filter((row) => CENTROIDS[row.country]);
  const busiest = rows[0]?.visits ?? 1;

  return (
    <section className="country-panel">
      <header className="country-panel-head">
        <div>
          <h2>Where visits came from</h2>
          <p>
            Country only, counted per day. No IP addresses are received or
            stored.
          </p>
        </div>
        <Globe2 aria-hidden="true" size={18} />
      </header>

      {rows.length === 0 ? (
        <p className="country-empty">
          No visits recorded yet for this range. Countries appear once someone
          opens the public page.
        </p>
      ) : (
        <div className="country-body">
          <figure className="country-map">
            <svg
              viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
              role="img"
              aria-label={`Dot map of visits by country. ${rows
                .slice(0, 5)
                .map((row) => `${countryName(row.country)} ${row.visits}`)
                .join(", ")}.`}
            >
              {/* Graticule every 30/60 degrees, so the dots have a frame of reference. */}
              <g className="country-graticule" aria-hidden="true">
                {[-30, 0, 30, 60].map((lat) => {
                  const { y } = project(lat, 0);
                  return <line key={`h${lat}`} x1={0} y1={y} x2={MAP_WIDTH} y2={y} />;
                })}
                {[-120, -60, 0, 60, 120].map((lon) => {
                  const { x } = project(0, lon);
                  return <line key={`m${lon}`} x1={x} y1={0} x2={x} y2={MAP_HEIGHT} />;
                })}
              </g>
              {plotted.map((row) => {
                const [lat, lon] = CENTROIDS[row.country];
                const { x, y } = project(lat, lon);
                // Area-proportional, so a country with 4x the visits reads as
                // 4x the ink rather than 4x the radius.
                const radius = 5 + Math.sqrt(row.visits / busiest) * 17;
                return (
                  <g key={row.country} className="country-dot">
                    <circle cx={x} cy={y} r={radius} />
                    <circle cx={x} cy={y} r={2.5} className="country-dot-core" />
                    {/* Labelled so the plot is readable without a legend. */}
                    <text x={x} y={y - radius - 6} textAnchor="middle">
                      {row.country}
                    </text>
                  </g>
                );
              })}
            </svg>
          </figure>

          <ol className="country-list">
            {rows.map((row) => {
              const share = total === 0 ? 0 : (row.visits / total) * 100;
              return (
                <li key={row.country}>
                  <span className="country-rank-name">
                    <code>{row.country}</code>
                    {countryName(row.country)}
                  </span>
                  <span className="country-bar" aria-hidden="true">
                    <span style={{ width: `${Math.max(share, 2)}%` }} />
                  </span>
                  <span className="country-figures">
                    <strong>{row.visits}</strong>
                    <small>{share.toFixed(0)}%</small>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
