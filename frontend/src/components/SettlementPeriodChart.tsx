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
import { SettlementPeriodSummary } from '../api/types';

interface SettlementPeriodChartProps {
  data: SettlementPeriodSummary[];
  deliveryDate: string;
}

const renderSettlementTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0]?.payload;
    return (
      <div className="custom-chart-tooltip">
        <div className="tt-time">
          Settlement Period {label} (30-min GB grid)
        </div>
        <div className="tt-row">
          <span className="tt-label">Forecast:</span>
          <span className="tt-val" style={{ color: 'var(--color-forecast)' }}>
            {item.forecast !== null ? `${item.forecast.toLocaleString()} MW` : 'Missing'}
          </span>
        </div>
        <div className="tt-row">
          <span className="tt-label">Actual:</span>
          <span className="tt-val" style={{ color: 'var(--color-actual)' }}>
            {item.actual !== null ? `${item.actual.toLocaleString()} MW` : 'Missing'}
          </span>
        </div>
        {item.error !== null && (
          <div className="tt-row" style={{ marginTop: '0.35rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.25rem' }}>
            <span className="tt-label">Delta:</span>
            <span className="tt-val" style={{ color: item.error >= 0 ? 'var(--color-error-pos)' : 'var(--color-error-neg)' }}>
              {item.error > 0 ? '+' : ''}{item.error.toLocaleString()} MW
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const SettlementPeriodChart: React.FC<SettlementPeriodChartProps> = ({
  data,
  deliveryDate,
}) => {
  const chartData = data.map((d) => ({
    sp: d.settlement_period,
    forecast: d.forecast_mw,
    actual: d.actual_mw,
    error: d.error_mw,
  }));

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Settlement Period Diurnal Profile</h2>
          <p className="chart-subtitle">
            Accuracy variation across Great Britain 30-minute settlement periods (SP 1–48) · {deliveryDate}
          </p>
        </div>

        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--color-forecast)' }} />
            <span>Forecast (MW)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--color-actual)' }} />
            <span>Actual (MW)</span>
          </div>
        </div>
      </div>

      <div style={{ height: '320px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a303c" vertical={false} />
            <XAxis
              dataKey="sp"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              interval={3}
              tickFormatter={(sp) => `SP${sp}`}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
            />
            <Tooltip content={renderSettlementTooltip} />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="var(--color-forecast)"
              strokeWidth={2}
              dot={{ r: 2, fill: 'var(--color-forecast)' }}
              activeDot={{ r: 5 }}
              name="Forecast"
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="var(--color-actual)"
              strokeWidth={2}
              dot={{ r: 2, fill: 'var(--color-actual)' }}
              activeDot={{ r: 5 }}
              name="Actual"
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
