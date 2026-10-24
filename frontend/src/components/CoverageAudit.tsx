import React from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import { CoverageStatistics } from '../api/types';

interface CoverageAuditProps {
  coverage: CoverageStatistics;
  warnings: string[];
}

export const CoverageAudit: React.FC<CoverageAuditProps> = ({ coverage, warnings }) => {
  return (
    <div>
      {warnings.length > 0 && (
        <div className="warning-alert">
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Operational Data Notice:</strong>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="coverage-audit-bar">
        <div className="coverage-metrics">
          <div className="coverage-stat">
            <span className="coverage-stat-label">Expected Intervals:</span>
            <span className="coverage-stat-val">{coverage.expected_intervals}</span>
          </div>

          <div className="coverage-stat">
            <span className="coverage-stat-label">Forecasts Available:</span>
            <span className="coverage-stat-val" style={{ color: 'var(--color-forecast)' }}>
              {coverage.forecast_intervals_available}
            </span>
          </div>

          <div className="coverage-stat">
            <span className="coverage-stat-label">Actuals Metered:</span>
            <span className="coverage-stat-val" style={{ color: 'var(--color-actual)' }}>
              {coverage.actual_intervals_available}
            </span>
          </div>

          <div className="coverage-stat">
            <span className="coverage-stat-label">Matched Pairs:</span>
            <span className="coverage-stat-val" style={{ color: '#fff' }}>
              {coverage.matched_pairs}
            </span>
          </div>

          <div className="coverage-stat">
            <span className="coverage-stat-label">Missing Forecasts:</span>
            <span className="coverage-stat-val" style={{ color: 'var(--color-warning)' }}>
              {coverage.missing_forecast_count}
            </span>
          </div>
        </div>

        <div className="coverage-note">
          <Info size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
          {coverage.notes}
        </div>
      </div>
    </div>
  );
};
