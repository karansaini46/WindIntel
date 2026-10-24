import React from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import { CoverageStatistics } from '../api/types';

interface CoverageAuditProps {
  coverage: CoverageStatistics;
  warnings: string[];
}

export const CoverageAudit: React.FC<CoverageAuditProps> = ({ coverage, warnings }) => {
  const matchedPercent = Math.min(100, Math.max(0, coverage.coverage_percent));
  const missingPercent = Math.max(0, 100 - matchedPercent);

  return (
    <section aria-label="Data quality and coverage audit" style={{ marginBottom: '1.5rem' }}>
      {warnings.length > 0 && (
        <div className="warning-alert" role="alert">
          <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Operational Data Notice:</strong>
            <ul>
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="coverage-audit-card">
        <div className="coverage-metrics-row">
          <div className="coverage-metrics">
            <div className="coverage-stat">
              <span className="coverage-stat-label">Expected Intervals:</span>
              <span className="coverage-stat-val">{coverage.expected_intervals}</span>
            </div>

            <div className="coverage-stat">
              <span className="coverage-stat-label">Forecasts Available:</span>
              <span className="coverage-stat-val" style={{ color: 'var(--forecast-series)' }}>
                {coverage.forecast_intervals_available}
              </span>
            </div>

            <div className="coverage-stat">
              <span className="coverage-stat-label">Actuals Metered:</span>
              <span className="coverage-stat-val" style={{ color: 'var(--actual-series)' }}>
                {coverage.actual_intervals_available}
              </span>
            </div>

            <div className="coverage-stat">
              <span className="coverage-stat-label">Matched Pairs:</span>
              <span className="coverage-stat-val" style={{ color: 'var(--text-primary)' }}>
                {coverage.matched_pairs}
              </span>
            </div>

            <div className="coverage-stat">
              <span className="coverage-stat-label">Missing Forecasts:</span>
              <span
                className="coverage-stat-val"
                style={{
                  color: coverage.missing_forecast_count > 0 ? 'var(--warning)' : 'var(--text-secondary)',
                }}
              >
                {coverage.missing_forecast_count}
              </span>
            </div>
          </div>

          <div className="coverage-note">
            <Info size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: 'var(--text-muted)' }} aria-hidden="true" />
            <span>{coverage.notes}</span>
          </div>
        </div>

        {/* Clean, editorial horizontal coverage visualization */}
        <div
          className="coverage-bar-track"
          role="progressbar"
          aria-valuenow={matchedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Data coverage: ${matchedPercent}% matched`}
          title={`Coverage breakdown: ${coverage.matched_pairs} matched, ${coverage.missing_forecast_count} missing forecasts`}
        >
          <div
            className="coverage-bar-segment-matched"
            style={{ width: `${matchedPercent}%` }}
          />
          <div
            className="coverage-bar-segment-missing"
            style={{ width: `${missingPercent}%` }}
          />
        </div>

        <div className="coverage-bar-legend">
          <div className="coverage-legend-item">
            <div className="coverage-legend-swatch" style={{ background: 'var(--accent)' }} />
            <span>Matched intervals ({matchedPercent.toFixed(0)}%)</span>
          </div>
          {missingPercent > 0 && (
            <div className="coverage-legend-item">
              <div className="coverage-legend-swatch" style={{ background: '#E5A855' }} />
              <span>Missing forecasts ({missingPercent.toFixed(0)}%)</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
