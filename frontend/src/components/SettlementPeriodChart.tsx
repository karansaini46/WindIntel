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
      <div className="custom-chart-tooltip" role="tooltip">
        <div className="tt-time">
          Settlement Period {label} (30-min GB grid)
        </div>
        <div className="tt-row">
          <span className="tt-label">Forecast:</span>
          <span className="tt-val" style={{ color: 'var(--forecast-series)' }}>
            {item.forecast !== null ? `${item.forecast.toLocaleString()} MW` : 'Missing'}
          </span>
        </div>
        <div className="tt-row">
          <span className="tt-label">Actual Outturn:</span>
          <span className="tt-val" style={{ color: 'var(--actual-series)' }}>
            {item.actual !== null ? `${item.actual.toLocaleString()} MW` : 'Missing'}
          </span>
        </div>
        {item.error !== null && (
          <div
            className="tt-row"
            style={{
              marginTop: '0.35rem',
              borderTop: '1px solid var(--border)',
              paddingTop: '0.35rem',
            }}
          >
            <span className="tt-label">Delta (F - A):</span>
            <span
              className="tt-val"
              style={{
                color: item.error >= 0 ? 'var(--error-positive)' : 'var(--error-negative)',
              }}
            >
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

  const periodsCount = data.length;

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-title-group">
          <h2 className="chart-title">Settlement Period Diurnal Profile</h2>
          <p className="chart-subtitle">
            Variation across GB settlement periods ({periodsCount > 0 ? `SP 1–${periodsCount}` : 'SP 1–48'}) · {deliveryDate}
          </p>
        </div>

        <div className="chart-legend" aria-label="Settlement period chart legend">
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#6489A5' }} />
            <span>Forecast (MW)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#47745E' }} />
            <span>Actual (MW)</span>
          </div>
        </div>
      </div>

      <div style={{ height: '300px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 16, left: 6, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E3E8E3" vertical={false} />
            <XAxis
              dataKey="sp"
              stroke="#69746E"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#CFD7D0' }}
              interval={periodsCount > 24 ? 3 : 1}
              tickFormatter={(sp) => `SP${sp}`}
            />
            <YAxis
              width={64}
              stroke="#69746E"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#CFD7D0' }}
              tickFormatter={(val) => `${(val / 1000).toFixed(0)}k MW`}
            />
            <Tooltip content={renderSettlementTooltip} />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#6489A5"
              strokeWidth={2}
              dot={{ r: 2, fill: '#6489A5', strokeWidth: 0 }}
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
