import React, { useState } from 'react';
import AddStopModal from './AddStopModal';
import './RoutePlanner.css';

// SVG Icon Components
const EmailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <polyline points="22,6 12,13 2,6"></polyline>
  </svg>
);

const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);


function RoutePlanner({
  onAddStop,
  stops,
  onRemoveStop,
  onCalculateRoute,
  onOptimizeRoute,
  onClearRoute,
  isOptimizing,
  route,
  selectedDriver,
  onDriverChange,
  vehicles,
  allOrders,
  drivers: driversProp
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter opdrachten op basis van zoekterm
  const filteredOrders = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return allOrders;
    }
    const query = searchQuery.toLowerCase();
    return allOrders.filter(order => 
      order.name?.toLowerCase().includes(query) ||
      order.address?.toLowerCase().includes(query) ||
      order.email?.toLowerCase().includes(query) ||
      order.phone?.includes(query) ||
      order.orderType?.toLowerCase().includes(query)
    );
  }, [allOrders, searchQuery]);

  const handleAddOrderToRoute = (order) => {
    // Voeg opdracht toe aan huidige route
    onAddStop({
      name: order.name,
      coordinates: order.coordinates,
      address: order.address,
      email: order.email,
      phone: order.phone,
      orderType: order.orderType,
      customerInfo: order.customerInfo
    });
  };

  // Haal unieke chauffeurs op - prefer drivers prop, fallback to vehicles
  // Filter out UUIDs - only show actual driver names
  const drivers = React.useMemo(() => {
    // If drivers prop is provided (array of driver objects), use those
    if (driversProp && Array.isArray(driversProp) && driversProp.length > 0) {
      // Extract names from driver objects
      return driversProp
        .map(driver => typeof driver === 'object' ? driver.name : driver)
        .filter(name => name && name.trim())
        .filter(name => {
          // Filter out UUIDs
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name.trim());
          return !isUUID;
        })
        .sort();
    }
    
    // Fallback: haal unieke chauffeurs op uit vehicles
    const uniqueDrivers = new Set();
    vehicles.forEach(vehicle => {
      // Check Nederlandse veldnaam (van form) en Engelse (van database)
      const driver = vehicle.chauffeur || vehicle.driver;
      if (driver && driver.trim()) {
        // Check if it's a UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(driver.trim());
        // Only add if it's NOT a UUID (i.e., it's a name)
        if (!isUUID) {
          uniqueDrivers.add(driver.trim());
        }
      }
    });
    return Array.from(uniqueDrivers).sort();
  }, [vehicles, driversProp]);

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}u ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDistance = (meters) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };


  return (
    <div className="route-planner">
      <div className="driver-selection">
        <label htmlFor="driver-select">Chauffeur *</label>
        <select
          id="driver-select"
          className="driver-select"
          value={selectedDriver}
          onChange={(e) => onDriverChange(e.target.value)}
          required
        >
          <option value="">Selecteer een chauffeur</option>
          {drivers.map((driver, index) => {
            // Handle both object format {id, name} and string format
            const driverName = typeof driver === 'object' ? driver.name : driver;
            const driverValue = typeof driver === 'object' ? driver.name : driver;
            return (
              <option key={driver?.id || index} value={driverValue}>
                {driverName}
              </option>
            );
          })}
        </select>
        {drivers.length === 0 && (
          <p className="driver-hint">Voeg eerst een voertuig toe via het menu</p>
        )}
      </div>

      <div className="search-container">
        <button
          className="btn-add-stop"
          onClick={() => setIsModalOpen(true)}
          disabled={!selectedDriver}
        >
          + Stop toevoegen
        </button>
      </div>

      <AddStopModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddStop={onAddStop}
      />

      <div className="stops-list">
        <div className="stops-header">
          <h3>Opdrachten ({allOrders.length})</h3>
          <div className="search-orders">
            <input
              type="text"
              className="search-orders-input"
              placeholder="Zoek in opdrachten..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                title="Wis zoekopdracht"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        </div>
        
        {searchQuery && (
          filteredOrders.length === 0 ? (
            <p className="empty-message">
              Geen opdrachten gevonden
            </p>
          ) : (
            <div className="orders-list">
              {filteredOrders.map((order) => {
                const isInCurrentRoute = stops.some(stop => stop.id === order.id);
                return (
                  <div 
                    key={order.id} 
                    className={`order-item ${isInCurrentRoute ? 'in-route' : ''} ${!isInCurrentRoute ? 'clickable' : ''}`}
                    onClick={() => {
                      if (!isInCurrentRoute) {
                        handleAddOrderToRoute(order);
                        setSearchQuery(''); // Clear search after adding
                      }
                    }}
                    style={{ cursor: !isInCurrentRoute ? 'pointer' : 'default' }}
                    title={!isInCurrentRoute ? 'Klik om toe te voegen aan route' : 'Al in route'}
                  >
                    <div className="order-info">
                      <div className="order-name">{order.name}</div>
                      {order.address && (
                        <div className="order-address">{order.address}</div>
                      )}
                      {order.orderType && (
                        <div className="order-type">
                          <span className="order-type-badge">{order.orderType}</span>
                        </div>
                      )}
                      {order.email && (
                        <div className="order-contact">
                          <EmailIcon />
                          <span>{order.email}</span>
                        </div>
                      )}
                      {order.phone && (
                        <div className="order-contact">
                          <PhoneIcon />
                          <span>{order.phone}</span>
                        </div>
                      )}
                    </div>
                    {isInCurrentRoute && (
                      <span className="in-route-badge">In route</span>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {stops.length > 0 && (
          <div className="current-route-stops">
            <h4>Stops in huidige route ({stops.length})</h4>
            <div className="stops">
              {stops.map((stop, index) => (
                <div key={stop.id} className="stop-item">
                  <div className="stop-number">{index + 1}</div>
                  <div className="stop-info">
                    <div className="stop-name">{stop.name}</div>
                    {stop.address && (
                      <div className="stop-address">{stop.address}</div>
                    )}
                    {stop.orderType && (
                      <div className="stop-order-type">
                        <span className="order-type-badge">{stop.orderType}</span>
                      </div>
                    )}
                    {stop.email && (
                      <div className="stop-contact">
                        <EmailIcon />
                        <span>{stop.email}</span>
                      </div>
                    )}
                    {stop.phone && (
                      <div className="stop-contact">
                        <PhoneIcon />
                        <span>{stop.phone}</span>
                      </div>
                    )}
                  </div>
                  <button
                    className="remove-btn"
                    onClick={() => onRemoveStop(stop.id)}
                    title="Verwijder stop"
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>


    </div>
  );
}

export default RoutePlanner;

