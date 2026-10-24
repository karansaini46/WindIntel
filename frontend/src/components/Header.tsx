import React from 'react';
import { Wind, Activity, Clock, Database } from 'lucide-react';
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
  decisionDate,
  decisionCutoff,
  isHealthy,
  isCached,
  lastRetrievedAt,
}) => {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo">
          <Wind size={22} strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="brand-title">WindIntel</h1>
          <p className="brand-subtitle">
            UK Day-Ahead Wind Forecast Intelligence & Outturn Analytics
          </p>
        </div>
      </div>

      <div className="header-badges">
        <div className={`meta-badge ${isHealthy ? 'healthy' : ''}`}>
          <div className="dot" />
          <span>{isHealthy ? 'System Operational' : 'API Connecting'}</span>
        </div>

        <div className="meta-badge">
          <Clock size={13} />
          <span>Decision: <strong style={{ color: '#fff' }}>{decisionDate} ({decisionCutoff} GMT)</strong></span>
        </div>

        <div className="meta-badge">
          <Database size={13} />
          <span>Data: <strong style={{ color: '#fff' }}>Elexon BMRS</strong></span>
        </div>

        {lastRetrievedAt && (
          <div className="meta-badge">
            <Activity size={13} />
            <span>
              {isCached ? 'Persistent Cache' : 'Live Ingestion'} · {new Date(lastRetrievedAt).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
