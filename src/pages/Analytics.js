import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getUserVehicles, getMonthlyCostsForMonth } from '../services/userData';
import './Analytics.css';

function Analytics() {
  const { currentUser } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [allRoutes, setAllRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [stopDetails, setStopDetails] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [periodFilter, setPeriodFilter] = useState('all'); // 'all', 'day', 'week', 'month', 'quarter', 'year', 'date'
  const [selectedDate, setSelectedDate] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [btwPercentage, setBtwPercentage] = useState(() => {
    const saved = localStorage.getItem('analytics_btw_percentage');
    return saved ? parseFloat(saved) : 0;
  });
  const [tempBtwPercentage, setTempBtwPercentage] = useState(btwPercentage);

  useEffect(() => {
    const loadRoutes = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Load all completed routes with driver info
        const { data, error } = await supabase
          .from('routes')
          .select(`
            *,
            drivers (
              name,
              email,
              hourly_rate
            )
          `)
          .eq('user_id', currentUser.id)
          .eq('route_status', 'completed')
          .order('date', { ascending: false });

        if (error) throw error;
        setAllRoutes(data || []);
        setRoutes(data || []);
        
        // Load vehicles for cost calculation
        const userVehicles = await getUserVehicles(currentUser.id);
        setVehicles(userVehicles || []);
      } catch (error) {
        console.error('Error loading routes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRoutes();
  }, [currentUser]);

  // Filter routes based on selected period
  useEffect(() => {
    if (periodFilter === 'all') {
      setRoutes(allRoutes);
      return;
    }

    if (periodFilter === 'date' && !selectedDate) {
      setRoutes([]);
      return;
    }

    const now = new Date();
    const filtered = allRoutes.filter(route => {
      if (!route.date) return false;
      const routeDate = new Date(route.date);
      
      switch (periodFilter) {
        case 'day':
          return routeDate.toDateString() === now.toDateString();
        
        case 'date':
          if (!selectedDate) return false;
          const selected = new Date(selectedDate);
          return routeDate.toDateString() === selected.toDateString();
        
        case 'week':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          return routeDate >= weekStart && routeDate <= weekEnd;
        
        case 'month':
          return routeDate.getMonth() === now.getMonth() && 
                 routeDate.getFullYear() === now.getFullYear();
        
        case 'quarter':
          const currentQuarter = Math.floor(now.getMonth() / 3);
          const routeQuarter = Math.floor(routeDate.getMonth() / 3);
          return routeQuarter === currentQuarter && 
                 routeDate.getFullYear() === now.getFullYear();
        
        case 'year':
          return routeDate.getFullYear() === now.getFullYear();
        
        default:
          return true;
      }
    });
    
    setRoutes(filtered);
  }, [periodFilter, allRoutes, selectedDate]);

  const loadStopDetails = async (routeId) => {
    try {
      const { data, error } = await supabase
        .from('route_stop_details')
        .select('*')
        .eq('route_id', routeId)
        .order('stop_index', { ascending: true });

      if (error) throw error;
      setStopDetails(data || []);
    } catch (error) {
      console.error('Error loading stop details:', error);
    }
  };

  const handleRouteClick = async (route) => {
    if (selectedRoute?.id === route.id) {
      setSelectedRoute(null);
      setStopDetails([]);
    } else {
      setSelectedRoute(route);
      await loadStopDetails(route.id);
    }
  };

  const calculateTotalRevenue = (route) => {
    if (!stopDetails.length || stopDetails[0]?.route_id !== route.id) return 0;
    return stopDetails.reduce((sum, detail) => sum + (parseFloat(detail.amount_received) || 0), 0);
  };

  const calculateTotalPartsCost = (route) => {
    if (!stopDetails.length || stopDetails[0]?.route_id !== route.id) return 0;
    return stopDetails.reduce((sum, detail) => sum + (parseFloat(detail.parts_cost) || 0), 0);
  };

  const calculateVehicleCost = (route) => {
    // Use actual_distance_km if available, otherwise use planned distance
    const distanceKm = route.actual_distance_km 
      ? parseFloat(route.actual_distance_km) 
      : (route.route_data?.distance ? route.route_data.distance / 1000 : 0);
    
    if (distanceKm === 0) return 0;
    
    // First check if route has diesel_price_per_liter (fuel cost)
    if (route.diesel_price_per_liter) {
      // Find vehicle to get consumption
      const vehicleWithConsumption = vehicles.find(v => v.consumption);
      if (vehicleWithConsumption && vehicleWithConsumption.consumption) {
        // Parse consumption (format: "X L/100km" or just "X")
        const consumptionStr = vehicleWithConsumption.consumption.toString();
        const consumptionMatch = consumptionStr.match(/(\d+\.?\d*)/);
        const consumptionLitersPer100km = consumptionMatch ? parseFloat(consumptionMatch[1]) : 0;
        
        if (consumptionLitersPer100km > 0) {
          // Calculate fuel cost: (distance_km / 100) * consumption_liters_per_100km * diesel_price_per_liter
          const fuelCost = (distanceKm / 100) * consumptionLitersPer100km * parseFloat(route.diesel_price_per_liter);
          return fuelCost;
        }
      }
    }
    
    // Fallback to cents_per_km if no diesel price
    const vehicleWithCost = vehicles.find(v => v.cents_per_km && v.cents_per_km > 0);
    if (!vehicleWithCost || !vehicleWithCost.cents_per_km) return 0;
    
    // Calculate: kilometers × cents_per_km / 100 (to convert cents to euros)
    return (distanceKm * parseFloat(vehicleWithCost.cents_per_km)) / 100;
  };

  const calculateDriverCost = (route) => {
    // Get hours worked
    const hoursWorked = parseFloat(route.hours_worked) || 0;
    
    // Get driver hourly rate
    const hourlyRate = route.drivers?.hourly_rate ? parseFloat(route.drivers.hourly_rate) : 0;
    
    // Calculate: hours × hourly_rate
    return hoursWorked * hourlyRate;
  };

  const calculateProfit = (route) => {
    const revenue = calculateTotalRevenue(route);
    const partsCost = calculateTotalPartsCost(route);
    const vehicleCost = calculateVehicleCost(route);
    const driverCost = calculateDriverCost(route);
    
    return revenue - partsCost - vehicleCost - driverCost;
  };

  const [totals, setTotals] = useState({ totalRevenue: 0, totalPartsCost: 0, totalVehicleCost: 0, totalDriverCost: 0, totalMonthlyCosts: 0, totalProfit: 0 });

  // Calculate totals when routes or period filter changes
  useEffect(() => {
    const loadTotals = async () => {
      if (routes.length === 0) {
        setTotals({ totalRevenue: 0, totalPartsCost: 0, totalVehicleCost: 0, totalDriverCost: 0, totalMonthlyCosts: 0, totalProfit: 0 });
        return;
      }

      let totalRevenue = 0;
      let totalPartsCost = 0;
      let totalVehicleCost = 0;
      let totalDriverCost = 0;
      let totalMonthlyCosts = 0;

      // Calculate monthly costs for the selected period
      try {
        let monthToCheck = new Date();
        if (periodFilter === 'date' && selectedDate) {
          monthToCheck = new Date(selectedDate);
        } else if (periodFilter === 'month') {
          monthToCheck = new Date();
        } else if (periodFilter === 'quarter') {
          monthToCheck = new Date();
        } else if (periodFilter === 'year') {
          monthToCheck = new Date();
        } else if (periodFilter === 'week') {
          monthToCheck = new Date();
        } else if (periodFilter === 'day') {
          monthToCheck = new Date();
        }
        
        // Get monthly costs for the month(s) in the selected period
        if (periodFilter === 'all') {
          // For "all", we need to get costs for all months that have routes
          const uniqueMonths = new Set();
          routes.forEach(route => {
            if (route.date) {
              const routeDate = new Date(route.date);
              const monthKey = `${routeDate.getFullYear()}-${String(routeDate.getMonth() + 1).padStart(2, '0')}`;
              uniqueMonths.add(monthKey);
            }
          });
          
          for (const monthKey of uniqueMonths) {
            const [year, month] = monthKey.split('-');
            const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const costs = await getMonthlyCostsForMonth(currentUser.id, monthDate);
            totalMonthlyCosts += costs.reduce((sum, cost) => sum + (parseFloat(cost.amount) || 0), 0);
          }
        } else {
          // For specific periods, get costs for the relevant month(s)
          if (periodFilter === 'quarter') {
            // Get costs for all 3 months in the quarter
            const currentQuarter = Math.floor(monthToCheck.getMonth() / 3);
            for (let i = 0; i < 3; i++) {
              const monthDate = new Date(monthToCheck.getFullYear(), currentQuarter * 3 + i, 1);
              const costs = await getMonthlyCostsForMonth(currentUser.id, monthDate);
              totalMonthlyCosts += costs.reduce((sum, cost) => sum + (parseFloat(cost.amount) || 0), 0);
            }
          } else if (periodFilter === 'year') {
            // Get costs for all 12 months
            for (let i = 0; i < 12; i++) {
              const monthDate = new Date(monthToCheck.getFullYear(), i, 1);
              const costs = await getMonthlyCostsForMonth(currentUser.id, monthDate);
              totalMonthlyCosts += costs.reduce((sum, cost) => sum + (parseFloat(cost.amount) || 0), 0);
            }
          } else {
            // For day, week, month, or date - get costs for that specific month
            const costs = await getMonthlyCostsForMonth(currentUser.id, monthToCheck);
            totalMonthlyCosts += costs.reduce((sum, cost) => sum + (parseFloat(cost.amount) || 0), 0);
          }
        }
      } catch (error) {
        console.error('Error loading monthly costs:', error);
      }

      for (const route of routes) {
        try {
          // Load stop details for this route
          const { data: details } = await supabase
            .from('route_stop_details')
            .select('*')
            .eq('route_id', route.id);

          if (details) {
            const revenue = details.reduce((sum, detail) => sum + (parseFloat(detail.amount_received) || 0), 0);
            const partsCost = details.reduce((sum, detail) => sum + (parseFloat(detail.parts_cost) || 0), 0);
            
            // Calculate vehicle cost (uses actual_distance_km if available, includes diesel price if set)
            const vehicleCost = calculateVehicleCost(route);
            
            // Calculate driver cost
            const hoursWorked = parseFloat(route.hours_worked) || 0;
            const hourlyRate = route.drivers?.hourly_rate ? parseFloat(route.drivers.hourly_rate) : 0;
            const driverCost = hoursWorked * hourlyRate;

            totalRevenue += revenue;
            totalPartsCost += partsCost;
            totalVehicleCost += vehicleCost;
            totalDriverCost += driverCost;
          }
        } catch (error) {
          console.error(`Error loading details for route ${route.id}:`, error);
        }
      }

      // Distribute monthly costs across routes (proportional or per route)
      // For simplicity, we'll divide monthly costs by number of routes in the period
      const monthlyCostsPerRoute = routes.length > 0 ? totalMonthlyCosts / routes.length : 0;
      const totalProfit = totalRevenue - totalPartsCost - totalVehicleCost - totalDriverCost - totalMonthlyCosts;
      
      setTotals({ 
        totalRevenue, 
        totalPartsCost, 
        totalVehicleCost, 
        totalDriverCost, 
        totalMonthlyCosts,
        totalProfit 
      });
    };
    
    loadTotals();
  }, [routes, periodFilter, selectedDate, vehicles, currentUser]);

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading-message">Laden...</div>
      </div>
    );
  }

  const getPeriodLabel = () => {
    switch (periodFilter) {
      case 'day': return 'Vandaag';
      case 'week': return 'Deze week';
      case 'month': return 'Deze maand';
      case 'quarter': return 'Dit kwartaal';
      case 'year': return 'Dit jaar';
      case 'date': 
        if (selectedDate) {
          const date = new Date(selectedDate);
          return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
        }
        return 'Selecteer datum';
      default: return 'Alle periodes';
    }
  };

  const handlePeriodFilterChange = (value) => {
    setPeriodFilter(value);
    if (value !== 'date') {
      setSelectedDate('');
    }
  };

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div className="analytics-header-top">
          <div>
            <h1>Analytics</h1>
            <p>Overzicht van voltooide routes</p>
          </div>
          <div className="analytics-controls">
            <select 
              className="period-filter-select"
              value={periodFilter}
              onChange={(e) => handlePeriodFilterChange(e.target.value)}
            >
              <option value="all">Alle periodes</option>
              <option value="day">Vandaag</option>
              <option value="week">Deze week</option>
              <option value="month">Deze maand</option>
              <option value="quarter">Dit kwartaal</option>
              <option value="year">Dit jaar</option>
              <option value="date">Specifieke datum</option>
            </select>
            {periodFilter === 'date' && (
              <input
                type="date"
                className="date-filter-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            )}
            <button 
              className="btn-settings"
              onClick={() => {
                setTempBtwPercentage(btwPercentage);
                setShowSettings(true);
              }}
              title="Instellingen"
            >
              ⚙️
            </button>
          </div>
        </div>
        
        {/* Summary Cards */}
        {routes.length > 0 && (
          <div className="analytics-summary">
            <div className="summary-card">
              <div className="summary-label">Totaal Opbrengst</div>
              <div className="summary-value revenue">€{totals.totalRevenue.toFixed(2)}</div>
              <div className="summary-period">{getPeriodLabel()}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Totale Kosten</div>
              <div className="summary-value costs">
                €{(totals.totalPartsCost + totals.totalVehicleCost + totals.totalDriverCost + totals.totalMonthlyCosts).toFixed(2)}
              </div>
              <div className="summary-period">{getPeriodLabel()}</div>
            </div>
            {totals.totalVehicleCost > 0 && (
              <div className="summary-card">
                <div className="summary-label">Voertuigkosten</div>
                <div className="summary-value costs">
                  €{totals.totalVehicleCost.toFixed(2)}
                </div>
                <div className="summary-period">{getPeriodLabel()}</div>
              </div>
            )}
            {totals.totalDriverCost > 0 && (
              <div className="summary-card">
                <div className="summary-label">Chauffeurkosten</div>
                <div className="summary-value costs">
                  €{totals.totalDriverCost.toFixed(2)}
                </div>
                <div className="summary-period">{getPeriodLabel()}</div>
              </div>
            )}
            {totals.totalMonthlyCosts > 0 && (
              <div className="summary-card">
                <div className="summary-label">Maandelijkse Kosten</div>
                <div className="summary-value costs">
                  €{totals.totalMonthlyCosts.toFixed(2)}
                </div>
                <div className="summary-period">{getPeriodLabel()}</div>
              </div>
            )}
            <div className="summary-card highlight">
              <div className="summary-label">Bruto Winst</div>
              <div className={`summary-value ${totals.totalProfit >= 0 ? 'profit' : 'loss'}`}>
                €{totals.totalProfit.toFixed(2)}
              </div>
              <div className="summary-period">{getPeriodLabel()}</div>
            </div>
            {btwPercentage > 0 && totals.totalProfit > 0 && (
              <div className="summary-card">
                <div className="summary-label">BTW ({btwPercentage}%)</div>
                <div className="summary-value costs">
                  €{(totals.totalProfit * (btwPercentage / 100)).toFixed(2)}
                </div>
                <div className="summary-period">{getPeriodLabel()}</div>
              </div>
            )}
            {btwPercentage > 0 && totals.totalProfit > 0 && (
              <div className="summary-card highlight-green">
                <div className="summary-label">Netto Winst</div>
                <div className={`summary-value ${(totals.totalProfit - (totals.totalProfit * (btwPercentage / 100))) >= 0 ? 'profit' : 'loss'}`}>
                  €{(totals.totalProfit - (totals.totalProfit * (btwPercentage / 100))).toFixed(2)}
                </div>
                <div className="summary-period">{getPeriodLabel()}</div>
              </div>
            )}
            <div className="summary-card">
              <div className="summary-label">Aantal Routes</div>
              <div className="summary-value">{routes.length}</div>
              <div className="summary-period">{getPeriodLabel()}</div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="settings-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h2>⚙️ Instellingen</h2>
              <button className="close-button" onClick={() => setShowSettings(false)}>×</button>
            </div>
            <div className="settings-modal-body">
              <div className="settings-group">
                <label htmlFor="btw-percentage">BTW Percentage (%)</label>
                <input
                  type="number"
                  id="btw-percentage"
                  value={tempBtwPercentage}
                  onChange={(e) => setTempBtwPercentage(parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="bijv. 21"
                />
                <small>Dit percentage wordt van de bruto winst afgetrokken om de netto winst te berekenen.</small>
              </div>
            </div>
            <div className="settings-modal-footer">
              <button className="btn-cancel" onClick={() => setShowSettings(false)}>
                Annuleren
              </button>
              <button 
                className="btn-save"
                onClick={() => {
                  setBtwPercentage(tempBtwPercentage);
                  localStorage.setItem('analytics_btw_percentage', tempBtwPercentage.toString());
                  setShowSettings(false);
                }}
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="analytics-content">
        {routes.length === 0 ? (
          <div className="empty-analytics">
            <p>Nog geen voltooide routes</p>
          </div>
        ) : (
          <div className="routes-grid">
            {routes.map((route) => {
              const isSelected = selectedRoute?.id === route.id;
              const revenue = isSelected ? calculateTotalRevenue(route) : 0;
              const partsCost = isSelected ? calculateTotalPartsCost(route) : 0;
              const profit = isSelected ? calculateProfit(route) : 0;

              return (
                <div
                  key={route.id}
                  className={`route-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleRouteClick(route)}
                >
                  <div className="route-card-header">
                    <h3>{route.name || 'Route zonder naam'}</h3>
                    <span className="route-status completed">Voltooid</span>
                  </div>
                  <div className="route-card-body">
                    <p><strong>Datum:</strong> {route.date ? new Date(route.date).toLocaleDateString('nl-NL') : '-'}</p>
                    <p><strong>Chauffeur:</strong> {route.drivers?.name || route.selected_driver || '-'}</p>
                    <p><strong>Aantal stops:</strong> {route.stops?.length || 0}</p>
                    {route.hours_worked && (
                      <p><strong>Gewerkte uren:</strong> {route.hours_worked} uur</p>
                    )}
                    {route.actual_distance_km && (
                      <p><strong>Gereden kilometers:</strong> {parseFloat(route.actual_distance_km).toFixed(2)} km</p>
                    )}
                    {route.route_data?.distance && !route.actual_distance_km && (
                      <p><strong>Geplande kilometers:</strong> {(route.route_data.distance / 1000).toFixed(2)} km</p>
                    )}
                    {isSelected && (
                      <div className="route-financials">
                        <p><strong>Totale opbrengst:</strong> €{revenue.toFixed(2)}</p>
                        <p><strong>Kosten onderdelen:</strong> €{partsCost.toFixed(2)}</p>
                        {(() => {
                          const vehicleCost = calculateVehicleCost(route);
                          const driverCost = calculateDriverCost(route);
                          const distanceKm = route.actual_distance_km 
                            ? parseFloat(route.actual_distance_km) 
                            : (route.route_data?.distance ? route.route_data.distance / 1000 : 0);
                          
                          // Find vehicle with cents_per_km or consumption
                          const vehicleWithCost = vehicles.find(v => v.cents_per_km && v.cents_per_km > 0);
                          const vehicleWithConsumption = vehicles.find(v => v.consumption);
                          
                          return (
                            <>
                              {vehicleCost > 0 && (
                                <div className="cost-breakdown">
                                  <p><strong>Kosten voertuig:</strong> €{vehicleCost.toFixed(2)}</p>
                                  {distanceKm > 0 && (
                                    <div className="cost-calculation">
                                      {route.diesel_price_per_liter && vehicleWithConsumption ? (
                                        <>
                                          <small>
                                            {distanceKm.toFixed(2)} km × 
                                            {(() => {
                                              const consumptionStr = vehicleWithConsumption.consumption?.toString() || '';
                                              const consumptionMatch = consumptionStr.match(/(\d+\.?\d*)/);
                                              const consumptionLitersPer100km = consumptionMatch ? parseFloat(consumptionMatch[1]) : 0;
                                              return consumptionLitersPer100km;
                                            })()} L/100km × 
                                            €{parseFloat(route.diesel_price_per_liter).toFixed(3)}/L = 
                                            €{vehicleCost.toFixed(2)}
                                          </small>
                                        </>
                                      ) : vehicleWithCost ? (
                                        <>
                                          <small>
                                            {distanceKm.toFixed(2)} km × 
                                            {parseFloat(vehicleWithCost.cents_per_km).toFixed(2)} cent/km = 
                                            €{vehicleCost.toFixed(2)}
                                          </small>
                                        </>
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                              )}
                              {driverCost > 0 && (
                                <div className="cost-breakdown">
                                  <p><strong>Kosten chauffeur:</strong> €{driverCost.toFixed(2)}</p>
                                  {route.hours_worked && route.drivers?.hourly_rate && (
                                    <div className="cost-calculation">
                                      <small>
                                        {parseFloat(route.hours_worked).toFixed(2)} uur × 
                                        €{parseFloat(route.drivers.hourly_rate).toFixed(2)}/uur = 
                                        €{driverCost.toFixed(2)}
                                      </small>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          );
                        })()}
                        <p className="profit"><strong>Bruto Winst:</strong> €{profit.toFixed(2)}</p>
                        {btwPercentage > 0 && profit > 0 && (
                          <>
                            <p className="btw-cost"><strong>BTW ({btwPercentage}%):</strong> €{(profit * (btwPercentage / 100)).toFixed(2)}</p>
                            <p className="netto-profit"><strong>Netto Winst:</strong> €{(profit - (profit * (btwPercentage / 100))).toFixed(2)}</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {isSelected && stopDetails.length > 0 && (
                    <div className="stop-details-list">
                      <h4>Stop Details:</h4>
                      {stopDetails.map((detail, index) => (
                        <div key={detail.id} className="stop-detail-item">
                          <p><strong>Stop {detail.stop_index + 1}:</strong></p>
                          {detail.work_description && (
                            <p className="work-description">{detail.work_description}</p>
                          )}
                          <div className="stop-financials">
                            {detail.amount_received && (
                              <span>Ontvangen: €{parseFloat(detail.amount_received).toFixed(2)}</span>
                            )}
                            {detail.parts_cost && (
                              <span>Onderdelen: €{parseFloat(detail.parts_cost).toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="page-logo-footer">
        <img src="/logo.png" alt="Routenu" />
      </div>
    </div>
  );
}

export default Analytics;
