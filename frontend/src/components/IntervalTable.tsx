import React, { useState } from 'react';
import { ArrowUpDown, History, Search } from 'lucide-react';
import { IntervalEvaluationRecord } from '../api/types';

interface IntervalTableProps {
  intervals: IntervalEvaluationRecord[];
  onInspectInterval: (startTime: string) => void;
}

type SortField =
  | 'start_time'
  | 'settlement_period'
  | 'actual_mw'
  | 'forecast_mw'
  | 'error_mw'
  | 'abs_error_mw'
  | 'lead_time_hours';

type SortOrder = 'asc' | 'desc';

export const IntervalTable: React.FC<IntervalTableProps> = ({
  intervals,
  onInspectInterval,
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('settlement_period');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filtered = intervals.filter((row) => {
    const spText = `sp ${row.settlement_period}`;
    const spRaw = `sp${row.settlement_period}`;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      row.start_time.toLowerCase().includes(q) ||
      spText.includes(q) ||
      spRaw.includes(q);
    const matchesStatus = filterStatus === 'ALL' || row.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];

    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortOrder === 'asc'
      ? (valA as number) - (valB as number)
      : (valB as number) - (valA as number);
  });

  return (
    <div className="table-card">
      <div className="table-header">
        <div>
          <h2 className="chart-title">Delivery Interval Audit Table</h2>
          <p className="chart-subtitle">
            Inspect individual half-hourly settlement intervals, lead times, and publication revisions
          </p>
        </div>

        <div className="table-controls">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: '8px',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search time / SP..."
              className="table-search-input"
              style={{ paddingLeft: '1.75rem' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Filter interval records"
            />
          </div>

          <select
            className="select-input"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.65rem' }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by interval status"
          >
            <option value="ALL">All Statuses ({intervals.length})</option>
            <option value="MATCHED">Matched Only</option>
            <option value="MISSING_FORECAST">Missing Forecast</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table" aria-label="Settlement interval records">
          <thead>
            <tr>
              <th
                scope="col"
                className="sortable"
                onClick={() => handleSort('settlement_period')}
                title="Sort by Settlement Period"
              >
                SP <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: '2px' }} aria-hidden="true" />
              </th>
              <th
                scope="col"
                className="sortable"
                onClick={() => handleSort('start_time')}
                title="Sort by Delivery Time"
              >
                Delivery Time (GMT) <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: '2px' }} aria-hidden="true" />
              </th>
              <th
                scope="col"
                className="sortable"
                onClick={() => handleSort('actual_mw')}
                title="Sort by Metered Actual"
              >
                Actual (MW) <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: '2px' }} aria-hidden="true" />
              </th>
              <th
                scope="col"
                className="sortable"
                onClick={() => handleSort('forecast_mw')}
                title="Sort by Selected Forecast"
              >
                Selected Forecast (MW) <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: '2px' }} aria-hidden="true" />
              </th>
              <th
                scope="col"
                className="sortable"
                onClick={() => handleSort('error_mw')}
                title="Sort by Error"
              >
                Error (MW) <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: '2px' }} aria-hidden="true" />
              </th>
              <th
                scope="col"
                className="sortable"
                onClick={() => handleSort('abs_error_mw')}
                title="Sort by Absolute Error"
              >
                Abs Error (MW) <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: '2px' }} aria-hidden="true" />
              </th>
              <th scope="col">Publish Time</th>
              <th
                scope="col"
                className="sortable"
                onClick={() => handleSort('lead_time_hours')}
                title="Sort by Lead Time"
              >
                Lead Time <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: '2px' }} aria-hidden="true" />
              </th>
              <th scope="col">Status</th>
              <th scope="col" style={{ textAlign: 'center' }}>Evolution</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={10} className="table-empty-state">
                  No intervals match the current filter criteria.
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const isMatched = row.status === 'MATCHED';
                const err = row.error_mw;
                return (
                  <tr key={row.start_time}>
                    <td style={{ fontWeight: 600 }}>SP {row.settlement_period}</td>
                    <td className="tabular">
                      {row.start_time.substring(11, 16)} - {row.end_time.substring(11, 16)}
                    </td>
                    <td style={{ color: 'var(--actual-series)', fontWeight: 600 }}>
                      {row.actual_mw !== null ? `${row.actual_mw.toLocaleString()} MW` : '—'}
                    </td>
                    <td style={{ color: 'var(--forecast-series)', fontWeight: 600 }}>
                      {row.forecast_mw !== null ? `${row.forecast_mw.toLocaleString()} MW` : '—'}
                    </td>
                    <td
                      style={{
                        color:
                          err !== null
                            ? err >= 0
                              ? 'var(--error-positive)'
                              : 'var(--error-negative)'
                            : 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      {err !== null ? `${err > 0 ? '+' : ''}${err.toLocaleString()} MW` : '—'}
                    </td>
                    <td>
                      {row.abs_error_mw !== null ? `${row.abs_error_mw.toLocaleString()} MW` : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }} className="tabular">
                      {row.publish_time ? row.publish_time.replace('T', ' ').substring(5, 16) : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }} className="tabular">
                      {row.lead_time_hours !== null ? `${row.lead_time_hours}h` : '—'}
                    </td>
                    <td>
                      <span
                        className={`status-tag ${
                          isMatched ? 'status-matched' : 'status-missing'
                        }`}
                      >
                        {isMatched ? 'MATCHED' : 'MISSING FORECAST'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn-inspect"
                        onClick={() => onInspectInterval(row.start_time)}
                        title={`Inspect publication version history for ${row.start_time.substring(11, 16)} GMT`}
                      >
                        <History size={11} aria-hidden="true" />
                        <span>History</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
