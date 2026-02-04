import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getEmailTemplate, sendWebhook, getRouteStopTimestamps, recalculateArrivalTimes, getPickedUpBikesForDriver } from '../services/userData';
import Map from '../components/Map';
import './DriverDashboard.css';

const MAPBOX_PUBLIC_TOKEN = process.env.REACT_APP_MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoiZmF0YmlrZWh1bHAiLCJhIjoiY21qNnhmanp5MDB4ajNncjB1YXJrMDc2cSJ9.5CYl4ZfCROi-pmyaNzETIg';

const API_BASE_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8001');
const FRONTEND_BASE_URL = process.env.REACT_APP_FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://app.routenu.nl' : window.location.origin);

function DriverDashboard() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [driver, setDriver] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [stopDetails, setStopDetails] = useState({});
  const [showStopModal, setShowStopModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showRouteOverview, setShowRouteOverview] = useState(false);
  const [routeTimestamps, setRouteTimestamps] = useState([]);
  const [hoursWorked, setHoursWorked] = useState('');
  const [kilometersDriven, setKilometersDriven] = useState('');
  const [selectedPickedUpStops, setSelectedPickedUpStops] = useState([]);
  const [pickedUpBikes, setPickedUpBikes] = useState([]);
  const [routeStopDetails, setRouteStopDetails] = useState({}); // Store stop details per route

  // Load stop details for a route
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

  useEffect(() => {
    const loadDriverData = async () => {
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
          // If driver doesn't exist, redirect to admin login
          if (driverError.code === 'PGRST116') {
            alert('Je bent niet geregistreerd als chauffeur. Log in als admin.');
            logout();
            window.location.href = '/login';
            return;
          }
        }

        if (driverData) {
          setDriver(driverData);

          // Load routes assigned to this driver (vandaag en toekomstig)
          // Use local date to avoid timezone issues
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const todayStr = `${year}-${month}-${day}`; // Format: YYYY-MM-DD (local time)

          const { data: routesData, error: routesError } = await supabase
            .from('routes')
            .select('id, user_id, date, name, stops, route_data, route_status, driver_id, route_started_at, live_route_token')
            .eq('driver_id', driverData.id)
            .gte('date', todayStr)
            .order('date', { ascending: true });

          if (routesError) {
            console.error('Error loading routes:', routesError);
          } else {
            console.log('Loaded routes for driver:', routesData);
            setRoutes(routesData || []);
            
            // Load stop details for all started routes
            if (routesData && routesData.length > 0) {
              routesData.forEach(async (route) => {
                if (route.route_status === 'started' && route.stops && route.stops.length > 0) {
                  const details = await loadStopDetails(route.id);
                  setRouteStopDetails(prev => ({ ...prev, [route.id]: details }));
                }
              });
            }
          }

          // Load picked up bikes for this driver
          try {
            const bikesData = await getPickedUpBikesForDriver(driverData.id);
            setPickedUpBikes(bikesData || []);
          } catch (bikesError) {
            console.error('Error loading picked up bikes:', bikesError);
          }
        }
      } catch (error) {
        console.error('Error loading driver data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDriverData();
  }, [currentUser, logout]);

  // Find first incomplete stop (needs to be called after stopDetails are loaded)
  const findFirstIncompleteStop = (route, loadedDetails) => {
    if (!route.stops || route.stops.length === 0) return 0;
    
    for (let i = 0; i < route.stops.length; i++) {
      if (!loadedDetails[i]) {
        return i;
      }
    }
    return route.stops.length; // All stops completed
  };

  // Check if a stop is completed
  const isStopCompleted = (routeId, stopIndex) => {
    return !!stopDetails[stopIndex];
  };


  const handleStartRoute = async (routeId) => {
    try {
      // Find the route to get stops
      const route = routes.find(r => r.id === routeId);
      if (!route || !route.stops) {
        throw new Error('Route niet gevonden of heeft geen stops');
      }

      // Generate a secure token for live route access (general route token)
      const liveRouteToken = `${routeId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Generate personal tokens for each stop with email
      const stopTokens = {};
      route.stops.forEach((stop, index) => {
        if (stop.email && stop.email.trim()) {
          // Generate unique token for this stop
          const stopToken = `${routeId}-${index}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          stopTokens[index.toString()] = stopToken;
        }
      });
      
      const startedAt = new Date().toISOString();
      
      const { error, data } = await supabase
        .from('routes')
        .update({ 
          route_status: 'started',
          route_started_at: startedAt,
          live_route_token: liveRouteToken,
          stop_tokens: stopTokens
        })
        .eq('id', routeId)
        .select('id, user_id, date, name, stops, route_data, route_status, driver_id, route_started_at, live_route_token, stop_tokens')
        .single();

      if (error) throw error;

      // Save route start timestamp
      if (data && data.stops && data.stops.length > 0) {
        // Save start time for first stop (departure from start)
        const { error: timestampError } = await supabase
          .from('route_stop_timestamps')
          .upsert({
            route_id: routeId,
            stop_index: -1, // -1 indicates route start
            route_started_at: startedAt
          }, {
            onConflict: 'route_id,stop_index'
          });

        if (timestampError) {
          console.error('Error saving route start timestamp:', timestampError);
        }
      }

      // Find the route and set it as active (route is already declared above)
      if (route && route.stops && route.stops.length > 0) {
        setActiveRoute({ ...route, route_started_at: startedAt, live_route_token: liveRouteToken, stop_tokens: stopTokens });
        setCurrentStopIndex(0);
        setStopDetails({});
        // Load existing stop details if any
        await loadStopDetails(routeId);
        setShowStopModal(true);
      }

      // Update local state
      setRoutes(prev => prev.map(r => 
        r.id === routeId ? { ...r, route_status: 'started', route_started_at: startedAt, live_route_token: liveRouteToken } : r
      ));

      // Send emails to customers with live route link
      // Use the updated route data from database (data) which includes user_id and stop_tokens
      // Merge with route from state to ensure we have stops
      const routeFromState = routes.find(r => r.id === routeId);
      const routeForEmail = { 
        ...data, 
        stops: routeFromState?.stops || route?.stops || data?.stops || [],
        stop_tokens: stopTokens
      };
      console.log('Sending route started emails for route:', routeForEmail.id, 'with user_id:', routeForEmail.user_id, 'stops count:', routeForEmail.stops?.length, 'stop_tokens:', stopTokens);
      await sendRouteStartedEmails(routeForEmail, liveRouteToken);
    } catch (error) {
      console.error('Error starting route:', error);
      alert('Fout bij het starten van de route: ' + error.message);
    }
  };

  // Send emails to customers when route starts
  const sendRouteStartedEmails = async (route, liveRouteToken) => {
    try {
      if (!route || !route.stops || route.stops.length === 0) return;
      
      // Get driver info for webhook
      const currentDriver = driver || null;
      
      // Get the route owner's user_id (admin who created the route)
      // The route.user_id should be the admin user, not the driver
      let routeOwnerId = route.user_id;
      
      // If route doesn't have user_id, try to get it from the route data or query it
      if (!routeOwnerId) {
        console.warn('Route has no user_id, trying to fetch route owner...');
        try {
          const { data: routeData, error: routeError } = await supabase
            .from('routes')
            .select('user_id')
            .eq('id', route.id)
            .single();
          
          if (routeError) {
            console.error('Error fetching route owner:', routeError);
            return;
          }
          
          routeOwnerId = routeData?.user_id;
        } catch (error) {
          console.error('Error getting route owner:', error);
          return;
        }
      }
      
      // Prepare route data for template (needed for webhook even if no emails)
      const routeName = route.name || 'Route';
      const routeDate = route.date 
        ? new Date(route.date).toLocaleDateString('nl-NL', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          })
        : 'vandaag';
      // Create general route link for webhooks (not personalized)
      const generalRouteLink = `${FRONTEND_BASE_URL}/route/${route.id}/${liveRouteToken}`;
      const stopsCount = route.stops.length;
      
      // Always fetch template to check for webhook, even if no emails will be sent
      let savedTemplate = null;
      let emailTemplate = null; // Separate variable for email sending
      
      if (routeOwnerId) {
        console.log('🔍 Fetching email template for route owner:', routeOwnerId, 'route:', route.id);
        try {
          // Get email template for "route-gestart" from the route owner (admin)
          savedTemplate = await getEmailTemplate(routeOwnerId, 'route-gestart');
          console.log('📧 Template fetched:', {
            exists: !!savedTemplate,
            hasHtmlContent: !!(savedTemplate?.html_content),
            htmlContentLength: savedTemplate?.html_content?.length,
            hasWebhook: !!(savedTemplate?.webhook_url),
            webhookUrl: savedTemplate?.webhook_url,
            webhookUrlType: typeof savedTemplate?.webhook_url,
            webhookUrlLength: savedTemplate?.webhook_url?.length,
            subject: savedTemplate?.subject,
            fromEmail: savedTemplate?.from_email,
            fullTemplate: savedTemplate // Log full template for debugging
          });
          
          // ALWAYS use custom template if it exists
          if (savedTemplate) {
            console.log('✅ Custom template found, using it for emails');
            // Use the custom template as-is - don't override with default
            emailTemplate = savedTemplate;
            
            // Only use default if html_content is completely missing
            if (!savedTemplate.html_content || !savedTemplate.html_content.trim()) {
              console.warn('⚠️ Custom template found but html_content is empty, using default content');
              emailTemplate = {
                ...savedTemplate, // Keep webhook_url and other custom fields
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
  </style>
</head>
<body>
  <div class="header">
    <h1>Routenu.nl</h1>
  </div>
  <div class="content">
    <h2>Beste klant,</h2>
    <p>Route <strong>\${routeName}</strong> voor \${routeDate} is gestart!</p>
    <p>De route bevat \${stopsText} en wordt nu uitgevoerd.</p>
    <p>U kunt de route live volgen via onderstaande link:</p>
    <a href="\${liveRouteLink}" class="button">Route live bekijken</a>
  </div>
</body>
</html>`
              };
            } else {
              console.log('✅ Using custom template html_content (length:', savedTemplate.html_content.length, ')');
            }
          } else {
            console.log('❌ No custom template found for route owner:', routeOwnerId, 'using default template');
            emailTemplate = {
              subject: `Route ${routeName} is gestart!`,
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
  </style>
</head>
<body>
  <div class="header">
    <h1>Routenu.nl</h1>
  </div>
  <div class="content">
    <h2>Beste klant,</h2>
    <p>Route <strong>\${routeName}</strong> voor \${routeDate} is gestart!</p>
    <p>De route bevat \${stopsText} en wordt nu uitgevoerd.</p>
    <p>U kunt de route live volgen via onderstaande link:</p>
    <a href="\${liveRouteLink}" class="button">Route live bekijken</a>
  </div>
</body>
</html>`,
              from_email: 'noreply@routenu.nl',
              webhook_url: null
            };
          }
        } catch (templateError) {
          console.error('❌ Error fetching template:', templateError);
          // Use default template on error
          console.log('⚠️ Using default template due to error');
          emailTemplate = {
            subject: `Route ${routeName} is gestart!`,
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
  </style>
</head>
<body>
  <div class="header">
    <h1>Routenu.nl</h1>
  </div>
  <div class="content">
    <h2>Beste klant,</h2>
    <p>Route <strong>\${routeName}</strong> voor \${routeDate} is gestart!</p>
    <p>De route bevat \${stopsText} en wordt nu uitgevoerd.</p>
    <p>U kunt de route live volgen via onderstaande link:</p>
    <a href="\${liveRouteLink}" class="button">Route live bekijken</a>
  </div>
</body>
</html>`,
            from_email: 'noreply@routenu.nl',
            webhook_url: null
          };
        }
      } else {
        console.warn('⚠️ Route has no user_id, cannot send emails, but will check for webhook');
      }
      
      // Log which template will be used
      if (emailTemplate) {
        console.log('📨 Email template to use:', {
          isCustom: !!savedTemplate,
          subject: emailTemplate.subject,
          hasHtmlContent: !!(emailTemplate.html_content),
          htmlContentLength: emailTemplate.html_content?.length,
          hasWebhook: !!(emailTemplate.webhook_url),
          webhookUrl: emailTemplate.webhook_url
        });
      }

      // Get customers with email addresses
      const customersWithEmail = route.stops.filter(stop => stop.email && stop.email.trim());
      
      // Get stop tokens from route (should be in data from handleStartRoute)
      const stopTokens = route.stop_tokens || {};
      
      // Send emails to all customers with personal links (if any and if template exists)
      const emailPromises = (customersWithEmail.length > 0 && emailTemplate && emailTemplate.html_content) ? customersWithEmail.map(async (stop) => {
        try {
          // Create personal link with email address
          const encodedEmail = encodeURIComponent(stop.email.trim().toLowerCase());
          const personalRouteLink = `${FRONTEND_BASE_URL}/route/${route.id}/${liveRouteToken}/${encodedEmail}`;
          console.log('✓ Generated personal link for email', stop.email, ':', personalRouteLink);
          console.log('  - Encoded email:', encodedEmail);
          console.log('  - Full URL:', personalRouteLink);
          
          // Calculate stopsText for proper pluralization
          const stopsText = `${stopsCount} stop${stopsCount !== 1 ? 's' : ''}`;
          
          // Replace template variables with personalized link
          // First replace escaped placeholders (from default template)
          let personalizedHtml = emailTemplate.html_content
            .replace(/\\\$\{routeName\}/g, routeName)
            .replace(/\\\$\{routeDate\}/g, routeDate)
            .replace(/\\\$\{routeLink\}/g, personalRouteLink)
            .replace(/\\\$\{liveRouteLink\}/g, personalRouteLink)
            .replace(/\\\$\{stopsCount\}/g, stopsCount.toString())
            .replace(/\\\$\{stopsText\}/g, stopsText)
            .replace(/\\\$\{stopName\}/g, stop.name || 'klant')
            // Then replace regular placeholders (from custom templates)
            .replace(/\$\{routeName\}/g, routeName)
            .replace(/\$\{routeDate\}/g, routeDate)
            .replace(/\$\{routeLink\}/g, personalRouteLink)
            .replace(/\$\{liveRouteLink\}/g, personalRouteLink)
            .replace(/\$\{stopsCount\}/g, stopsCount.toString())
            .replace(/\$\{stopsText\}/g, stopsText)
            .replace(/\$\{stopName\}/g, stop.name || 'klant');
          
          // Verify that the link is in the HTML
          if (personalizedHtml.includes(personalRouteLink)) {
            console.log('✓ Personal link verified in HTML for', stop.email);
          } else {
            console.error('✗ ERROR: Personal link NOT found in HTML for', stop.email);
            console.log('  - Expected link:', personalRouteLink);
            console.log('  - HTML contains link:', personalizedHtml.includes('route/'));
          }

          let personalizedSubject = emailTemplate.subject
            // First replace escaped placeholders
            .replace(/\\\$\{routeName\}/g, routeName)
            .replace(/\\\$\{routeDate\}/g, routeDate)
            .replace(/\\\$\{routeLink\}/g, personalRouteLink)
            .replace(/\\\$\{liveRouteLink\}/g, personalRouteLink)
            .replace(/\\\$\{stopsCount\}/g, stopsCount.toString())
            .replace(/\\\$\{stopName\}/g, stop.name || 'klant')
            // Then replace regular placeholders
            .replace(/\$\{routeName\}/g, routeName)
            .replace(/\$\{routeDate\}/g, routeDate)
            .replace(/\$\{routeLink\}/g, personalRouteLink)
            .replace(/\$\{liveRouteLink\}/g, personalRouteLink)
            .replace(/\$\{stopsCount\}/g, stopsCount.toString())
            .replace(/\$\{stopName\}/g, stop.name || 'klant');

          const response = await fetch(`${API_BASE_URL}/api/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: emailTemplate.from_email || 'noreply@routenu.nl',
              to: stop.email.trim(),
              subject: personalizedSubject,
              html: personalizedHtml
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'E-mail verzenden mislukt');
          }

          return { email: stop.email, success: true };
        } catch (error) {
          console.error(`Error sending email to ${stop.email}:`, error);
          return { email: stop.email, success: false, error: error.message };
        }
      }) : [];

      // Wait for all emails to be sent (if any)
      let successful = 0;
      let failed = 0;
      if (emailPromises.length > 0) {
        const results = await Promise.all(emailPromises);
        successful = results.filter(r => r.success).length;
        failed = results.filter(r => !r.success).length;
        console.log(`Route started emails sent: ${successful} successful, ${failed} failed`);
      } else {
        console.log('No customers with email addresses found, skipping email sending');
      }

      // Send webhook if configured (ALWAYS check, even if no emails were sent)
      // savedTemplate contains the original template from database (or null)
      // This preserves the webhook_url even if we use a default email template
      let webhookUrl = null;
      
      console.log('🔍 Checking for webhook URL...', {
        hasSavedTemplate: !!savedTemplate,
        savedTemplateWebhookUrl: savedTemplate?.webhook_url,
        savedTemplateWebhookUrlType: typeof savedTemplate?.webhook_url,
        savedTemplateWebhookUrlTrimmed: savedTemplate?.webhook_url?.trim(),
        routeOwnerId: routeOwnerId
      });
      
      if (savedTemplate && savedTemplate.webhook_url) {
        const trimmedUrl = savedTemplate.webhook_url.trim();
        if (trimmedUrl) {
          webhookUrl = trimmedUrl;
          console.log('✅ Webhook URL found in savedTemplate:', webhookUrl);
        } else {
          console.log('⚠️ savedTemplate.webhook_url exists but is empty/whitespace');
        }
      } else {
        console.log('⚠️ savedTemplate.webhook_url is missing:', {
          hasSavedTemplate: !!savedTemplate,
          webhookUrlValue: savedTemplate?.webhook_url,
          webhookUrlType: typeof savedTemplate?.webhook_url
        });
      }
      
      // Double-check: if savedTemplate is null or doesn't have webhook_url, try fetching again
      if (!webhookUrl && routeOwnerId) {
        console.log('🔄 Re-fetching template to check for webhook URL...');
        try {
          const webhookTemplate = await getEmailTemplate(routeOwnerId, 'route-gestart');
          console.log('🔄 Re-fetched template:', {
            exists: !!webhookTemplate,
            webhookUrl: webhookTemplate?.webhook_url,
            webhookUrlType: typeof webhookTemplate?.webhook_url,
            webhookUrlTrimmed: webhookTemplate?.webhook_url?.trim(),
            fullTemplate: webhookTemplate
          });
          
          if (webhookTemplate && webhookTemplate.webhook_url) {
            const trimmedUrl = webhookTemplate.webhook_url.trim();
            if (trimmedUrl) {
              webhookUrl = trimmedUrl;
              console.log('✅ Webhook URL found after re-fetch:', webhookUrl);
            } else {
              console.log('⚠️ Re-fetched template has webhook_url but it is empty/whitespace');
            }
          } else {
            console.log('❌ No webhook URL found in re-fetched template');
          }
        } catch (error) {
          console.error('❌ Error fetching template for webhook:', error);
        }
      } else if (!routeOwnerId) {
        console.log('❌ No routeOwnerId, cannot check for webhook URL');
      }
      
      if (webhookUrl) {
        // Send webhook for EACH stop separately (one webhook per stop)
        console.log(`🚀 Sending ${route.stops.length} webhook(s) from driver dashboard (one per stop)...`);
        
        // Send webhook for each stop with ONLY their specific data (no other stops)
        const webhookPromises = route.stops.map(async (stop, stopIndex) => {
          try {
            const encodedEmail = stop.email ? encodeURIComponent(stop.email.trim().toLowerCase()) : null;
            const personalRouteLink = encodedEmail 
              ? `${FRONTEND_BASE_URL}/route/${route.id}/${liveRouteToken}/${encodedEmail}`
              : generalRouteLink;
            
            const stopIdentifier = stop.email || stop.name || `Stop ${stopIndex + 1}`;
            console.log(`📤 Sending webhook for stop ${stopIndex + 1}: ${stopIdentifier}`);
            
            // Send webhook with ONLY this stop's data, no other stops
            await sendWebhook(webhookUrl, 'route-gestart', {
              routeName,
              routeDate,
              routeLink: generalRouteLink,
              liveRouteLink: personalRouteLink, // Use personal link for this stop
              stopsCount,
              driverName: currentDriver?.name || '',
              driverId: currentDriver?.id || '',
              vehicleInfo: '',
              routeId: route.id,
              routeStartedAt: route.route_started_at || new Date().toISOString(),
              // ONLY this stop's data - no other stops
              stopName: stop.name || '',
              stopEmail: stop.email || '',
              stopPhone: stop.phone || '',
              stopAddress: stop.address || '',
              stopPersonalRouteLink: personalRouteLink,
              stopIndex: stopIndex
            });
            
            console.log(`✅ Webhook successfully sent for stop ${stopIndex + 1}: ${stopIdentifier}`);
            return { stopIndex, identifier: stopIdentifier, success: true };
          } catch (webhookError) {
            const stopIdentifier = stop.email || stop.name || `Stop ${stopIndex + 1}`;
            console.error(`❌ Error sending webhook for stop ${stopIndex + 1} (${stopIdentifier}):`, webhookError);
            return { stopIndex, identifier: stopIdentifier, success: false, error: webhookError.message };
          }
        });
        
        // Wait for all webhooks to be sent
        const webhookResults = await Promise.all(webhookPromises);
        const successful = webhookResults.filter(r => r.success).length;
        const failed = webhookResults.filter(r => !r.success).length;
        console.log(`📊 Webhook summary: ${successful} successful, ${failed} failed`);
      } else {
        console.log('ℹ️ No webhook URL configured for route owner:', routeOwnerId);
      }
    } catch (error) {
      console.error('Error sending route started emails:', error);
      // Don't throw - email failures shouldn't block route start
    }
  };

  const handleSaveStopDetails = async (stopIndex, details) => {
    if (!activeRoute) return;

    try {
      const stop = activeRoute.stops[stopIndex];
      if (!stop) return;

      const now = new Date().toISOString();

      // Save stop details to database
      const { data, error } = await supabase
        .from('route_stop_details')
        .upsert({
          route_id: activeRoute.id,
          stop_index: stopIndex,
          stop_id: stop.id?.toString() || stopIndex.toString(),
          work_description: details.workDescription || null,
          amount_received: details.amountReceived ? parseFloat(details.amountReceived) : null,
          parts_cost: details.partsCost ? parseFloat(details.partsCost) : null,
          completed_at: now
        }, {
          onConflict: 'route_id,stop_index'
        })
        .select()
        .single();

      if (error) throw error;

      // Save actual arrival time for this stop
      const { error: timestampError } = await supabase
        .from('route_stop_timestamps')
        .upsert({
          route_id: activeRoute.id,
          stop_index: stopIndex,
          stop_id: stop.id?.toString() || stopIndex.toString(),
          actual_arrival_time: now,
          actual_departure_time: now // Will be updated when leaving
        }, {
          onConflict: 'route_id,stop_index'
        });

      if (timestampError) {
        console.error('Error saving stop timestamp:', timestampError);
      }

      // Update local state
      setStopDetails(prev => ({
        ...prev,
        [stopIndex]: details
      }));

      // Check if there are more stops
      if (stopIndex < activeRoute.stops.length - 1) {
        // Close modal and reopen for next stop to reset form fields
        setShowStopModal(false);
        // Use setTimeout to ensure modal closes before reopening
        setTimeout(() => {
          setCurrentStopIndex(stopIndex + 1);
          setShowStopModal(true);
        }, 100);
      } else {
        // All stops completed, show complete modal
        setShowStopModal(false);
        setShowCompleteModal(true);
      }
    } catch (error) {
      console.error('Error saving stop details:', error);
      alert('Fout bij opslaan stop details: ' + error.message);
    }
  };

  const handleCompleteRoute = async () => {
    if (!activeRoute || !hoursWorked) {
      alert('Vul eerst het aantal gewerkte uren in');
      return;
    }

    if (!kilometersDriven) {
      alert('Vul het aantal gereden kilometers in');
      return;
    }

    try {
      const hours = parseFloat(hoursWorked);
      if (isNaN(hours) || hours <= 0) {
        alert('Voer een geldig aantal uren in');
        return;
      }

      const kilometers = parseFloat(kilometersDriven);
      if (isNaN(kilometers) || kilometers < 0) {
        alert('Voer een geldig aantal kilometers in');
        return;
      }

      const { error } = await supabase
        .from('routes')
        .update({ 
          route_status: 'completed',
          hours_worked: hours,
          actual_distance_km: kilometers
        })
        .eq('id', activeRoute.id);

      if (error) throw error;

      // Save picked up bikes if any stops are selected
      if (selectedPickedUpStops.length > 0 && activeRoute.stops) {
        const pickedUpBikesData = selectedPickedUpStops.map(stopIndex => {
          const stop = activeRoute.stops[stopIndex];
          return {
            user_id: currentUser.id,
            route_id: activeRoute.id,
            stop_index: stopIndex,
            stop_name: stop.name || '',
            stop_email: stop.email || '',
            stop_phone: stop.phone || '',
            stop_address: stop.address || '',
            stop_coordinates: stop.coordinates || null,
            driver_id: driver?.id || null,
            driver_name: driver?.name || '',
            route_name: activeRoute.name || '',
            route_date: activeRoute.date || null
          };
        });

        // Insert picked up bikes
        const { error: bikesError } = await supabase
          .from('picked_up_bikes')
          .insert(pickedUpBikesData);

        if (bikesError) {
          console.error('Error saving picked up bikes:', bikesError);
          // Don't fail the route completion if bike saving fails
        } else {
          // Send webhook for each picked up bike separately
          const webhookUrl = 'https://hooks.zapier.com/hooks/catch/20451847/ulzf67x/';
          
          for (const bikeData of pickedUpBikesData) {
            try {
              await sendWebhook(webhookUrl, 'fiets-opgehaald', {
                route_id: activeRoute.id,
                route_name: activeRoute.name || '',
                route_date: activeRoute.date || '',
                stop_index: bikeData.stop_index,
                stop_name: bikeData.stop_name,
                stop_email: bikeData.stop_email,
                stop_phone: bikeData.stop_phone,
                stop_address: bikeData.stop_address,
                stop_coordinates: bikeData.stop_coordinates,
                driver_id: bikeData.driver_id,
                driver_name: bikeData.driver_name,
                picked_up_at: new Date().toISOString()
              });
            } catch (webhookError) {
              console.error('Error sending webhook for picked up bike:', webhookError);
              // Continue with other bikes even if one webhook fails
            }
          }
        }
      }

      // Update local state
      setRoutes(prev => prev.map(r => 
        r.id === activeRoute.id ? { ...r, route_status: 'completed', hours_worked: hours, actual_distance_km: kilometers } : r
      ));
      
      // Reload picked up bikes if any were saved
      if (selectedPickedUpStops.length > 0 && driver?.id) {
        try {
          const bikesData = await getPickedUpBikesForDriver(driver.id);
          setPickedUpBikes(bikesData || []);
        } catch (bikesError) {
          console.error('Error reloading picked up bikes:', bikesError);
        }
      }
      
      // Reset state
      setActiveRoute(null);
      setCurrentStopIndex(0);
      setStopDetails({});
      setShowCompleteModal(false);
      setHoursWorked('');
      setKilometersDriven('');
      setSelectedPickedUpStops([]);
      
      alert('Route succesvol voltooid!');
    } catch (error) {
      console.error('Error completing route:', error);
      alert('Fout bij het voltooien van de route: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="driver-dashboard">
        <div className="loading-message">Laden...</div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="driver-dashboard">
        <div className="error-message">
          Je bent niet geregistreerd als chauffeur. Log in als admin.
        </div>
      </div>
    );
  }

  // Helper function to format date as YYYY-MM-DD using local time (avoiding timezone issues)
  const formatDateAsLocalString = (date) => {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Filter routes: vandaag en toekomstig
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`; // Format: YYYY-MM-DD (local time)
  
  const todayRoutes = routes.filter(r => {
    const routeDateStr = formatDateAsLocalString(r.date);
    return routeDateStr === todayStr;
  });
  
  const futureRoutes = routes.filter(r => {
    const routeDateStr = formatDateAsLocalString(r.date);
    // Only include routes that are strictly in the future (not today)
    return routeDateStr && routeDateStr > todayStr;
  });
  
  const currentRoutes = todayRoutes.filter(r => r.route_status === 'started');
  const plannedTodayRoutes = todayRoutes.filter(r => r.route_status === 'planned' || !r.route_status);
  const completedRoutes = routes.filter(r => r.route_status === 'completed');

  return (
    <div className="driver-dashboard">
      <div className="logo-header">
        <img src="/logo.png" alt="RouteNu" className="logo" />
      </div>
      <div className="driver-header">
        <div className="driver-info">
          <h1>Welkom, {driver.name}</h1>
          <p>Chauffeur Dashboard</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="logout-btn" onClick={logout}>
            Uitloggen
          </button>
        </div>
      </div>

      <div className="routes-sections">
        {/* Huidige Route */}
        {currentRoutes.length > 0 && (
          <div className="route-section">
            <h2>Huidige Route</h2>
            <div className="routes-list">
              {currentRoutes.map((route) => {
                const routeDate = route.date 
                  ? new Date(route.date).toLocaleDateString('nl-NL')
                  : '-';
                const stopsCount = route.stops?.length || 0;
                const routeDetails = routeStopDetails[route.id] || {};

                return (
                  <div key={route.id} className="route-card active">
                    <div className="route-card-header">
                      <h3>{route.name || 'Route zonder naam'}</h3>
                      <span className="route-status started">Gestart</span>
                    </div>
                    <div className="route-card-body">
                      <p><strong>Datum:</strong> {routeDate}</p>
                      <p><strong>Aantal stops:</strong> {stopsCount}</p>
                    </div>
                    <div className="route-card-actions">
                      <button 
                        className="btn-overview"
                        onClick={async () => {
                          setActiveRoute(route);
                          // Load timestamps for route overview
                          try {
                            const timestamps = await getRouteStopTimestamps(route.id);
                            setRouteTimestamps(timestamps || []);
                            setShowRouteOverview(true);
                          } catch (error) {
                            console.error('Error loading timestamps:', error);
                            setRouteTimestamps([]);
                            setShowRouteOverview(true);
                          }
                        }}
                      >
                        Route overzicht
                      </button>
                      <button 
                        className="btn-continue"
                        onClick={() => {
                          navigate(`/monteur/route/${route.id}`);
                        }}
                      >
                        Route voortzetten
                      </button>
                    </div>
                    {/* Timeline */}
                    {route.stops && route.stops.length > 0 && (
                      <div className="route-timeline-small">
                        {route.stops.map((stop, index) => {
                          const isCompleted = !!routeDetails[index];
                          return (
                            <div 
                              key={index} 
                              className={`timeline-item-small ${isCompleted ? 'completed' : ''}`}
                            >
                              <div className="timeline-marker-small">
                                {isCompleted ? (
                                  <span className="checkmark-small">✓</span>
                                ) : (
                                  <span className="stop-number-small">{index + 1}</span>
                                )}
                              </div>
                              <div className="timeline-content-small">
                                <span className="stop-name-small">{stop.name || `Stop ${index + 1}`}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Routes van vandaag (gepland) */}
        {plannedTodayRoutes.length > 0 && (
          <div className="route-section">
            <h2>Routes van vandaag</h2>
            <div className="routes-list">
              {plannedTodayRoutes.map((route) => {
                const routeDate = route.date 
                  ? new Date(route.date).toLocaleDateString('nl-NL')
                  : '-';
                const stopsCount = route.stops?.length || 0;

                return (
                  <div key={route.id} className="route-card">
                    <div className="route-card-header">
                      <h3>{route.name || 'Route zonder naam'}</h3>
                      <span className="route-status planned">Gepland</span>
                    </div>
                    <div className="route-card-body">
                      <p><strong>Datum:</strong> {routeDate}</p>
                      <p><strong>Aantal stops:</strong> {stopsCount}</p>
                    </div>
                    <div className="route-card-actions">
                      <button 
                        className="btn-overview"
                        onClick={async () => {
                          setActiveRoute(route);
                          // For planned routes, there are no timestamps yet
                          setRouteTimestamps([]);
                          setShowRouteOverview(true);
                        }}
                      >
                        Route overzicht
                      </button>
                      <button 
                        className="btn-start"
                        onClick={() => handleStartRoute(route.id)}
                      >
                        Route starten
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Toekomstige Routes */}
        {futureRoutes.length > 0 && (
          <div className="route-section">
            <h2>Toekomstige Routes</h2>
            <div className="routes-list">
              {futureRoutes.map((route) => {
                const routeDate = route.date 
                  ? new Date(route.date).toLocaleDateString('nl-NL')
                  : '-';
                const stopsCount = route.stops?.length || 0;
                // Check if route is actually today (in case of timezone issues)
                const routeDateStr = formatDateAsLocalString(route.date);
                const isToday = routeDateStr === todayStr;

                return (
                  <div key={route.id} className="route-card">
                    <div className="route-card-header">
                      <h3>{route.name || 'Route zonder naam'}</h3>
                      <span className="route-status planned">Gepland</span>
                    </div>
                    <div className="route-card-body">
                      <p><strong>Datum:</strong> {routeDate}</p>
                      <p><strong>Aantal stops:</strong> {stopsCount}</p>
                    </div>
                    <div className="route-card-actions">
                      <button 
                        className="btn-overview"
                        onClick={async () => {
                          setActiveRoute(route);
                          // For future routes, there are no timestamps yet
                          setRouteTimestamps([]);
                          setShowRouteOverview(true);
                        }}
                      >
                        Route overzicht
                      </button>
                      {/* Show "Route starten" button if route is actually today */}
                      {isToday && (route.route_status === 'planned' || !route.route_status) && (
                        <button 
                          className="btn-start"
                          onClick={() => handleStartRoute(route.id)}
                        >
                          Route starten
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Opgehaalde Fietsen */}
        {pickedUpBikes.length > 0 && (
          <div className="route-section">
            <h2>Opgehaalde Fietsen</h2>
            <div className="routes-list">
              {pickedUpBikes.map((bike) => {
                const daysSince = bike.picked_up_at 
                  ? Math.floor((new Date() - new Date(bike.picked_up_at)) / (1000 * 60 * 60 * 24))
                  : 0;
                const pickupDate = bike.picked_up_at 
                  ? new Date(bike.picked_up_at).toLocaleDateString('nl-NL')
                  : '-';

                return (
                  <div key={bike.id} className="route-card">
                    <div className="route-card-header">
                      <h3>{bike.stop_name || 'Onbekende stop'}</h3>
                      <div className="days-badge-small">
                        <span className="days-number-small">{daysSince}</span>
                        <span className="days-label-small">dag{daysSince !== 1 ? 'en' : ''}</span>
                      </div>
                    </div>
                    <div className="route-card-body">
                      <p><strong>Adres:</strong> {bike.stop_address || '-'}</p>
                      <p><strong>Route:</strong> {bike.route_name || '-'}</p>
                      <p><strong>Opgehaald op:</strong> {pickupDate}</p>
                      {bike.stop_email && <p><strong>E-mail:</strong> {bike.stop_email}</p>}
                      {bike.stop_phone && <p><strong>Telefoon:</strong> {bike.stop_phone}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Geen routes */}
        {routes.length === 0 && (
          <div className="empty-routes">
            <p>Geen routes toegewezen</p>
          </div>
        )}
      </div>

      {/* Stop Details Modal */}
      {showStopModal && activeRoute && activeRoute.stops && currentStopIndex < activeRoute.stops.length && (
        <StopDetailsModal
          stop={activeRoute.stops[currentStopIndex]}
          stopIndex={currentStopIndex}
          totalStops={activeRoute.stops.length}
          onSave={(details) => handleSaveStopDetails(currentStopIndex, details)}
          onClose={() => {
            setShowStopModal(false);
            setActiveRoute(null);
          }}
          existingDetails={stopDetails[currentStopIndex]}
        />
      )}

      {/* Complete Route Modal */}
      {showCompleteModal && activeRoute && (
        <CompleteRouteModal
          route={activeRoute}
          hoursWorked={hoursWorked}
          onHoursChange={setHoursWorked}
          kilometersDriven={kilometersDriven}
          onKilometersChange={setKilometersDriven}
          selectedPickedUpStops={selectedPickedUpStops}
          onPickedUpStopsChange={setSelectedPickedUpStops}
          onComplete={handleCompleteRoute}
          onClose={() => {
            setShowCompleteModal(false);
            setActiveRoute(null);
            setHoursWorked('');
            setKilometersDriven('');
            setSelectedPickedUpStops([]);
          }}
        />
      )}

      {/* Route Overview Modal */}
      {showRouteOverview && activeRoute && (
        <RouteOverviewModal
          route={activeRoute}
          timestamps={routeTimestamps}
          onClose={() => {
            setShowRouteOverview(false);
            setActiveRoute(null);
            setRouteTimestamps([]);
          }}
        />
      )}
    </div>
  );
}

// Stop Details Modal Component
function StopDetailsModal({ stop, stopIndex, totalStops, onSave, onClose, existingDetails }) {
  const [workDescription, setWorkDescription] = useState(existingDetails?.workDescription || '');
  const [amountReceived, setAmountReceived] = useState(existingDetails?.amountReceived || '');
  const [partsCost, setPartsCost] = useState(existingDetails?.partsCost || '');
  const [showMapChooser, setShowMapChooser] = useState(false);

  // Reset form fields when stopIndex changes (new stop)
  useEffect(() => {
    setWorkDescription(existingDetails?.workDescription || '');
    setAmountReceived(existingDetails?.amountReceived || '');
    setPartsCost(existingDetails?.partsCost || '');
  }, [stopIndex, existingDetails]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      workDescription,
      amountReceived,
      partsCost
    });
  };

  const openInAppleMaps = () => {
    if (!stop.coordinates || !stop.address) return;
    const [lng, lat] = stop.coordinates;
    const url = `http://maps.apple.com/?q=${encodeURIComponent(stop.address)}&ll=${lat},${lng}`;
    window.open(url, '_blank');
    setShowMapChooser(false);
  };

  const openInGoogleMaps = () => {
    if (!stop.coordinates || !stop.address) return;
    const [lng, lat] = stop.coordinates;
    // Use universal Google Maps URL that works on all devices
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank');
    setShowMapChooser(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content stop-details-modal">
        <div className="modal-header">
          <h2>
            <span className="current-stop-number">{stopIndex + 1}</span>
            {' '}van {totalStops}
          </h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="stop-info">
            <h3>{stop.name || 'Stop zonder naam'}</h3>
            {stop.address && (
              <p 
                className="stop-address clickable-address"
                onClick={() => setShowMapChooser(true)}
              >
                📍 {stop.address}
              </p>
            )}
            {stop.email && <p className="stop-contact">📧 {stop.email}</p>}
            {stop.phone && (
              <div className="stop-contact">
                <a href={`tel:${stop.phone.replace(/\s/g, '')}`} className="phone-link-button">
                  <span className="phone-icon">📞</span>
                  <span className="phone-text">{stop.phone}</span>
                  <span className="phone-label">Bel nu</span>
                </a>
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit}>
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
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Annuleren
              </button>
              <button type="submit" className="btn-submit">
                {stopIndex < totalStops - 1 ? 'Volgende stop' : 'Alle stops voltooid'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Map Chooser Modal */}
      {showMapChooser && (
        <div className="modal-overlay" onClick={() => setShowMapChooser(false)}>
          <div className="modal-content map-chooser-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Open in kaart</h2>
              <button className="close-button" onClick={() => setShowMapChooser(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="map-chooser-address">{stop.address}</p>
              <div className="map-chooser-buttons">
                <button className="btn-apple-maps" onClick={openInAppleMaps}>
                  <span className="map-icon">🗺️</span>
                  <span>Kaarten</span>
                </button>
                <button className="btn-google-maps" onClick={openInGoogleMaps}>
                  <span className="map-icon">📍</span>
                  <span>Google Maps</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Complete Route Modal Component
function CompleteRouteModal({ route, hoursWorked, onHoursChange, kilometersDriven, onKilometersChange, selectedPickedUpStops, onPickedUpStopsChange, onComplete, onClose }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hoursWorked || parseFloat(hoursWorked) <= 0) {
      alert('Vul een geldig aantal uren in');
      return;
    }
    if (!kilometersDriven || parseFloat(kilometersDriven) < 0) {
      alert('Vul een geldig aantal kilometers in');
      return;
    }
    onComplete();
  };

  const handleStopToggle = (stopIndex) => {
    if (selectedPickedUpStops.includes(stopIndex)) {
      onPickedUpStopsChange(selectedPickedUpStops.filter(idx => idx !== stopIndex));
    } else {
      onPickedUpStopsChange([...selectedPickedUpStops, stopIndex]);
    }
  };

  // Get planned distance from route_data if available
  const plannedDistanceKm = route?.route_data?.distance ? (route.route_data.distance / 1000).toFixed(2) : null;
  const stops = route?.stops || [];

  return (
    <div className="modal-overlay">
      <div className="modal-content complete-route-modal">
        <div className="modal-header">
          <h2>Route voltooien</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p>Alle stops zijn voltooid. Vul de gegevens in om de route af te sluiten.</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="hours-worked">Gewerkte uren *</label>
              <input
                type="number"
                id="hours-worked"
                step="0.25"
                min="0.25"
                value={hoursWorked}
                onChange={(e) => onHoursChange(e.target.value)}
                placeholder="8.0"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="kilometers-driven">
                Gereden kilometers (km) *
                {plannedDistanceKm && (
                  <span className="form-hint"> (Gepland: {plannedDistanceKm} km)</span>
                )}
              </label>
              <input
                type="number"
                id="kilometers-driven"
                step="0.1"
                min="0"
                value={kilometersDriven}
                onChange={(e) => onKilometersChange(e.target.value)}
                placeholder={plannedDistanceKm || "0.0"}
                required
              />
            </div>
            <div className="form-group">
              <label>Opgehaalde fietsen (optioneel)</label>
              <p className="form-hint">Selecteer de stops waar je een fiets hebt opgehaald:</p>
              <div className="picked-up-stops-list">
                {stops.map((stop, index) => (
                  <label key={index} className="stop-checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedPickedUpStops.includes(index)}
                      onChange={() => handleStopToggle(index)}
                    />
                    <span className="stop-checkbox-text">
                      {stop.name || stop.address || `Stop ${index + 1}`}
                      {stop.address && <span className="stop-address"> - {stop.address}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Annuleren
              </button>
              <button type="submit" className="btn-submit">
                Route sluiten
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Route Overview Modal Component
function RouteOverviewModal({ route, timestamps, onClose }) {
  const [showMapChooser, setShowMapChooser] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);

  const formatTime = (timeString) => {
    if (!timeString) return '--:--';
    const date = new Date(timeString);
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('nl-NL', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const handleAddressClick = (address, coordinates) => {
    setSelectedAddress(address);
    setSelectedCoordinates(coordinates);
    setShowMapChooser(true);
  };

  const openInAppleMaps = () => {
    if (!selectedCoordinates || !selectedAddress) return;
    const [lng, lat] = selectedCoordinates;
    const url = `http://maps.apple.com/?q=${encodeURIComponent(selectedAddress)}&ll=${lat},${lng}`;
    window.open(url, '_blank');
    setShowMapChooser(false);
  };

  const openInGoogleMaps = () => {
    if (!selectedCoordinates || !selectedAddress) return;
    const [lng, lat] = selectedCoordinates;
    // Try native app first, fallback to web
    const nativeUrl = `comgooglemaps://?q=${lat},${lng}&center=${lat},${lng}&zoom=14`;
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    
    // Try to open native app, fallback to web
    const link = document.createElement('a');
    link.href = nativeUrl;
    link.target = '_blank';
    link.click();
    
    // Fallback to web if native doesn't work
    setTimeout(() => {
      window.open(webUrl, '_blank');
    }, 500);
    
    setShowMapChooser(false);
  };

  // Calculate estimated end time based on route data
  const calculateEndTime = () => {
    if (!route.route_data) return null;
    
    // If route is started, use route_started_at
    if (route.route_started_at) {
      const startTime = new Date(route.route_started_at);
      const totalDuration = route.route_data.duration || 0; // in seconds
      const endTime = new Date(startTime.getTime() + (totalDuration * 1000));
      return endTime;
    }
    
    // If route is not started yet, estimate based on departure_time or default 08:00
    const departureTime = route.departure_time || '08:00';
    const [hours, minutes] = departureTime.split(':').map(Number);
    const startTime = new Date();
    startTime.setHours(hours, minutes, 0, 0);
    const totalDuration = route.route_data.duration || 0; // in seconds
    const endTime = new Date(startTime.getTime() + (totalDuration * 1000));
    return endTime;
  };

  // Calculate planned arrival and departure times for each stop
  const calculatePlannedTimes = (stopIndex) => {
    if (!route.route_data || !route.stops || stopIndex >= route.stops.length) {
      return { arrival: null, departure: null, serviceTime: null };
    }

    // Get start time
    let startTime;
    if (route.route_started_at) {
      startTime = new Date(route.route_started_at);
    } else {
      const departureTime = route.departure_time || '08:00';
      const [hours, minutes] = departureTime.split(':').map(Number);
      startTime = new Date();
      startTime.setHours(hours, minutes, 0, 0);
    }

    // Calculate cumulative duration to this stop
    let cumulativeDuration = 0;
    if (route.route_data.waypoints && route.route_data.waypoints.length > 0) {
      // waypoints[0] is start, waypoints[1] is first stop, etc.
      // Waypoint durations are typically segment durations (time from previous waypoint)
      // We need to sum all segment durations up to this stop
      
      for (let i = 0; i <= stopIndex; i++) {
        // Get segment duration for this leg (from waypoint i to waypoint i+1)
        const segmentDuration = route.route_data.waypoints[i + 1]?.duration || 
                                (route.route_data.duration / (route.stops.length + 1));
        cumulativeDuration += segmentDuration;
      }
    } else {
      // Fallback: divide duration evenly
      const durationPerSegment = route.route_data.duration / (route.stops.length + 1);
      cumulativeDuration = durationPerSegment * (stopIndex + 1);
    }

    const arrivalTime = new Date(startTime.getTime() + (cumulativeDuration * 1000));
    
    // Get service time (from route_data or default 5 minutes)
    const serviceTimeMinutes = route.route_data?.service_time || 5;
    const departureTime = new Date(arrivalTime.getTime() + (serviceTimeMinutes * 60 * 1000));

    return {
      arrival: arrivalTime,
      departure: departureTime,
      serviceTime: serviceTimeMinutes
    };
  };

  const endTime = calculateEndTime();
  const routeStartTime = route.route_started_at ? formatTime(route.route_started_at) : (route.departure_time || '08:00');
  const routeEndTime = endTime ? formatTime(endTime.toISOString()) : '--:--';

  return (
    <div className="modal-overlay">
      <div className="modal-content route-overview-modal" style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h2>Route Overzicht: {route.name || 'Route zonder naam'}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="route-overview-info">
            <div className="info-row">
              <span className="info-label">Datum:</span>
              <span className="info-value">{formatDate(route.date)}</span>
            </div>
            {route.route_started_at ? (
              <div className="info-row">
                <span className="info-label">Route gestart om:</span>
                <span className="info-value">{routeStartTime}</span>
              </div>
            ) : (
              <div className="info-row">
                <span className="info-label">Verwachte starttijd:</span>
                <span className="info-value">{routeStartTime}</span>
              </div>
            )}
            {routeEndTime !== '--:--' && (
              <div className="info-row">
                <span className="info-label">{route.route_started_at ? 'Verwachte eindtijd:' : 'Geschatte eindtijd:'}</span>
                <span className="info-value">{routeEndTime}</span>
              </div>
            )}
            <div className="info-row">
              <span className="info-label">Totaal aantal stops:</span>
              <span className="info-value">{route.stops?.length || 0}</span>
            </div>
            {route.route_data?.duration && (() => {
              const totalMinutes = Math.round(route.route_data.duration / 60);
              const hours = Math.floor(totalMinutes / 60);
              const minutes = totalMinutes % 60;
              let durationText = '';
              if (hours > 0) {
                durationText = `${hours} ${hours === 1 ? 'uur' : 'uren'}`;
                if (minutes > 0) {
                  durationText += ` en ${minutes} ${minutes === 1 ? 'minuut' : 'minuten'}`;
                }
              } else {
                durationText = `${minutes} ${minutes === 1 ? 'minuut' : 'minuten'}`;
              }
              return (
                <div className="info-row">
                  <span className="info-label">Verwachte duur:</span>
                  <span className="info-value">{durationText}</span>
                </div>
              );
            })()}
          </div>

          <div className="stops-overview">
            <h3>Alle Stops</h3>
            <div className="stops-list-overview">
              {route.stops && route.stops.length > 0 ? (
                route.stops.map((stop, index) => {
                  const timestamp = timestamps.find(t => t.stop_index === index);
                  const isCompleted = timestamp && timestamp.actual_arrival_time;
                  const hasDeparted = timestamp && timestamp.actual_departure_time;
                  const plannedTimes = calculatePlannedTimes(index);

                  return (
                    <div key={index} className={`stop-overview-item ${isCompleted ? 'completed' : ''}`}>
                      <div className="stop-overview-header">
                        <div className="stop-number-overview">{index + 1}</div>
                        <div className="stop-info-overview">
                          <h4>{stop.name || `Stop ${index + 1}`}</h4>
                          {stop.address && (
                            <p 
                              className="stop-address-overview clickable-address"
                              onClick={() => handleAddressClick(stop.address, stop.coordinates)}
                            >
                              📍 {stop.address}
                            </p>
                          )}
                          {stop.email && <p className="stop-contact-overview">📧 {stop.email}</p>}
                          {stop.phone && (
                            <div className="stop-contact-overview">
                              <a href={`tel:${stop.phone.replace(/\s/g, '')}`} className="phone-link-button">
                                <span className="phone-icon">📞</span>
                                <span className="phone-text">{stop.phone}</span>
                                <span className="phone-label">Bel nu</span>
                              </a>
                            </div>
                          )}
                        </div>
                        {isCompleted && (
                          <div className="stop-status-overview completed">
                            <span>✓</span>
                          </div>
                        )}
                      </div>
                      <div className="stop-times-overview">
                        {/* Geplande tijden */}
                        <div className="time-info-overview">
                          <span className="time-label-overview">Geplande aankomst:</span>
                          <span className="time-value-overview planned">{plannedTimes.arrival ? formatTime(plannedTimes.arrival.toISOString()) : '--:--'}</span>
                        </div>
                        {plannedTimes.serviceTime && (
                          <div className="time-info-overview">
                            <span className="time-label-overview">Service tijd:</span>
                            <span className="time-value-overview planned">{plannedTimes.serviceTime} min</span>
                          </div>
                        )}
                        <div className="time-info-overview">
                          <span className="time-label-overview">Geplande eindtijd:</span>
                          <span className="time-value-overview planned">{plannedTimes.departure ? formatTime(plannedTimes.departure.toISOString()) : '--:--'}</span>
                        </div>
                        
                        {/* Werkelijke tijden (als beschikbaar) */}
                        {timestamp && timestamp.actual_arrival_time && (
                          <div className="time-info-overview">
                            <span className="time-label-overview">Werkelijke aankomst:</span>
                            <span className="time-value-overview actual">{formatTime(timestamp.actual_arrival_time)}</span>
                          </div>
                        )}
                        {timestamp && timestamp.actual_departure_time && (
                          <div className="time-info-overview">
                            <span className="time-label-overview">Werkelijke vertrek:</span>
                            <span className="time-value-overview actual">{formatTime(timestamp.actual_departure_time)}</span>
                          </div>
                        )}
                        {!isCompleted && (
                          <div className="time-info-overview">
                            <span className="time-label-overview">Status:</span>
                            <span className="time-value-overview pending">Nog niet aangekomen</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p>Geen stops beschikbaar</p>
              )}
            </div>
          </div>

          {/* Route kaart */}
          {route.stops && route.stops.length > 0 && (
            <div className="route-map-overview">
              <h3>Route op kaart</h3>
              <div className="map-container-overview">
                <Map
                  mapboxToken={MAPBOX_PUBLIC_TOKEN}
                  route={route.route_data?.geometry ? {
                    geometry: route.route_data.geometry,
                    distance: route.route_data.distance,
                    duration: route.route_data.duration
                  } : null}
                  stops={route.stops}
                  startCoordinates={route.route_data?.waypoints?.[0]?.coordinates || 
                                   (route.stops.length > 0 && route.stops[0]?.coordinates ? route.stops[0].coordinates : null)}
                  center={route.route_data?.waypoints?.[0]?.coordinates || 
                         (route.stops.length > 0 && route.stops[0]?.coordinates ? route.stops[0].coordinates : [5.2913, 52.1326])}
                  zoom={route.stops.length > 1 ? 10 : 12}
                  completedStops={new Set(timestamps.filter(t => t.actual_arrival_time).map(t => t.stop_index))}
                />
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-close" onClick={onClose}>
            Sluiten
          </button>
        </div>
      </div>

      {/* Map Chooser Modal */}
      {showMapChooser && (
        <div className="modal-overlay" onClick={() => setShowMapChooser(false)}>
          <div className="modal-content map-chooser-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Open in kaart</h2>
              <button className="close-button" onClick={() => setShowMapChooser(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="map-chooser-address">{selectedAddress}</p>
              <div className="map-chooser-buttons">
                <button className="btn-apple-maps" onClick={openInAppleMaps}>
                  <span className="map-icon">🗺️</span>
                  <span>Kaarten</span>
                </button>
                <button className="btn-google-maps" onClick={openInGoogleMaps}>
                  <span className="map-icon">📍</span>
                  <span>Google Maps</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriverDashboard;

