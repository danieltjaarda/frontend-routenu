import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserRoutes, deleteItem, saveRoute } from '../services/userData';
import CalendarModal from '../components/CalendarModal';
import jsPDF from 'jspdf';
import './Routes.css';

function Routes({ onSelectRoute }) {
  const { currentUser } = useAuth();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [searchDate, setSearchDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('Actieve routes');
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingRouteId, setDeletingRouteId] = useState(null);
  const [editingRouteId, setEditingRouteId] = useState(null);
  const [editingRouteName, setEditingRouteName] = useState('');

  // Load routes from database
  useEffect(() => {
    const loadRoutes = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const userRoutes = await getUserRoutes(currentUser.id);
        setRoutes(userRoutes);
      } catch (error) {
        console.error('Error loading routes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRoutes();
  }, [currentUser]);

  const handleNewRoute = () => {
    setIsCalendarOpen(true);
  };

  const handleDateSelect = (date) => {
    setIsCalendarOpen(false);
    // Navigeer naar route aanmaak pagina met geselecteerde datum
    if (onSelectRoute) {
      onSelectRoute(date);
    }
  };

  const handleSearchChange = (e) => {
    setSearchDate(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchDate('');
  };

  const handleDeleteRoute = async (routeId, routeName) => {
    if (!window.confirm(`Weet je zeker dat je de route "${routeName || 'Route'}" wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.`)) {
      return;
    }

    if (!currentUser) return;

    try {
      setDeletingRouteId(routeId);
      await deleteItem('routes', routeId);
      
      // Remove from local state
      setRoutes(prev => prev.filter(r => r.id !== routeId));
      console.log('Route verwijderd');
    } catch (error) {
      console.error('Error deleting route:', error);
      alert('Fout bij verwijderen route: ' + (error.message || 'Onbekende fout'));
    } finally {
      setDeletingRouteId(null);
    }
  };

  const handleStartEdit = (route) => {
    setEditingRouteId(route.id);
    setEditingRouteName(route.name || '');
  };

  const handleCancelEdit = () => {
    setEditingRouteId(null);
    setEditingRouteName('');
  };

  const handleSaveRouteName = async (routeId) => {
    if (!currentUser) return;

    try {
      const route = routes.find(r => r.id === routeId);
      if (!route) return;

      await saveRoute(currentUser.id, {
        ...route,
        name: editingRouteName.trim() || route.name
      });

      // Update local state
      setRoutes(prev => prev.map(r => 
        r.id === routeId 
          ? { ...r, name: editingRouteName.trim() || r.name }
          : r
      ));

      setEditingRouteId(null);
      setEditingRouteName('');
    } catch (error) {
      console.error('Error saving route name:', error);
      alert('Fout bij opslaan route naam: ' + (error.message || 'Onbekende fout'));
    }
  };

  // Calculate arrival times for stops
  const calculateArrivalTimes = (route) => {
    if (!route || !route.stops || route.stops.length === 0) return [];

    const departureTime = route.departure_time || '08:00';
    const [hours, minutes] = departureTime.split(':').map(Number);
    const startTime = new Date();
    startTime.setHours(hours, minutes, 0, 0);

    const times = [];
    let currentTime = new Date(startTime);

    // Calculate times based on route_data waypoints if available
    if (route.route_data?.waypoints && route.route_data.waypoints.length > 0) {
      let cumulativeDuration = 0;
      
      route.stops.forEach((stop, index) => {
        const segmentDuration = route.route_data.waypoints[index + 1]?.duration || 
                                (route.route_data.duration / (route.stops.length + 1));
        cumulativeDuration += segmentDuration;
        
        const arrivalTime = new Date(startTime.getTime() + (cumulativeDuration * 1000));
        const departureTime = new Date(arrivalTime.getTime() + (5 * 60 * 1000)); // 5 minuten per stop
        
        times.push({
          arrival: arrivalTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
          departure: departureTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
        });
      });
    } else if (route.route_data?.duration) {
      // Fallback: verdeel duration gelijkmatig
      const durationPerStop = route.route_data.duration / (route.stops.length + 1);
      
      route.stops.forEach((stop, index) => {
        const segmentDuration = durationPerStop;
        currentTime = new Date(currentTime.getTime() + (segmentDuration * 1000));
        
        const arrivalTime = new Date(currentTime);
        const departureTime = new Date(arrivalTime.getTime() + (5 * 60 * 1000)); // 5 minuten per stop
        
        times.push({
          arrival: arrivalTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
          departure: departureTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
        });
        
        currentTime = new Date(departureTime);
      });
    } else {
      // No route data, just show estimated times
      route.stops.forEach(() => {
        times.push({
          arrival: '-',
          departure: '-'
        });
      });
    }

    return times;
  };

  // Download route as PDF
  const handleDownloadRoute = (route) => {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // Prepare route date for display and filename
      const routeDate = route.date 
        ? new Date(route.date).toLocaleDateString('nl-NL', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          })
        : 'Geen datum';
      
      // Create date string with only numbers and underscores (YYYY_MM_DD)
      const routeDateForFilename = route.date
        ? (() => {
            const date = new Date(route.date);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}_${month}_${day}`;
          })()
        : 'geen_datum';

      // Header
      pdf.setFontSize(20);
      pdf.setTextColor(12, 192, 223); // RouteNu blue
      pdf.text('RouteNu', margin, yPos);
      
      yPos += 10;
      pdf.setFontSize(16);
      pdf.setTextColor(0, 0, 0);
      pdf.text(route.name || 'Route zonder naam', margin, yPos);
      
      yPos += 8;
      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Datum: ${routeDate}`, margin, yPos);

      // Route info
      yPos += 10;
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      const distance = route.route_data?.distance 
        ? `${(route.route_data.distance / 1000).toFixed(1)} km` 
        : '-';
      const duration = route.route_data?.duration 
        ? `${Math.round(route.route_data.duration / 60)} minuten` 
        : '-';
      pdf.text(`Afstand: ${distance} | Duur: ${duration}`, margin, yPos);

      // Calculate arrival times
      const arrivalTimes = calculateArrivalTimes(route);

      // Stops
      yPos += 15;
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Stops:', margin, yPos);
      yPos += 8;

      if (!route.stops || route.stops.length === 0) {
        pdf.setFontSize(10);
        pdf.setTextColor(150, 150, 150);
        pdf.text('Geen stops toegevoegd', margin, yPos);
      } else {
        route.stops.forEach((stop, index) => {
          // Check if we need a new page
          if (yPos > pageHeight - 60) {
            pdf.addPage();
            yPos = margin;
          }

          pdf.setFontSize(11);
          pdf.setTextColor(0, 0, 0);
          pdf.setFont(undefined, 'bold');
          pdf.text(`Stop ${index + 1}: ${stop.name || 'Naamloze stop'}`, margin, yPos);
          yPos += 6;

          pdf.setFont(undefined, 'normal');
          pdf.setFontSize(10);
          
          // Aankomsttijd
          if (arrivalTimes[index]) {
            pdf.text(`Aankomsttijd: ${arrivalTimes[index].arrival}`, margin + 5, yPos);
            yPos += 5;
          }

          // Adres
          if (stop.address) {
            pdf.text(`Adres: ${stop.address}`, margin + 5, yPos);
            yPos += 5;
          }

          // Email
          if (stop.email) {
            pdf.text(`E-mail: ${stop.email}`, margin + 5, yPos);
            yPos += 5;
          }

          // Telefoon
          if (stop.phone) {
            pdf.text(`Telefoon: ${stop.phone}`, margin + 5, yPos);
            yPos += 5;
          }

          // Overige velden
          if (stop.orderType) {
            pdf.text(`Type: ${stop.orderType}`, margin + 5, yPos);
            yPos += 5;
          }

          if (stop.notes) {
            pdf.text(`Opmerkingen: ${stop.notes}`, margin + 5, yPos);
            yPos += 5;
          }

          yPos += 5; // Spacing tussen stops
        });
      }

      // Generate safe filename - very strict cleaning
      let routeNameSafe = (route.name || 'Route')
        .trim()
        .replace(/[^a-zA-Z0-9]/g, '_') // Replace ALL non-alphanumeric with underscore
        .replace(/_+/g, '_') // Replace multiple underscores with single
        .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
      
      // If route name is empty after cleaning, use default
      if (!routeNameSafe || routeNameSafe.length === 0) {
        routeNameSafe = 'Route';
      }
      
      // Limit length
      routeNameSafe = routeNameSafe.substring(0, 40);
      
      // Date is already safe (YYYY_MM_DD format)
      const safeDate = routeDateForFilename;
      
      // Construct simple filename without hyphens
      const fileName = `${routeNameSafe}_${safeDate}.pdf`;
      
      // Download PDF
      console.log('Generating PDF...');
      console.log('Route name:', route.name);
      console.log('Route name safe:', routeNameSafe);
      console.log('Date for filename:', routeDateForFilename);
      console.log('Final filename:', fileName);
      
      // Validate filename is safe (only alphanumeric, underscores, and .pdf)
      if (!/^[a-zA-Z0-9_]+\.pdf$/.test(fileName)) {
        console.error('Invalid filename generated:', fileName);
        alert('Fout: Ongeldige bestandsnaam gegenereerd. Probeer opnieuw.');
        return;
      }
      
      // Generate PDF blob and download manually to ensure proper filename
      const pdfBlob = pdf.output('blob');
      
      // Verify blob is valid
      if (!pdfBlob || pdfBlob.size === 0) {
        console.error('PDF blob is empty or invalid');
        alert('Fout: PDF kon niet worden gegenereerd. Probeer opnieuw.');
        return;
      }
      
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.setAttribute('download', fileName); // Explicitly set download attribute
      link.style.display = 'none';
      link.setAttribute('type', 'application/pdf');
      document.body.appendChild(link);
      
      // Trigger download
      try {
        link.click();
        console.log('PDF download triggered with filename:', fileName);
      } catch (error) {
        console.error('Error triggering download:', error);
        alert('Fout bij downloaden PDF: ' + error.message);
      } finally {
        // Clean up after a short delay
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
          URL.revokeObjectURL(url);
        }, 200);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Fout bij genereren PDF: ' + (error.message || 'Onbekende fout'));
    }
  };

  return (
    <div className="routes-page">
      <div className="routes-header">
        <h1>Routes</h1>
        
        <div className="routes-controls">
          <select 
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option>Actieve routes</option>
            <option>Alle routes</option>
            <option>Voltooide routes</option>
          </select>
          
          <button className="btn-new-route" onClick={handleNewRoute}>
            <span className="plus-icon">+</span>
            Nieuwe route
          </button>
        </div>
      </div>

      <div className="routes-table-container">
        {loading ? (
          <div className="empty-routes">
            <p>Routes laden...</p>
          </div>
        ) : routes.length > 0 ? (
          <table className="routes-table">
            <thead>
              <tr>
                <th>Route naam</th>
                <th>Datum</th>
                <th>Aantal stops</th>
                <th>Afstand</th>
                <th>Duur</th>
                <th>Acties</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route, index) => {
                const stopsCount = route.stops?.length || 0;
                const distance = route.route_data?.distance 
                  ? `${(route.route_data.distance / 1000).toFixed(1)} km` 
                  : '-';
                const duration = route.route_data?.duration 
                  ? `${Math.round(route.route_data.duration / 60)} min` 
                  : '-';
                
                // Check if route date is today
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const routeDateObj = route.date ? new Date(route.date) : null;
                if (routeDateObj) {
                  routeDateObj.setHours(0, 0, 0, 0);
                }
                const isToday = routeDateObj && routeDateObj.getTime() === today.getTime();
                const isCompleted = route.route_status === 'completed';

                // Count routes on the same date and get index
                const routeDateStr = route.date ? new Date(route.date).toISOString().split('T')[0] : null;
                const routesOnSameDate = routes.filter(r => {
                  if (!r.date) return false;
                  const rDateStr = new Date(r.date).toISOString().split('T')[0];
                  return rDateStr === routeDateStr;
                });
                
                // Get the index of this route among routes on the same date (sorted by created_at)
                const sortedRoutesOnSameDate = routesOnSameDate.sort((a, b) => {
                  const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
                  const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
                  return aTime - bTime;
                });
                const routeIndex = sortedRoutesOnSameDate.findIndex(r => r.id === route.id);
                const routeNumber = routeIndex >= 0 ? routeIndex + 1 : 1;
                const showNumber = routesOnSameDate.length > 1;

                const routeDate = route.date 
                  ? `${new Date(route.date).toLocaleDateString('nl-NL')}${showNumber ? ` (${routeNumber})` : ''}`
                  : '-';

                const handleRowClick = () => {
                  if (route.date && !editingRouteId) {
                    onSelectRoute(new Date(route.date));
                  }
                };

                return (
                  <tr 
                    key={route.id}
                    className={`route-row ${isToday ? 'route-today' : ''} ${isCompleted ? 'route-completed' : ''}`}
                    onClick={handleRowClick}
                  >
                    <td className="route-name" onClick={(e) => e.stopPropagation()}>
                      {editingRouteId === route.id ? (
                        <div className="route-name-edit">
                          <input
                            type="text"
                            value={editingRouteName}
                            onChange={(e) => setEditingRouteName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveRouteName(route.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                            className="route-name-input"
                            autoFocus
                          />
                          <button
                            className="btn-save-name"
                            onClick={() => handleSaveRouteName(route.id)}
                            title="Opslaan"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </button>
                          <button
                            className="btn-cancel-name"
                            onClick={handleCancelEdit}
                            title="Annuleren"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="route-name-display">
                          <span>{route.name || 'Route zonder naam'}</span>
                          {showNumber && <span className="route-number-badge">({routeNumber})</span>}
                          {isCompleted && (
                            <span className="completed-checkmark" title="Route voltooid">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            </span>
                          )}
                          <button
                            className="btn-edit-name"
                            onClick={() => handleStartEdit(route)}
                            title="Route naam bewerken"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                    <td onClick={handleRowClick}>{routeDate}</td>
                    <td onClick={handleRowClick}>{stopsCount} stops</td>
                    <td onClick={handleRowClick}>{distance}</td>
                    <td onClick={handleRowClick}>{duration}</td>
                    <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="action-buttons">
                        <button 
                          className="btn-download"
                          onClick={() => handleDownloadRoute(route)}
                          title="Route downloaden als PDF"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => handleDeleteRoute(route.id, route.name)}
                          disabled={deletingRouteId === route.id}
                          title="Route verwijderen"
                        >
                          {deletingRouteId === route.id ? (
                            <span className="delete-loading">...</span>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-routes">
            <p>Nog geen routes aangemaakt</p>
            <p className="empty-hint">Klik op "+ Nieuwe route" om een route aan te maken</p>
          </div>
        )}
      </div>

      <CalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        onDateSelect={handleDateSelect}
      />

      <div className="page-logo-footer">
        <img src="/logo.png" alt="Routenu" />
      </div>
    </div>
  );
}

export default Routes;

