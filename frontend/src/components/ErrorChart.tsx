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
      <div className="custom-chart-tooltip" role="tooltip">
        <div className="tt-time">
          {label} GMT · Settlement Period {data?.sp}
        </div>

        <div className="tt-row">
          <span className="tt-label">Forecast Error (F - A):</span>
          <span
            className="tt-val"
            style={{ color: isOver ? 'var(--error-positive)' : 'var(--error-negative)' }}
          >
            {isOver ? '+' : ''}
            {data.error.toLocaleString()} MW
          </span>
        </div>

        <div className="tt-row">
          <span className="tt-label">Direction:</span>
          <span
            className="tt-val"
            style={{ color: isOver ? 'var(--error-positive)' : 'var(--error-negative)' }}
          >
            {isOver ? 'Overforecast (Overestimation)' : 'Underforecast (Underestimation)'}
          </span>
        </div>

        <div
          className="tt-row"
          style={{
            marginTop: '0.35rem',
            paddingTop: '0.35rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          <span className="tt-label">Forecast / Outturn:</span>
          <span className="tt-val tabular">
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
        <div className="chart-title-group">
          <h2 className="chart-title">Forecast Residuals & Directional Bias</h2>
          <p className="chart-subtitle">
            Signed error (Forecast - Actual) for {deliveryDate} · Positive = Overestimate, Negative = Underestimate
          </p>
        </div>

        <div className="chart-legend" aria-label="Error chart legend">
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#B68A4C' }} />
            <span>Overforecast (+MW)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#B9655C' }} />
            <span>Underforecast (-MW)</span>
          </div>
        </div>
      </div>

      <div style={{ height: '300px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 12, right: 16, left: 6, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E3E8E3" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#69746E"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#CFD7D0' }}
              interval={2}
            />
            <YAxis
              width={64}
              stroke="#69746E"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#CFD7D0' }}
              tickFormatter={(val) => `${(val / 1000).toFixed(1)}k MW`}
            />
            <Tooltip content={renderErrorTooltip} />
            <ReferenceLine y={0} stroke="#89928C" strokeWidth={1.5} />
            <Bar dataKey="error" maxBarSize={18} radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => {
                const color =
                  entry.error !== null && entry.error >= 0 ? '#B68A4C' : '#B9655C';
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
