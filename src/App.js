import React, { useState, useEffect, useRef } from 'react';
import { Routes as RouterRoutes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Map from './components/Map';
import RoutePlanner from './components/RoutePlanner';
import Sidebar from './components/Sidebar';
import Timeline from './components/Timeline';
import AddStopModal from './components/AddStopModal';
import RoutesPage from './pages/Routes';
import Vehicles from './pages/Vehicles';
import Orders from './pages/Orders';
import Analytics from './pages/Analytics';
import TodayRoute from './pages/TodayRoute';
import EmailConfigurator from './pages/EmailConfigurator';
import LiveRoute from './pages/LiveRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import DriverLogin from './pages/DriverLogin';
import DriverDashboard from './pages/DriverDashboard';
import Drivers from './pages/Drivers';
import Checkout from './pages/Checkout';
import { 
  getUserVehicles, 
  getUserOrders, 
  getUserRoutes,
  getUserProfile,
  getUserDrivers,
  saveVehicle, 
  saveOrder,
  saveRoute,
  isUserDriver,
  getEmailTemplate,
  sendWebhook
} from './services/userData';
import './App.css';

// Secret token voor API calls (Optimization, Directions)
const MAPBOX_SECRET_TOKEN = 'process.env.MAPBOX_SECRET_TOKEN || ""';

// Public token voor Mapbox GL JS (kaart)
const MAPBOX_PUBLIC_TOKEN = process.env.REACT_APP_MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoiZmF0YmlrZWh1bHAiLCJhIjoiY21qNnhmanp5MDB4ajNncjB1YXJrMDc2cSJ9.5CYl4ZfCROi-pmyaNzETIg';

const API_BASE_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8001');

// Helper function to normalize coordinates to [lng, lat] format
// Mapbox expects [longitude, latitude] format
const normalizeCoordinates = (coords) => {
  if (!coords || !Array.isArray(coords) || coords.length !== 2) {
    return coords;
  }
  
  const [first, second] = coords;
  
  // Validate that both are numbers
  if (typeof first !== 'number' || typeof second !== 'number') {
    console.warn('Coordinates are not numbers:', coords);
    return coords;
  }
  
  // Check if coordinates are in wrong order (lat, lng instead of lng, lat)
  // For Netherlands: longitude is between ~3-7, latitude is between ~50-54
  // If first value is between 50-54 (latitude range) and second is between 3-7 (longitude range),
  // then they are in wrong order
  const isFirstLatitude = first >= 50 && first <= 54;
  const isSecondLongitude = second >= 3 && second <= 7;
  
  // Also check if first is clearly latitude (> 10) and second is clearly longitude (< 10)
  const isFirstClearlyLat = Math.abs(first) > 10 && Math.abs(first) < 90;
  const isSecondClearlyLng = Math.abs(second) >= 3 && Math.abs(second) <= 7;
  
  if ((isFirstLatitude && isSecondLongitude) || (isFirstClearlyLat && isSecondClearlyLng)) {
    console.warn('Coordinates appear to be in wrong order (lat, lng), swapping to (lng, lat):', coords, '->', [second, first]);
    return [second, first];
  }
  
  // Also check reverse: if first is longitude and second is latitude, they're already correct
  const isFirstLongitude = first >= 3 && first <= 7;
  const isSecondLatitude = second >= 50 && second <= 54;
  
  if (isFirstLongitude && isSecondLatitude) {
    // Already in correct order [lng, lat]
    return coords;
  }
  
  // If we can't determine, return as-is (might be outside Netherlands or already correct)
  // But log a warning if values seem suspicious
  if (Math.abs(first) > 90 || Math.abs(second) > 180) {
    console.warn('Coordinates have suspicious values (outside normal ranges):', coords);
  }
  
  return coords;
};

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [selectedRouteDate, setSelectedRouteDate] = useState(null);
  const [currentRouteId, setCurrentRouteId] = useState(null); // Store current route ID
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [stops, setStops] = useState([]);
  const [allOrders, setAllOrders] = useState([]); // Alle opdrachten die ooit zijn toegevoegd
  const [route, setRoute] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null); // User profile with startpoint
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStop, setEditingStop] = useState(null);
  const [departureTime, setDepartureTime] = useState('08:00');
  const [isDriver, setIsDriver] = useState(false);
  const [showRouteChoiceModal, setShowRouteChoiceModal] = useState(false);
  const [pendingDate, setPendingDate] = useState(null);
  const [existingRoutesForDate, setExistingRoutesForDate] = useState([]);
  const hasRedirectedRef = useRef(false);

  // Redirect to /vandaag on page load/refresh (for authenticated non-driver users)
  useEffect(() => {
    // Only redirect once on initial load/refresh
    if (hasRedirectedRef.current || !currentUser || isDriver) return;
    
    // Don't redirect on auth pages, checkout, profile pages, onboarding, or if already on /vandaag
    const excludedPages = ['/login', '/register', '/chauffeur-login', '/checkout', '/checkout/success', '/checkout/cancel', '/profiel', '/vandaag', '/route-aanmaken', '/onboarding', '/on-boarding'];
    if (excludedPages.includes(location.pathname)) {
      hasRedirectedRef.current = true;
      return;
    }
    
    // Always redirect to /vandaag on refresh/load for all other pages
    hasRedirectedRef.current = true;
    navigate('/vandaag', { replace: true });
  }, [currentUser, isDriver, location.pathname, navigate]);

  // Check if user is a driver and redirect if needed
  useEffect(() => {
    const checkIfDriver = async () => {
      if (!currentUser) {
        setIsDriver(false);
        return;
      }

      try {
        const driver = await isUserDriver(currentUser.id);
        setIsDriver(driver);
        
        // Only redirect drivers to /monteur if they're on root or specific admin pages
        // Don't redirect if they're on /chauffeur-login, /profiel, or other settings pages
        // Also don't redirect if they just created a driver account (they should stay on current page)
        const adminPages = ['/', '/routes', '/voertuigen', '/chauffeurs', '/pakketten', '/berichten', '/analytics', '/vandaag', '/route-aanmaken'];
        const shouldRedirect = driver && 
          adminPages.includes(location.pathname) && 
          location.pathname !== '/monteur' && 
          location.pathname !== '/chauffeur-login';
        
        if (shouldRedirect) {
          navigate('/monteur', { replace: true });
        }
      } catch (error) {
        console.error('Error checking if user is driver:', error);
        setIsDriver(false);
      }
    };

    checkIfDriver();
  }, [currentUser, location.pathname, navigate]);

  // Check setup requirements: startpoint -> driver -> vehicle (only for non-drivers)
  // This runs when user logs in or when navigating to routes
  useEffect(() => {
    const checkSetupRequirements = async () => {
      if (!currentUser || isDriver) return;
      
      // Don't check on auth pages, profile page, checkout, setup pages, onboarding, or /vandaag
      const allowedPages = ['/login', '/register', '/profiel', '/checkout', '/chauffeurs', '/voertuigen', '/chauffeurs-lijst', '/vandaag', '/onboarding', '/on-boarding'];
      if (allowedPages.includes(location.pathname)) {
        return;
      }
      
      try {
        // Step 1: Check if startpoint is set (use state if available, otherwise query)
        let profile = userProfile;
        if (!profile || !profile.start_address || !profile.start_coordinates) {
          profile = await getUserProfile(currentUser.id);
          if (!profile || !profile.start_address || !profile.start_coordinates) {
            navigate('/profiel', { replace: true });
            return;
          }
        }

        // Step 2: Check if driver exists (use state if available, otherwise query)
        // BUT: If there's already a vehicle, we know there's a driver (vehicles require drivers)
        // So skip driver check if vehicle exists
        let hasDriver = false;
        
        // First check if vehicle exists - if so, skip driver check
        const hasVehicleInState = vehicles && vehicles.length > 0;
        if (hasVehicleInState) {
          hasDriver = true; // Assume driver exists if vehicle exists
        } else {
          // Only check for drivers if no vehicle exists
          if (drivers && drivers.length > 0) {
            const driversWithAccount = drivers.filter(d => d.email);
            hasDriver = driversWithAccount.length > 0;
          }
          if (!hasDriver) {
            const userDrivers = await getUserDrivers(currentUser.id);
            const driversWithAccount = userDrivers ? userDrivers.filter(d => d.email) : [];
            hasDriver = driversWithAccount.length > 0;
          }
        }
        
        if (!hasDriver) {
          navigate('/chauffeurs', { replace: true });
          return;
        }

        // Step 3: Check if vehicle exists (ALWAYS prioritize state first)
        // The state should be updated immediately when a vehicle is added
        let hasVehicle = vehicles && vehicles.length > 0;
        
        // Only query database if state is truly empty (not just loading)
        // This ensures we use the most up-to-date state when available
        if (!hasVehicle) {
          // State might not be updated yet, query database to get latest data
          const userVehicles = await getUserVehicles(currentUser.id);
          hasVehicle = userVehicles && userVehicles.length > 0;
          // Update state if vehicles found
          if (hasVehicle && userVehicles.length > 0) {
            setVehicles(userVehicles);
          }
        }
        
        if (!hasVehicle) {
          navigate('/voertuigen', { replace: true });
          return;
        }

        // All requirements met, user can access all features
      } catch (error) {
        console.error('Error checking setup requirements:', error);
        // If error, redirect to profile page as fallback
        if (location.pathname !== '/profiel') {
          navigate('/profiel', { replace: true });
        }
      }
    };

    // Only check if we have a current user and we're not on auth pages
    // Don't add delay - state should be updated immediately when vehicle is added
    if (currentUser && !isDriver) {
      checkSetupRequirements();
    }
  }, [currentUser, isDriver, location.pathname, navigate, userProfile, drivers, vehicles]);

  // Load user data on mount and when user changes
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      // Skip loading admin data if user is a driver
      if (isDriver) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Load vehicles, orders, drivers, and user profile
        const [userVehicles, userOrders, userDrivers, profile] = await Promise.all([
          getUserVehicles(currentUser.id),
          getUserOrders(currentUser.id),
          getUserDrivers(currentUser.id),
          getUserProfile(currentUser.id)
        ]);
        
        setUserProfile(profile);
        
        // Map database field names to form field names for vehicles
        const mappedVehicles = userVehicles.map(vehicle => {
          // Find driver name by driver ID
          const driverId = vehicle.driver || vehicle.chauffeur;
          const driver = userDrivers?.find(d => d.id === driverId);
          const driverName = driver?.name || driverId || '-';
          
          return {
            ...vehicle,
            // Map database fields to form fields for backward compatibility
            kenteken: vehicle.license_plate || vehicle.kenteken,
            omschrijving: vehicle.description || vehicle.omschrijving,
            vasteKleur: vehicle.fixed_color || vehicle.vasteKleur,
            brandstofType: vehicle.fuel_type || vehicle.brandstofType,
            verbruik: vehicle.consumption || vehicle.verbruik,
            co2Uitstoot: vehicle.co2_emission || vehicle.co2Uitstoot,
            chauffeur: driverName, // Use driver name for display
            driver: driverId, // Keep driver ID for form editing
            starttijd: vehicle.start_time || vehicle.starttijd,
            eindtijd: vehicle.end_time || vehicle.eindtijd,
            snelheid: vehicle.speed || vehicle.snelheid
          };
        });
        
        // Map database field names to frontend format for orders
        const mappedOrders = userOrders.map(order => ({
          ...order,
          // Map snake_case to camelCase for frontend compatibility
          orderType: order.order_type || order.orderType,
          customerInfo: order.customer_info || order.customerInfo
        }));
        
        setVehicles(mappedVehicles);
        setAllOrders(mappedOrders);
        setDrivers(userDrivers || []);
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [currentUser, isDriver]);

  // Functie om automatisch e-mail te verzenden wanneer een stop met e-mail wordt toegevoegd
  const sendWelcomeEmail = async (stop, routeName, routeDate, routeId) => {
    if (!currentUser || !stop.email || !stop.email.trim()) {
      return; // Geen e-mail als gebruiker niet ingelogd is of geen e-mail heeft
    }

    try {
      // Haal template op
      let savedTemplate;
      try {
        savedTemplate = await getEmailTemplate(currentUser.id, 'klant-aangemeld');
      } catch (templateError) {
        console.error('Error loading welcome email template:', templateError);
        // Gebruik default template als tabel niet bestaat
        if (templateError.message && (
          templateError.message.includes('email_templates') || 
          templateError.message.includes('does not exist') ||
          templateError.message.includes('schema cache')
        )) {
          savedTemplate = null; // Gebruik default template
        } else {
          return; // Stop als er een andere fout is
        }
      }

      // Als geen template, gebruik default
      if (!savedTemplate) {
        const routeNameForTemplate = routeName || 'Route';
        const routeDateForTemplate = routeDate 
          ? new Date(routeDate).toLocaleDateString('nl-NL', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })
          : 'vandaag';
        const routeLink = routeId ? `https://routenu.nl/route/${routeId}` : '#';
        
        savedTemplate = {
          subject: `Welkom bij RouteNu - U bent toegevoegd aan route ${routeNameForTemplate}`,
          html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #0CC0DF;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 8px 8px;
    }
    .button {
      display: inline-block;
      background: #0CC0DF;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 9999px;
      margin-top: 20px;
    }
    .info-box {
      background: white;
      padding: 15px;
      border-radius: 8px;
      margin: 15px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RouteNu</h1>
  </div>
  <div class="content">
    <h2>Beste ${stop.name || 'klant'},</h2>
    <p>De route <strong>${routeNameForTemplate}</strong> is aangemaakt en u bent aangemeld voor deze route op <strong>${routeDateForTemplate}</strong>.</p>
    <div class="info-box">
      <p><strong>Uw stop:</strong></p>
      <p>${stop.address || 'Adres wordt binnenkort toegevoegd'}</p>
    </div>
    <p>U ontvangt verdere informatie zodra de route is berekend en geoptimaliseerd.</p>
    <a href="${routeLink}" class="button">Bekijk route</a>
  </div>
</body>
</html>`,
          from_email: 'noreply@routenu.nl'
        };
      }

      // Vervang template variabelen
      const routeNameForTemplate = routeName || 'Route';
      const routeDateForTemplate = routeDate 
        ? new Date(routeDate).toLocaleDateString('nl-NL', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          })
        : 'vandaag';
      const routeLink = routeId ? `https://routenu.nl/route/${routeId}` : '#';
      
      let htmlContent = savedTemplate.html_content
        .replace(/\$\{stopName\}/g, stop.name || 'klant')
        .replace(/\$\{stopAddress\}/g, stop.address || 'Adres wordt binnenkort toegevoegd')
        .replace(/\$\{routeName\}/g, routeNameForTemplate)
        .replace(/\$\{routeDate\}/g, routeDateForTemplate)
        .replace(/\$\{routeLink\}/g, routeLink);

      let subject = savedTemplate.subject
        .replace(/\$\{stopName\}/g, stop.name || 'klant')
        .replace(/\$\{stopAddress\}/g, stop.address || 'Adres wordt binnenkort toegevoegd')
        .replace(/\$\{routeName\}/g, routeNameForTemplate)
        .replace(/\$\{routeDate\}/g, routeDateForTemplate)
        .replace(/\$\{routeLink\}/g, routeLink);

      // Verstuur e-mail
      const response = await fetch(`${API_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: savedTemplate.from_email || 'noreply@routenu.nl',
          to: stop.email.trim(),
          subject: subject,
          html: htmlContent
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error sending welcome email:', errorData);
      } else {
        // Verstuur webhook als e-mail succesvol is verzonden en webhook URL bestaat
        if (savedTemplate.webhook_url) {
          await sendWebhook(savedTemplate.webhook_url, 'klant-aangemeld', {
            stopName: stop.name || '',
            name: stop.name || '',
            email: stop.email || '',
            phone: stop.phone || '',
            stopAddress: stop.address || '',
            address: stop.address || '',
            routeName: routeNameForTemplate,
            routeDate: routeDateForTemplate,
            routeLink: routeLink
          });
        }
      }
    } catch (error) {
      console.error('Error sending welcome email:', error);
      // Fail silently - don't interrupt the stop addition process
    }
  };

  const handleAddStop = async (location) => {
    const newStop = {
      id: Date.now(),
      name: location.name || `Stop ${stops.length + 1}`,
      coordinates: location.coordinates,
      address: location.address || '',
      email: location.email || '',
      phone: location.phone || '',
      orderType: location.orderType || '',
      customerInfo: location.customerInfo || null
    };
    
    // Voeg toe aan huidige route stops
    const updatedStops = [...stops, newStop];
    setStops(updatedStops);
    
    // Save to Supabase if user is logged in
    if (currentUser) {
      try {
        await saveOrder(currentUser.id, newStop);
        // Reload orders to get updated list
        const userOrders = await getUserOrders(currentUser.id);
        setAllOrders(userOrders);
        
        // Auto-save route with new stops
        await autoSaveRoute(updatedStops, null, null);
        
        // Verstuur welkomst e-mail als stop een e-mailadres heeft
        if (newStop.email && newStop.email.trim()) {
          const routeNameForEmail = selectedRouteDate 
            ? `Route ${new Date(selectedRouteDate).toLocaleDateString('nl-NL')}` 
            : 'Route';
          sendWelcomeEmail(newStop, routeNameForEmail, selectedRouteDate, currentRouteId);
        }
      } catch (error) {
        console.error('Error saving order:', error);
      }
    } else {
      // Fallback: add to local state if not logged in
      setAllOrders(prev => {
        const exists = prev.some(order => 
          order.address === newStop.address && 
          order.name === newStop.name
        );
        if (!exists) {
          return [...prev, newStop];
        }
        return prev;
      });
    }
  };

  const handleEditStop = (stop) => {
    setEditingStop(stop);
    setIsModalOpen(true);
  };

  const handleUpdateStop = async (stopId, updatedData) => {
    const updatedStops = stops.map(stop => 
      stop.id === stopId 
        ? { ...stop, ...updatedData }
        : stop
    );
    setStops(updatedStops);
    
    // Update order in database if user is logged in
    if (currentUser) {
      try {
        // Find the order in allOrders to get its database ID
        const orderToUpdate = allOrders.find(order => order.id === stopId);
        if (orderToUpdate && orderToUpdate.db_id) {
          const { updateItem } = await import('./services/userData');
          await updateItem('orders', orderToUpdate.db_id, {
            name: updatedData.name,
            address: updatedData.address,
            coordinates: updatedData.coordinates,
            email: updatedData.email,
            phone: updatedData.phone,
            order_type: updatedData.orderType,
            customer_info: updatedData.customerInfo
          });
        }
        
        // Reload orders to get updated list
        const userOrders = await getUserOrders(currentUser.id);
        setAllOrders(userOrders);
        
        // Auto-save route with updated stops
        await autoSaveRoute(updatedStops, null, null);
      } catch (error) {
        console.error('Error updating order:', error);
      }
    }
    
    // Recalculate route if route exists
    if (route) {
      setRoute(null);
      // Optionally auto-recalculate route here
    }
    
    setEditingStop(null);
    setIsModalOpen(false);
  };

  // Helper function to get driver ID from driver name
  const getDriverIdFromName = async (driverName) => {
    if (!driverName || !currentUser) return null;
    try {
      const { getUserDrivers } = await import('./services/userData');
      const drivers = await getUserDrivers(currentUser.id);
      const driver = drivers.find(d => d.name === driverName);
      return driver ? driver.id : null;
    } catch (error) {
      console.error('Error getting driver ID:', error);
      return null;
    }
  };

  // Helper function to auto-save route to database
  const autoSaveRoute = async (updatedStops, updatedRoute = null, updatedDriver = null) => {
    if (!currentUser || !currentRouteId) return;

    try {
      const { updateItem } = await import('./services/userData');
      const driverToSave = updatedDriver !== null ? updatedDriver : selectedDriver;
      const driverId = driverToSave ? await getDriverIdFromName(driverToSave) : null;
      
      await updateItem('routes', currentRouteId, {
        stops: updatedStops,
        route_data: updatedRoute !== null ? updatedRoute : route,
        selected_driver: driverToSave,
        driver_id: driverId
      });
      console.log('Route automatisch bijgewerkt');
    } catch (error) {
      console.error('Error auto-saving route:', error);
    }
  };

  const handleRemoveStop = async (id) => {
    const updatedStops = stops.filter(stop => stop.id !== id);
    setStops(updatedStops);
    if (route) setRoute(null);
    
    // Auto-save route after removing stop
    await autoSaveRoute(updatedStops, null);
  };

  // Reorder stops (move from oldIndex to newIndex)
  const handleReorderStops = async (oldIndex, newIndex) => {
    const updatedStops = [...stops];
    const [movedStop] = updatedStops.splice(oldIndex, 1);
    updatedStops.splice(newIndex, 0, movedStop);
    setStops(updatedStops);
    setRoute(null); // Clear route when order changes
    
    // Auto-save route after reordering
    await autoSaveRoute(updatedStops, null);
  };

  // Calculate route based on current stop order (no optimization)
  const handleCalculateRoute = async () => {
    if (stops.length < 1) {
      alert('Voeg minimaal 1 stop toe om een route te berekenen');
      return;
    }

    setIsOptimizing(true);
    try {
      // Get startpoint from user profile or use first stop
      let startCoordinates = null;
      if (userProfile?.start_coordinates) {
        startCoordinates = normalizeCoordinates(userProfile.start_coordinates);
      } else if (stops.length > 0 && stops[0].coordinates) {
        startCoordinates = normalizeCoordinates(stops[0].coordinates);
      } else {
        alert('Geen startpunt gevonden. Stel een startpunt in via Instellingen.');
        setIsOptimizing(false);
        return;
      }

      // Validate that startCoordinates is valid
      if (!startCoordinates || !Array.isArray(startCoordinates) || startCoordinates.length !== 2) {
        alert('Startpunt heeft geen geldige coördinaten. Stel een startpunt in via Instellingen.');
        setIsOptimizing(false);
        return;
      }

      // Validate that all stops have valid coordinates and normalize them
      const normalizedStops = stops.map(stop => ({
        ...stop,
        coordinates: stop.coordinates ? normalizeCoordinates(stop.coordinates) : stop.coordinates
      }));

      const stopsWithInvalidCoordinates = normalizedStops.filter(stop => 
        !stop.coordinates || 
        !Array.isArray(stop.coordinates) || 
        stop.coordinates.length !== 2 ||
        typeof stop.coordinates[0] !== 'number' ||
        typeof stop.coordinates[1] !== 'number'
      );

      if (stopsWithInvalidCoordinates.length > 0) {
        console.error('Stops with invalid coordinates:', stopsWithInvalidCoordinates);
        alert(`Er zijn ${stopsWithInvalidCoordinates.length} stop(s) zonder geldige coördinaten. Controleer de stops en voeg coördinaten toe.`);
        setIsOptimizing(false);
        return;
      }

      // Format: startpoint;stop1;stop2;...;startpoint (startpoint first, then stops, then back to start)
      const stopCoordinates = normalizedStops
        .filter(stop => stop.coordinates && Array.isArray(stop.coordinates) && stop.coordinates.length === 2)
        .map(stop => `${stop.coordinates[0]},${stop.coordinates[1]}`)
        .join(';');
      
      if (!stopCoordinates) {
        alert('Geen geldige stops gevonden met coördinaten.');
        setIsOptimizing(false);
        return;
      }

      const coordinates = `${startCoordinates[0]},${startCoordinates[1]};${stopCoordinates};${startCoordinates[0]},${startCoordinates[1]}`;
      
      // Log detailed coordinate information for debugging
      console.log('Calling Mapbox API with coordinates:', {
        coordinatesLength: coordinates.length,
        stopsCount: normalizedStops.length,
        startCoordinates,
        hasStopCoordinates: !!stopCoordinates,
        fullCoordinatesString: coordinates,
        allStopCoordinates: normalizedStops.map((stop, idx) => ({
          index: idx,
          name: stop.name,
          coordinates: stop.coordinates,
          formatted: stop.coordinates ? `${stop.coordinates[0]},${stop.coordinates[1]}` : 'MISSING'
        }))
      });
      
      // Gebruik Directions API met public token (werkt vanuit browser)
      // Voor meerdere stops gebruiken we waypoints
      // Note: Mapbox expects coordinates in URL path, not URL encoded
      const apiUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?` +
        `access_token=${MAPBOX_PUBLIC_TOKEN}&` +
        `geometries=geojson&` +
        `overview=full&` +
        `steps=true&` +
        `annotations=duration,distance`;
      
      console.log('Mapbox API URL (first 300 chars):', apiUrl.substring(0, 300));
      
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Mapbox API error:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(errorData.message || `Route berekening mislukt (${response.status})`);
      }

      const data = await response.json();
      
      console.log('Mapbox API response:', {
        code: data.code,
        hasRoutes: !!data.routes,
        routesLength: data.routes?.length,
        message: data.message,
        fullResponse: data // Log full response for debugging
      });
      
      // If NoRoute, log more details
      if (data.code === 'NoRoute') {
        console.error('Mapbox NoRoute error details:', {
          code: data.code,
          message: data.message,
          waypoints: data.waypoints,
          coordinates: coordinates,
          stops: stops.map(s => ({ name: s.name, coords: s.coordinates }))
        });
      }
      
      // Directions API response
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const routeData = data.routes[0];
        const calculatedRoute = {
          geometry: routeData.geometry,
          distance: routeData.distance,
          duration: routeData.duration,
          waypoints: data.waypoints
        };
        
        console.log('Route calculated (handleCalculateRoute), setting route state', {
          hasGeometry: !!calculatedRoute.geometry,
          coordinatesCount: calculatedRoute.geometry?.coordinates?.length,
          distance: calculatedRoute.distance
        });
        
        // Set route state first (so Map component can render it immediately)
        // Use a new object reference to ensure React detects the change
        setRoute({ ...calculatedRoute });

        // Auto-save route with calculated route data (async, doesn't block rendering)
        autoSaveRoute(stops, calculatedRoute, null).catch(err => {
          console.error('Error auto-saving route:', err);
        });
      } else {
        console.error('Mapbox API returned no route:', {
          code: data.code,
          message: data.message,
          data: data
        });
        throw new Error(data.message || 'Geen route gevonden. Controleer of alle stops geldige coördinaten hebben.');
      }
    } catch (error) {
      console.error('Route berekening error:', error);
      alert(`Er is een fout opgetreden: ${error.message || 'Route berekening mislukt'}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleOptimizeRoute = async () => {
    if (stops.length < 1) {
      alert('Voeg minimaal 1 stop toe om een route te optimaliseren');
      return;
    }

    setIsOptimizing(true);
    try {
      // Get startpoint from user profile or use first stop
      let startCoordinates = null;
      if (userProfile?.start_coordinates) {
        startCoordinates = normalizeCoordinates(userProfile.start_coordinates);
      } else if (stops.length > 0 && stops[0].coordinates) {
        startCoordinates = normalizeCoordinates(stops[0].coordinates);
      } else {
        alert('Geen startpunt gevonden. Stel een startpunt in via Instellingen.');
        setIsOptimizing(false);
        return;
      }

      // Validate that startCoordinates is valid
      if (!startCoordinates || !Array.isArray(startCoordinates) || startCoordinates.length !== 2) {
        alert('Startpunt heeft geen geldige coördinaten. Stel een startpunt in via Instellingen.');
        setIsOptimizing(false);
        return;
      }

      // Validate that all stops have valid coordinates and normalize them
      const normalizedStops = stops.map(stop => ({
        ...stop,
        coordinates: stop.coordinates ? normalizeCoordinates(stop.coordinates) : stop.coordinates
      }));

      const stopsWithInvalidCoordinates = normalizedStops.filter(stop => 
        !stop.coordinates || 
        !Array.isArray(stop.coordinates) || 
        stop.coordinates.length !== 2 ||
        typeof stop.coordinates[0] !== 'number' ||
        typeof stop.coordinates[1] !== 'number'
      );

      if (stopsWithInvalidCoordinates.length > 0) {
        console.error('Stops with invalid coordinates:', stopsWithInvalidCoordinates);
        alert(`Er zijn ${stopsWithInvalidCoordinates.length} stop(s) zonder geldige coördinaten. Controleer de stops en voeg coördinaten toe.`);
        setIsOptimizing(false);
        return;
      }

      // Check if we have too many waypoints (Optimization API limit is 12)
      const validStops = normalizedStops.filter(stop => 
        stop.coordinates && Array.isArray(stop.coordinates) && stop.coordinates.length === 2
      );
      
      if (validStops.length === 0) {
        alert('Geen geldige stops gevonden met coördinaten.');
        setIsOptimizing(false);
        return;
      }

      if (validStops.length > 11) {
        alert(`Te veel stops voor route optimalisatie. Maximum is 11 stops (je hebt ${validStops.length}).`);
        setIsOptimizing(false);
        return;
      }

      // Use Mapbox Optimization API to optimize the route order
      // This requires a secret token and will optimize the order of stops
      const waypoints = validStops.map(stop => ({
        coordinates: stop.coordinates
      }));

      // Optimization API request body
      // For roundtrip=true, we only need to send the start point ONCE
      // The API will automatically return to the start point
      // We set source=first to keep the start fixed, and let the API optimize the order of stops
      const optimizationRequest = {
        profile: 'driving',
        waypoints: [
          {
            coordinates: startCoordinates,
            approach: 'curb'
          },
          ...waypoints.map(wp => ({
            coordinates: wp.coordinates,
            approach: 'curb'
          }))
          // DO NOT add start coordinates again at the end - roundtrip handles the return automatically
        ],
        roundtrip: true,  // Automatically returns to start
        source: 'first',  // Keep start point fixed at position 0
        // destination: leave as 'any' (default) so API can choose best last stop before returning
        geometries: 'geojson',
        overview: 'full',
        steps: true,
        annotations: ['duration', 'distance']
      };

      console.log('Calling Mapbox Optimization API:', {
        waypointsCount: optimizationRequest.waypoints.length,
        stopsCount: validStops.length,
        startCoordinates,
        stopsOrder: validStops.map(s => s.name)
      });

      // Call Optimization API (requires secret token, must be done server-side)
      // Since we can't use secret token in browser, we'll use a backend endpoint
      // For now, let's use the backend API if available, otherwise fall back to Directions API
      const API_BASE_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8001');
      
      let response;
      let data;
      
      try {
        // Try to use backend API for optimization (if available)
        const optimizeUrl = API_BASE_URL.startsWith('http') 
          ? `${API_BASE_URL}/api/optimize-route`
          : `${API_BASE_URL}/optimize-route`;
        
        console.log('Calling backend optimization endpoint:', optimizeUrl);
        
        response = await fetch(optimizeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            waypoints: optimizationRequest.waypoints,
            profile: optimizationRequest.profile
          })
        });

        if (response.ok) {
          data = await response.json();
        } else {
          throw new Error('Backend optimization not available');
        }
      } catch (backendError) {
        console.log('Backend optimization not available, using client-side optimization fallback');
        
        // Fallback: Use Directions API with all permutations or a simple optimization
        // For now, we'll calculate the route and let Mapbox handle basic optimization
        // by trying different orderings
        const allWaypoints = validStops.map(stop => stop.coordinates);
        const startCoord = startCoordinates;
        
        // Try to optimize by calculating distance matrix and finding best order
        // For simplicity, we'll use a greedy nearest-neighbor approach
        const optimizedOrder = [startCoord];
        const remaining = [...allWaypoints];
        let current = startCoord;
        
        while (remaining.length > 0) {
          let nearest = null;
          let nearestIndex = -1;
          let minDistance = Infinity;
          
          // Find nearest unvisited waypoint
          for (let i = 0; i < remaining.length; i++) {
            const distance = Math.sqrt(
              Math.pow(current[0] - remaining[i][0], 2) + 
              Math.pow(current[1] - remaining[i][1], 2)
            );
            if (distance < minDistance) {
              minDistance = distance;
              nearest = remaining[i];
              nearestIndex = i;
            }
          }
          
          if (nearest) {
            optimizedOrder.push(nearest);
            remaining.splice(nearestIndex, 1);
            current = nearest;
          }
        }
        
        // Add return to start
        optimizedOrder.push(startCoord);
        
        // Calculate route with optimized order
        const coordinates = optimizedOrder.map(coord => `${coord[0]},${coord[1]}`).join(';');
        
        const apiUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?` +
          `access_token=${MAPBOX_PUBLIC_TOKEN}&` +
          `geometries=geojson&` +
          `overview=full&` +
          `steps=true&` +
          `annotations=duration,distance`;
        
        console.log('Using optimized order (nearest-neighbor):', coordinates);
        
        response = await fetch(apiUrl);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Route optimalisatie mislukt (${response.status})`);
        }
        
        data = await response.json();
        
        // If NoRoute with optimized order, try calculating in segments
        if (data.code === 'NoRoute' && optimizedOrder.length > 4) {
          console.log('Optimized route failed, trying segments approach...');
          
          try {
            const segmentSize = 2;
            const segments = [];
            const segmentWaypoints = optimizedOrder.slice(1, -1); // Remove start and end
            
            for (let i = 0; i < segmentWaypoints.length; i += segmentSize) {
              const segmentPoints = segmentWaypoints.slice(i, i + segmentSize);
              const segmentStart = i === 0 ? optimizedOrder[0] : segmentWaypoints[i - 1];
              const segmentEnd = i + segmentSize >= segmentWaypoints.length 
                ? optimizedOrder[optimizedOrder.length - 1] 
                : segmentWaypoints[i + segmentSize];
              
              const segmentCoords = `${segmentStart[0]},${segmentStart[1]};${segmentPoints.map(p => `${p[0]},${p[1]}`).join(';')};${segmentEnd[0]},${segmentEnd[1]}`;
              
              const segmentUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${segmentCoords}?` +
                `access_token=${MAPBOX_PUBLIC_TOKEN}&` +
                `geometries=geojson&` +
                `overview=full`;
              
              const segmentResponse = await fetch(segmentUrl);
              const segmentData = await segmentResponse.json();
              
              if (segmentData.code === 'Ok' && segmentData.routes && segmentData.routes.length > 0) {
                segments.push(segmentData.routes[0]);
              } else {
                console.error(`Segment ${i} failed:`, segmentData);
                throw new Error('Route segment calculation failed');
              }
            }
            
            // Combine segments
            const combinedCoordinates = [];
            let totalDistance = 0;
            let totalDuration = 0;
            
            segments.forEach((segment, idx) => {
              if (segment.geometry && segment.geometry.coordinates) {
                if (idx === 0) {
                  combinedCoordinates.push(...segment.geometry.coordinates);
                } else {
                  combinedCoordinates.push(...segment.geometry.coordinates.slice(1));
                }
                totalDistance += segment.distance || 0;
                totalDuration += segment.duration || 0;
              }
            });
            
            if (combinedCoordinates.length > 0) {
              data = {
                code: 'Ok',
                routes: [{
                  geometry: {
                    type: 'LineString',
                    coordinates: combinedCoordinates
                  },
                  distance: totalDistance,
                  duration: totalDuration
                }],
                waypoints: []
              };
              console.log('Route calculated from segments successfully');
            }
          } catch (segmentError) {
            console.error('Error calculating route in segments:', segmentError);
            // Fall through to show original error
          }
        }
      }
      
      console.log('Mapbox API response:', {
        code: data.code,
        hasRoutes: !!data.routes,
        routesLength: data.routes?.length,
        message: data.message
      });
      
      // If NoRoute, log more details
      if (data.code === 'NoRoute') {
        console.error('Mapbox NoRoute error details:', {
          code: data.code,
          message: data.message,
          waypoints: data.waypoints
        });
        throw new Error(data.message || 'Geen route gevonden. Controleer of alle stops geldige coördinaten hebben.');
      }
      
      // Process successful route response
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const routeData = data.routes[0];
        
        // If we have waypoints from the response, reorder stops to match optimized order
        let optimizedStops = [...stops];
        let stopsReordered = false;
        
        if (data.waypoints && data.waypoints.length > 0) {
          console.log('Waypoints from optimization API:', data.waypoints);
          console.log('Valid stops:', validStops.map(s => ({ name: s.name, coords: s.coordinates })));
          
          // IMPORTANT: According to Mapbox docs, waypoints array is in INPUT order (original order)
          // But waypoint_index gives the OPTIMIZED order within the trip
          // Since we now send [start, stop1, stop2, ...] (no duplicate start at end),
          // waypoint[0] = start (waypoint_index = 0)
          // waypoint[1..n] = stops (waypoint_index = optimized position)
          
          console.log('All waypoints from API:', data.waypoints.map(wp => ({
            location: wp.location,
            waypoint_index: wp.waypoint_index,
            trips_index: wp.trips_index
          })));
          
          // Skip the first waypoint (index 0 = start point)
          const stopWaypoints = data.waypoints.slice(1);
          
          console.log('Stop waypoints (excluding start at index 0):', stopWaypoints.map(wp => ({
            location: wp.location,
            waypoint_index: wp.waypoint_index
          })));
          
          // Create mapping: waypoint -> stop by matching coordinates
          // Keep track of which stops have been matched to handle duplicates
          const usedStopIndices = new Set();
          
          const stopMappings = stopWaypoints.map((wp) => {
            const wpCoords = wp.location || wp.coordinates || (Array.isArray(wp) ? wp : null);
            
            if (!wpCoords || !Array.isArray(wpCoords)) {
              console.warn('Invalid waypoint coordinates:', wp);
              return null;
            }
            
            // Find matching stop by coordinates (with tolerance)
            // For duplicates, find the first unmatched stop
            let stopIndex = -1;
            for (let i = 0; i < validStops.length; i++) {
              // Skip already matched stops (for handling duplicates)
              if (usedStopIndices.has(i)) continue;
              
              const stop = validStops[i];
              const stopCoords = stop.coordinates;
              if (!stopCoords || !Array.isArray(stopCoords)) continue;
              
              // Check if coordinates match (within 0.01 degrees tolerance, ~1km)
              // Increased tolerance to handle slight coordinate differences
              const lngDiff = Math.abs(stopCoords[0] - wpCoords[0]);
              const latDiff = Math.abs(stopCoords[1] - wpCoords[1]);
              
              if (lngDiff < 0.01 && latDiff < 0.01) {
                stopIndex = i;
                usedStopIndices.add(i); // Mark as matched
                break;
              }
            }
            
            if (stopIndex === -1) {
              console.warn(`Could not match waypoint to stop:`, {
                wpCoords,
                waypoint_index: wp.waypoint_index,
                availableStops: validStops.filter((_, idx) => !usedStopIndices.has(idx)).map(s => ({
                  name: s.name,
                  coords: s.coordinates
                }))
              });
            }
            
            return {
              waypoint: wp,
              waypoint_index: wp.waypoint_index !== undefined ? wp.waypoint_index : -1,
              stopIndex: stopIndex,
              coords: wpCoords
            };
          }).filter(mapping => mapping !== null && mapping.stopIndex !== -1);
          
          // Sort by waypoint_index to get optimized order
          // waypoint_index represents the position in the optimized trip
          stopMappings.sort((a, b) => a.waypoint_index - b.waypoint_index);
          
          console.log('Stop mappings sorted by waypoint_index (optimized order):', 
            stopMappings.map(m => ({
              stopIndex: m.stopIndex,
              stopName: validStops[m.stopIndex]?.name,
              waypoint_index: m.waypoint_index
            })));
          
          // Reorder stops based on optimized waypoint order
          // If we matched all stops, use the optimized order
          // If we didn't match all, try using waypoint_index as fallback
          if (stopMappings.length === validStops.length) {
            // Create new stops array in optimized order
            optimizedStops = stopMappings.map(mapping => validStops[mapping.stopIndex]);
            
            // Check if order actually changed
            stopsReordered = optimizedStops.some((stop, idx) => stop.id !== stops[idx]?.id);
            
            if (stopsReordered) {
              console.log('Stops reordered based on optimized route:');
              console.log('  Original order:', stops.map(s => s.name));
              console.log('  Optimized order:', optimizedStops.map(s => s.name));
              
              // Update stops state with optimized order
              setStops(optimizedStops);
            } else {
              console.log('Stops are already in optimal order');
            }
          } else if (stopMappings.length > 0 && stopWaypoints.length === validStops.length) {
            // Partial match - try to use waypoint_index order as best guess
            // This handles cases where coordinates don't match exactly
            console.warn(`Partial match: matched ${stopMappings.length} out of ${validStops.length} stops`);
            console.log('Attempting to reorder based on waypoint_index order...');
            
            // Use the waypoint order from the API response
            // waypoint_index tells us the optimized position
            const orderedByWaypointIndex = stopWaypoints
              .map((wp, inputIndex) => ({
                waypoint: wp,
                waypoint_index: wp.waypoint_index !== undefined ? wp.waypoint_index : -1,
                inputIndex: inputIndex // Original input order (0-based, excluding start)
              }))
              .filter(item => item.waypoint_index !== -1)
              .sort((a, b) => a.waypoint_index - b.waypoint_index);
            
            // Map back to stops using input index
            if (orderedByWaypointIndex.length === validStops.length) {
              optimizedStops = orderedByWaypointIndex.map(item => validStops[item.inputIndex]);
              
              stopsReordered = optimizedStops.some((stop, idx) => stop.id !== stops[idx]?.id);
              
              if (stopsReordered) {
                console.log('Stops reordered using waypoint_index fallback:');
                console.log('  Original order:', stops.map(s => s.name));
                console.log('  Optimized order:', optimizedStops.map(s => s.name));
                
                setStops(optimizedStops);
              }
            }
          } else {
            console.warn(`Could not reorder stops: matched ${stopMappings.length} out of ${validStops.length} stops`);
            console.warn('Stop mappings:', stopMappings);
          }
        }
        
        const calculatedRoute = {
          geometry: routeData.geometry,
          distance: routeData.distance,
          duration: routeData.duration,
          waypoints: data.waypoints
        };
        
        console.log('Route optimized and calculated (handleOptimizeRoute)', {
          hasGeometry: !!calculatedRoute.geometry,
          coordinatesCount: calculatedRoute.geometry?.coordinates?.length,
          distance: calculatedRoute.distance,
          duration: calculatedRoute.duration,
          stopsReordered: stopsReordered
        });
        
        // Set route state first (so Map component can render it immediately)
        setRoute({ ...calculatedRoute });

        // Auto-save route with optimized stops and calculated route data
        autoSaveRoute(optimizedStops, calculatedRoute, null).catch(err => {
          console.error('Error auto-saving route:', err);
        });
      } else {
        console.error('Mapbox API returned no route:', {
          code: data.code,
          message: data.message,
          data: data
        });
        throw new Error(data.message || 'Geen route gevonden. Controleer of alle stops geldige coördinaten hebben.');
      }
    } catch (error) {
      console.error('Route optimalisatie error:', error);
      alert(`Er is een fout opgetreden: ${error.message || 'Route optimalisatie mislukt'}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleClearRoute = () => {
    setRoute(null);
  };

  const createNewRouteForDate = async (date, dateStr) => {
    navigate('/route-aanmaken');
    
    try {
      const dateFormatted = date instanceof Date 
        ? date.toLocaleDateString('nl-NL')
        : new Date(date).toLocaleDateString('nl-NL');

      const newRouteId = await saveRoute(currentUser.id, {
        date: dateStr,
        name: `Route ${dateFormatted}`,
        stops: [],
        route_data: null,
        selected_driver: null,
        driver_id: null
      });
      setCurrentRouteId(newRouteId);
      setStops([]);
      setRoute(null);
      setSelectedDriver('');
      console.log('Nieuwe route automatisch aangemaakt in database');
    } catch (error) {
      console.error('Error creating route:', error);
    }
  };

  const handleLoadExistingRoute = (route) => {
    setShowRouteChoiceModal(false);
    navigate('/route-aanmaken');
    setCurrentRouteId(route.id);
    
    // Ensure stops have valid structure and normalize coordinates
    const loadedStops = (route.stops || []).map(stop => {
      // Normalize coordinates to [lng, lat] format if they exist
      if (stop.coordinates && Array.isArray(stop.coordinates) && stop.coordinates.length === 2) {
        const normalizedCoords = normalizeCoordinates(stop.coordinates);
        // Only update if coordinates were actually changed
        if (normalizedCoords[0] !== stop.coordinates[0] || normalizedCoords[1] !== stop.coordinates[1]) {
          console.log('Normalized coordinates for stop:', stop.name, stop.coordinates, '->', normalizedCoords);
          return { ...stop, coordinates: normalizedCoords };
        }
        return stop;
      }
      // If coordinates are missing or invalid, log a warning
      console.warn('Stop without valid coordinates:', stop);
      return stop;
    });
    
    console.log('Loading existing route:', {
      routeId: route.id,
      stopsCount: loadedStops.length,
      stopsWithCoordinates: loadedStops.filter(s => s.coordinates && Array.isArray(s.coordinates)).length,
      hasRouteData: !!route.route_data
    });
    
    setStops(loadedStops);
    setRoute(route.route_data || null);
    if (route.selected_driver) {
      setSelectedDriver(route.selected_driver);
    }
  };

  const handleCreateNewRoute = async () => {
    setShowRouteChoiceModal(false);
    const selectedDateStr = pendingDate instanceof Date 
      ? pendingDate.toISOString().split('T')[0] 
      : new Date(pendingDate).toISOString().split('T')[0];
    await createNewRouteForDate(pendingDate, selectedDateStr);
  };

  const handleSelectRoute = async (date) => {
    setSelectedRouteDate(date);
    
    // Try to load existing routes for this date if user is logged in
    if (currentUser) {
      try {
        const userRoutes = await getUserRoutes(currentUser.id);
        const selectedDateStr = date instanceof Date 
          ? date.toISOString().split('T')[0] 
          : new Date(date).toISOString().split('T')[0];
        
        const existingRoutes = userRoutes
          .filter(r => {
            if (!r.date) return false;
            const routeDate = new Date(r.date).toISOString().split('T')[0];
            return routeDate === selectedDateStr;
          })
          .sort((a, b) => {
            // Sort by created_at to match the order in Routes table
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
            return aTime - bTime;
          });

        if (existingRoutes.length > 0) {
          // Routes exist for this date, show choice modal
          setExistingRoutesForDate(existingRoutes);
          setPendingDate(date);
          setShowRouteChoiceModal(true);
        } else {
          // No routes for this date, create new one
          await createNewRouteForDate(date, selectedDateStr);
        }
      } catch (error) {
        console.error('Error loading route:', error);
      }
    } else {
      navigate('/route-aanmaken');
      setStops([]);
      setRoute(null);
    }
  };

  const handleNavigate = (view) => {
    if (view === 'routes') {
      navigate('/routes');
      setStops([]);
      setRoute(null);
      setSelectedRouteDate(null);
      setCurrentRouteId(null);
    } else if (view === 'vehicles') {
      navigate('/chauffeurs');
    } else if (view === 'orders') {
      navigate('/pakketten');
    } else if (view === 'email') {
      navigate('/berichten');
    }
  };

  const handleAddOrderToRoute = (order) => {
    // Navigeer naar route aanmaak pagina en voeg opdracht toe
    if (location.pathname !== '/route-aanmaken') {
      navigate('/route-aanmaken');
    }
    handleAddStop({
      name: order.name,
      coordinates: order.coordinates,
      address: order.address,
      email: order.email,
      phone: order.phone,
      orderType: order.orderType,
      customerInfo: order.customerInfo
    });
  };

  const handleVehicleAdded = async (vehiclesData) => {
    // Vehicle is already saved in database by Vehicles component
    // Update state immediately with the provided vehicles data
    if (vehiclesData && Array.isArray(vehiclesData)) {
      // If array is passed, use it directly and immediately
      setVehicles(vehiclesData);
    } else if (currentUser) {
      // Fallback: reload from database
      try {
        const userVehicles = await getUserVehicles(currentUser.id);
        setVehicles(userVehicles);
      } catch (error) {
        console.error('Error reloading vehicles:', error);
      }
    }
  };

  const getCurrentView = () => {
    const path = location.pathname;
    if (path === '/routes') return 'routes';
    if (path === '/chauffeurs') return 'vehicles';
    if (path === '/pakketten') return 'orders';
    if (path === '/berichten' || path === '/email') return 'email';
    if (path === '/route-aanmaken') return 'create-route';
    return 'routes';
  };

  // Check if we're on auth pages or onboarding
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/onboarding' || location.pathname === '/on-boarding';

  return (
    <div className="app">
      {!isAuthPage && currentUser && !isDriver && (
        <Sidebar onNavigate={handleNavigate} currentView={getCurrentView()} />
      )}
      <div className={`content-wrapper ${isAuthPage ? 'full-width' : ''}`}>
        <RouterRoutes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/onboarding" 
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/on-boarding" 
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            } 
          />
          <Route path="/chauffeur-login" element={<DriverLogin />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout/success" element={<Checkout />} />
          <Route path="/checkout/cancel" element={<Checkout />} />
          <Route 
            path="/chauffeur-dashboard" 
            element={
              <ProtectedRoute>
                <DriverDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/vandaag" 
            element={
              <ProtectedRoute>
                <TodayRoute />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/route/:routeId/:token/:email?" 
            element={<LiveRoute />} 
          />
          <Route 
            path="/routes" 
            element={
              <ProtectedRoute>
                {loading ? <div>Laden...</div> : <RoutesPage onSelectRoute={handleSelectRoute} />}
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chauffeurs" 
            element={
              <ProtectedRoute>
                {loading ? <div>Laden...</div> : <Vehicles vehicles={vehicles} onVehicleAdded={handleVehicleAdded} setVehicles={setVehicles} />}
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/pakketten" 
            element={
              <ProtectedRoute>
                {loading ? <div>Laden...</div> : <Orders allOrders={allOrders} onAddOrderToRoute={handleAddOrderToRoute} />}
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/analytics" 
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chauffeurs-lijst" 
            element={
              <ProtectedRoute>
                {loading ? <div>Laden...</div> : <Drivers />}
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/berichten" 
            element={
              <ProtectedRoute>
                <EmailConfigurator />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/email" 
            element={
              <ProtectedRoute>
                <EmailConfigurator />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profiel" 
            element={
              <ProtectedRoute>
                {loading ? <div>Laden...</div> : <Profile />}
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/route-aanmaken" 
            element={
              <ProtectedRoute>
                {loading ? <div>Laden...</div> : (
                  <>
                    <div className="sidebar">
                      <div className="logo-container">
                        <img src="/logo.png" alt="RouteNu" className="logo" />
                      </div>
                      {selectedRouteDate && (
                        <p className="subtitle">
                          Route voor {selectedRouteDate.toLocaleDateString('nl-NL', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      )}
                      {!selectedRouteDate && (
                        <p className="subtitle">Route optimalisatie voor Nederland</p>
                      )}
                      
                      <RoutePlanner
                        onAddStop={handleAddStop}
                        stops={stops}
                        onRemoveStop={handleRemoveStop}
                        onOptimizeRoute={handleOptimizeRoute}
                        onClearRoute={handleClearRoute}
                        isOptimizing={isOptimizing}
                        route={route}
                    selectedDriver={selectedDriver}
                    onDriverChange={async (driver) => {
                      setSelectedDriver(driver);
                      // Auto-save route when driver changes
                      await autoSaveRoute(stops, null, driver);
                    }}
                        vehicles={vehicles}
                        allOrders={allOrders}
                      />
                    </div>
                    
                    <div className="map-container">
                      <Map
                        mapboxToken={MAPBOX_PUBLIC_TOKEN}
                        stops={stops}
                        route={route}
                        startCoordinates={userProfile?.start_coordinates}
                        center={[5.2913, 52.1326]} // Centrum van Nederland
                        zoom={7}
                      />
                    </div>
                    
                    <Timeline
                        stops={stops}
                        route={route}
                        onRemoveStop={handleRemoveStop}
                        onReorderStops={handleReorderStops}
                        startAddress={userProfile?.start_address}
                        onEditStop={handleEditStop}
                        onCalculateRoute={handleCalculateRoute}
                        onOptimizeRoute={handleOptimizeRoute}
                        isOptimizing={isOptimizing}
                        departureTime={departureTime}
                        onDepartureTimeChange={setDepartureTime}
                        currentRouteId={currentRouteId}
                        routeName={selectedRouteDate ? `Route ${new Date(selectedRouteDate).toLocaleDateString('nl-NL')}` : 'Route'}
                        routeDate={selectedRouteDate}
                        vehicles={vehicles}
                        drivers={drivers}
                      />
                    <AddStopModal
                      isOpen={isModalOpen}
                      onClose={() => {
                        setIsModalOpen(false);
                        setEditingStop(null);
                      }}
                      onAddStop={handleAddStop}
                      editingStop={editingStop}
                      onUpdateStop={handleUpdateStop}
                    />
                  </>
                )}
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/monteur" 
            element={
              <ProtectedRoute>
                <DriverDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/" 
            element={
              currentUser ? (
                <Navigate to="/vandaag" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
        </RouterRoutes>
      </div>


      {/* Route Choice Modal */}
      {showRouteChoiceModal && (
        <div className="route-choice-overlay" onClick={() => setShowRouteChoiceModal(false)}>
          <div className="route-choice-content" onClick={(e) => e.stopPropagation()}>
            <div className="route-choice-header">
              <h2>Routes voor {pendingDate && new Date(pendingDate).toLocaleDateString('nl-NL')}</h2>
              <button className="close-button" onClick={() => setShowRouteChoiceModal(false)}>×</button>
            </div>
            <div className="route-choice-body">
              <p>Er zijn al {existingRoutesForDate.length} route(s) voor deze datum. Wat wil je doen?</p>
              
              <div className="existing-routes-list">
                <h3>Bestaande routes:</h3>
                {existingRoutesForDate.map((route, index) => (
                  <button
                    key={route.id}
                    className="route-choice-button"
                    onClick={() => handleLoadExistingRoute(route)}
                  >
                    <span className="route-number">{index + 1}</span>
                    <div className="route-info">
                      <div className="route-name">Route ({index + 1})</div>
                      <div className="route-details">
                        {route.stops?.length || 0} stops
                        {route.selected_driver && ` • ${route.selected_driver}`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="route-choice-actions">
                <button
                  className="btn-new-route-choice"
                  onClick={handleCreateNewRoute}
                >
                  <span className="plus-icon">+</span>
                  Nieuwe route aanmaken
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return <AppContent />;
}

export default App;

