import React, { useEffect, useState, useCallback } from 'react';
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

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!startTime) return;

    window.addEventListener('keydown', handleKeyDown);
    // Lock background scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [startTime, handleKeyDown]);

  useEffect(() => {
    if (!startTime) return;

    let isMounted = true;

    // Ensure decision_cutoff is a valid ISO timestamp format for the backend API
    let queryCutoff = decisionCutoff;
    if (decisionCutoff && !decisionCutoff.includes('T')) {
      try {
        const startDate = new Date(startTime);
        startDate.setUTCDate(startDate.getUTCDate() - 1);
        const ymd = startDate.toISOString().substring(0, 10);
        queryCutoff = `${ymd}T${decisionCutoff.replace(/Z$/, '')}Z`;
      } catch {
        queryCutoff = decisionCutoff;
      }
    }

    apiClient
      .getForecastHistory({
        start_time: startTime,
        decision_cutoff: queryCutoff,
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

  const cutoffTimeDisplay = decisionCutoff.includes('T')
    ? decisionCutoff.substring(11, 19)
    : decisionCutoff;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 id="modal-title" className="modal-title">
              Forecast Publication Evolution
            </h3>
            <p className="modal-subtitle">
              Delivery Interval: {startTime.replace('T', ' ').substring(0, 16)} GMT
            </p>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            aria-label="Close dialog"
            autoFocus
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {loading && (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)' }}>
              Loading Elexon publication evolution history...
            </div>
          )}

          {error && (
            <div className="warning-alert" role="alert" style={{ color: 'var(--danger)', background: 'var(--danger-subtle)' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
              <div>
                <strong>Error loading publication history:</strong>
                <p style={{ marginTop: '0.2rem' }}>{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && data && (
            <div>
              <div className="modal-info-strip">
                <div className="modal-info-row">
                  <span style={{ color: 'var(--text-secondary)' }}>Configured Decision Cutoff:</span>
                  <span className="tabular" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {cutoffTimeDisplay} GMT
                  </span>
                </div>
                <div className="modal-info-row">
                  <span style={{ color: 'var(--text-secondary)' }}>Total Revisions Published:</span>
                  <span className="tabular" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {data.versions_count} versions
                  </span>
                </div>
              </div>

              {data.versions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No publication history records returned by Elexon BMRS for this interval.
                </div>
              ) : (
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
                          <div className="timeline-time-row">
                            <span className="timeline-pub-time tabular">
                              {ver.publish_time.replace('T', ' ').substring(5, 16)} GMT
                            </span>
                            {isSelected && (
                              <span className="timeline-badge-selected">
                                ★ SELECTED VERSION
                              </span>
                            )}
                            {!isEligible && (
                              <span className="timeline-badge-ineligible">
                                POST-CUTOFF (EXCLUDED)
                              </span>
                            )}
                          </div>
                          <div className="timeline-lead-time">
                            Lead Time: {ver.lead_time_hours}h prior to delivery
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div className="timeline-mw-value">
                            {ver.generation_mw.toLocaleString()} MW
                          </div>
                          <div className="timeline-status-note">
                            {isEligible ? 'Eligible at cutoff' : 'Published after cutoff'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
