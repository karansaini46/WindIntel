import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { IntervalEvaluationRecord } from '../api/types';

interface ForecastChartProps {
  intervals: IntervalEvaluationRecord[];
  deliveryDate: string;
}

const renderForecastTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    const hasForecast = data?.forecast !== null && data?.forecast !== undefined;
    const hasActual = data?.actual !== null && data?.actual !== undefined;
    const err = hasForecast && hasActual ? data.forecast - data.actual : null;

    return (
      <div className="custom-chart-tooltip" role="tooltip">
        <div className="tt-time">
          {label} GMT · Settlement Period {data?.sp}
        </div>

        <div className="tt-row">
          <span className="tt-label">Selected Forecast:</span>
          <span className="tt-val" style={{ color: 'var(--forecast-series)' }}>
            {hasForecast ? `${data.forecast.toLocaleString()} MW` : 'Missing / Not Published'}
          </span>
        </div>

        <div className="tt-row">
          <span className="tt-label">Actual Generation:</span>
          <span className="tt-val" style={{ color: 'var(--actual-series)' }}>
            {hasActual ? `${data.actual.toLocaleString()} MW` : 'Pending / Missing'}
          </span>
        </div>

        {err !== null && (
          <div
            className="tt-row"
            style={{
              marginTop: '0.35rem',
              paddingTop: '0.35rem',
              borderTop: '1px solid var(--border)',
            }}
          >
            <span className="tt-label">Error (F - A):</span>
            <span
              className="tt-val"
              style={{
                color: err >= 0 ? 'var(--error-positive)' : 'var(--error-negative)',
              }}
            >
              {err > 0 ? '+' : ''}
              {Math.round(err).toLocaleString()} MW
            </span>
          </div>
        )}

        {data?.leadTime !== null && data?.leadTime !== undefined && (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Lead time at cutoff: {data.leadTime}h
          </div>
        )}

        {data?.publishTime && (
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            Published: {data.publishTime.replace('T', ' ').substring(0, 16)} GMT
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const ForecastChart: React.FC<ForecastChartProps> = ({
  intervals,
  deliveryDate,
}) => {
  const chartData = intervals.map((inv) => {
    const timeLabel = inv.start_time.substring(11, 16);
    return {
      time: timeLabel,
      fullTime: inv.start_time,
      sp: inv.settlement_period,
      forecast: inv.forecast_mw,
      actual: inv.actual_mw,
      publishTime: inv.publish_time,
      leadTime: inv.lead_time_hours,
      status: inv.status,
    };
  });

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-title-group">
          <h2 className="chart-title">Day-Ahead Generation vs Outturn Profile</h2>
          <p className="chart-subtitle">
            Evaluated for delivery on {deliveryDate} (Europe/London Market Clock) · Hourly WINDFOR vs 30-min FUELHH
          </p>
        </div>

        <div className="chart-legend" aria-label="Forecast chart legend">
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--forecast-series)' }} />
            <span>Eligible Forecast (WINDFOR)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--actual-series)' }} />
            <span>Metered Outturn (FUELHH)</span>
          </div>
        </div>
      </div>

      <div style={{ height: '360px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 16, left: 6, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E3E8E3" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#69746E"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#CFD7D0' }}
              interval={3}
            />
            <YAxis
              width={64}
              stroke="#69746E"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#CFD7D0' }}
              tickFormatter={(val) => `${(val / 1000).toFixed(0)}k MW`}
            />
            <Tooltip content={renderForecastTooltip} />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#6489A5"
              strokeWidth={2.2}
              dot={{ r: 2.5, fill: '#6489A5', strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: '#FFFFFF', strokeWidth: 2 }}
              name="Forecast"
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#47745E"
              strokeWidth={2}
              dot={{ r: 2, fill: '#47745E', strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: '#FFFFFF', strokeWidth: 2 }}
              name="Actual"
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
