import React from 'react';
import { HelpCircle } from 'lucide-react';
import { EvaluationMetrics, CoverageStatistics } from '../api/types';

interface SummaryCardsProps {
  metrics: EvaluationMetrics;
  coverage: CoverageStatistics;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ metrics, coverage }) => {
  const biasValue = metrics.bias;
  const isOverforecast = biasValue !== null && biasValue > 0;
  const isUnderforecast = biasValue !== null && biasValue < 0;

  return (
    <div className="kpi-grid">
      {/* 1. MAE */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Mean Absolute Error</span>
          <span
            className="kpi-info-icon"
            title="MAE represents the average magnitude of forecast error across all valid matched delivery intervals. Lower values indicate higher accuracy."
          >
            <HelpCircle size={14} />
          </span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">
            {metrics.mae !== null ? metrics.mae.toLocaleString() : 'N/A'}
          </span>
          <span className="kpi-unit">MW</span>
        </div>
        <div className="kpi-subtext">Average absolute error magnitude</div>
      </div>

      {/* 2. RMSE */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Root Mean Squared Error</span>
          <span
            className="kpi-info-icon"
            title="RMSE measures the square root of mean squared errors. It penalizes large individual forecast misses significantly more heavily than MAE."
          >
            <HelpCircle size={14} />
          </span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">
            {metrics.rmse !== null ? metrics.rmse.toLocaleString() : 'N/A'}
          </span>
          <span className="kpi-unit">MW</span>
        </div>
        <div className="kpi-subtext">Quadratic penalty for extreme outliers</div>
      </div>

      {/* 3. Bias */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Forecast Bias (Mean Error)</span>
          <span
            className="kpi-info-icon"
            title="Bias = mean(Forecast - Actual). Positive means forecasts systematically overestimate generation (risking shortfall in procurement); negative means systematic underestimation."
          >
            <HelpCircle size={14} />
          </span>
        </div>
        <div className="kpi-value-row">
          <span
            className="kpi-value"
            style={{
              color: isOverforecast ? 'var(--color-error-pos)' : isUnderforecast ? 'var(--color-error-neg)' : '#fff',
            }}
          >
            {biasValue !== null ? `${biasValue > 0 ? '+' : ''}${biasValue.toLocaleString()}` : 'N/A'}
          </span>
          <span className="kpi-unit">MW</span>
        </div>
        {biasValue !== null && (
          <div
            className={`kpi-badge ${
              isOverforecast ? 'badge-overforecast' : isUnderforecast ? 'badge-underforecast' : ''
            }`}
          >
            {isOverforecast ? 'Overforecasting (+)' : isUnderforecast ? 'Underforecasting (-)' : 'Zero Bias'}
          </div>
        )}
      </div>

      {/* 4. MAPE */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Mean Absolute % Error</span>
          <span
            className="kpi-info-icon"
            title="MAPE measures percentage deviation relative to actual generation. Observations with actuals < 100 MW are excluded to avoid mathematical distortion during calm wind periods."
          >
            <HelpCircle size={14} />
          </span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">
            {metrics.mape !== null ? `${metrics.mape.toFixed(1)}%` : 'N/A'}
          </span>
        </div>
        <div className="kpi-subtext">
          {metrics.mape_excluded_count > 0
            ? `${metrics.mape_excluded_count} low-wind interval(s) excluded`
            : 'All matched intervals included'}
        </div>
      </div>

      {/* 5. Forecast Coverage */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Interval Coverage</span>
          <span
            className="kpi-info-icon"
            title="Percentage of expected delivery intervals that have a verified matched forecast-actual pair. WINDFOR provides hourly projections (24 intervals) on a 48-period settlement day."
          >
            <HelpCircle size={14} />
          </span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">{coverage.coverage_percent}%</span>
        </div>
        <div className="kpi-subtext">
          {coverage.matched_pairs} of {coverage.expected_intervals} periods matched
        </div>
      </div>
    </div>
  );
};
