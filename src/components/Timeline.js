import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getEmailTemplate, sendWebhook } from '../services/userData';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import './Timeline.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8001');

// SVG Icons
const DragIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="12" r="1"></circle>
    <circle cx="9" cy="5" r="1"></circle>
    <circle cx="9" cy="19" r="1"></circle>
    <circle cx="15" cy="12" r="1"></circle>
    <circle cx="15" cy="5" r="1"></circle>
    <circle cx="15" cy="19" r="1"></circle>
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

function Timeline({ stops, route, onRemoveStop, onReorderStops, onReverseRoute, startAddress, onEditStop, onCalculateRoute, onOptimizeRoute, isOptimizing, departureTime, onDepartureTimeChange, serviceTime, currentRouteId, routeName, routeDate, vehicles = [], drivers = [] }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [tempDepartureTime, setTempDepartureTime] = useState(departureTime || '08:00');
  const [isInformingCustomers, setIsInformingCustomers] = useState(false);
  const [customersInformedAt, setCustomersInformedAt] = useState(null);

  // Update tempDepartureTime when departureTime prop changes
  React.useEffect(() => {
    setTempDepartureTime(departureTime || '08:00');
  }, [departureTime]);


  // Load customers_informed_at timestamp when route changes
  useEffect(() => {
    const loadCustomersInformedAt = async () => {
      if (!currentUser || !currentRouteId) {
        setCustomersInformedAt(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('routes')
          .select('customers_informed_at')
          .eq('id', currentRouteId)
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading customers_informed_at:', error);
          return;
        }

        if (data && data.customers_informed_at) {
          setCustomersInformedAt(data.customers_informed_at);
        } else {
          setCustomersInformedAt(null);
        }
      } catch (error) {
        console.error('Error loading customers_informed_at:', error);
      }
    };

    loadCustomersInformedAt();
  }, [currentUser, currentRouteId]);

  // Bereken tijden op basis van route duration en waypoints
  const calculateTimes = () => {
    if (!route || stops.length === 0) return [];
    
    const startTime = new Date();
    // Gebruik departureTime als die is ingesteld, anders default 08:00
    const [hours, minutes] = (departureTime || '08:00').split(':').map(Number);
    startTime.setHours(hours, minutes, 0, 0);
    
    const times = [];
    let currentTime = startTime;
    
    // Start tijd
    times.push({
      arrival: formatTime(currentTime),
      departure: null
    });
    
    // Bereken tijden voor elke stop
    if (route.waypoints && route.waypoints.length > 0) {
      // Gebruik waypoint durations als beschikbaar
      let cumulativeDuration = 0;
      
      stops.forEach((stop, index) => {
        // Schat de reistijd naar deze stop (gebruik gemiddelde als waypoint duration niet beschikbaar is)
        const segmentDuration = route.waypoints[index + 1]?.duration || 
                                (route.duration / (stops.length + 1));
        cumulativeDuration += segmentDuration;
        
        const arrivalTime = new Date(startTime.getTime() + (cumulativeDuration * 1000));
        // Gebruik algemene service tijd voor alle stops
        const serviceTimeMinutes = serviceTime || 5;
        const departureTime = new Date(arrivalTime.getTime() + (serviceTimeMinutes * 60 * 1000));
        
        times.push({
          arrival: formatTime(arrivalTime),
          departure: formatTime(departureTime)
        });
      });
      
      // Eind tijd
      const endTime = new Date(startTime.getTime() + (route.duration * 1000));
      times.push({
        arrival: formatTime(endTime),
        departure: null
      });
    } else {
      // Fallback: verdeel duration gelijkmatig
      const durationPerStop = route.duration / (stops.length + 1);
      
      stops.forEach((stop, index) => {
        const arrivalTime = new Date(startTime.getTime() + (durationPerStop * (index + 1) * 1000));
        // Gebruik service tijd uit user profile (via prop)
        const serviceTimeMinutes = serviceTime || 5;
        const departureTime = new Date(arrivalTime.getTime() + (serviceTimeMinutes * 60 * 1000));
        
        times.push({
          arrival: formatTime(arrivalTime),
          departure: formatTime(departureTime)
        });
      });
      
      // Eind tijd
      const endTime = new Date(startTime.getTime() + (route.duration * 1000));
      times.push({
        arrival: formatTime(endTime),
        departure: null
      });
    }
    
    return times;
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  };

  const times = route ? calculateTimes() : [];

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}:${minutes.toString().padStart(2, '0')} uur`;
  };

  const formatDistance = (meters) => {
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDurationShort = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}u ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleInformCustomers = async () => {
    if (!currentUser) {
      alert('Je moet ingelogd zijn om klanten te informeren');
      return;
    }

    if (stops.length === 0) {
      alert('Voeg eerst stops toe aan de route');
      return;
    }

    // Verzamel alle e-mailadressen uit de stops
    const emailAddresses = stops
      .map(stop => stop.email)
      .filter(email => email && email.trim() !== '');

    if (emailAddresses.length === 0) {
      alert('Geen e-mailadressen gevonden in de stops. Voeg e-mailadressen toe aan de stops.');
      return;
    }

    setIsInformingCustomers(true);

    try {
      // Haal de opgeslagen template op
      let savedTemplate;
      try {
        savedTemplate = await getEmailTemplate(currentUser.id, 'klanten-informeren');
        console.log('Loaded template:', {
          hasTemplate: !!savedTemplate,
          hasHtmlContent: !!savedTemplate?.html_content,
          htmlContentLength: savedTemplate?.html_content?.length,
          htmlContentPreview: savedTemplate?.html_content?.substring(0, 100)
        });
      } catch (templateError) {
        console.error('Error loading template:', templateError);
        
        // Check if error is about missing table
        if (templateError.message && (
          templateError.message.includes('email_templates') || 
          templateError.message.includes('does not exist') ||
          templateError.message.includes('schema cache')
        )) {
          // Use default template if table doesn't exist
          console.log('Email templates table not found, using default template');
          savedTemplate = null; // Will use default template below
        } else {
          alert('Fout bij het ophalen van de template: ' + (templateError.message || 'Onbekende fout'));
          setIsInformingCustomers(false);
          return;
        }
      }
      
      // If no saved template, use default template
      if (!savedTemplate) {
        const routeNameForTemplate = routeName || 'Route';
        const routeDateForTemplate = routeDate 
          ? new Date(routeDate).toLocaleDateString('nl-NL', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })
          : 'vandaag';
        const stopsCount = stops.length;
        const routeLink = currentRouteId ? `https://app.routenu.nl/route/${currentRouteId}` : '#';
        
        savedTemplate = {
          subject: `U bent aangemeld voor route \${routeName}`,
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
    .time-info {
      background: white;
      padding: 15px;
      border-radius: 8px;
      margin: 15px 0;
      border-left: 4px solid #0CC0DF;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Routenu.nl</h1>
  </div>
  <div class="content">
    <h2>Beste klant,</h2>
    <p>U bent aangemeld voor de route <strong>\${routeName}</strong> op \${routeDate}.</p>
    <div class="time-info">
      <p><strong>Verwachte aankomsttijd:</strong> \${stopTimeRange}</p>
    </div>
    <p>Meer informatie ontvangt u op de dag zelf van de route.</p>
    <a href="\${liveRouteLink}" class="button">Bekijk route</a>
  </div>
</body>
</html>`,
          from_email: 'noreply@routenu.nl'
        };
      }

      // Haal of genereer token voor deze route (altijd een token hebben)
      let liveRouteToken = null;
      if (currentRouteId) {
        try {
          const { data: routeData } = await supabase
            .from('routes')
            .select('live_route_token, route_status')
            .eq('id', currentRouteId)
            .eq('user_id', currentUser.id)
            .maybeSingle();
          
          if (routeData?.live_route_token) {
            liveRouteToken = routeData.live_route_token;
            console.log('✓ Found live_route_token for route:', liveRouteToken);
          } else {
            // Genereer nieuwe token en sla op
            liveRouteToken = `${currentRouteId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            await supabase
              .from('routes')
              .update({ live_route_token: liveRouteToken })
              .eq('id', currentRouteId)
              .eq('user_id', currentUser.id);
            console.log('✓ Generated and saved new live_route_token for route:', currentRouteId);
          }
        } catch (error) {
          console.error('Error getting/generating token:', error);
          // Genereer token lokaal als fallback (wordt niet opgeslagen)
          liveRouteToken = `${currentRouteId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        }
      }

      // Bereid route data voor template variabelen
      const routeNameForTemplate = routeName || 'Route';
      const routeDateForTemplate = routeDate 
        ? new Date(routeDate).toLocaleDateString('nl-NL', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          })
        : 'vandaag';
      const stopsCount = stops.length;
      const baseRouteLink = currentRouteId ? `https://app.routenu.nl/route/${currentRouteId}` : '#';

      // Vervang template variabelen
      // Check if html_content exists and is a string
      if (!savedTemplate.html_content || typeof savedTemplate.html_content !== 'string') {
        console.error('Invalid HTML content in template:', savedTemplate);
        alert('Fout: Template HTML content is ongeldig. Controleer de template in E-mail Templates.');
        setIsInformingCustomers(false);
        return;
      }
      
      // Bereken tijdstippen voor alle stops
      const calculatedTimes = calculateTimes();
      
      // Functie om tijdstippen te formatteren voor een stop
      const getStopTimeRange = (stopIndex) => {
        if (!calculatedTimes || calculatedTimes.length === 0 || stopIndex < 0 || stopIndex >= calculatedTimes.length - 1) {
          return 'Wordt nog berekend';
        }
        
        const timeInfo = calculatedTimes[stopIndex + 1]; // +1 omdat eerste item start tijd is
        if (!timeInfo || !timeInfo.arrival) {
          return 'Wordt nog berekend';
        }
        
        const arrivalTime = timeInfo.arrival;
        const departureTime = timeInfo.departure;
        
        if (departureTime) {
          return `${arrivalTime} - ${departureTime}`;
        }
        return arrivalTime;
      };

      // Verstuur e-mails naar alle adressen
      const emailPromises = emailAddresses.map(async (email) => {
        try {
          // Vind de stop die bij dit e-mailadres hoort
          const stopForEmail = stops.find(stop => stop.email && stop.email.trim().toLowerCase() === email.trim().toLowerCase());
          const stopIndex = stopForEmail ? stops.indexOf(stopForEmail) : -1;
          
          // Bereken tijdstippen voor deze specifieke stop
          const stopTimeRange = getStopTimeRange(stopIndex);
          
          // Genereer persoonlijke link met token en email (altijd)
          const encodedEmail = encodeURIComponent(email.trim().toLowerCase());
          let personalRouteLink;
          if (currentRouteId && liveRouteToken && encodedEmail) {
            // Altijd token + email gebruiken
            personalRouteLink = `https://app.routenu.nl/route/${currentRouteId}/${liveRouteToken}/${encodedEmail}`;
          } else if (currentRouteId) {
            // Fallback: alleen route ID als token/email ontbreekt
            personalRouteLink = `https://app.routenu.nl/route/${currentRouteId}`;
          } else {
            personalRouteLink = baseRouteLink;
          }
          const routeLink = personalRouteLink; // Use personal link for routeLink too
          const liveRouteLink = personalRouteLink; // Use personal link for liveRouteLink
          
          console.log('✓ Generated personal link for email', email, ':', personalRouteLink);
          
          // Make a copy of the HTML content to avoid mutating the original
          let htmlContent = String(savedTemplate.html_content);
          
          // Vervang template variabelen (in volgorde om conflicten te voorkomen)
          htmlContent = htmlContent
            .replace(/\$\{routeLink\}/g, routeLink)
            .replace(/\$\{liveRouteLink\}/g, liveRouteLink)
            .replace(/\$\{stopsCount\}/g, stopsCount.toString())
            .replace(/\$\{routeDate\}/g, routeDateForTemplate)
            .replace(/\$\{routeName\}/g, routeNameForTemplate)
            .replace(/\$\{stopTimeRange\}/g, stopTimeRange);
          
          const emailPayload = {
            from: savedTemplate.from_email || 'noreply@routenu.nl',
            to: email.trim(),
            subject: savedTemplate.subject
              .replace(/\$\{routeLink\}/g, routeLink)
            .replace(/\$\{liveRouteLink\}/g, liveRouteLink)
              .replace(/\$\{stopsCount\}/g, stopsCount.toString())
              .replace(/\$\{routeDate\}/g, routeDateForTemplate)
              .replace(/\$\{routeName\}/g, routeNameForTemplate)
              .replace(/\$\{stopTimeRange\}/g, stopTimeRange),
            html: htmlContent
          };
          
          console.log('Sending email to:', email, 'with payload size:', JSON.stringify(emailPayload).length);
          
          // Verstuur e-mail
          let emailSent = false;
          try {
            const response = await fetch(`${API_BASE_URL}/api/send-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(emailPayload)
            });

            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error || 'E-mail verzenden mislukt');
            }
            emailSent = true;
            console.log(`✅ Email sent successfully to ${email}`);
          } catch (emailError) {
            console.error(`❌ Error sending email to ${email}:`, emailError);
            // Continue to send webhook even if email fails
          }
          
          // Verstuur webhook ALTIJD (ook als e-mail faalt) als webhook URL bestaat
          if (savedTemplate?.webhook_url && savedTemplate.webhook_url.trim() && stopForEmail) {
            console.log(`🚀 Sending webhook for klanten-informeren to ${email}:`, {
              webhookUrl: savedTemplate.webhook_url,
              hasWebhookUrl: !!savedTemplate.webhook_url,
              webhookUrlLength: savedTemplate.webhook_url.length,
              emailSent: emailSent
            });
            
            try {
              await sendWebhook(savedTemplate.webhook_url, 'klanten-informeren', {
                stopName: stopForEmail.name || '',
                name: stopForEmail.name || '',
                email: stopForEmail.email || '',
                phone: stopForEmail.phone || '',
                stopAddress: stopForEmail.address || '',
                address: stopForEmail.address || '',
                routeName: routeNameForTemplate,
                routeDate: routeDateForTemplate,
                routeLink: personalRouteLink,
                liveRouteLink: personalRouteLink
              });
              console.log(`✅ Webhook sent successfully for ${email}`);
            } catch (webhookError) {
              console.error(`❌ Error sending webhook for ${email}:`, webhookError);
              // Don't fail the email send if webhook fails
            }
          } else {
            console.log(`⚠️ No webhook URL configured for klanten-informeren template for ${email}:`, {
              hasSavedTemplate: !!savedTemplate,
              webhookUrl: savedTemplate?.webhook_url,
              webhookUrlType: typeof savedTemplate?.webhook_url,
              hasStopForEmail: !!stopForEmail
            });
          }
          
          return { email, success: emailSent };
        } catch (error) {
          console.error(`Error sending email to ${email}:`, error);
          return { email, success: false, error: error.message };
        }
      });

      const results = await Promise.all(emailPromises);
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      if (failed === 0) {
        // Update customers_informed_at timestamp in database
        if (currentUser && currentRouteId) {
          try {
            const { error: updateError } = await supabase
              .from('routes')
              .update({ customers_informed_at: new Date().toISOString() })
              .eq('id', currentRouteId)
              .eq('user_id', currentUser.id);

            if (updateError) {
              console.error('Error updating customers_informed_at:', updateError);
            } else {
              // Update local state
              setCustomersInformedAt(new Date().toISOString());
            }
          } catch (updateError) {
            console.error('Error updating customers_informed_at:', updateError);
          }
        }

        alert(`Alle e-mails succesvol verzonden naar ${successful} klant(en)!`);
      } else {
        alert(`${successful} e-mail(s) verzonden, ${failed} mislukt. Check de console voor details.`);
      }
    } catch (error) {
      console.error('Error informing customers:', error);
      alert('Fout bij het informeren van klanten: ' + (error.message || 'Onbekende fout'));
    } finally {
      setIsInformingCustomers(false);
    }
  };

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <h2>Voertuigen</h2>
        <div className="timeline-actions">
          <button className="link-button">Alles inklappen</button>
          <button className="link-button">Alles vergrendelen</button>
        </div>
      </div>

      {route && stops.length > 0 && (
        <div className="vehicle-summary">
          <div className="vehicle-info">
            <span className="vehicle-name">Voertuig...</span>
            <span className="route-stats">
              {formatDistance(route.distance)}, {formatDuration(route.duration)}
            </span>
          </div>
          <div className="vehicle-actions">
            {onReverseRoute && stops.length >= 2 && (
              <button 
                className="icon-button" 
                onClick={onReverseRoute}
                title="Route omdraaien"
              >
                🔄
              </button>
            )}
            <button 
              className="icon-button" 
              onClick={() => {
                setTempDepartureTime(departureTime || '08:00');
                setShowDepartureModal(true);
              }}
              title="Vertrektijd aanpassen"
            >
              ⚙️
            </button>
          </div>
        </div>
      )}

      <div className="timeline-list">
        {/* Start adres */}
        {stops.length > 0 && (
          <div className="timeline-item">
            <div className="timeline-time">
              {times[0]?.arrival || (departureTime || '08:00')}
            </div>
            <div className="timeline-line-wrapper">
              <div className="timeline-marker start">S</div>
              <div className="timeline-line"></div>
            </div>
            <div className="timeline-content">
              <div className="stop-content-wrapper">
                <div className="stop-title">Start adres</div>
                <div className="stop-address">{startAddress || stops[0]?.address || 'Start locatie'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Stops */}
        {stops.map((stop, index) => {
          const time = times[index + 1];
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;
          
          return (
            <div 
              key={stop.id} 
              className={`timeline-item ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
              draggable={!!onReorderStops}
              onDragStart={(e) => {
                setDraggedIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', e.target);
                e.target.style.opacity = '0.5';
              }}
              onDragEnd={(e) => {
                e.target.style.opacity = '1';
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverIndex !== index && draggedIndex !== index) {
                  setDragOverIndex(index);
                }
              }}
              onDragLeave={() => {
                setDragOverIndex(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (onReorderStops && draggedIndex !== null && draggedIndex !== index) {
                  onReorderStops(draggedIndex, index);
                }
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
            >
              <div className="timeline-time">
                {time ? `${time.arrival}-${time.departure}` : '--:--'}
              </div>
              <div className="timeline-line-wrapper">
                <div className="timeline-marker">{index + 1}</div>
                <div className="timeline-line"></div>
              </div>
              <div className="timeline-content">
                <div className="stop-content-wrapper">
                  <div className="stop-title">{stop.name}</div>
                  <div className="stop-address">{stop.address}</div>
                </div>
                <div className="stop-actions-group">
                  {onEditStop && (
                    <button 
                      className="edit-stop-btn" 
                      title="Stop bewerken"
                      onClick={() => onEditStop(stop)}
                    >
                      <EditIcon />
                    </button>
                  )}
                  {onReorderStops && (
                    <div className="drag-handle" title="Sleep om te verplaatsen">
                      <DragIcon />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Eind adres */}
        {stops.length > 0 && route && (
          <div className="timeline-item">
            <div className="timeline-time">
              {times[times.length - 1]?.arrival || '--:--'}
            </div>
            <div className="timeline-line-wrapper">
              <div className="timeline-marker end">E</div>
            </div>
            <div className="timeline-content">
              <div className="stop-content-wrapper">
                <div className="stop-title">Eind adres</div>
                <div className="stop-address">{startAddress || stops[0]?.address || 'Eind locatie'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Route Details */}
        {route && (
          <div className="route-details-timeline">
            <h3>Route Details</h3>
            <div className="route-stats-timeline">
              <div className="stat-timeline">
                <span className="stat-label-timeline">Afstand:</span>
                <span className="stat-value-timeline">{formatDistance(route.distance)}</span>
              </div>
              <div className="stat-timeline">
                <span className="stat-label-timeline">Tijd:</span>
                <span className="stat-value-timeline">{formatDurationShort(route.duration)}</span>
              </div>
              {stops.length > 0 && serviceTime && (
                <div className="stat-timeline">
                  <span className="stat-label-timeline">Totale service tijd:</span>
                  <span className="stat-value-timeline">{stops.length * serviceTime} min</span>
                </div>
              )}
            </div>
          </div>
        )}

        {stops.length === 0 && (
          <div className="empty-timeline">
            <p>Voeg stops toe om de timeline te zien</p>
          </div>
        )}
      </div>

      {/* Route berekenen button */}
      {stops.length > 0 && (
        <div className="timeline-footer">
          <div className="timeline-footer-row">
          <button 
            className="btn-route-calculate"
            onClick={() => setShowRouteModal(true)}
            disabled={isOptimizing}
          >
            Route berekenen
          </button>
            {onReverseRoute && stops.length >= 2 && (
              <button 
                className="btn-reverse-route"
                onClick={onReverseRoute}
                title="Route omdraaien"
              >
                🔄 Omdraaien
              </button>
            )}
          </div>
          <button 
            className="btn-inform-customers"
            onClick={handleInformCustomers}
            disabled={isInformingCustomers}
          >
            {isInformingCustomers ? 'Verzenden...' : 'Klanten informeren'}
          </button>
          {customersInformedAt && (
            <div className="customers-informed-info">
              Laatst geïnformeerd: {new Date(customersInformedAt).toLocaleString('nl-NL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>
      )}

      {/* Route modal */}
      {showRouteModal && (
        <div className="route-modal-overlay" onClick={() => setShowRouteModal(false)}>
          <div className="route-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="route-modal-header">
              <h3>Route berekenen</h3>
              <button className="route-modal-close" onClick={() => setShowRouteModal(false)}>×</button>
            </div>
            
            {/* Check if vehicles or drivers are missing */}
            {(vehicles.length === 0 || drivers.length === 0) && (
              <div className="route-modal-warning">
                <p>Om een route te berekenen heb je nodig:</p>
                <ul>
                  {vehicles.length === 0 && (
                    <li>
                      <strong>Voertuig:</strong> Voeg eerst een voertuig toe via{' '}
                      <button 
                        className="link-button-inline" 
                        onClick={() => {
                          setShowRouteModal(false);
                          navigate('/voertuigen');
                        }}
                      >
                        Voertuigen
                      </button>
                    </li>
                  )}
                  {drivers.length === 0 && (
                    <li>
                      <strong>Chauffeur:</strong> Voeg eerst een chauffeur toe via{' '}
                      <button 
                        className="link-button-inline" 
                        onClick={() => {
                          setShowRouteModal(false);
                          navigate('/chauffeurs');
                        }}
                      >
                        Chauffeurs
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {vehicles.length > 0 && drivers.length > 0 && (
              <div className="route-modal-buttons">
                <button
                  className="btn-route-optimize"
                  onClick={() => {
                    if (onOptimizeRoute) {
                      onOptimizeRoute();
                    }
                    setShowRouteModal(false);
                  }}
                  disabled={isOptimizing}
                >
                  Route optimaliseren
                </button>
                <button
                  className="btn-route-keep-order"
                  onClick={() => {
                    if (onCalculateRoute) {
                      onCalculateRoute();
                    }
                    setShowRouteModal(false);
                  }}
                  disabled={isOptimizing}
                >
                  Volgorde behouden
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Departure time modal */}
      {showDepartureModal && (
        <div className="route-modal-overlay" onClick={() => setShowDepartureModal(false)}>
          <div className="route-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="route-modal-header">
              <h3>Vertrektijd aanpassen</h3>
              <button className="route-modal-close" onClick={() => setShowDepartureModal(false)}>×</button>
            </div>
            <div className="departure-time-content">
              <label htmlFor="departure-time" className="departure-time-label">
                Vertrektijd
              </label>
              <input
                type="time"
                id="departure-time"
                className="departure-time-input"
                value={tempDepartureTime}
                onChange={(e) => setTempDepartureTime(e.target.value)}
              />
              <div className="departure-time-buttons">
                <button
                  className="btn-route-keep-order"
                  onClick={() => setShowDepartureModal(false)}
                >
                  Annuleren
                </button>
                <button
                  className="btn-route-optimize"
                  onClick={() => {
                    if (onDepartureTimeChange) {
                      onDepartureTimeChange(tempDepartureTime);
                    }
                    setShowDepartureModal(false);
                  }}
                >
                  Opslaan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Timeline;

