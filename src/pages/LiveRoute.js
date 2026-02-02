import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { recalculateArrivalTimes, getRouteStopTimestamps, getUserProfile } from '../services/userData';
import { useAuth } from '../contexts/AuthContext';
import Map from '../components/Map';
import './LiveRoute.css';

function LiveRoute() {
  const { routeId, token, email: emailParam } = useParams();
  const { currentUser } = useAuth();
  const [route, setRoute] = useState(null);
  const [timestamps, setTimestamps] = useState([]);
  const [recalculatedTimes, setRecalculatedTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [estimatedArrival, setEstimatedArrival] = useState(null);
  const [targetStopIndex, setTargetStopIndex] = useState(undefined);
  const [userServiceTime, setUserServiceTime] = useState(5); // Default service time
  const [showRouteMap, setShowRouteMap] = useState(false);
  
  // Find stop index based on email if provided
  useEffect(() => {
    if (emailParam && route && route.stops) {
      const decodedEmail = decodeURIComponent(emailParam);
      const foundIndex = route.stops.findIndex(stop => 
        stop.email && stop.email.trim().toLowerCase() === decodedEmail.toLowerCase()
      );
      if (foundIndex >= 0) {
        setTargetStopIndex(foundIndex);
        console.log('Found stop index', foundIndex, 'for email:', decodedEmail);
      } else {
        console.warn('No stop found for email:', decodedEmail);
        setTargetStopIndex(undefined);
      }
    } else {
      setTargetStopIndex(undefined);
    }
  }, [emailParam, route]);

  // Load user service time if authenticated
  useEffect(() => {
    const loadUserServiceTime = async () => {
      if (currentUser) {
        try {
          const profile = await getUserProfile(currentUser.id);
          if (profile?.service_time) {
            setUserServiceTime(profile.service_time);
          }
        } catch (error) {
          console.error('Error loading user service time:', error);
        }
      }
    };
    loadUserServiceTime();
  }, [currentUser]);

  useEffect(() => {
    loadRouteData();
    
    // Poll for updates every 10 seconds only if route is started
    const interval = setInterval(() => {
      // Only poll if route is started (we'll check this in loadRouteData)
      loadRouteData();
    }, 10000);

    return () => clearInterval(interval);
  }, [routeId, token, emailParam]);

  const loadRouteData = async () => {
    try {
      // Debug: Log environment info
      console.log('=== LIVE ROUTE DEBUG ===');
      console.log('Environment:', {
        isProduction: process.env.NODE_ENV === 'production',
        supabaseUrl: process.env.REACT_APP_SUPABASE_URL ? 'SET' : 'MISSING',
        supabaseKey: process.env.REACT_APP_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
        location: window.location.href,
        isAuthenticated: !!currentUser
      });
      console.log('Loading route data for:', { 
        routeId, 
        token, 
        emailParam,
        targetStopIndex
      });
      
      // Load route - check both general token and stop tokens
      // Note: This query needs a public RLS policy to work without authentication
      const { data: routeData, error: routeError } = await supabase
        .from('routes')
        .select('*')
        .eq('id', routeId)
        .single(); // Don't filter by route_status here, check it after loading

      console.log('Route data loaded:', { 
        found: !!routeData, 
        hasToken: !!routeData?.live_route_token,
        hasStopTokens: !!routeData?.stop_tokens,
        routeStatus: routeData?.route_status,
        error: routeError 
      });
      
      // Debug: Log full error details
      if (routeError) {
        console.error('=== SUPABASE ERROR DETAILS ===');
        console.error('Error Code:', routeError.code);
        console.error('Error Message:', routeError.message);
        console.error('Error Details:', routeError.details);
        console.error('Error Hint:', routeError.hint);
        console.error('Full Error Object:', JSON.stringify(routeError, null, 2));
      }

      if (routeError) {
        console.error('Route error details:', {
          code: routeError.code,
          message: routeError.message,
          details: routeError.details,
          hint: routeError.hint,
          routeId,
          token,
          emailParam
        });
        // Check if it's an RLS error
        if (routeError.code === 'PGRST301' || routeError.message?.includes('permission') || routeError.message?.includes('policy') || routeError.message?.includes('RLS')) {
          setError('Toegang geweigerd. Controleer of de RLS policy voor publieke live routes is ingesteld. Voer add-public-live-route-policy.sql uit in Supabase.');
        } else if (routeError.code === 'PGRST116') {
          setError('Route niet gevonden. Controleer of de route ID correct is en of de route is gestart.');
        } else {
          setError(`Route niet gevonden of link is ongeldig. Fout: ${routeError.message || routeError.code || 'Onbekende fout'}`);
        }
        setLoading(false);
        return;
      }

      if (!routeData) {
        console.error('No route data found');
        setError('Route niet gevonden of link is ongeldig');
        setLoading(false);
        return;
      }

      // Verify token if provided in URL
      if (token) {
        // Verify token - check if it matches the general route token
        const tokenValid = routeData.live_route_token === token;
        
        if (!tokenValid) {
          console.error('Token mismatch:', { 
            expected: routeData.live_route_token, 
            actual: token,
            emailParam,
            routeId,
            routeStatus: routeData.route_status
          });
          setError('Route niet gevonden of link is ongeldig. Controleer of de token correct is.');
          setLoading(false);
          return;
        }
        
        console.log('✓ Token verified');
      } else if (routeData.route_status === 'started') {
        // Route is started but no token provided - this shouldn't happen for public links
        console.warn('Route is started but no token provided in URL');
        setError('Route niet gevonden of link is ongeldig. Token ontbreekt in de link.');
        setLoading(false);
        return;
      } else {
        // Route not started yet - token is optional, show route info
        console.log('Route not started yet, showing route info without live tracking');
      }
      
      // Log for debugging
      console.log('Token verified, emailParam:', emailParam, 'targetStopIndex:', targetStopIndex, 'will show', targetStopIndex !== undefined ? 'only stop ' + targetStopIndex : 'all stops');

      setRoute(routeData);

      // Load timestamps
      let timestampsData = [];
      try {
        timestampsData = await getRouteStopTimestamps(routeId);
        console.log('Loaded timestamps:', timestampsData);
        setTimestamps(timestampsData || []);
      } catch (timestampError) {
        console.error('Error loading timestamps:', timestampError);
        console.error('Timestamp error details:', {
          code: timestampError.code,
          message: timestampError.message,
          details: timestampError.details,
          hint: timestampError.hint
        });
        setTimestamps([]);
      }

      // Recalculate arrival times for ALL stops based on last completed stop
      if (routeData.stops && routeData.stops.length > 0) {
        try {
          // Calculate estimated times for all stops based on actual progress
          const allEstimatedTimes = calculateEstimatedArrivalForAllStops(routeData, timestampsData || []);
          
          // Also get recalculated times from service (for actual arrival times)
          const recalculated = await recalculateArrivalTimes(routeId, routeData, timestampsData || [], userServiceTime);
          
          // Merge estimated times with actual times
          const mergedTimes = routeData.stops.map((stop, index) => {
            const actual = recalculated[index];
            const estimated = allEstimatedTimes[index];
            
            // If we have actual arrival time, use that, otherwise use estimated
            if (actual && actual.isActual) {
              return actual;
            } else if (estimated) {
              return {
                arrival: estimated.arrival,
                departure: estimated.departure,
                isActual: false,
                estimatedMinutes: estimated.estimatedMinutes
              };
            } else if (actual) {
              return actual;
            }
            return null;
          }).filter(Boolean);
          
          setRecalculatedTimes(mergedTimes);
          
          // If viewing a specific stop, calculate estimated arrival time
          if (targetStopIndex !== undefined && !isNaN(targetStopIndex)) {
            const estimatedTime = allEstimatedTimes[targetStopIndex] || calculateEstimatedArrivalForStop(
              routeData, 
              timestampsData || [], 
              targetStopIndex
            );
            setEstimatedArrival(estimatedTime);
          } else {
            // Clear estimated arrival if not viewing specific stop
            setEstimatedArrival(null);
          }
        } catch (recalcError) {
          console.error('Error recalculating times:', recalcError);
          setRecalculatedTimes([]);
        }
      }

      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error loading route data:', err);
      setError('Fout bij het laden van route gegevens');
      setLoading(false);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '--:--';
    const date = new Date(timeString);
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  };

  const calculateDelay = (estimatedTime, actualTime) => {
    if (!actualTime) return null;
    
    const estimated = new Date(estimatedTime);
    const actual = new Date(actualTime);
    const delayMinutes = Math.round((actual - estimated) / 1000 / 60);
    
    return delayMinutes;
  };

  // Calculate estimated arrival times for ALL stops based on last completed stop
  const calculateEstimatedArrivalForAllStops = (routeData, timestamps) => {
    if (!routeData || !routeData.stops || routeData.stops.length === 0 || !routeData.route_data) {
      console.log('calculateEstimatedArrivalForAllStops: Invalid route data');
      return {};
    }

    // Find the last completed stop (with actual_departure_time)
    let lastCompletedIndex = -1;
    let lastDepartureTime = null;
    
    // Check if route has started
    const routeStart = timestamps.find(t => t.stop_index === -1);
    if (!routeStart || !routeStart.route_started_at) {
      console.log('calculateEstimatedArrivalForAllStops: Route not started');
      return {};
    }

    lastDepartureTime = new Date(routeStart.route_started_at);
    console.log('Route started at:', lastDepartureTime);

    // Find the last stop that was actually completed (has departure time)
    // We check ALL stops, not just before target, to find the most recent completed stop
    for (let i = routeData.stops.length - 1; i >= 0; i--) {
      const timestamp = timestamps.find(t => t.stop_index === i);
      if (timestamp && timestamp.actual_departure_time) {
        lastCompletedIndex = i;
        lastDepartureTime = new Date(timestamp.actual_departure_time);
        console.log(`Found last completed stop: ${i}, departed at:`, lastDepartureTime);
        break;
      } else if (timestamp && timestamp.actual_arrival_time) {
        // If only arrival time exists, use arrival + service time as departure
        lastCompletedIndex = i;
        // Use service time from user profile (if available), otherwise from route_data, or default 5 minutes
        const serviceTimeMinutes = userServiceTime || routeData.route_data?.service_time || 5;
        lastDepartureTime = new Date(new Date(timestamp.actual_arrival_time).getTime() + (serviceTimeMinutes * 60 * 1000));
        console.log(`Found last completed stop (arrival only): ${i}, estimated departure at:`, lastDepartureTime);
        break;
      }
    }

    if (lastCompletedIndex === -1) {
      console.log('No completed stops found, using route start time');
    }

    // Calculate estimated arrival times for all stops AFTER the last completed stop
    const estimatedTimes = {};
    const waypoints = routeData.route_data.waypoints || [];
    
    console.log('Calculating times for stops after index:', lastCompletedIndex);
    console.log('Waypoints available:', waypoints.length);
    console.log('Total route duration:', routeData.route_data.duration);
    
    // Calculate cumulative duration from last completed stop to each following stop
    let cumulativeDuration = 0;
    
    for (let stopIndex = lastCompletedIndex + 1; stopIndex < routeData.stops.length; stopIndex++) {
      // Calculate duration for this segment (from previous stop to current stop)
      // Waypoints array structure depends on API, but typically:
      // - waypoints[0] = start location
      // - waypoints[1] = first stop
      // - waypoints[2] = second stop, etc.
      // Duration is usually cumulative from start, or segment duration
      
      let segmentDuration;
      if (waypoints.length > stopIndex + 1) {
        // If waypoint has duration, it might be cumulative or segment
        // Try to get segment duration by checking if it's cumulative
        if (waypoints[stopIndex + 1]?.duration) {
          if (stopIndex === lastCompletedIndex + 1) {
            // First segment: use waypoint duration directly (or calculate from cumulative)
            segmentDuration = waypoints[stopIndex + 1].duration;
            // If this seems cumulative (larger than expected), try to get segment
            if (waypoints[stopIndex]?.duration && waypoints[stopIndex + 1].duration > waypoints[stopIndex].duration) {
              segmentDuration = waypoints[stopIndex + 1].duration - waypoints[stopIndex].duration;
            }
          } else {
            // Subsequent segments: calculate difference
            const prevWaypoint = waypoints[stopIndex]?.duration || 0;
            const currentWaypoint = waypoints[stopIndex + 1].duration;
            segmentDuration = currentWaypoint - prevWaypoint;
          }
        } else {
          // No duration in waypoint, estimate
          segmentDuration = routeData.route_data.duration / (routeData.stops.length + 1);
        }
      } else {
        // Fallback: estimate based on average duration per segment
        segmentDuration = routeData.route_data.duration / (routeData.stops.length + 1);
      }
      
      cumulativeDuration += segmentDuration;

      // Calculate estimated arrival and departure time
      const estimatedArrival = new Date(lastDepartureTime.getTime() + (cumulativeDuration * 1000));
      // Use service time from user profile (if available), otherwise from route_data, or default 5 minutes
      const serviceTimeMinutes = userServiceTime || routeData.route_data?.service_time || 5;
      const estimatedDeparture = new Date(estimatedArrival.getTime() + (serviceTimeMinutes * 60 * 1000));
      
      console.log(`Stop ${stopIndex}: segment=${Math.round(segmentDuration)}s, cumulative=${Math.round(cumulativeDuration)}s, arrival=${estimatedArrival.toLocaleTimeString()}, serviceTime=${serviceTimeMinutes}min`);
      
      estimatedTimes[stopIndex] = {
        arrival: estimatedArrival.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
        departure: estimatedDeparture.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
        arrivalDate: estimatedArrival,
        departureDate: estimatedDeparture,
        estimatedMinutes: Math.round(cumulativeDuration / 60)
      };
    }

    console.log('Calculated estimated times:', estimatedTimes);
    return estimatedTimes;
  };

  // Calculate estimated arrival time for a specific stop (backward compatibility)
  const calculateEstimatedArrivalForStop = (routeData, timestamps, targetStopIndex) => {
    const allTimes = calculateEstimatedArrivalForAllStops(routeData, timestamps);
    return allTimes[targetStopIndex] || null;
  };

  if (loading) {
    return (
      <div className="live-route-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">
            <h2>Live link starten</h2>
            <p>Even geduld, we zijn al je gegevens aan het ophalen...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="live-route-page">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="live-route-page">
        <div className="error-message">Route niet gevonden</div>
      </div>
    );
  }

  const routeDate = route.date 
    ? new Date(route.date).toLocaleDateString('nl-NL', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })
    : 'vandaag';

  const isRouteStarted = route.route_status === 'started';

  return (
    <div className="live-route-page">
      <div className="live-route-header">
        <img src="/fatbikehulplogo5.avif" alt="Fatbikehulp" className="live-route-logo" />
        <h1>{isRouteStarted ? 'Route Live Bekijken' : 'Route Informatie'}</h1>
        <p className="route-date">{routeDate}</p>
        {isRouteStarted && (
          <p className="last-update">Laatste update: {lastUpdate.toLocaleTimeString('nl-NL')}</p>
        )}
      </div>

      <div className="live-route-status">
        {isRouteStarted ? (
          <div className="status-badge started">
            <span className="status-dot"></span>
            Monteur is onderweg
          </div>
        ) : (
          <div className="status-badge not-started">
            <span className="status-dot"></span>
            Route nog niet gestart
          </div>
        )}
      </div>

      {isRouteStarted && route.route_started_at && (
        <div className="route-start-info">
          <p><strong>Route gestart om:</strong> {formatTime(route.route_started_at)}</p>
        </div>
      )}

      {!isRouteStarted && (
        <div className="route-not-started-info">
          <p>De route is nog niet gestart. U ontvangt een nieuwe link zodra de route is gestart en u kunt de route live volgen.</p>
        </div>
      )}

      {isRouteStarted && (
      <div className="stops-list">
        <h2>{targetStopIndex !== undefined && !isNaN(targetStopIndex) ? 'Uw Stop' : 'Stops'}</h2>
        {route.stops && route.stops.length > 0 ? (
          <div className="stops-container">
            {(targetStopIndex !== undefined && !isNaN(targetStopIndex) && targetStopIndex >= 0 && targetStopIndex < route.stops.length
              ? (() => {
                  const targetStop = route.stops[targetStopIndex];
                  console.log('FILTERING: Showing ONLY stop', targetStopIndex, 'for email:', emailParam);
                  return targetStop ? [{ stop: targetStop, index: targetStopIndex }] : [];
                })()
              : (() => {
                  console.log('FILTERING: Showing ALL stops (general view)');
                  return route.stops.map((stop, index) => ({ stop, index }));
                })()
            ).map(({ stop, index }) => {
              const timestamp = timestamps.find(t => t.stop_index === index);
              const recalculatedTime = recalculatedTimes[index];
              const isCompleted = timestamp && timestamp.actual_arrival_time;
              
              // Calculate delay if we have both estimated and actual
              let delay = null;
              if (timestamp && timestamp.actual_arrival_time && recalculatedTime) {
                // We need original estimated time - for now use recalculated as baseline
                delay = calculateDelay(
                  route.route_started_at ? 
                    new Date(new Date(route.route_started_at).getTime() + (index * 15 * 60 * 1000)).toISOString() :
                    null,
                  timestamp.actual_arrival_time
                );
              }

              return (
                <div key={index} className={`stop-card ${isCompleted ? 'completed' : 'pending'}`}>
                  <div className="stop-header">
                    <div className="stop-number">{index + 1}</div>
                    <div className="stop-info">
                      <h3>{stop.name || `Stop ${index + 1}`}</h3>
                      {stop.address && <p className="stop-address">{stop.address}</p>}
                    </div>
                    {isCompleted && (
                      <div className="stop-status completed">
                        <span>✓</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="stop-times">
                    {/* Show actual arrival time if available */}
                    {timestamp && timestamp.actual_arrival_time && (
                      <div className="time-info">
                        <span className="time-label">Aangekomen om:</span>
                        <span className="time-value actual">
                          {formatTime(timestamp.actual_arrival_time)}
                        </span>
                      </div>
                    )}
                    
                    {/* Show actual departure time if available */}
                    {timestamp && timestamp.actual_departure_time && (
                      <div className="time-info">
                        <span className="time-label">Vertrokken om:</span>
                        <span className="time-value actual">
                          {formatTime(timestamp.actual_departure_time)}
                        </span>
                      </div>
                    )}
                    
                    {/* Show estimated arrival time if not yet arrived */}
                    {!timestamp?.actual_arrival_time && recalculatedTime && (
                      <div className="time-info estimated-arrival">
                        <div className="estimated-time-content">
                          <span className="time-label">Verwachte aankomsttijd</span>
                          <div className="estimated-time-display">
                            <span className="time-value estimated">
                              {recalculatedTime.arrival}
                            </span>
                            {recalculatedTime.estimatedMinutes > 0 && (
                              <span className="time-note">Over ongeveer {recalculatedTime.estimatedMinutes} minuten</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    
                    {/* Show delay if we have both estimated and actual */}
                    {delay !== null && delay !== 0 && (
                      <div className={`delay-info ${delay > 0 ? 'delay' : 'early'}`}>
                        {delay > 0 ? `+${delay} min vertraging` : `${Math.abs(delay)} min vroeger`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p>Geen stops beschikbaar</p>
        )}
      </div>
      )}

      {isRouteStarted && (
      <div className="auto-refresh-note">
        <p>Deze pagina wordt automatisch elke 10 seconden bijgewerkt</p>
      </div>
      )}

      {/* Route Map Section */}
      {isRouteStarted && route.stops && route.stops.length > 0 && (
        <div className="route-map-section">
          {!showRouteMap ? (
            <div className="route-map-toggle">
              <button 
                className="view-route-btn"
                onClick={() => setShowRouteMap(true)}
              >
                Bekijk route
              </button>
            </div>
          ) : (
            <>
              <div className="route-map-header">
                <h2>Route overzicht</h2>
                <button 
                  className="close-map-btn"
                  onClick={() => setShowRouteMap(false)}
                  aria-label="Sluit kaart"
                >
                  ×
                </button>
              </div>
              <div className="route-map-container">
                <Map
                  stops={route.stops}
                  completedStops={new Set(
                    timestamps
                      .filter(t => t.actual_arrival_time && t.stop_index >= 0)
                      .map(t => t.stop_index)
                  )}
                  center={route.stops[0]?.coordinates || [5.2913, 52.1326]}
                  zoom={10}
                  showPopups={false}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* FAQ Section */}
      <div className="faq-section">
        <h2>Veelgestelde vragen</h2>
        <div className="faq-list">
          <div className="faq-item">
            <h3 className="faq-question">Belt de monteur mij?</h3>
            <p className="faq-answer">Ja, de monteur belt u 1 uur van tevoren.</p>
          </div>
          
          <div className="faq-item">
            <h3 className="faq-question">Kan het tijdstip afwijken?</h3>
            <p className="faq-answer">
              Ja, het tijdstip kan afwijken. Bij elke stop die de monteur afrondt wordt de route herberekend. 
              Het kan zijn dat het daadwerkelijke tijdstip wel 3 uur later is dan oorspronkelijk gepland.
            </p>
          </div>
          
          <div className="faq-item">
            <h3 className="faq-question">Moet ik er om thuis blijven?</h3>
            <p className="faq-answer">
              Nee, u hoeft er niet om thuis te blijven. U wordt 1 uur van tevoren gebeld, 
              dus u kunt gerust naar de supermarkt of andere boodschappen doen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveRoute;

