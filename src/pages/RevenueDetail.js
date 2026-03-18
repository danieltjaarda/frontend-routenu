import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getUserVehicles } from '../services/userData';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import './RevenueDetail.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

const METRIC_CONFIG = {
  revenue:    { label: 'Totale Omzet',  color: '#0CC0DF', bg: 'rgba(12, 192, 223, 0.08)' },
  costs:      { label: 'Totale Kosten', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)' },
  grossProfit:{ label: 'Bruto Winst',   color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)' },
  netProfit:  { label: 'Netto Winst',   color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)' },
};

function RevenueDetail() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [allRoutes, setAllRoutes] = useState([]);
  const [allShopRepairs, setAllShopRepairs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState('30days');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [activeMetrics, setActiveMetrics] = useState({ revenue: true, costs: false, grossProfit: false, netProfit: false });
  const [chartType, setChartType] = useState('line');
  const [btwPercentage] = useState(() => {
    const saved = localStorage.getItem('analytics_btw_percentage');
    return saved ? parseFloat(saved) : 0;
  });

  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) { setLoading(false); return; }
      try {
        setLoading(true);
        const [routesRes, repairsRes, userVehicles] = await Promise.all([
          supabase
            .from('routes')
            .select(`
              id, date, route_status, actual_distance_km, hours_worked, diesel_price_per_liter, route_data,
              drivers ( name, hourly_rate )
            `)
            .eq('user_id', currentUser.id)
            .eq('route_status', 'completed')
            .order('date', { ascending: true }),
          supabase
            .from('shop_repairs')
            .select('id, date, revenue, parts_cost, labor_hours')
            .eq('user_id', currentUser.id)
            .order('date', { ascending: true }),
          getUserVehicles(currentUser.id)
        ]);

        const routes = routesRes.data || [];
        setVehicles(userVehicles || []);

        const routeIds = routes.map(r => r.id);
        let stopDetails = [];
        if (routeIds.length > 0) {
          const { data } = await supabase
            .from('route_stop_details')
            .select('route_id, amount_received, parts_cost')
            .in('route_id', routeIds);
          stopDetails = data || [];
        }

        const routeRevenueMap = {};
        const routePartsCostMap = {};
        stopDetails.forEach(d => {
          if (!routeRevenueMap[d.route_id]) routeRevenueMap[d.route_id] = 0;
          if (!routePartsCostMap[d.route_id]) routePartsCostMap[d.route_id] = 0;
          routeRevenueMap[d.route_id] += parseFloat(d.amount_received) || 0;
          routePartsCostMap[d.route_id] += parseFloat(d.parts_cost) || 0;
        });

        const calcVehicleCost = (route) => {
          const distanceKm = route.actual_distance_km
            ? parseFloat(route.actual_distance_km)
            : (route.route_data?.distance ? route.route_data.distance / 1000 : 0);
          if (distanceKm === 0) return 0;
          if (route.diesel_price_per_liter) {
            const v = (userVehicles || []).find(v => v.consumption);
            if (v) {
              const match = v.consumption.toString().match(/(\d+\.?\d*)/);
              const lPer100 = match ? parseFloat(match[1]) : 0;
              if (lPer100 > 0) return (distanceKm / 100) * lPer100 * parseFloat(route.diesel_price_per_liter);
            }
          }
          const v2 = (userVehicles || []).find(v => v.cents_per_km && v.cents_per_km > 0);
          if (!v2) return 0;
          return (distanceKm * parseFloat(v2.cents_per_km)) / 100;
        };

        const calcDriverCost = (route) => {
          const hours = parseFloat(route.hours_worked) || 0;
          const rate = route.drivers?.hourly_rate ? parseFloat(route.drivers.hourly_rate) : 0;
          return hours * rate;
        };

        const enrichedRoutes = routes.map(r => {
          const revenue = routeRevenueMap[r.id] || 0;
          const partsCost = routePartsCostMap[r.id] || 0;
          const vehicleCost = calcVehicleCost(r);
          const driverCost = calcDriverCost(r);
          const totalCost = partsCost + vehicleCost + driverCost;
          return { ...r, revenue, totalCost };
        });

        setAllRoutes(enrichedRoutes);
        setAllShopRepairs((repairsRes.data || []).map(r => ({
          ...r,
          totalCost: (parseFloat(r.parts_cost) || 0) + ((parseFloat(r.labor_hours) || 0) * 20)
        })));
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentUser]);

  const toggleMetric = (key) => {
    setActiveMetrics(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  };

  const getPeriodConfig = (filter) => {
    switch (filter) {
      case '7days': return { days: 7, label: '7 dagen' };
      case 'week': return { days: 7, label: 'Week' };
      case '30days': return { days: 30, label: '30 dagen' };
      case 'quarter': return { days: 90, label: 'Kwartaal' };
      case 'year': return { days: 365, label: 'Jaar' };
      default: return { days: 30, label: '30 dagen' };
    }
  };

  const getCurrentDateRange = (filter, offset) => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    if (filter === 'week') {
      const dow = now.getDay();
      const monOff = dow === 0 ? -6 : 1 - dow;
      const ws = new Date(now);
      ws.setDate(now.getDate() + monOff + (offset * 7));
      ws.setHours(0, 0, 0, 0);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      we.setHours(23, 59, 59, 999);
      return { start: ws, end: we };
    }
    const config = getPeriodConfig(filter);
    const end = new Date(now);
    end.setDate(end.getDate() + (offset * config.days));
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - config.days + 1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  };

  const getPeriodLabel = (filter, offset) => {
    const { start, end } = getCurrentDateRange(filter, offset);
    const fs = { day: 'numeric', month: 'short' };
    const ff = { day: 'numeric', month: 'short', year: 'numeric' };
    const range = `${start.toLocaleDateString('nl-NL', fs)} - ${end.toLocaleDateString('nl-NL', ff)}`;
    if (filter === 'week')    return offset === 0 ? 'Deze week' : offset === -1 ? 'Vorige week' : range;
    if (filter === '7days')   return offset === 0 ? 'Afgelopen 7 dagen' : range;
    if (filter === '30days')  return offset === 0 ? 'Afgelopen 30 dagen' : range;
    if (filter === 'quarter') return offset === 0 ? 'Afgelopen kwartaal' : range;
    if (filter === 'year')    return offset === 0 ? 'Afgelopen jaar' : range;
    return '';
  };

  const aggregateByDate = (routes, repairs, startDate, endDate) => {
    const dates = {};
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const key = cur.toISOString().split('T')[0];
      dates[key] = { revenue: 0, costs: 0 };
      cur.setDate(cur.getDate() + 1);
    }
    routes.forEach(r => {
      if (!r.date) return;
      const key = r.date.split('T')[0];
      if (dates[key]) {
        dates[key].revenue += r.revenue;
        dates[key].costs += r.totalCost;
      }
    });
    repairs.forEach(r => {
      if (!r.date) return;
      const key = r.date.split('T')[0];
      if (dates[key]) {
        dates[key].revenue += parseFloat(r.revenue) || 0;
        dates[key].costs += r.totalCost;
      }
    });
    const sorted = Object.keys(dates).sort();
    return sorted.map(key => {
      const rev = dates[key].revenue;
      const cost = dates[key].costs;
      const gross = rev - cost;
      const net = btwPercentage > 0 && gross > 0 ? gross - (gross * btwPercentage / 100) : gross;
      return { date: key, revenue: rev, costs: cost, grossProfit: gross, netProfit: net };
    });
  };

  const formatLabel = (dateStr, filter) => {
    const d = new Date(dateStr);
    if (filter === '7days' || filter === 'week') return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric' });
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  };

  const chartData = useMemo(() => {
    const { start, end } = getCurrentDateRange(periodFilter, periodOffset);
    const data = aggregateByDate(allRoutes, allShopRepairs, start, end);

    const maxTicks = { '7days': 7, 'week': 7, '30days': 15, 'quarter': 12, 'year': 12 }[periodFilter] || 15;
    const step = Math.max(1, Math.floor(data.length / maxTicks));

    const labels = data.map((d, i) =>
      i % step === 0 || i === data.length - 1 ? formatLabel(d.date, periodFilter) : ''
    );

    const datasets = [];
    const showPoints = data.length <= 31;
    const isBar = chartType === 'bar';
    const isArea = chartType === 'area';
    let dsIndex = 0;

    Object.entries(activeMetrics).forEach(([key, enabled]) => {
      if (!enabled) return;
      const cfg = METRIC_CONFIG[key];
      if (isBar) {
        datasets.push({
          label: cfg.label,
          data: data.map(d => d[key]),
          backgroundColor: cfg.color + 'CC',
          borderColor: cfg.color,
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
        });
      } else {
        datasets.push({
          label: cfg.label,
          data: data.map(d => d[key]),
          borderColor: cfg.color,
          backgroundColor: isArea ? cfg.color + '20' : cfg.bg,
          borderWidth: 2.5,
          pointRadius: showPoints ? 4 : 0,
          pointBackgroundColor: cfg.color,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: cfg.color,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          tension: 0.3,
          fill: isArea ? true : dsIndex === 0
        });
      }
      dsIndex++;
    });

    if (compareEnabled) {
      const prevRange = getCurrentDateRange(periodFilter, periodOffset - 1);
      const prevData = aggregateByDate(allRoutes, allShopRepairs, prevRange.start, prevRange.end);
      const s = prevRange.start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
      const e = prevRange.end.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
      const prevLabel = `${s} - ${e}`;

      Object.entries(activeMetrics).forEach(([key, enabled]) => {
        if (!enabled) return;
        const cfg = METRIC_CONFIG[key];
        const lighter = cfg.color + '80';
        if (isBar) {
          datasets.push({
            label: `${cfg.label} (${prevLabel})`,
            data: data.map((_, i) => i < prevData.length ? prevData[i][key] : 0),
            backgroundColor: lighter + '66',
            borderColor: lighter,
            borderWidth: 1,
            borderRadius: 4,
            borderDash: [4, 2],
            barPercentage: 0.7,
            categoryPercentage: 0.8,
          });
        } else {
          datasets.push({
            label: `${cfg.label} (${prevLabel})`,
            data: data.map((_, i) => i < prevData.length ? prevData[i][key] : 0),
            borderColor: lighter,
            backgroundColor: isArea ? lighter + '10' : 'transparent',
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: lighter,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            tension: 0.3,
            fill: isArea
          });
        }
      });
    }

    return { labels, datasets };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRoutes, allShopRepairs, periodFilter, periodOffset, compareEnabled, activeMetrics, btwPercentage, chartType]);

  const summaryStats = useMemo(() => {
    const { start, end } = getCurrentDateRange(periodFilter, periodOffset);
    const data = aggregateByDate(allRoutes, allShopRepairs, start, end);

    const cur = data.reduce((acc, d) => ({
      revenue: acc.revenue + d.revenue,
      costs: acc.costs + d.costs,
      grossProfit: acc.grossProfit + d.grossProfit,
      netProfit: acc.netProfit + d.netProfit,
      deals: acc.deals + (d.revenue > 0 ? 1 : 0)
    }), { revenue: 0, costs: 0, grossProfit: 0, netProfit: 0, deals: 0 });

    const prevRange = getCurrentDateRange(periodFilter, periodOffset - 1);
    const prevData = aggregateByDate(allRoutes, allShopRepairs, prevRange.start, prevRange.end);
    const prev = prevData.reduce((acc, d) => ({
      revenue: acc.revenue + d.revenue,
      costs: acc.costs + d.costs,
      grossProfit: acc.grossProfit + d.grossProfit,
      netProfit: acc.netProfit + d.netProfit,
    }), { revenue: 0, costs: 0, grossProfit: 0, netProfit: 0 });

    return { cur, prev };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRoutes, allShopRepairs, periodFilter, periodOffset, btwPercentage]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(255,255,255,0.96)',
        titleColor: '#1a1a2e',
        bodyColor: '#4a4a5a',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        cornerRadius: 10,
        padding: 14,
        titleFont: { size: 13, weight: '600', family: "'Inter', sans-serif" },
        bodyFont: { size: 13, family: "'Inter', sans-serif" },
        displayColors: true,
        callbacks: {
          title: (items) => {
            if (!items.length) return '';
            const { start } = getCurrentDateRange(periodFilter, periodOffset);
            const date = new Date(start);
            date.setDate(date.getDate() + items[0].dataIndex);
            return date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          },
          label: (item) => {
            const val = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(item.raw);
            return ` ${item.dataset.label}: ${val}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 0, font: { size: 11, family: "'Inter', sans-serif" }, color: '#9ca3af' },
        border: { display: false }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
        ticks: {
          font: { size: 11, family: "'Inter', sans-serif" },
          color: '#9ca3af',
          callback: (v) => v >= 1000 ? `€${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `€${v}`
        },
        border: { display: false }
      }
    }
  };

  const fmt = (amount) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(amount);

  const pctChange = (cur, prev) => prev > 0 ? ((cur - prev) / prev * 100).toFixed(1) : cur > 0 ? '+100' : '0.0';

  if (loading) {
    return (
      <div className="revenue-detail-page">
        <div className="loading-message">
          <div className="loading-spinner"></div>
          <span>Gegevens laden...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="revenue-detail-page">
      <div className="revenue-header">
        <button className="back-btn" onClick={() => navigate('/analytics')}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Terug
        </button>
        <div className="revenue-title-block">
          <h1>Financieel Overzicht</h1>
          <p className="revenue-subtitle">Dagelijkse omzet, kosten en winst met periode vergelijking</p>
        </div>
      </div>

      <div className="revenue-controls">
        <div className="period-buttons">
          {[
            { key: '7days', label: '7 dagen' },
            { key: 'week', label: 'Per week' },
            { key: '30days', label: '30 dagen' },
            { key: 'quarter', label: 'Kwartaal' },
            { key: 'year', label: 'Jaar' }
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`period-btn ${periodFilter === key ? 'active' : ''}`}
              onClick={() => { setPeriodFilter(key); setPeriodOffset(0); }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className={`compare-btn ${compareEnabled ? 'active' : ''}`}
          onClick={() => setCompareEnabled(!compareEnabled)}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M4 15L8 9L12 12L16 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4 5L8 11L12 8L16 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
          </svg>
          Vergelijk
        </button>
      </div>

      <div className="period-nav-bar">
        <button className="nav-arrow-btn" onClick={() => setPeriodOffset(prev => prev - 1)}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="period-nav-label">{getPeriodLabel(periodFilter, periodOffset)}</span>
        <button className="nav-arrow-btn" onClick={() => setPeriodOffset(prev => prev + 1)} disabled={periodOffset >= 0}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M8 4L14 10L8 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="metric-toggles">
        {Object.entries(METRIC_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            className={`metric-toggle ${activeMetrics[key] ? 'active' : ''}`}
            style={{
              '--metric-color': cfg.color,
              '--metric-bg': cfg.bg,
            }}
            onClick={() => toggleMetric(key)}
          >
            <span className="metric-toggle-dot" style={{ background: cfg.color }}></span>
            <span className="metric-toggle-label">{cfg.label}</span>
            <span className="metric-toggle-value">{fmt(summaryStats.cur[key])}</span>
            {compareEnabled && (
              <span className={`metric-toggle-change ${summaryStats.cur[key] >= summaryStats.prev[key] ? 'positive' : 'negative'}`}>
                {summaryStats.cur[key] >= summaryStats.prev[key] ? '+' : ''}{pctChange(summaryStats.cur[key], summaryStats.prev[key])}%
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="revenue-chart-container">
        <div className="chart-header">
          <div className="chart-legend-custom">
            {Object.entries(activeMetrics).map(([key, enabled]) => enabled && (
              <React.Fragment key={key}>
                <span className="legend-dot" style={{ background: METRIC_CONFIG[key].color }}></span>
                <span className="legend-label">{METRIC_CONFIG[key].label}</span>
              </React.Fragment>
            ))}
            {compareEnabled && (
              <span className="legend-label" style={{ marginLeft: 16, fontStyle: 'italic', color: '#9ca3af' }}>
                (gestreept = vorige periode)
              </span>
            )}
          </div>
          <div className="chart-type-buttons">
            <button
              className={`chart-type-btn ${chartType === 'line' ? 'active' : ''}`}
              onClick={() => setChartType('line')}
              title="Lijn grafiek"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M3 15L7 9L11 12L17 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className={`chart-type-btn ${chartType === 'bar' ? 'active' : ''}`}
              onClick={() => setChartType('bar')}
              title="Staaf grafiek"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="10" width="3" height="7" rx="1" fill="currentColor"/>
                <rect x="8.5" y="6" width="3" height="11" rx="1" fill="currentColor"/>
                <rect x="14" y="3" width="3" height="14" rx="1" fill="currentColor"/>
              </svg>
            </button>
            <button
              className={`chart-type-btn ${chartType === 'area' ? 'active' : ''}`}
              onClick={() => setChartType('area')}
              title="Area grafiek"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M3 15L7 9L11 12L17 5V17H3V15Z" fill="currentColor" opacity="0.2"/>
                <path d="M3 15L7 9L11 12L17 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="chart-wrapper">
          {chartType === 'bar'
            ? <Bar data={chartData} options={chartOptions} />
            : <Line data={chartData} options={chartOptions} />
          }
        </div>
      </div>
    </div>
  );
}

export default RevenueDetail;
