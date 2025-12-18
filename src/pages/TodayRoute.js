import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserRoutes, getUserProfile } from '../services/userData';
import { supabase } from '../lib/supabase';
import Map from '../components/Map';
import './TodayRoute.css';

const MAPBOX_PUBLIC_TOKEN = process.env.REACT_APP_MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoiZmF0YmlrZWh1bHAiLCJhIjoiY21qNnhmanp5MDB4ajNncjB1YXJrMDc2cSJ9.5CYl4ZfCROi-pmyaNzETIg';

// Kleuren voor verschillende routes
const ROUTE_COLORS = [
  '#0CC0DF', // Blauw (huidige kleur)
  '#4CAF50', // Groen
  '#FF9800', // Oranje
  '#9C27B0', // Paars
  '#F44336', // Rood
  '#00BCD4', // Cyaan
  '#FFC107', // Geel
  '#E91E63', // Roze
];

function TodayRoute() {
  const { currentUser } = useAuth();
  const [routes, setRoutes] = useState([]); // Alle routes van vandaag
  const [startCoordinates, setStartCoordinates] = useState(null);
  const [completedStops, setCompletedStops] = useState({}); // Object met routeId -> Set van completed stops
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTodayRoutes = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Get today's date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        
        // Load all routes for today
        const allRoutes = await getUserRoutes(currentUser.id);
        const todayRoutes = allRoutes
          .filter(r => {
            if (!r.date) return false;
            const routeDateStr = new Date(r.date).toISOString().split('T')[0];
            return routeDateStr === todayStr;
          })
          .sort((a, b) => {
            // Sort by created_at to maintain consistent order
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
            return aTime - bTime;
          });
        
        setRoutes(todayRoutes);
        
        // Load completed stops for all routes
        const completedStopsData = {};
        for (const route of todayRoutes) {
          if (route.id) {
            const { data: stopDetails, error: stopDetailsError } = await supabase
              .from('route_stop_details')
              .select('stop_index')
              .eq('route_id', route.id);
            
            if (!stopDetailsError && stopDetails) {
              completedStopsData[route.id] = new Set(stopDetails.map(detail => detail.stop_index));
            } else {
              completedStopsData[route.id] = new Set();
            }
          }
        }
        setCompletedStops(completedStopsData);

        // Load user profile for start coordinates
        const profile = await getUserProfile(currentUser.id);
        if (profile?.start_coordinates) {
          setStartCoordinates(profile.start_coordinates);
        }
      } catch (error) {
        console.error('Error loading today routes:', error);
        setRoutes([]);
      } finally {
        setLoading(false);
      }
    };

    loadTodayRoutes();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="today-route-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-message">Routes laden...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="today-route-page">
      <div className="today-route-header">
        <div className="logo-container">
          <img src="/logo.png" alt="RouteNu" className="logo" />
        </div>
      </div>
      <div className="today-route-map">
        <Map
          mapboxToken={MAPBOX_PUBLIC_TOKEN}
          routes={routes}
          startCoordinates={startCoordinates}
          completedStops={completedStops}
          routeColors={ROUTE_COLORS}
          center={[5.2913, 52.1326]} // Centrum van Nederland
          zoom={7}
        />
      </div>
    </div>
  );
}

export default TodayRoute;

