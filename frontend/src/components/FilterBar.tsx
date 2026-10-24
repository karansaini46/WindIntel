import React from 'react';
import { RefreshCw, Download } from 'lucide-react';

interface FilterBarProps {
  decisionDate: string;
  onDecisionDateChange: (date: string) => void;
  decisionCutoff: string;
  onDecisionCutoffChange: (cutoff: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  isLoading: boolean;
}

const PRESETS = [
  { label: '05 Jan', date: '2026-01-05' },
  { label: '10 Jan', date: '2026-01-10' },
  { label: '15 Jan', date: '2026-01-15' },
  { label: '20 Jan', date: '2026-01-20' },
  { label: '28 Jan', date: '2026-01-28' },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  decisionDate,
  onDecisionDateChange,
  decisionCutoff,
  onDecisionCutoffChange,
  onRefresh,
  onExport,
  isLoading,
}) => {
  return (
    <section className="filter-bar" aria-label="Evaluation decision filters">
      <div className="filter-group">
        <div className="control-item">
          <label htmlFor="decision-date-input" className="control-label">
            Decision Date (Jan 2026)
          </label>
          <div className="control-input-row">
            <input
              id="decision-date-input"
              type="date"
              className="date-input"
              value={decisionDate}
              min="2026-01-01"
              max="2026-01-31"
              disabled={isLoading}
              onChange={(e) => onDecisionDateChange(e.target.value)}
            />
            <div className="preset-pills" role="group" aria-label="Quick date presets">
              {PRESETS.map((p) => {
                const isActive = decisionDate === p.date;
                return (
                  <button
                    key={p.date}
                    type="button"
                    className={`btn btn-preset ${isActive ? 'active' : ''}`}
                    disabled={isLoading}
                    onClick={() => onDecisionDateChange(p.date)}
                    aria-pressed={isActive}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="control-item">
          <label htmlFor="decision-cutoff-select" className="control-label">
            Day-Ahead Purchasing Cutoff
          </label>
          <select
            id="decision-cutoff-select"
            className="select-input"
            value={decisionCutoff}
            disabled={isLoading}
            onChange={(e) => onDecisionCutoffChange(e.target.value)}
          >
            <option value="11:00:00">11:00:00 GMT (EPEX Auction)</option>
            <option value="12:00:00">12:00:00 GMT (GB Half-Hour Auction)</option>
            <option value="14:00:00">14:00:00 GMT (Mid-Day Operational)</option>
            <option value="17:00:00">17:00:00 GMT (Late Shift Scheduling)</option>
          </select>
        </div>
      </div>

      <div className="filter-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={isLoading}
          title="Reload evaluation data from Elexon BMRS"
        >
          <RefreshCw size={13} className={isLoading ? 'spin' : ''} aria-hidden="true" />
          <span>{isLoading ? 'Fetching...' : 'Refresh'}</span>
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onExport}
          disabled={isLoading}
          title="Export evaluated delivery intervals as RFC 4180 CSV"
        >
          <Download size={13} aria-hidden="true" />
          <span>Export CSV</span>
        </button>
      </div>
    </section>
  );
};
