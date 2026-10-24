import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import { IntervalEvaluationRecord } from '../api/types';

interface ErrorChartProps {
  intervals: IntervalEvaluationRecord[];
  deliveryDate: string;
}

const renderErrorTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    const isOver = data.error >= 0;
    return (
      <div className="custom-chart-tooltip">
        <div className="tt-time">
          {label} GMT (SP {data?.sp})
        </div>

        <div className="tt-row">
          <span className="tt-label">Forecast Error:</span>
          <span
            className="tt-val"
            style={{ color: isOver ? 'var(--color-error-pos)' : 'var(--color-error-neg)' }}
          >
            {isOver ? '+' : ''}
            {data.error.toLocaleString()} MW
          </span>
        </div>

        <div className="tt-row">
          <span className="tt-label">Classification:</span>
          <span className="tt-val" style={{ color: isOver ? 'var(--color-error-pos)' : 'var(--color-error-neg)' }}>
            {isOver ? 'Overforecasting (Shortfall Risk)' : 'Underforecasting (Surplus)'}
          </span>
        </div>

        <div className="tt-row" style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid var(--border-subtle)' }}>
          <span className="tt-label">Forecast / Actual:</span>
          <span className="tt-val mono">
            {data.forecast?.toLocaleString()} / {data.actual?.toLocaleString()} MW
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const ErrorChart: React.FC<ErrorChartProps> = ({ intervals, deliveryDate }) => {
  const chartData = intervals
    .filter((inv) => inv.error_mw !== null && inv.actual_mw !== null)
    .map((inv) => {
      const timeLabel = inv.start_time.substring(11, 16);
      return {
        time: timeLabel,
        fullTime: inv.start_time,
        sp: inv.settlement_period,
        error: inv.error_mw,
        absError: inv.abs_error_mw,
        actual: inv.actual_mw,
        forecast: inv.forecast_mw,
      };
    });

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Forecast Residuals & Directional Bias</h2>
          <p className="chart-subtitle">
            Signed error (Forecast - Actual) for {deliveryDate} · Positive = Overforecast, Negative = Underforecast
          </p>
        </div>

        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--color-error-pos)' }} />
            <span>Overforecast (Surplus Risk)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--color-error-neg)' }} />
            <span>Underforecast (Deficit Risk)</span>
          </div>
        </div>
      </div>

      <div style={{ height: '280px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a303c" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              interval={3}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              tickFormatter={(val) => `${(val / 1000).toFixed(1)}k`}
            />
            <Tooltip content={renderErrorTooltip} />
            <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
            <Bar dataKey="error" maxBarSize={20} radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => {
                const color =
                  entry.error !== null && entry.error >= 0
                    ? 'var(--color-error-pos)'
                    : 'var(--color-error-neg)';
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
