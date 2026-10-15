'use client';

import { useMapEvents } from 'react-leaflet';

/** Lets the user pick a position on the map (used to start a report at an exact place). */
export default function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      if (Number.isFinite(lat) && Number.isFinite(lng)) onPick(lat, lng);
    },
  });
  return null;
}
