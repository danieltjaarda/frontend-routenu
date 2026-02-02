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
import Profile from './pages/Profile';
import DriverLogin from './pages/DriverLogin';
import DriverDashboard from './pages/DriverDashboard';
import Drivers from './pages/Drivers';
import Checkout from './pages/Checkout';
import PickedUpBikes from './pages/PickedUpBikes';
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
const MAPBOX_SECRET_TOKEN = 'sk.eyJ1IjoiZmF0YmlrZWh1bHAiLCJhIjoiY21qNnhqdXdjMDExcDNkczZrNmN6ZGtkcCJ9._qbrsDUZpEOR97cAI17-hA';

// Public token voor Mapbox GL JS (kaart)
const MAPBOX_PUBLIC_TOKEN = process.env.REACT_APP_MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoiZmF0YmlrZWh1bHAiLCJhIjoiY21qNnhmanp5MDB4ajNncjB1YXJrMDc2cSJ9.5CYl4ZfCROi-pmyaNzETIg';

const API_BASE_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8001');

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
    
    // Don't redirect on auth pages, checkout, profile pages, or if already on /vandaag
    const excludedPages = ['/login', '/register', '/chauffeur-login', '/checkout', '/checkout/success', '/checkout/cancel', '/profiel', '/vandaag', '/route-aanmaken'];
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
      
      // Don't check on auth pages, profile page, checkout, setup pages, or /vandaag
      const allowedPages = ['/login', '/register', '/profiel', '/checkout', '/chauffeurs', '/voertuigen', '/chauffeurs-lijst', '/vandaag'];
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
        const mappedVehicles = userVehicles.map(vehicle => ({
          ...vehicle,
          // Map database fields to form fields for backward compatibility
          kenteken: vehicle.license_plate || vehicle.kenteken,
          omschrijving: vehicle.description || vehicle.omschrijving,
          vasteKleur: vehicle.fixed_color || vehicle.vasteKleur,
          brandstofType: vehicle.fuel_type || vehicle.brandstofType,
          verbruik: vehicle.consumption || vehicle.verbruik,
          co2Uitstoot: vehicle.co2_emission || vehicle.co2Uitstoot,
          chauffeur: vehicle.driver || vehicle.chauffeur, // Important for driver selection
          starttijd: vehicle.start_time || vehicle.starttijd,
          eindtijd: vehicle.end_time || vehicle.eindtijd,
          snelheid: vehicle.speed || vehicle.snelheid
        }));
        
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

  // Reverse the order of all stops
  const handleReverseRoute = async () => {
    if (stops.length < 2) return; // No point reversing 0 or 1 stops
    
    const reversedStops = [...stops].reverse();
    setStops(reversedStops);
    setRoute(null); // Clear route when order changes
    
    // Auto-save route after reversing
    await autoSaveRoute(reversedStops, null);
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
        startCoordinates = userProfile.start_coordinates;
      } else if (stops.length > 0) {
        startCoordinates = stops[0].coordinates;
      } else {
        alert('Geen startpunt gevonden. Stel een startpunt in via Instellingen.');
        setIsOptimizing(false);
        return;
      }

      // Format: startpoint;stop1;stop2;...;startpoint (startpoint first, then stops, then back to start)
      const stopCoordinates = stops.map(stop => `${stop.coordinates[0]},${stop.coordinates[1]}`).join(';');
      const coordinates = `${startCoordinates[0]},${startCoordinates[1]};${stopCoordinates};${startCoordinates[0]},${startCoordinates[1]}`;
      
      // Gebruik Directions API met public token (werkt vanuit browser)
      // Voor meerdere stops gebruiken we waypoints
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?` +
        `access_token=${MAPBOX_PUBLIC_TOKEN}&` +
        `geometries=geojson&` +
        `overview=full&` +
        `steps=true&` +
        `annotations=duration,distance`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Route berekening mislukt');
      }

      const data = await response.json();
      
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
        throw new Error(data.message || 'Geen route gevonden');
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
        startCoordinates = userProfile.start_coordinates;
      } else if (stops.length > 0) {
        startCoordinates = stops[0].coordinates;
      } else {
        alert('Geen startpunt gevonden. Stel een startpunt in via Instellingen.');
        setIsOptimizing(false);
        return;
      }

      // Format: startpoint;stop1;stop2;...;startpoint (startpoint first, then stops, then back to start)
      const stopCoordinates = stops.map(stop => `${stop.coordinates[0]},${stop.coordinates[1]}`).join(';');
      const coordinates = `${startCoordinates[0]},${startCoordinates[1]};${stopCoordinates};${startCoordinates[0]},${startCoordinates[1]}`;
      
      // Gebruik Directions API met public token (werkt vanuit browser)
      // Voor meerdere stops gebruiken we waypoints
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?` +
        `access_token=${MAPBOX_PUBLIC_TOKEN}&` +
        `geometries=geojson&` +
        `overview=full&` +
        `steps=true&` +
        `annotations=duration,distance`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Route optimalisatie mislukt');
      }

      const data = await response.json();
      
      // Directions API response
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const routeData = data.routes[0];
        const calculatedRoute = {
          geometry: routeData.geometry,
          distance: routeData.distance,
          duration: routeData.duration,
          waypoints: data.waypoints
        };
        
        console.log('Route calculated (handleOptimizeRoute), setting route state', {
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
        throw new Error(data.message || 'Geen route gevonden');
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
    setStops(route.stops || []);
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

  // Check if we're on auth pages
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <div className="app">
      {!isAuthPage && currentUser && !isDriver && (
        <Sidebar onNavigate={handleNavigate} currentView={getCurrentView()} />
      )}
      <div className={`content-wrapper ${isAuthPage ? 'full-width' : ''}`}>
        <RouterRoutes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
            path="/opgehaalde-fietsen" 
            element={
              <ProtectedRoute>
                <PickedUpBikes />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/nieuwe" 
            element={
              <ProtectedRoute>
                <PickedUpBikes />
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
                        onReverseRoute={handleReverseRoute}
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

