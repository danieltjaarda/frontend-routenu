import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './Map.css';

// Public token voor Mapbox GL JS - moet beginnen met pk.*
const MAPBOX_PUBLIC_TOKEN = process.env.REACT_APP_MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoiZmF0YmlrZWh1bHAiLCJhIjoiY21qNnhmanp5MDB4ajNncjB1YXJrMDc2cSJ9.5CYl4ZfCROi-pmyaNzETIg';

function Map({ 
  mapboxToken, 
  stops, 
  route, 
  routes, // Array van routes voor meerdere routes
  center, 
  zoom, 
  startCoordinates, 
  completedStops = new Set(),
  routeColors = ['#0CC0DF'] // Array van kleuren voor routes
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const startMarker = useRef(null);
  const routeLayers = useRef([]); // Array voor meerdere route layers

  useEffect(() => {
    if (map.current) return; // Initialize map only once

    mapboxgl.accessToken = mapboxToken || MAPBOX_PUBLIC_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center || [5.2913, 52.1326], // Centrum van Nederland
      zoom: zoom || 7
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
  }, [mapboxToken, center, zoom]);

  // Update start marker when startCoordinates change
  useEffect(() => {
    if (!map.current) return;

    // Remove existing start marker
    if (startMarker.current) {
      startMarker.current.remove();
      startMarker.current = null;
    }

    // Add start marker if startCoordinates are available
    if (startCoordinates && Array.isArray(startCoordinates) && startCoordinates.length === 2) {
      const el = document.createElement('div');
      el.className = 'custom-marker start-marker';
      el.innerHTML = `<div class="marker-number">S</div>`;
      
      startMarker.current = new mapboxgl.Marker(el)
        .setLngLat(startCoordinates)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<strong>Startpunt</strong>`)
        )
        .addTo(map.current);
    }
  }, [startCoordinates]);

  // Update markers when routes change (for multiple routes)
  useEffect(() => {
    if (!map.current) return;

    // Remove existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // If routes array is provided, use that; otherwise fall back to single route/stops
    if (routes && routes.length > 0) {
      const showRouteNumber = routes.length > 1; // Only show route number if multiple routes
      
      routes.forEach((routeData, routeIndex) => {
        const routeStops = routeData.stops || [];
        const routeColor = routeColors[routeIndex % routeColors.length];
        const routeCompletedStops = completedStops[routeData.id] || new Set();

        routeStops.forEach((stop, stopIndex) => {
          const el = document.createElement('div');
          const isCompleted = routeCompletedStops.has(stopIndex);
          el.className = `custom-marker ${isCompleted ? 'completed-marker' : ''}`;
          
          // Set background color: green for completed, route color for incomplete
          el.style.backgroundColor = isCompleted ? '#4CAF50' : routeColor;
          el.style.borderColor = routeColor;
          
          if (isCompleted) {
            el.innerHTML = `<div class="marker-checkmark">✓</div>`;
          } else {
            el.innerHTML = `<div class="marker-number">${stopIndex + 1}</div>`;
          }
          
          // Format popup title with route number if multiple routes
          const popupTitle = showRouteNumber 
            ? `<strong>Route (${routeIndex + 1}) - Stop ${stopIndex + 1}</strong>`
            : `<strong>Stop ${stopIndex + 1}</strong>`;
          
          const marker = new mapboxgl.Marker(el)
            .setLngLat(stop.coordinates)
            .setPopup(
              new mapboxgl.Popup({ offset: 25 })
                .setHTML(`${popupTitle}<br>${stop.name}${isCompleted ? '<br><span style="color: green;">✓ Voltooid</span>' : ''}`)
            )
            .addTo(map.current);

          markers.current.push(marker);
        });
      });

      // Fit map to all routes
      const bounds = new mapboxgl.LngLatBounds();
      if (startCoordinates && Array.isArray(startCoordinates) && startCoordinates.length === 2) {
        bounds.extend(startCoordinates);
      }
      routes.forEach(routeData => {
        const routeStops = routeData.stops || [];
        routeStops.forEach(stop => bounds.extend(stop.coordinates));
      });
      if (bounds.isEmpty() === false) {
        map.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15
        });
      }
    } else if (stops && stops.length > 0) {
      // Fallback to single route/stops (backward compatibility)
      stops.forEach((stop, index) => {
        const el = document.createElement('div');
        const isCompleted = completedStops.has(index);
        el.className = `custom-marker ${isCompleted ? 'completed-marker' : ''}`;
        
        if (isCompleted) {
          el.innerHTML = `<div class="marker-checkmark">✓</div>`;
        } else {
          el.innerHTML = `<div class="marker-number">${index + 1}</div>`;
        }
        
        const marker = new mapboxgl.Marker(el)
          .setLngLat(stop.coordinates)
          .setPopup(
            new mapboxgl.Popup({ offset: 25 })
              .setHTML(`<strong>Stop ${index + 1}</strong><br>${stop.name}${isCompleted ? '<br><span style="color: green;">✓ Voltooid</span>' : ''}`)
          )
          .addTo(map.current);

        markers.current.push(marker);
      });

      const bounds = new mapboxgl.LngLatBounds();
      if (startCoordinates && Array.isArray(startCoordinates) && startCoordinates.length === 2) {
        bounds.extend(startCoordinates);
      }
      stops.forEach(stop => bounds.extend(stop.coordinates));
      if (bounds.isEmpty() === false) {
        map.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15
        });
      }
    }
  }, [routes, stops, startCoordinates, completedStops, routeColors]);

  // Update routes when routes data changes (for multiple routes)
  useEffect(() => {
    if (!map.current) {
      console.log('Map not initialized, skipping route update');
      return;
    }

    console.log('Map route effect triggered', { 
      route: route ? { 
        hasGeometry: !!route.geometry, 
        distance: route.distance, 
        coordinatesCount: route.geometry?.coordinates?.length,
        geometryType: route.geometry?.type
      } : null, 
      routes: routes?.length
    });

    const removeAllRoutes = () => {
      // Remove all route layers and sources
      routeLayers.current.forEach(layerId => {
        try {
          if (map.current.getLayer(layerId)) {
            map.current.removeLayer(layerId);
          }
        } catch (e) {
          console.warn(`Error removing layer ${layerId}:`, e);
        }
        try {
          if (map.current.getSource(layerId)) {
            map.current.removeSource(layerId);
          }
        } catch (e) {
          console.warn(`Error removing source ${layerId}:`, e);
        }
      });
      routeLayers.current = [];
    };

    const addRoutes = () => {
      if (!map.current) return;
      
      // First, ensure all old routes are removed
      removeAllRoutes();

      // If routes array is provided, render all routes
      if (routes && routes.length > 0) {
        routes.forEach((routeData, routeIndex) => {
          const routeGeometry = routeData.route_data?.geometry;
          if (!routeGeometry) return;

          const routeColor = routeColors[routeIndex % routeColors.length];
          const layerId = `route-${routeData.id || routeIndex}`;
          const sourceId = `route-source-${routeData.id || routeIndex}`;

          // Double check source doesn't exist
          try {
            if (map.current.getSource(sourceId)) {
              map.current.removeSource(sourceId);
            }
          } catch (e) {
            // Source doesn't exist, continue
          }

          try {
            map.current.addSource(sourceId, {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: routeGeometry
              }
            });

            map.current.addLayer({
              id: layerId,
              type: 'line',
              source: sourceId,
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': routeColor,
                'line-width': 8,
                'line-opacity': 0.75
              }
            });

            routeLayers.current.push(layerId);
          } catch (e) {
            console.error(`Error adding route ${routeIndex}:`, e);
          }
        });

        // Fit map to all routes
        const bounds = new mapboxgl.LngLatBounds();
        routes.forEach(routeData => {
          const routeGeometry = routeData.route_data?.geometry;
          if (routeGeometry && routeGeometry.coordinates) {
            routeGeometry.coordinates.forEach(coord => bounds.extend(coord));
          }
        });
        if (bounds.isEmpty() === false) {
          map.current.fitBounds(bounds, {
            padding: 50,
            maxZoom: 15
          });
        }
      } else if (route && route.geometry) {
        // Fallback to single route (backward compatibility)
        console.log('Adding single route to map', { 
          hasGeometry: !!route.geometry, 
          coordinatesCount: route.geometry?.coordinates?.length,
          distance: route.distance 
        });
        const layerId = 'route-single';
        const sourceId = 'route-source-single';

        // Double check source doesn't exist and remove it
        try {
          if (map.current.getLayer(layerId)) {
            map.current.removeLayer(layerId);
          }
          if (map.current.getSource(sourceId)) {
            map.current.removeSource(sourceId);
          }
        } catch (e) {
          // Source/layer doesn't exist, continue
        }

        try {
          // Validate geometry
          if (!route.geometry || !route.geometry.coordinates || route.geometry.coordinates.length === 0) {
            console.warn('Route geometry is invalid', route);
            return;
          }

          // Ensure source doesn't exist before adding
          if (map.current.getSource(sourceId)) {
            console.log('Source already exists, removing first');
            try {
              if (map.current.getLayer(layerId)) {
                map.current.removeLayer(layerId);
              }
              map.current.removeSource(sourceId);
            } catch (e) {
              console.warn('Error removing existing source:', e);
            }
          }

          console.log('Adding source and layer for route', {
            sourceId,
            layerId,
            coordinatesCount: route.geometry.coordinates.length
          });

          map.current.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: route.geometry
            }
          });

          map.current.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': routeColors[0] || '#0CC0DF',
              'line-width': 8,
              'line-opacity': 0.75
            }
          });

          routeLayers.current.push(layerId);
          console.log('Route layer successfully added to map');

          // Fit map to route bounds
          const coordinates = route.geometry.coordinates;
          if (coordinates && coordinates.length > 0) {
            const bounds = new mapboxgl.LngLatBounds();
            coordinates.forEach(coord => {
              if (Array.isArray(coord) && coord.length >= 2) {
                bounds.extend(coord);
              }
            });
            if (!bounds.isEmpty()) {
              map.current.fitBounds(bounds, {
                padding: 50,
                maxZoom: 15
              });
            }
          }
        } catch (e) {
          console.error('Error adding single route:', e);
          console.error('Route data:', route);
        }
      }
    };

    // Always try to add routes immediately
    const tryAddRoutes = () => {
      if (!map.current) {
        console.log('Map not initialized yet');
        return;
      }
      
      // Use a small delay to ensure map is ready, then add routes
      const addRoutesWhenReady = () => {
        if (!map.current) return;
        
        if (map.current.loaded()) {
          // Map is loaded, add routes immediately
          console.log('Map is loaded, adding routes immediately');
          try {
            addRoutes();
          } catch (error) {
            console.error('Error in addRoutes:', error);
            // Retry after a short delay
            setTimeout(() => {
              if (map.current && map.current.loaded()) {
                addRoutes();
              }
            }, 100);
          }
        } else {
          // Map is not loaded yet, wait for it
          console.log('Map not loaded yet, waiting for load event');
          map.current.once('load', () => {
            console.log('Map loaded, adding routes');
            addRoutes();
          });
        }
      };
      
      // Try immediately
      addRoutesWhenReady();
      
      // Also try after a short delay to catch any timing issues
      setTimeout(addRoutesWhenReady, 50);
    };
    
    tryAddRoutes();

    // Cleanup function
    return () => {
      if (map.current) {
        removeAllRoutes();
      }
    };
  }, [
    routes, 
    route, // Keep route in dependencies but use JSON.stringify for deep comparison
    routeColors
  ]);

  return (
    <div className="map-wrapper">
      <div ref={mapContainer} className="map-container" />
    </div>
  );
}

export default Map;

