import { useEffect, useRef, type ReactNode } from 'react';
import L from 'leaflet';

// HTML controls drawn over the map. Stops taps and scrolls from reaching
// Leaflet, so typing in the search box doesn't also pan or zoom the map.
export function MapOverlay({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    L.DomEvent.disableClickPropagation(ref.current);
    L.DomEvent.disableScrollPropagation(ref.current);
  }, []);
  return (
    <div ref={ref} className={`map-overlay ${className}`}>
      {children}
    </div>
  );
}
