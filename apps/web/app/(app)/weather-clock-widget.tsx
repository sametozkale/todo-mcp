"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LocationState = {
  latitude: number;
  longitude: number;
  city: string;
};

type WeatherState = {
  temperature: number;
  weatherCode: number;
};

function weatherCodeToGlyph(code: number): string {
  if (code === 0) return "Clear";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if ([95, 96, 99].includes(code)) return "Storm";
  return "Weather";
}

function getDigitalTime(now: Date): string {
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** BigDataCloud client reverse geocode — no API key, browser-friendly. */
async function reverseGeocodeCity(latitude: number, longitude: number): Promise<string | null> {
  try {
    const url =
      "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" +
      encodeURIComponent(String(latitude)) +
      "&longitude=" +
      encodeURIComponent(String(longitude)) +
      "&localityLanguage=en";
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
    };
    const pick =
      data.city?.trim() ||
      data.locality?.trim() ||
      data.principalSubdivision?.trim() ||
      data.countryName?.trim();
    return pick || null;
  } catch {
    return null;
  }
}

/** When no place name is available, show a readable zone label (not "Local"). */
function locationFallbackLabel(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      const segment = tz.split("/").pop();
      if (segment) return segment.replace(/_/g, " ");
    }
  } catch {
    // ignore
  }
  const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(new Date());
  const zone = parts.find((p) => p.type === "timeZoneName")?.value;
  return zone?.trim() || "Weather";
}

function AnalogMiniClock({ now }: { now: Date }) {
  const seconds = now.getSeconds();
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  const secondDeg = seconds * 6;
  const minuteDeg = minutes * 6;
  const hourDeg = hours * 30;

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="#d8d8d8" strokeWidth="1" />
      <line x1="12" y1="5.2" x2="12" y2="6.8" stroke="#b8b8b8" strokeWidth="1" strokeLinecap="round" />
      <line x1="12" y1="17.2" x2="12" y2="18.8" stroke="#b8b8b8" strokeWidth="1" strokeLinecap="round" />
      <line x1="5.2" y1="12" x2="6.8" y2="12" stroke="#b8b8b8" strokeWidth="1" strokeLinecap="round" />
      <line x1="17.2" y1="12" x2="18.8" y2="12" stroke="#b8b8b8" strokeWidth="1" strokeLinecap="round" />

      <g transform={`rotate(${hourDeg} 12 12)`}>
        <line x1="12" y1="12" x2="12" y2="8.6" stroke="#7d7d7d" strokeWidth="1.7" strokeLinecap="round" />
      </g>
      <g transform={`rotate(${minuteDeg} 12 12)`}>
        <line x1="12" y1="12" x2="12" y2="7.2" stroke="#8a8a8a" strokeWidth="1.3" strokeLinecap="round" />
      </g>
      <g transform={`rotate(${secondDeg} 12 12)`}>
        <line x1="12" y1="12.8" x2="12" y2="6.7" stroke="#9a9a9a" strokeWidth="0.9" strokeLinecap="round" />
      </g>
      <circle cx="12" cy="12" r="1.05" fill="#8b8b8b" />
    </svg>
  );
}

export function WeatherClockWidget() {
  const [now, setNow] = useState<Date | null>(null);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const reverseGeocodeAttemptedKey = useRef<string | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;

    async function resolveByIpFallback() {
      try {
        const resp = await fetch("https://ipapi.co/json/");
        if (!resp.ok) return;
        const data = (await resp.json()) as {
          latitude?: number;
          longitude?: number;
          city?: string;
        };
        if (!alive || data.latitude == null || data.longitude == null) return;
        setLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          city: data.city?.trim() ?? "",
        });
      } catch {
        // Keep widget resilient; time will still render.
      }
    }

    if (!navigator.geolocation) {
      void resolveByIpFallback();
      return () => {
        alive = false;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!alive) return;
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          city: "",
        });
      },
      () => {
        void resolveByIpFallback();
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 15 * 60 * 1000 },
    );

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!location) return;
    if (location.city.trim()) {
      reverseGeocodeAttemptedKey.current = `${location.latitude},${location.longitude}`;
      return;
    }

    const coordsKey = `${location.latitude},${location.longitude}`;
    if (reverseGeocodeAttemptedKey.current === coordsKey) return;
    reverseGeocodeAttemptedKey.current = coordsKey;

    let cancelled = false;
    const { latitude, longitude } = location;

    void (async () => {
      const name = await reverseGeocodeCity(latitude, longitude);
      if (cancelled) return;
      setLocation((prev) => {
        if (!prev || prev.latitude !== latitude || prev.longitude !== longitude) return prev;
        if (prev.city.trim()) return prev;
        return { ...prev, city: name ?? "" };
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [location]);

  useEffect(() => {
    if (!location) return;
    const currentLocation = location;
    let alive = true;

    async function loadWeather() {
      try {
        const url =
          "https://api.open-meteo.com/v1/forecast?latitude=" +
          encodeURIComponent(String(currentLocation.latitude)) +
          "&longitude=" +
          encodeURIComponent(String(currentLocation.longitude)) +
          "&current=temperature_2m,weather_code&timezone=auto";
        const resp = await fetch(url);
        if (!resp.ok) return;
        const data = (await resp.json()) as {
          current?: { temperature_2m?: number; weather_code?: number };
        };
        const current = data.current;
        if (!alive || !current || current.temperature_2m == null || current.weather_code == null) return;
        setWeather({
          temperature: Math.round(current.temperature_2m),
          weatherCode: current.weather_code,
        });
      } catch {
        // Keep widget resilient; clock still works.
      }
    }

    void loadWeather();
    const timer = window.setInterval(loadWeather, 15 * 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [location]);

  const displayNow = now ?? new Date(0);

  const weatherText = useMemo(() => {
    if (!weather) return "Loading weather";
    const label = weatherCodeToGlyph(weather.weatherCode);
    const place = location?.city?.trim() || locationFallbackLabel();
    return `${place} ${weather.temperature}\u00b0 ${label}`;
  }, [weather, location]);

  return (
    <div className="pointer-events-none fixed bottom-4 left-12 z-30">
      <div className="inline-flex h-6 items-center text-[11px] leading-4 text-[#777777]">
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex h-5 w-5 items-center justify-center">
            <AnalogMiniClock now={displayNow} />
          </span>
          <span className="tabular-nums">{now ? getDigitalTime(now) : "--:--"}</span>
        </span>
        <span className="mx-2 inline-block h-1 w-1 shrink-0 rounded-full bg-[#f2f2f2]" aria-hidden />
        <span className="truncate">{weatherText}</span>
      </div>
    </div>
  );
}

