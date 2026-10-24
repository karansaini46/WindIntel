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
    <section className="kpi-grid" aria-label="Key performance indicators">
      {/* 1. MAE */}
      <div className="kpi-card" tabIndex={0} aria-label="Mean Absolute Error card">
        <div className="kpi-header">
          <span className="kpi-label">Mean Absolute Error</span>
          <span
            className="kpi-info-icon"
            title="MAE measures average magnitude of absolute forecast error across all valid matched intervals. Lower values indicate higher accuracy."
            aria-label="MAE information"
          >
            <HelpCircle size={14} aria-hidden="true" />
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
      <div className="kpi-card" tabIndex={0} aria-label="Root Mean Squared Error card">
        <div className="kpi-header">
          <span className="kpi-label">Root Mean Squared Error</span>
          <span
            className="kpi-info-icon"
            title="RMSE calculates the square root of mean squared errors, placing greater weight on large individual forecast deviations than MAE."
            aria-label="RMSE information"
          >
            <HelpCircle size={14} aria-hidden="true" />
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
      <div className="kpi-card" tabIndex={0} aria-label="Forecast Bias card">
        <div className="kpi-header">
          <span className="kpi-label">Forecast Bias (Mean Error)</span>
          <span
            className="kpi-info-icon"
            title="Bias = mean(Forecast - Actual). Positive values indicate systematic overestimation; negative values indicate systematic underestimation."
            aria-label="Bias information"
          >
            <HelpCircle size={14} aria-hidden="true" />
          </span>
        </div>
        <div className="kpi-value-row">
          <span
            className="kpi-value"
            style={{
              color: isOverforecast
                ? 'var(--error-positive)'
                : isUnderforecast
                ? 'var(--error-negative)'
                : 'var(--text-primary)',
            }}
          >
            {biasValue !== null ? `${biasValue > 0 ? '+' : ''}${biasValue.toLocaleString()}` : 'N/A'}
          </span>
          <span className="kpi-unit">MW</span>
        </div>
        {biasValue !== null ? (
          <div
            className={`kpi-badge ${
              isOverforecast ? 'badge-overforecast' : isUnderforecast ? 'badge-underforecast' : ''
            }`}
          >
            {isOverforecast ? 'Overforecasting (+)' : isUnderforecast ? 'Underforecasting (-)' : 'Zero Bias'}
          </div>
        ) : (
          <div className="kpi-subtext">Sign of systematic deviation</div>
        )}
      </div>

      {/* 4. MAPE */}
      <div className="kpi-card" tabIndex={0} aria-label="Mean Absolute Percentage Error card">
        <div className="kpi-header">
          <span className="kpi-label">Mean Absolute % Error</span>
          <span
            className="kpi-info-icon"
            title="MAPE measures percentage deviation relative to actual generation. Low-generation intervals (< 100 MW) are excluded to prevent division-by-near-zero distortion."
            aria-label="MAPE information"
          >
            <HelpCircle size={14} aria-hidden="true" />
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
      <div className="kpi-card" tabIndex={0} aria-label="Interval Coverage card">
        <div className="kpi-header">
          <span className="kpi-label">Interval Coverage</span>
          <span
            className="kpi-info-icon"
            title="Proportion of expected delivery intervals that have verified matched forecast and actual metered pairs."
            aria-label="Coverage information"
          >
            <HelpCircle size={14} aria-hidden="true" />
          </span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">{coverage.coverage_percent}%</span>
        </div>
        <div className="kpi-subtext">
          {coverage.matched_pairs} of {coverage.expected_intervals} periods matched
        </div>
      </div>
    </section>
  );
};
