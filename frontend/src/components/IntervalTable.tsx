import React, { useState } from 'react';
import { ArrowUpDown, History } from 'lucide-react';
import { IntervalEvaluationRecord } from '../api/types';

interface IntervalTableProps {
  intervals: IntervalEvaluationRecord[];
  onInspectInterval: (startTime: string) => void;
}

type SortField = 'start_time' | 'settlement_period' | 'actual_mw' | 'forecast_mw' | 'error_mw' | 'abs_error_mw' | 'lead_time_hours';
type SortOrder = 'asc' | 'desc';

export const IntervalTable: React.FC<IntervalTableProps> = ({ intervals, onInspectInterval }) => {
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
    let valA = a[sortField];
    let valB = b[sortField];

    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
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
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search time / SP..."
              className="table-search-input mono"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="select-input mono"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="ALL">All Statuses ({intervals.length})</option>
            <option value="MATCHED">Matched Only</option>
            <option value="MISSING_FORECAST">Missing Forecast</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('settlement_period')}>
                SP <ArrowUpDown size={11} style={{ display: 'inline' }} />
              </th>
              <th className="sortable" onClick={() => handleSort('start_time')}>
                Delivery Time (GMT) <ArrowUpDown size={11} style={{ display: 'inline' }} />
              </th>
              <th className="sortable" onClick={() => handleSort('actual_mw')}>
                Actual (MW) <ArrowUpDown size={11} style={{ display: 'inline' }} />
              </th>
              <th className="sortable" onClick={() => handleSort('forecast_mw')}>
                Selected Forecast (MW) <ArrowUpDown size={11} style={{ display: 'inline' }} />
              </th>
              <th className="sortable" onClick={() => handleSort('error_mw')}>
                Error (MW) <ArrowUpDown size={11} style={{ display: 'inline' }} />
              </th>
              <th className="sortable" onClick={() => handleSort('abs_error_mw')}>
                Abs Error (MW) <ArrowUpDown size={11} style={{ display: 'inline' }} />
              </th>
              <th>Publish Time</th>
              <th className="sortable" onClick={() => handleSort('lead_time_hours')}>
                Lead Time <ArrowUpDown size={11} style={{ display: 'inline' }} />
              </th>
              <th>Status</th>
              <th>Evolution</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const isMatched = row.status === 'MATCHED';
              const err = row.error_mw;
              return (
                <tr key={row.start_time}>
                  <td style={{ fontWeight: 600 }}>SP {row.settlement_period}</td>
                  <td>{row.start_time.substring(11, 16)} - {row.end_time.substring(11, 16)}</td>
                  <td style={{ color: 'var(--color-actual)', fontWeight: 600 }}>
                    {row.actual_mw !== null ? `${row.actual_mw.toLocaleString()} MW` : '—'}
                  </td>
                  <td style={{ color: 'var(--color-forecast)', fontWeight: 600 }}>
                    {row.forecast_mw !== null ? `${row.forecast_mw.toLocaleString()} MW` : '—'}
                  </td>
                  <td
                    style={{
                      color:
                        err !== null
                          ? err >= 0
                            ? 'var(--color-error-pos)'
                            : 'var(--color-error-neg)'
                          : 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    {err !== null ? `${err > 0 ? '+' : ''}${err.toLocaleString()} MW` : '—'}
                  </td>
                  <td>{row.abs_error_mw !== null ? `${row.abs_error_mw.toLocaleString()} MW` : '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {row.publish_time ? row.publish_time.replace('T', ' ').substring(5, 16) : '—'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
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
                  <td>
                    <button
                      className="btn-inspect"
                      onClick={() => onInspectInterval(row.start_time)}
                      title="Inspect publication versions from Elexon evolution endpoint"
                    >
                      <History size={11} style={{ display: 'inline', marginRight: '3px' }} />
                      History
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
