import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getRouteStopTimestamps, recalculateArrivalTimes } from '../services/userData';
import './DriverDashboard.css';

function ContinueRoute() {
  const { routeId } = useParams();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [driver, setDriver] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [stopDetails, setStopDetails] = useState({});
  const [workDescription, setWorkDescription] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [partsCost, setPartsCost] = useState('');
  const [routeTimestamps, setRouteTimestamps] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        // Load driver profile
        const { data: driverData, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .eq('user_id', currentUser.id)
          .single();

        if (driverError && driverError.code !== 'PGRST116') {
          console.error('Error loading driver:', driverError);
          if (driverError.code === 'PGRST116') {
            alert('Je bent niet geregistreerd als chauffeur. Log in als admin.');
            logout();
            window.location.href = '/login';
            return;
          }
        }

        if (driverData) {
          setDriver(driverData);

          // Load route
          const { data: routeData, error: routeError } = await supabase
            .from('routes')
            .select('id, user_id, date, name, stops, route_data, route_status, driver_id, route_started_at, live_route_token')
            .eq('id', routeId)
            .eq('driver_id', driverData.id)
            .single();

          if (routeError) {
            console.error('Error loading route:', routeError);
            alert('Route niet gevonden of je hebt geen toegang.');
            navigate('/monteur');
            return;
          }

          if (routeData) {
            setRoute(routeData);
            
            // Load stop details
            const details = await loadStopDetails(routeData.id);
            setStopDetails(details);
            
            // Find first incomplete stop
            const firstIncomplete = findFirstIncompleteStop(routeData, details);
            setCurrentStopIndex(firstIncomplete);
            
            // Load existing details for current stop if any
            if (details[firstIncomplete]) {
              setWorkDescription(details[firstIncomplete].workDescription || '');
              setAmountReceived(details[firstIncomplete].amountReceived || '');
              setPartsCost(details[firstIncomplete].partsCost || '');
            }

            // Load timestamps
            try {
              const timestamps = await getRouteStopTimestamps(routeData.id);
              setRouteTimestamps(timestamps || []);
            } catch (error) {
              console.error('Error loading timestamps:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser, routeId, navigate, logout]);

  const loadStopDetails = async (routeId) => {
    try {
      const { data, error } = await supabase
        .from('route_stop_details')
        .select('*')
        .eq('route_id', routeId)
        .order('stop_index', { ascending: true });

      if (error) throw error;

      const detailsMap = {};
      data.forEach(detail => {
        detailsMap[detail.stop_index] = {
          workDescription: detail.work_description || '',
          amountReceived: detail.amount_received?.toString() || '',
          partsCost: detail.parts_cost?.toString() || ''
        };
      });

      return detailsMap;
    } catch (error) {
      console.error('Error loading stop details:', error);
      return {};
    }
  };

  const findFirstIncompleteStop = (route, loadedDetails) => {
    if (!route.stops || route.stops.length === 0) return 0;
    
    for (let i = 0; i < route.stops.length; i++) {
      if (!loadedDetails[i]) {
        return i;
      }
    }
    return route.stops.length; // All stops completed
  };

  const isStopCompleted = (stopIndex) => {
    return !!stopDetails[stopIndex];
  };

  const handleSaveStop = async (e) => {
    e.preventDefault();
    
    if (!workDescription.trim()) {
      alert('Vul de werkzaamheden in');
      return;
    }

    try {
      const { error } = await supabase
        .from('route_stop_details')
        .upsert({
          route_id: routeId,
          stop_index: currentStopIndex,
          work_description: workDescription,
          amount_received: amountReceived ? parseFloat(amountReceived) : null,
          parts_cost: partsCost ? parseFloat(partsCost) : null
        }, {
          onConflict: 'route_id,stop_index'
        });

      if (error) throw error;

      // Update local state
      const updatedDetails = { ...stopDetails };
      updatedDetails[currentStopIndex] = {
        workDescription,
        amountReceived,
        partsCost
      };
      setStopDetails(updatedDetails);

      // Move to next stop
      const nextIndex = currentStopIndex + 1;
      if (nextIndex < route.stops.length) {
        setCurrentStopIndex(nextIndex);
        // Load existing details for next stop if any
        if (updatedDetails[nextIndex]) {
          setWorkDescription(updatedDetails[nextIndex].workDescription || '');
          setAmountReceived(updatedDetails[nextIndex].amountReceived || '');
          setPartsCost(updatedDetails[nextIndex].partsCost || '');
        } else {
          setWorkDescription('');
          setAmountReceived('');
          setPartsCost('');
        }
      } else {
        // All stops completed, navigate back
        alert('Alle stops zijn voltooid!');
        navigate('/monteur');
      }
    } catch (error) {
      console.error('Error saving stop details:', error);
      alert('Fout bij het opslaan: ' + error.message);
    }
  };

  const handleStopClick = (index) => {
    if (index < route.stops.length) {
      setCurrentStopIndex(index);
      // Load existing details if any
      if (stopDetails[index]) {
        setWorkDescription(stopDetails[index].workDescription || '');
        setAmountReceived(stopDetails[index].amountReceived || '');
        setPartsCost(stopDetails[index].partsCost || '');
      } else {
        setWorkDescription('');
        setAmountReceived('');
        setPartsCost('');
      }
    }
  };

  const openInMaps = (stop) => {
    if (!stop.coordinates || !stop.address) return;
    const [lng, lat] = stop.coordinates;
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return <div className="driver-dashboard"><div>Laden...</div></div>;
  }

  if (!route || !route.stops || route.stops.length === 0) {
    return (
      <div className="driver-dashboard">
        <div>Route niet gevonden of heeft geen stops.</div>
        <button onClick={() => navigate('/monteur')}>Terug</button>
      </div>
    );
  }

  const currentStop = route.stops[currentStopIndex];
  const allCompleted = currentStopIndex >= route.stops.length;

  return (
    <div className="driver-dashboard">
      <div className="logo-header">
        <img src="/logo.png" alt="RouteNu" className="logo" />
      </div>
      <div className="driver-header">
        <div className="driver-info">
          <h1>{route.name || 'Route zonder naam'}</h1>
          <p>Route voortzetten</p>
        </div>
        <button className="logout-btn" onClick={() => navigate('/monteur')}>
          Terug
        </button>
      </div>

      {/* Timeline */}
      <div className="route-timeline-container">
        <h2>Stops overzicht</h2>
        <div className="route-timeline">
          {route.stops.map((stop, index) => {
            const isCompleted = isStopCompleted(index);
            const isCurrent = index === currentStopIndex && !allCompleted;
            
            return (
              <div 
                key={index} 
                className={`timeline-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                onClick={() => handleStopClick(index)}
              >
                <div className="timeline-marker">
                  {isCompleted ? (
                    <span className="checkmark">✓</span>
                  ) : (
                    <span className="stop-number">{index + 1}</span>
                  )}
                </div>
                <div className="timeline-content">
                  <h3>{stop.name || `Stop ${index + 1}`}</h3>
                  {stop.address && <p className="stop-address">{stop.address}</p>}
                  {isCompleted && (
                    <span className="completed-badge">Voltooid</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Stop Form */}
      {!allCompleted && currentStop && (
        <div className="continue-route-form">
          <h2>
            Stop {currentStopIndex + 1} van {route.stops.length}
          </h2>
          <div className="stop-info-card">
            <h3>{currentStop.name || 'Stop zonder naam'}</h3>
            {currentStop.address && (
              <p 
                className="stop-address clickable-address"
                onClick={() => openInMaps(currentStop)}
              >
                📍 {currentStop.address}
              </p>
            )}
            {currentStop.email && <p className="stop-contact">📧 {currentStop.email}</p>}
            {currentStop.phone && (
              <a href={`tel:${currentStop.phone.replace(/\s/g, '')}`} className="phone-link-button">
                <span className="phone-icon">📞</span>
                <span className="phone-text">{currentStop.phone}</span>
                <span className="phone-label">Bel nu</span>
              </a>
            )}
          </div>

          <form onSubmit={handleSaveStop}>
            <div className="form-group">
              <label htmlFor="work-description">Werkzaamheden *</label>
              <textarea
                id="work-description"
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                placeholder="Beschrijf wat je hebt gedaan..."
                required
                rows={4}
              />
            </div>
            <div className="form-group">
              <label htmlFor="amount-received">Ontvangen bedrag (€)</label>
              <input
                type="number"
                id="amount-received"
                step="0.01"
                min="0"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label htmlFor="parts-cost">Kosten onderdelen (€)</label>
              <input
                type="number"
                id="parts-cost"
                step="0.01"
                min="0"
                value={partsCost}
                onChange={(e) => setPartsCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={() => navigate('/monteur')}>
                Annuleren
              </button>
              <button type="submit" className="btn-submit">
                {currentStopIndex < route.stops.length - 1 ? 'Volgende stop' : 'Route voltooien'}
              </button>
            </div>
          </form>
        </div>
      )}

      {allCompleted && (
        <div className="all-completed-message">
          <h2>✓ Alle stops zijn voltooid!</h2>
          <button onClick={() => navigate('/monteur')} className="btn-submit">
            Terug naar overzicht
          </button>
        </div>
      )}
    </div>
  );
}

export default ContinueRoute;

