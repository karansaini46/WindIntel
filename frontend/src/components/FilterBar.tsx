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
    <div className="filter-bar">
      <div className="filter-group">
        <div className="control-item">
          <label className="control-label">Decision Date (Jan 2026)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="date"
              className="date-input mono"
              value={decisionDate}
              min="2026-01-01"
              max="2026-01-31"
              onChange={(e) => onDecisionDateChange(e.target.value)}
            />
            {PRESETS.map((p) => (
              <button
                key={p.date}
                className={`btn btn-secondary ${decisionDate === p.date ? 'btn-primary' : ''}`}
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => onDecisionDateChange(p.date)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="control-item">
          <label className="control-label">Day-Ahead Purchasing Cutoff</label>
          <select
            className="select-input mono"
            value={decisionCutoff}
            onChange={(e) => onDecisionCutoffChange(e.target.value)}
          >
            <option value="11:00:00">11:00:00 GMT (EPEX Auction)</option>
            <option value="12:00:00">12:00:00 GMT (GB Half-Hour Auction)</option>
            <option value="14:00:00">14:00:00 GMT (Mid-Day Operational)</option>
            <option value="17:00:00">17:00:00 GMT (Late Shift Scheduling)</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={isLoading}
          title="Reload evaluation data from Elexon"
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          <span>{isLoading ? 'Fetching...' : 'Refresh'}</span>
        </button>

        <button
          className="btn btn-primary"
          onClick={onExport}
          title="Export evaluated delivery intervals as RFC 4180 CSV"
        >
          <Download size={14} />
          <span>Export CSV</span>
        </button>
      </div>
    </div>
  );
};
