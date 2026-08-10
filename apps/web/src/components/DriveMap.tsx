import { useEffect, useRef } from 'react';
import maplibregl, { type Map, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { DriveDetail } from '@mile-triage/shared';

type Props = {
  drive: DriveDetail | null;
};

export function DriveMap({ drive }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: [-74.006, 40.7128],
      zoom: 11,
    });
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !drive) return;

    const draw = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const coords: [number, number][] = [];
      if (drive.startLng != null && drive.startLat != null) {
        coords.push([drive.startLng, drive.startLat]);
      }
      for (const p of drive.points) {
        coords.push([p.lng, p.lat]);
      }
      if (drive.endLng != null && drive.endLat != null) {
        coords.push([drive.endLng, drive.endLat]);
      }

      if (map.getLayer('route-line')) map.removeLayer('route-line');
      if (map.getSource('route')) map.removeSource('route');

      if (coords.length >= 2) {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords },
          },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': '#3dd6c6',
            'line-width': 4,
          },
        });
      }

      if (drive.startLng != null && drive.startLat != null) {
        const el = document.createElement('div');
        el.style.cssText =
          'width:14px;height:14px;border-radius:50%;background:#2ecc71;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.3)';
        markersRef.current.push(
          new maplibregl.Marker({ element: el })
            .setLngLat([drive.startLng, drive.startLat])
            .addTo(map),
        );
      }
      if (drive.endLng != null && drive.endLat != null) {
        const el = document.createElement('div');
        el.style.cssText =
          'width:14px;height:14px;border-radius:50%;background:#e74c3c;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.3)';
        markersRef.current.push(
          new maplibregl.Marker({ element: el })
            .setLngLat([drive.endLng, drive.endLat])
            .addTo(map),
        );
      }

      if (coords.length === 1) {
        map.easeTo({ center: coords[0], zoom: 13, duration: 250 });
      } else if (coords.length > 1) {
        const bounds = coords.reduce(
          (b, c) => b.extend(c),
          new maplibregl.LngLatBounds(coords[0], coords[0]),
        );
        map.fitBounds(bounds, { padding: 48, duration: 250, maxZoom: 14 });
      }
    };

    if (map.isStyleLoaded()) draw();
    else map.once('load', draw);
  }, [drive]);

  if (!drive) {
    return (
      <div className="map-empty">
        Select a drive to preview its route.
      </div>
    );
  }

  return <div className="map-wrap" ref={containerRef} />;
}
