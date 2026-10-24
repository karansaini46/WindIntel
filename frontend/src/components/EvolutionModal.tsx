import React, { useEffect, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { apiClient } from '../api/client';
import { ForecastHistoryResponse } from '../api/types';

interface EvolutionModalProps {
  startTime: string | null;
  decisionCutoff: string;
  onClose: () => void;
}

export const EvolutionModal: React.FC<EvolutionModalProps> = ({
  startTime,
  decisionCutoff,
  onClose,
}) => {
  const [data, setData] = useState<ForecastHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startTime) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    apiClient
      .getForecastHistory({
        start_time: startTime,
        decision_cutoff: decisionCutoff,
      })
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load publication revision history');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [startTime, decisionCutoff]);

  if (!startTime) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Forecast Publication Evolution</h3>
            <p className="modal-subtitle">
              Delivery Interval: {startTime.replace('T', ' ').substring(0, 16)} GMT
            </p>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              Loading Elexon publication evolution history...
            </div>
          )}

          {error && (
            <div className="warning-alert" style={{ color: 'var(--color-error-neg)' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Error loading publication history:</strong>
                <p style={{ marginTop: '0.2rem' }}>{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && data && (
            <div>
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Configured Cutoff:</span>
                  <span className="mono" style={{ color: '#fff' }}>{decisionCutoff} GMT</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Revisions Published:</span>
                  <span className="mono" style={{ color: '#fff' }}>{data.versions_count} versions</span>
                </div>
              </div>

              {data.versions.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No publication history records returned by Elexon BMRS for this interval.
                </div>
              )}

              <div className="timeline-list">
                {data.versions.map((ver, idx) => {
                  const isSelected = ver.is_selected;
                  const isEligible = ver.eligible;

                  return (
                    <div
                      key={idx}
                      className={`timeline-item ${isSelected ? 'selected' : ''} ${
                        !isEligible ? 'ineligible' : ''
                      }`}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ color: '#fff', fontWeight: 600 }}>
                            {ver.publish_time.replace('T', ' ').substring(5, 16)} GMT
                          </span>
                          {isSelected && (
                            <span
                              style={{
                                background: 'rgba(56, 189, 248, 0.2)',
                                color: 'var(--color-forecast)',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '3px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                              }}
                            >
                              ★ SELECTED VERSION
                            </span>
                          )}
                          {!isEligible && (
                            <span
                              style={{
                                background: 'rgba(244, 63, 94, 0.15)',
                                color: 'var(--color-error-neg)',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '3px',
                                fontSize: '0.68rem',
                              }}
                            >
                              POST-CUTOFF (EXCLUDED)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          Lead Time: {ver.lead_time_hours}h prior to delivery
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-forecast)' }}>
                          {ver.generation_mw.toLocaleString()} MW
                        </div>
                        <div style={{ fontSize: '0.7rem', color: isEligible ? 'var(--color-actual)' : 'var(--text-muted)' }}>
                          {isEligible ? 'Eligible at cutoff' : 'Published after cutoff'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
