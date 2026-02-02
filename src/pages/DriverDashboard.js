import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getEmailTemplate, sendWebhook, getRouteStopTimestamps, recalculateArrivalTimes } from '../services/userData';
import Map from '../components/Map';
import './DriverDashboard.css';

const MAPBOX_PUBLIC_TOKEN = process.env.REACT_APP_MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoiZmF0YmlrZWh1bHAiLCJhIjoiY21qNnhmanp5MDB4ajNncjB1YXJrMDc2cSJ9.5CYl4ZfCROi-pmyaNzETIg';

const API_BASE_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8001');
const FRONTEND_BASE_URL = process.env.REACT_APP_FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://app.routenu.nl' : window.location.origin);

function DriverDashboard() {
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
  const [isContinuingRoute, setIsContinuingRoute] = useState(false);
  const [routeTimestamps, setRouteTimestamps] = useState([]);
  const [hoursWorked, setHoursWorked] = useState('');
  const [kilometersDriven, setKilometersDriven] = useState('');
  const [completedStopsByRoute, setCompletedStopsByRoute] = useState({});
  const [availableDays, setAvailableDays] = useState([]);
  const [showAvailableDaysModal, setShowAvailableDaysModal] = useState(false);
  const [savingAvailableDays, setSavingAvailableDays] = useState(false);
  const [availabilitySchedule, setAvailabilitySchedule] = useState({});
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);

  useEffect(() => {
    const loadDriverData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        // Load driver profile (including balance and total_hours)
        const { data: driverData, error: driverError } = await supabase
          .from('drivers')
          .select('id, user_id, name, email, phone, license_number, balance, total_hours, hourly_rate, admin_user_id, available_days, availability_schedule, created_at, updated_at')
          .eq('user_id', currentUser.id)
          .single();

        if (driverError) {
          // If driver doesn't exist (PGRST116 = no rows returned), redirect to admin login
          if (driverError.code === 'PGRST116') {
            alert('Je bent niet geregistreerd als chauffeur. Log in als admin.');
            logout();
            window.location.href = '/login';
            return;
          }
          // Other errors
          console.error('Error loading driver:', driverError);
          alert('Fout bij het laden van chauffeur gegevens: ' + driverError.message);
          setLoading(false);
          return;
        }

        if (driverData) {
          setDriver(driverData);
          // Set available days from driver data (default to empty array if not set)
          setAvailableDays(driverData.available_days || []);
          // Set availability schedule (default to empty object if not set)
          setAvailabilitySchedule(driverData.availability_schedule || {});

          // Load routes assigned to this driver (vandaag en toekomstig)
          // Use local date to avoid timezone issues
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const todayStr = `${year}-${month}-${day}`; // Format: YYYY-MM-DD (local time)

          // Reload driver to get latest balance and total_hours
          const { data: updatedDriver, error: driverUpdateError } = await supabase
            .from('drivers')
            .select('id, user_id, name, email, phone, license_number, balance, total_hours, hourly_rate')
            .eq('id', driverData.id)
            .single();

          if (!driverUpdateError && updatedDriver) {
            setDriver(updatedDriver);
          } else {
            setDriver(driverData);
          }

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
            
            // Load completed stops for all routes
            const completedStopsData = {};
            if (routesData && routesData.length > 0) {
              for (const route of routesData) {
                if (route.id) {
                  try {
                    const { data: stopDetails } = await supabase
                      .from('route_stop_details')
                      .select('stop_index')
                      .eq('route_id', route.id);
                    
                    if (stopDetails) {
                      completedStopsData[route.id] = new Set(stopDetails.map(detail => detail.stop_index));
                    } else {
                      completedStopsData[route.id] = new Set();
                    }
                  } catch (error) {
                    console.error('Error loading stop details for route:', route.id, error);
                    completedStopsData[route.id] = new Set();
                  }
                }
              }
            }
            setCompletedStopsByRoute(completedStopsData);
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
          partsCost: detail.parts_cost?.toString() || '',
          paymentToDriver: detail.payment_to_driver || false,
          selectedParts: detail.selected_parts || []
        };
      });

      setStopDetails(detailsMap);
      return detailsMap;
    } catch (error) {
      console.error('Error loading stop details:', error);
      return {};
    }
  };

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

      // Get existing stop detail to check if payment_to_driver was changed
      const { data: existingDetail } = await supabase
        .from('route_stop_details')
        .select('payment_to_driver, amount_received')
        .eq('route_id', activeRoute.id)
        .eq('stop_index', stopIndex)
        .single();

      const wasPaymentToDriver = existingDetail?.payment_to_driver || false;
      const oldAmount = existingDetail?.amount_received || 0;
      const newAmount = details.amountReceived ? parseFloat(details.amountReceived) : 0;
      const isPaymentToDriver = details.paymentToDriver || false;

      // Get route owner ID to update inventory
      const { data: routeData } = await supabase
        .from('routes')
        .select('user_id')
        .eq('id', activeRoute.id)
        .single();

      const routeOwnerId = routeData?.user_id;

      // Update inventory - deduct parts from stock
      if (details.selectedParts && details.selectedParts.length > 0 && routeOwnerId) {
        for (const selectedPart of details.selectedParts) {
          try {
            // Get current quantity
            const { data: currentPart, error: partError } = await supabase
              .from('inventory')
              .select('quantity')
              .eq('id', selectedPart.id)
              .eq('user_id', routeOwnerId)
              .single();

            if (!partError && currentPart) {
              const newQuantity = Math.max(0, (currentPart.quantity || 0) - (selectedPart.quantity || 0));
              
              // Update inventory quantity
              const { error: updateError } = await supabase
                .from('inventory')
                .update({ quantity: newQuantity })
                .eq('id', selectedPart.id)
                .eq('user_id', routeOwnerId);

              if (updateError) {
                console.error('Error updating inventory for part:', selectedPart.name, updateError);
              }
            }
          } catch (error) {
            console.error('Error processing inventory update for part:', selectedPart.name, error);
          }
        }
      }

      // Save stop details to database
      const { data, error } = await supabase
        .from('route_stop_details')
        .upsert({
          route_id: activeRoute.id,
          stop_index: stopIndex,
          stop_id: stop.id?.toString() || stopIndex.toString(),
          work_description: details.workDescription || null,
          amount_received: newAmount > 0 ? newAmount : null,
          parts_cost: details.partsCost ? parseFloat(details.partsCost) : null,
          payment_to_driver: isPaymentToDriver,
          completed_at: now,
          selected_parts: details.selectedParts || null // Store selected parts as JSON
        }, {
          onConflict: 'route_id,stop_index'
        })
        .select()
        .single();

      if (error) throw error;

      // Update driver balance if payment_to_driver changed
      if (driver && driver.id) {
        let balanceChange = 0;
        
        // If payment was changed from zaak to monteur, add amount
        if (!wasPaymentToDriver && isPaymentToDriver && newAmount > 0) {
          balanceChange = newAmount;
        }
        // If payment was changed from monteur to zaak, subtract old amount
        else if (wasPaymentToDriver && !isPaymentToDriver && oldAmount > 0) {
          balanceChange = -oldAmount;
        }
        // If payment stayed monteur but amount changed
        else if (wasPaymentToDriver && isPaymentToDriver && oldAmount !== newAmount) {
          balanceChange = newAmount - oldAmount;
        }

        if (balanceChange !== 0) {
          // Get current balance
          const { data: currentDriver, error: driverError } = await supabase
            .from('drivers')
            .select('balance')
            .eq('id', driver.id)
            .single();

          if (!driverError && currentDriver) {
            const newBalance = (parseFloat(currentDriver.balance) || 0) + balanceChange;
            
            // Update driver balance
            const { error: updateError } = await supabase
              .from('drivers')
              .update({ balance: newBalance })
              .eq('id', driver.id);

            if (updateError) {
              console.error('Error updating driver balance:', updateError);
            } else {
              // Update local driver state
              setDriver(prev => prev ? { ...prev, balance: newBalance } : null);
            }
          }
        }
      }

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

      // Update completed stops for this route
      setCompletedStopsByRoute(prev => ({
        ...prev,
        [activeRoute.id]: new Set([...(prev[activeRoute.id] || []), stopIndex])
      }));

      // Check if there are more stops
      if (stopIndex < activeRoute.stops.length - 1) {
        // If continuing route, go to next stop (full page mode)
        if (isContinuingRoute) {
          setCurrentStopIndex(stopIndex + 1);
        } else {
          // Close modal and reopen for next stop to reset form fields
          setShowStopModal(false);
          // Use setTimeout to ensure modal closes before reopening
          setTimeout(() => {
            setCurrentStopIndex(stopIndex + 1);
            setShowStopModal(true);
          }, 100);
        }
      } else {
        // All stops completed, show complete modal
        if (isContinuingRoute) {
          setIsContinuingRoute(false);
        } else {
          setShowStopModal(false);
        }
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

      // Update driver total hours
      if (driver && driver.id) {
        const { data: currentDriver, error: driverError } = await supabase
          .from('drivers')
          .select('total_hours')
          .eq('id', driver.id)
          .single();

        if (!driverError && currentDriver) {
          const newTotalHours = (parseFloat(currentDriver.total_hours) || 0) + hours;
          
          const { error: updateError } = await supabase
            .from('drivers')
            .update({ total_hours: newTotalHours })
            .eq('id', driver.id);

          if (updateError) {
            console.error('Error updating driver total hours:', updateError);
          } else {
            // Update local driver state
            setDriver(prev => prev ? { ...prev, total_hours: newTotalHours } : null);
          }
        }
      }

      // Update local state
      setRoutes(prev => prev.map(r => 
        r.id === activeRoute.id ? { ...r, route_status: 'completed', hours_worked: hours, actual_distance_km: kilometers } : r
      ));
      
      // Reset state
      setActiveRoute(null);
      setCurrentStopIndex(0);
      setStopDetails({});
      setShowCompleteModal(false);
      setHoursWorked('');
      setKilometersDriven('');
      
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

  // If continuing route, show full page stop details view
  if (isContinuingRoute && activeRoute && activeRoute.stops && currentStopIndex < activeRoute.stops.length) {
    return (
      <div className="driver-dashboard">
        <StopDetailsModal
          stop={activeRoute.stops[currentStopIndex]}
          stopIndex={currentStopIndex}
          totalStops={activeRoute.stops.length}
          routeId={activeRoute.id}
          onSave={(details) => {
            handleSaveStopDetails(currentStopIndex, details);
            // After saving, check if there are more stops
            if (currentStopIndex < activeRoute.stops.length - 1) {
              setCurrentStopIndex(currentStopIndex + 1);
            } else {
              setIsContinuingRoute(false);
              setShowCompleteModal(true);
            }
          }}
          onClose={() => {
            setIsContinuingRoute(false);
            setActiveRoute(null);
          }}
          existingDetails={stopDetails[currentStopIndex]}
          fullPage={true}
        />
      </div>
    );
  }

  // If showing route overview, show full page route overview
  if (showRouteOverview && activeRoute) {
    return (
      <div className="driver-dashboard">
        <RouteOverviewModal
          route={activeRoute}
          timestamps={routeTimestamps}
          onClose={() => {
            setShowRouteOverview(false);
            setActiveRoute(null);
            setRouteTimestamps([]);
          }}
          fullPage={true}
        />
      </div>
    );
  }

  // Get ISO week key (format: "2024-W01")
  const getWeekKey = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - day);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    const year = d.getFullYear();
    return `${year}-W${String(weekNumber).padStart(2, '0')}`;
  };

  // Get weeks for display
  const getWeeks = () => {
    const weeks = [];
    const today = new Date();
    
    for (let i = 0; i < 8; i++) {
      const weekDate = new Date(today);
      weekDate.setDate(today.getDate() + (i * 7));
      const weekKey = getWeekKey(weekDate);
      const weekNumber = weekKey.split('-W')[1];
      const year = weekKey.split('-W')[0];
      
      weeks.push({
        weekKey,
        weekNumber,
        year,
        date: new Date(weekDate),
        isCurrent: i === 0
      });
    }
    
    return weeks;
  };

  const weeks = getWeeks();
  const currentWeek = weeks[currentWeekIndex] || weeks[0];
  const currentWeekKey = currentWeek?.weekKey;

  // Get availability for current week
  const getWeekAvailability = (weekKey) => {
    return availabilitySchedule[weekKey] || {};
  };

  // Update day availability for current week
  const updateDayAvailability = (dayIndex, time) => {
    if (!currentWeekKey) return;
    
    setAvailabilitySchedule(prev => {
      const weekSchedule = prev[currentWeekKey] || {};
      const newSchedule = { ...prev };
      
      if (time && time.trim() !== '') {
        newSchedule[currentWeekKey] = {
          ...weekSchedule,
          [dayIndex.toString()]: time.trim()
        };
      } else {
        // Remove day if time is empty
        const { [dayIndex.toString()]: removed, ...rest } = weekSchedule;
        if (Object.keys(rest).length === 0) {
          // Remove week if no days left
          const { [currentWeekKey]: removedWeek, ...restWeeks } = newSchedule;
          return restWeeks;
        }
        newSchedule[currentWeekKey] = rest;
      }
      
      return newSchedule;
    });
  };

  // Handle saving availability schedule
  const handleSaveAvailabilitySchedule = async () => {
    if (!driver || !currentUser) return;

    try {
      setSavingAvailableDays(true);
      const { error } = await supabase
        .from('drivers')
        .update({ availability_schedule: availabilitySchedule })
        .eq('id', driver.id);

      if (error) throw error;

      // Update local driver state
      setDriver(prev => ({ ...prev, availability_schedule: availabilitySchedule }));
      setShowAvailableDaysModal(false);
      alert('Beschikbaarheid opgeslagen!');
    } catch (error) {
      console.error('Error saving availability schedule:', error);
      alert('Fout bij het opslaan van beschikbaarheid: ' + error.message);
    } finally {
      setSavingAvailableDays(false);
    }
  };

  // Day names in Dutch
  const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

  return (
    <div className="driver-dashboard">
      <div className="logo-header">
        <img src="/logo.png" alt="RouteNu" className="logo" />
      </div>
      <div className="driver-header">
        <div className="driver-info">
          <h1>Welkom, {driver.name}</h1>
          <p>Chauffeur Dashboard</p>
          <div className="driver-stats">
            <div className="driver-stat-item">
              <span className="stat-label">Balans:</span>
              <span className="stat-value balance">€{(driver.balance || 0).toFixed(2)}</span>
            </div>
            <div className="driver-stat-item">
              <span className="stat-label">Totaal uren:</span>
              <span className="stat-value hours">{(driver.total_hours || 0).toFixed(1)}u</span>
            </div>
          </div>
        </div>
        <div className="driver-header-buttons">
          <button 
            className="logout-btn availability-btn" 
            onClick={() => setShowAvailableDaysModal(true)}
          >
            Beschikbare dagen
          </button>
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

                return (
                  <div key={route.id} className="route-card active">
                    <div className="route-card-header">
                      <h3>{route.name || 'Route zonder naam'}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="route-status started">Gestart</span>
                        <span className="live-indicator">LIVE</span>
                      </div>
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
                        onClick={async () => {
                          setActiveRoute(route);
                          // Load existing stop details
                          const details = await loadStopDetails(route.id);
                          // Find first incomplete stop
                          const firstIncomplete = findFirstIncompleteStop(route, details);
                          setCurrentStopIndex(firstIncomplete);
                          if (firstIncomplete < route.stops.length) {
                            setIsContinuingRoute(true);
                            setShowStopModal(false);
                          } else {
                            // All stops completed, show complete modal
                            setShowCompleteModal(true);
                          }
                        }}
                      >
                        Route voortzetten
                      </button>
                    </div>
                    {/* Timeline van stops */}
                    {route.stops && route.stops.length > 0 && (
                      <div className="route-stops-timeline">
                        <div className="timeline-stops">
                          {route.stops.map((stop, index) => {
                            const isCompleted = completedStopsByRoute[route.id]?.has(index) || false;
                            return (
                              <div key={index} className={`timeline-stop-item ${isCompleted ? 'completed' : ''}`}>
                                <div className="timeline-stop-indicator">
                                  {isCompleted ? (
                                    <span className="timeline-stop-check">✓</span>
                                  ) : (
                                    <span className="timeline-stop-number">{index + 1}</span>
                                  )}
                                </div>
                                {index < route.stops.length - 1 && (
                                  <div className="timeline-stop-line"></div>
                                )}
                              </div>
                            );
                          })}
                        </div>
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
          routeId={activeRoute.id}
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
          onComplete={handleCompleteRoute}
          onClose={() => {
            setShowCompleteModal(false);
            setActiveRoute(null);
            setHoursWorked('');
            setKilometersDriven('');
          }}
        />
      )}

      {/* Available Days Modal */}
      {showAvailableDaysModal && (
        <div className="modal-overlay" onClick={() => setShowAvailableDaysModal(false)}>
          <div className="modal-content available-days-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {currentWeek?.isCurrent ? 'Huidige week' : 'Week'} {currentWeek?.weekNumber} - Beschikbaarheid
              </h2>
              <button className="close-button" onClick={() => {
                setAvailabilitySchedule(driver.availability_schedule || {});
                setCurrentWeekIndex(0);
                setShowAvailableDaysModal(false);
              }}>×</button>
            </div>
            <div className="modal-body">
              {/* Week Navigation */}
              <div className="week-navigation">
                <button 
                  className="week-nav-btn"
                  onClick={() => setCurrentWeekIndex(Math.max(0, currentWeekIndex - 1))}
                  disabled={currentWeekIndex === 0}
                >
                  ← Vorige
                </button>
                <div className="week-info">
                  <span className="week-label">
                    {currentWeek?.isCurrent ? 'Huidige week' : 'Week'} {currentWeek?.weekNumber} ({currentWeek?.year})
                  </span>
                </div>
                <button 
                  className="week-nav-btn"
                  onClick={() => setCurrentWeekIndex(Math.min(weeks.length - 1, currentWeekIndex + 1))}
                  disabled={currentWeekIndex === weeks.length - 1}
                >
                  Volgende →
                </button>
              </div>

              <p style={{ marginBottom: '20px', color: '#666', marginTop: '20px' }}>
                Geef per dag aan tot hoe laat je beschikbaar bent (bijv. 18:00):
              </p>
              <div className="available-days-grid">
                {dayNames.map((dayName, index) => {
                  const weekAvailability = getWeekAvailability(currentWeekKey);
                  const time = weekAvailability[index.toString()] || '';
                  
                  return (
                    <div key={index} className="day-time-input-group">
                      <label className="day-checkbox-label">
                        <input
                          type="checkbox"
                          checked={!!time}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateDayAvailability(index, '18:00');
                            } else {
                              updateDayAvailability(index, '');
                            }
                          }}
                        />
                        <span>{dayName}</span>
                      </label>
                      {time && (
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => updateDayAvailability(index, e.target.value)}
                          className="time-input"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-cancel" 
                onClick={() => {
                  // Reset to original driver data
                  setAvailabilitySchedule(driver.availability_schedule || {});
                  setCurrentWeekIndex(0);
                  setShowAvailableDaysModal(false);
                }}
              >
                Annuleren
              </button>
              <button 
                className="btn-save" 
                onClick={handleSaveAvailabilitySchedule}
                disabled={savingAvailableDays}
              >
                {savingAvailableDays ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Stop Details Modal Component
function StopDetailsModal({ stop, stopIndex, totalStops, routeId, onSave, onClose, existingDetails, fullPage = false }) {
  const { currentUser } = useAuth();
  const [workDescription, setWorkDescription] = useState(existingDetails?.workDescription || '');
  const [amountReceived, setAmountReceived] = useState(existingDetails?.amountReceived || '');
  const [partsCost, setPartsCost] = useState(existingDetails?.partsCost || '');
  const [manualPartsCost, setManualPartsCost] = useState('');
  const [useManualPartsCost, setUseManualPartsCost] = useState(false);
  const [paymentToDriver, setPaymentToDriver] = useState(existingDetails?.paymentToDriver || false);
  const [showMapChooser, setShowMapChooser] = useState(false);
  const [selectedParts, setSelectedParts] = useState(existingDetails?.selectedParts || []);
  const [partsSearchQuery, setPartsSearchQuery] = useState('');
  const [availableParts, setAvailableParts] = useState([]);
  const [showPartsSearch, setShowPartsSearch] = useState(false);
  const [routeOwnerId, setRouteOwnerId] = useState(null);

  // Load route owner ID and available parts
  useEffect(() => {
    const loadRouteOwnerAndParts = async () => {
      if (!routeId) return;
      
      try {
        // Get route owner ID from route
        const { data: routeData, error: routeError } = await supabase
          .from('routes')
          .select('user_id')
          .eq('id', routeId)
          .single();
        
        if (routeError) {
          console.error('Error loading route:', routeError);
          return;
        }
        
        if (routeData?.user_id) {
          setRouteOwnerId(routeData.user_id);
          
          // Load inventory for route owner
          const { data: inventoryData, error: inventoryError } = await supabase
            .from('inventory')
            .select('id, name, quantity, purchase_price, price')
            .eq('user_id', routeData.user_id)
            .gt('quantity', 0)
            .order('name', { ascending: true });
          
          if (!inventoryError && inventoryData) {
            console.log('Loaded inventory items:', inventoryData.length);
            if (inventoryData.length > 0) {
              console.log('Sample item:', inventoryData[0]);
              console.log('Sample purchase_price:', inventoryData[0]?.purchase_price, 'type:', typeof inventoryData[0]?.purchase_price);
              // Check if purchase_price is null/undefined for all items
              const itemsWithoutPrice = inventoryData.filter(item => !item.purchase_price || item.purchase_price === null);
              if (itemsWithoutPrice.length > 0) {
                console.warn(`Warning: ${itemsWithoutPrice.length} items have no purchase_price set`);
              }
            }
            setAvailableParts(inventoryData);
          } else if (inventoryError) {
            console.error('Error loading inventory:', inventoryError);
            console.error('Inventory error details:', JSON.stringify(inventoryError, null, 2));
          }
        }
      } catch (error) {
        console.error('Error loading route owner or parts:', error);
      }
    };
    
    loadRouteOwnerAndParts();
  }, [routeId]);

  // Reset form fields when stopIndex changes (new stop)
  useEffect(() => {
    setWorkDescription(existingDetails?.workDescription || '');
    setAmountReceived(existingDetails?.amountReceived || '');
    setPaymentToDriver(existingDetails?.paymentToDriver || false);
    const parts = existingDetails?.selectedParts || [];
    
    // Update purchase_price from availableParts if available
    // Use price as purchase_price (inkoopprijs)
    const updatedParts = parts.map(part => {
      const availablePart = availableParts.find(ap => ap.id === part.id);
      const purchasePrice = availablePart?.price || availablePart?.purchase_price || part.purchase_price || 0;
      return {
        ...part,
        purchase_price: purchasePrice
      };
    });
    
    setSelectedParts(updatedParts);
    // Recalculate parts cost
    const totalCost = updatedParts.reduce((sum, part) => {
      const price = part.purchase_price != null ? parseFloat(part.purchase_price) : 0;
      const qty = part.quantity || 0;
      return sum + (price * qty);
    }, 0);
    console.log('Recalculated total cost from existing parts:', totalCost);
    const existingPartsCost = existingDetails?.partsCost || '';
    setPartsCost(totalCost > 0 ? totalCost.toFixed(2) : '');
    // Check if existing parts cost differs from calculated (manual override was used)
    if (existingPartsCost && Math.abs(parseFloat(existingPartsCost) - totalCost) > 0.01) {
      setManualPartsCost(existingPartsCost);
      setUseManualPartsCost(true);
    } else {
      setManualPartsCost('');
      setUseManualPartsCost(false);
    }
  }, [stopIndex, existingDetails, availableParts]);

  // Update parts cost when selected parts change (only if not using manual cost)
  useEffect(() => {
    if (useManualPartsCost) {
      // Don't auto-update if user is using manual cost
      return;
    }
    const totalCost = selectedParts.reduce((sum, part) => {
      const price = part.purchase_price != null ? parseFloat(part.purchase_price) : 0;
      const qty = part.quantity || 0;
      const partTotal = price * qty;
      return sum + partTotal;
    }, 0);
    console.log('Selected parts changed, new total:', totalCost, 'selectedParts:', selectedParts);
    setPartsCost(totalCost > 0 ? totalCost.toFixed(2) : '');
  }, [selectedParts, useManualPartsCost]);

  // Filter parts based on search query
  const filteredParts = availableParts.filter(part =>
    part.name?.toLowerCase().includes(partsSearchQuery.toLowerCase())
  );

  // Add part to selected parts
  const handleAddPart = (part) => {
    console.log('Adding part:', part);
    
    const existingIndex = selectedParts.findIndex(p => p.id === part.id);
    const currentSelectedQty = existingIndex >= 0 ? (selectedParts[existingIndex].quantity || 0) : 0;
    const newQty = currentSelectedQty + 1;
    
    // Check if there's enough stock
    const availableQty = part.quantity || 0;
    if (newQty > availableQty) {
      alert(`Niet genoeg voorraad. Beschikbaar: ${availableQty} stuks`);
      return;
    }
    
    // Use price as purchase_price (inkoopprijs)
    // Fallback: use purchase_price if price is not available, otherwise 0
    let purchasePrice = 0;
    if (part.price != null && part.price !== '' && !isNaN(part.price)) {
      purchasePrice = parseFloat(part.price);
    } else if (part.purchase_price != null && part.purchase_price !== '' && !isNaN(part.purchase_price)) {
      purchasePrice = parseFloat(part.purchase_price);
    }
    
    console.log('Using price as purchase_price:', purchasePrice);
    
    if (existingIndex >= 0) {
      // Update quantity and ensure purchase_price is up to date
      const updated = [...selectedParts];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty,
        purchase_price: purchasePrice || updated[existingIndex].purchase_price || 0
      };
      console.log('Updated part:', updated[existingIndex]);
      setSelectedParts(updated);
    } else {
      // Add new part
      const newPart = {
        id: part.id,
        name: part.name,
        quantity: 1,
        purchase_price: purchasePrice,
        available_quantity: part.quantity // Store available quantity for validation
      };
      console.log('New part added:', newPart);
      setSelectedParts([...selectedParts, newPart]);
    }
    setPartsSearchQuery('');
    setShowPartsSearch(false);
  };

  // Update part quantity
  const handleUpdatePartQuantity = (partId, delta) => {
    const updated = selectedParts.map(part => {
      if (part.id === partId) {
        const newQuantity = Math.max(0, (part.quantity || 1) + delta);
        
        // Check stock availability and get latest purchase_price
        const availablePart = availableParts.find(p => p.id === partId);
        const availableQty = availablePart?.quantity || part.available_quantity || 0;
        
        if (newQuantity > availableQty) {
          alert(`Niet genoeg voorraad. Beschikbaar: ${availableQty} stuks`);
          return part; // Don't update
        }
        
        if (newQuantity === 0) {
          return null; // Mark for removal
        }
        // Update quantity and ensure purchase_price is up to date from availableParts
        // Use price as purchase_price (inkoopprijs)
        const purchasePrice = availablePart?.price || availablePart?.purchase_price || part.purchase_price || 0;
        return { 
          ...part, 
          quantity: newQuantity,
          purchase_price: purchasePrice
        };
      }
      return part;
    }).filter(Boolean);
    setSelectedParts(updated);
  };

  // Remove part
  const handleRemovePart = (partId) => {
    setSelectedParts(selectedParts.filter(p => p.id !== partId));
  };

  // Calculate total parts cost
  const calculateTotalPartsCost = () => {
    const total = selectedParts.reduce((sum, part) => {
      const price = parseFloat(part.purchase_price || 0);
      const qty = part.quantity || 0;
      const partTotal = price * qty;
      console.log(`Part: ${part.name}, price: ${price}, qty: ${qty}, total: ${partTotal}`);
      return sum + partTotal;
    }, 0);
    console.log('Total parts cost:', total);
    return total;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Use manual parts cost if enabled, otherwise use calculated cost
    const finalPartsCost = useManualPartsCost && manualPartsCost && manualPartsCost.trim() !== ''
      ? parseFloat(manualPartsCost)
      : (partsCost && partsCost.trim() !== '' ? parseFloat(partsCost) : calculateTotalPartsCost());
    onSave({
      workDescription,
      amountReceived,
      partsCost: finalPartsCost > 0 ? finalPartsCost.toFixed(2) : '',
      paymentToDriver,
      selectedParts
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showPartsSearch && !event.target.closest('.parts-selection-container')) {
        setShowPartsSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPartsSearch]);

  return (
    <div className={fullPage ? "stop-details-full-page" : "modal-overlay"} onClick={(e) => {
      if (!fullPage && e.target === e.currentTarget) {
        setShowPartsSearch(false);
      }
    }}>
      <div className={fullPage ? "stop-details-full-page-content" : "modal-content stop-details-modal"}>
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
              <div className="parts-selection-container">
                <div className="parts-selection-header">
                  <input
                    type="text"
                    className="parts-search-input"
                    placeholder="Zoek onderdeel..."
                    value={partsSearchQuery}
                    onChange={(e) => {
                      setPartsSearchQuery(e.target.value);
                      setShowPartsSearch(true);
                    }}
                    onFocus={() => setShowPartsSearch(true)}
                  />
                  {showPartsSearch && filteredParts.length > 0 && (
                    <div className="parts-search-dropdown">
                      {filteredParts.map(part => (
                        <div
                          key={part.id}
                          className="parts-search-item"
                          onClick={() => handleAddPart(part)}
                        >
                          <div className="parts-search-item-name">{part.name}</div>
                          <div className="parts-search-item-info">
                            <span>Voorraad: {part.quantity}</span>
                            {(part.price != null && part.price !== '') || (part.purchase_price != null && part.purchase_price !== '') ? (
                              <span>Inkoop: €{parseFloat(part.price || part.purchase_price || 0).toFixed(2)}</span>
                            ) : (
                              <span style={{ color: '#ff6b6b' }}>Geen prijs</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {selectedParts.length > 0 && (
                  <div className="selected-parts-list">
                    {selectedParts.map(part => {
                      const purchasePrice = part.purchase_price != null ? parseFloat(part.purchase_price) : 0;
                      const qty = part.quantity || 0;
                      const partTotal = purchasePrice * qty;
                      return (
                        <div key={part.id} className="selected-part-item">
                          <div className="selected-part-info">
                            <span className="selected-part-name">{part.name}</span>
                            <span className="selected-part-price">
                              €{purchasePrice.toFixed(2)} × {qty} = €{partTotal.toFixed(2)}
                            </span>
                          </div>
                          <div className="selected-part-actions">
                            <button
                              type="button"
                              className="part-qty-btn minus"
                              onClick={() => handleUpdatePartQuantity(part.id, -1)}
                            >
                              −
                            </button>
                            <span className="part-qty-value">{part.quantity}</span>
                            <button
                              type="button"
                              className="part-qty-btn plus"
                              onClick={() => handleUpdatePartQuantity(part.id, 1)}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="part-remove-btn"
                              onClick={() => handleRemovePart(part.id)}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="parts-total-cost">
                      <strong>Automatisch berekend totaal: €{calculateTotalPartsCost().toFixed(2)}</strong>
                    </div>
                  </div>
                )}
                
                <div style={{ marginTop: '12px' }}>
                  <label htmlFor="calculated-parts-cost" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Automatisch berekend bedrag (€)
                  </label>
                  <input
                    type="number"
                    id="calculated-parts-cost"
                    step="0.01"
                    min="0"
                    value={partsCost}
                    placeholder="0.00"
                    readOnly
                    style={{ 
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      backgroundColor: '#f5f5f5',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
                
                <div style={{ marginTop: '12px' }}>
                  <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <input
                      type="checkbox"
                      checked={useManualPartsCost}
                      onChange={(e) => {
                        setUseManualPartsCost(e.target.checked);
                        if (!e.target.checked) {
                          setManualPartsCost('');
                        }
                      }}
                    />
                    <span>Handmatig bedrag invoeren</span>
                  </label>
                  {useManualPartsCost && (
                    <input
                      type="number"
                      id="manual-parts-cost"
                      step="0.01"
                      min="0"
                      value={manualPartsCost}
                      onChange={(e) => setManualPartsCost(e.target.value)}
                      placeholder="0.00"
                      style={{ 
                        width: '100%',
                        marginTop: '8px',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    />
                  )}
                </div>
                <small className="form-hint">
                  Selecteer onderdelen hierboven voor automatische berekening. Vink "Handmatig bedrag invoeren" aan om een eigen bedrag in te voeren.
                </small>
              </div>
            </div>
            {amountReceived && parseFloat(amountReceived) > 0 && (
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={paymentToDriver}
                    onChange={(e) => setPaymentToDriver(e.target.checked)}
                  />
                  <span>Geld naar monteur (€{parseFloat(amountReceived).toFixed(2)})</span>
                </label>
                <small className="form-hint">
                  {paymentToDriver 
                    ? 'Dit bedrag wordt toegevoegd aan je balans' 
                    : 'Dit bedrag gaat naar de zaak'}
                </small>
              </div>
            )}
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
function CompleteRouteModal({ route, hoursWorked, onHoursChange, kilometersDriven, onKilometersChange, onComplete, onClose }) {
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

  // Get planned distance from route_data if available
  const plannedDistanceKm = route?.route_data?.distance ? (route.route_data.distance / 1000).toFixed(2) : null;

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
function RouteOverviewModal({ route, timestamps, onClose, fullPage = false }) {
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
    <div className={fullPage ? "route-overview-full-page" : "modal-overlay"}>
      <div className={fullPage ? "route-overview-full-page-content" : "modal-content route-overview-modal"} style={fullPage ? {} : { maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
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
            <div className="info-row">
              <span className="info-label">Service tijd per stop:</span>
              <span className="info-value">{route.route_data?.service_time || 5} minuten</span>
            </div>
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

