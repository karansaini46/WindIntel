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
    return (
      <div className="custom-chart-tooltip">
        <div className="tt-time">
          {label} GMT (SP {data?.sp})
        </div>

        <div className="tt-row">
          <span className="tt-label">Selected Forecast:</span>
          <span className="tt-val" style={{ color: 'var(--color-forecast)' }}>
            {data?.forecast !== null && data?.forecast !== undefined
              ? `${data.forecast.toLocaleString()} MW`
              : 'Missing / Not Published'}
          </span>
        </div>

        <div className="tt-row">
          <span className="tt-label">Actual Outturn:</span>
          <span className="tt-val" style={{ color: 'var(--color-actual)' }}>
            {data?.actual !== null && data?.actual !== undefined
              ? `${data.actual.toLocaleString()} MW`
              : 'Pending / Missing'}
          </span>
        </div>

        {data?.forecast !== null && data?.actual !== null && (
          <div className="tt-row" style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid var(--border-subtle)' }}>
            <span className="tt-label">Error (F - A):</span>
            <span
              className="tt-val"
              style={{
                color:
                  data.forecast - data.actual >= 0
                    ? 'var(--color-error-pos)'
                    : 'var(--color-error-neg)',
              }}
            >
              {data.forecast - data.actual > 0 ? '+' : ''}
              {Math.round(data.forecast - data.actual).toLocaleString()} MW
            </span>
          </div>
        )}

        {data?.leadTime !== null && data?.leadTime !== undefined && (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Lead time at cutoff: {data.leadTime} hrs
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
        <div>
          <h2 className="chart-title">Day-Ahead Generation vs Outturn Profile</h2>
          <p className="chart-subtitle">
            Evaluated for delivery on {deliveryDate} (Europe/London Market Clock)
          </p>
        </div>

        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--color-forecast)' }} />
            <span>Eligible Forecast (WINDFOR)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--color-actual)' }} />
            <span>Metered Outturn (FUELHH)</span>
          </div>
        </div>
      </div>

      <div style={{ height: '340px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a303c" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              interval={5}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
            />
            <Tooltip content={renderForecastTooltip} />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="var(--color-forecast)"
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: 'var(--color-forecast)' }}
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
