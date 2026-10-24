import React from 'react';
import { Database, Clock, Server } from 'lucide-react';
import { SystemMetadataResponse } from '../api/types';

interface HeaderProps {
  metadata: SystemMetadataResponse | null;
  decisionDate: string;
  decisionCutoff: string;
  isHealthy: boolean;
  isCached: boolean;
  lastRetrievedAt?: string;
}

export const Header: React.FC<HeaderProps> = ({
  metadata,
  decisionDate,
  decisionCutoff,
  isHealthy,
  isCached,
  lastRetrievedAt,
}) => {
  const dataSource = metadata?.data_source || 'Elexon BMRS';

  return (
    <header className="app-header" role="banner">
      <div className="brand-section">
        <div className="brand-logo-mark" aria-hidden="true">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Minimal wind / energy curve mark */}
            <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
          </svg>
        </div>
        <div className="brand-text">
          <span className="brand-title">WindIntel</span>
          <span className="brand-subtitle">Wind generation forecast evaluation</span>
        </div>
      </div>

      <div className="header-meta-group">
        {/* Backend health & operational status */}
        <div
          className={`status-pill ${isHealthy ? 'healthy' : 'unhealthy'}`}
          title={isHealthy ? 'Backend API connected and responding normally' : 'Backend API connection failed'}
        >
          <span className="status-dot" aria-hidden="true" />
          <span className="status-text">{isHealthy ? 'System Operational' : 'API Unavailable'}</span>
          {lastRetrievedAt && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
              · {isCached ? 'Cached snapshot' : 'Fresh ingest'}
            </span>
          )}
        </div>

        {/* Data Source */}
        <div className="header-meta-item" title="Primary market data provider">
          <Database size={13} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          <span>Data: <strong>{dataSource}</strong></span>
        </div>

        {/* Active Cutoff Reference */}
        <div className="header-meta-item" title="Cutoff time applied for forecast eligibility">
          <Clock size={13} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          <span>Cutoff: <strong>{decisionDate} {decisionCutoff} GMT</strong></span>
        </div>

        {/* Retrieval Timestamp */}
        {lastRetrievedAt && (
          <div className="header-meta-item" title="Local time of last evaluation response">
            <Server size={13} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
            <span>Retrieved: <strong>{new Date(lastRetrievedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong></span>
          </div>
        )}
      </div>
    </header>
  );
};
