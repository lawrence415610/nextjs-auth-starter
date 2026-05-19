"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";

const INITIAL_CENTER: [number, number] = [151.2093, -33.8688];
const INITIAL_ZOOM = 13.8;

function formatCoord(value: number) {
  return Number(value.toFixed(6));
}

function formatBounds(bounds: mapboxgl.LngLatBounds) {
  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();

  return {
    north: formatCoord(northEast.lat),
    south: formatCoord(southWest.lat),
    east: formatCoord(northEast.lng),
    west: formatCoord(southWest.lng),
  };
}

function logCurrentBounds(map: mapboxgl.Map) {
  const bounds = map.getBounds();

  if (!bounds) {
    return;
  }

  console.log("Current map bounds:", formatBounds(bounds));
}

export default function MapMvp() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!containerRef.current || mapRef.current) {
      return;
    }

    if (!token) {
      console.error("Missing NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN");
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      center: INITIAL_CENTER,
      container: containerRef.current,
      cooperativeGestures: true,
      pitchWithRotate: false,
      style: "mapbox://styles/mapbox/dark-v11",
      zoom: INITIAL_ZOOM,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      logCurrentBounds(map);
    });

    map.on("moveend", () => {
      logCurrentBounds(map);
    });

    map.on("click", (event) => {
      const lngLat = event.lngLat;

      markerRef.current?.remove();
      popupRef.current?.remove();

      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        offset: 36,
      }).setHTML(
        `<div class="map-popup"><strong>Temporary pin</strong><span>${formatCoord(lngLat.lat)}, ${formatCoord(
          lngLat.lng,
        )}</span></div>`,
      );

      const marker = new mapboxgl.Marker({ color: "#e11d48" }).setLngLat(lngLat).setPopup(popup).addTo(map);

      markerRef.current = marker;
      popupRef.current = popup;

      marker.getElement().addEventListener("click", (markerEvent) => {
        markerEvent.stopPropagation();
        marker.togglePopup();
      });
    });

    return () => {
      popupRef.current?.remove();
      markerRef.current?.remove();
      markerRef.current = null;
      popupRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  return (
    <section className="h-[calc(100vh-73px)] min-h-[520px] bg-zinc-950">
      <div className="relative h-full w-full overflow-hidden">
        <div ref={containerRef} className="h-full w-full" />
        <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-white/95 px-4 py-3 text-sm font-medium text-zinc-900 shadow-lg">
          Sydney nightlife map
        </div>
      </div>
    </section>
  );
}
