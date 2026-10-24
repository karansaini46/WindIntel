import { useEffect, useState, useCallback, useMemo } from 'react';
import { apiClient } from './api/client';
import { EvaluationResponse, SystemMetadataResponse } from './api/types';
import { Header } from './components/Header';
import { PageContext } from './components/PageContext';
import { FilterBar } from './components/FilterBar';
import { SummaryCards } from './components/SummaryCards';
import { CoverageAudit } from './components/CoverageAudit';
import { ForecastChart } from './components/ForecastChart';
import { ErrorChart } from './components/ErrorChart';
import { SettlementPeriodChart } from './components/SettlementPeriodChart';
import { IntervalTable } from './components/IntervalTable';
import { EvolutionModal } from './components/EvolutionModal';
import { AlertCircle, RefreshCw, FileQuestion } from 'lucide-react';
import './styles/index.css';

function computeDefaultDeliveryDate(decisionDateStr: string): string {
  try {
    const parts = decisionDateStr.split('-').map(Number);
    if (parts.length === 3) {
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().substring(0, 10);
    }
  } catch {
    // fallback
  }
  return decisionDateStr;
}

export function App() {
  // Read initial params from URL if present
  const queryParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialDate = queryParams.get('date') || '2026-01-05';
  const initialCutoff = queryParams.get('cutoff') || '12:00:00';

  const [decisionDate, setDecisionDate] = useState<string>(initialDate);
  const [decisionCutoff, setDecisionCutoff] = useState<string>(initialCutoff);
  const [metadata, setMetadata] = useState<SystemMetadataResponse | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectedStartTime, setInspectedStartTime] = useState<string | null>(null);

  // Sync URL search params
  const updateUrlParams = useCallback((date: string, cutoff: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('date', date);
    params.set('cutoff', cutoff);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, []);

  const fetchHealthAndMetadata = useCallback(async () => {
    try {
      const [h, m] = await Promise.all([
        apiClient.getHealth(),
        apiClient.getMetadata(),
      ]);
      setIsHealthy(h.status === 'healthy');
      setMetadata(m);
    } catch {
      setIsHealthy(false);
    }
  }, []);

  const loadEvaluation = useCallback(
    async (forceRefresh = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiClient.getEvaluation({
          decision_date: decisionDate,
          decision_cutoff: decisionCutoff,
          force_refresh: forceRefresh,
        });
        setEvaluation(data);
        updateUrlParams(decisionDate, decisionCutoff);
      } catch (err: any) {
        setError(err.message || 'Failed to retrieve forecast evaluation data');
      } finally {
        setIsLoading(false);
      }
    },
    [decisionDate, decisionCutoff, updateUrlParams]
  );

  useEffect(() => {
    fetchHealthAndMetadata();
  }, [fetchHealthAndMetadata]);

  useEffect(() => {
    loadEvaluation(false);
  }, [loadEvaluation]);

  const handleExportCsv = () => {
    const exportUrl = apiClient.getExportUrl({
      decision_date: decisionDate,
      decision_cutoff: decisionCutoff,
    });
    window.open(exportUrl, '_blank');
  };

  const deliveryDate = evaluation?.delivery_date || computeDefaultDeliveryDate(decisionDate);

  return (
    <div className="app-container">
      {/* A. Compact application header */}
      <Header
        metadata={metadata}
        decisionDate={decisionDate}
        decisionCutoff={decisionCutoff}
        isHealthy={isHealthy}
        isCached={evaluation?.cached ?? false}
        lastRetrievedAt={evaluation?.last_retrieved_at}
      />

      {/* B. Page title and operational context */}
      <PageContext
        decisionDate={decisionDate}
        deliveryDate={deliveryDate}
        decisionCutoff={decisionCutoff}
        timezone={evaluation?.timezone || metadata?.timezone}
      />

      {/* C. Decision controls */}
      <FilterBar
        decisionDate={decisionDate}
        onDecisionDateChange={(d) => setDecisionDate(d)}
        decisionCutoff={decisionCutoff}
        onDecisionCutoffChange={(c) => setDecisionCutoff(c)}
        onRefresh={() => loadEvaluation(true)}
        onExport={handleExportCsv}
        isLoading={isLoading}
      />

      {/* API Error State */}
      {error && (
        <div className="error-alert" role="alert">
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
          <div>
            <strong>Evaluation Error:</strong>
            <p style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>{error}</p>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              onClick={() => loadEvaluation(true)}
            >
              <RefreshCw size={12} aria-hidden="true" />
              <span>Retry Evaluation</span>
            </button>
          </div>
        </div>
      )}

      {/* Stable layout loading skeleton */}
      {isLoading && (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}
          aria-label="Loading evaluation data"
          aria-busy="true"
        >
          <div className="skeleton" style={{ height: '96px' }} />
          <div className="skeleton" style={{ height: '64px' }} />
          <div className="skeleton" style={{ height: '360px' }} />
          <div className="skeleton" style={{ height: '280px' }} />
        </div>
      )}

      {/* Evaluation Data Display */}
      {!isLoading && evaluation && (
        <>
          {/* D. KPI summary row */}
          <SummaryCards metrics={evaluation.metrics} coverage={evaluation.coverage} />

          {/* E. Data quality and coverage summary */}
          <CoverageAudit coverage={evaluation.coverage} warnings={evaluation.warnings} />

          {/* Empty Evaluation Check */}
          {evaluation.intervals.length === 0 ? (
            <div className="chart-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', marginBottom: '2rem' }}>
              <FileQuestion size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem auto' }} aria-hidden="true" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                No delivery intervals found
              </h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 1.5rem auto', fontSize: '0.85rem' }}>
                No wind forecast or outturn intervals are available for decision date {decisionDate} at cutoff {decisionCutoff}.
                Try selecting a date within the supported range (e.g. 05 Jan 2026).
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDecisionDate('2026-01-05')}
              >
                Reset to 05 Jan 2026
              </button>
            </div>
          ) : (
            <div className="charts-grid">
              {/* F. Forecast-versus-actual analysis (Highest priority) */}
              <ForecastChart
                intervals={evaluation.intervals}
                deliveryDate={evaluation.delivery_date}
              />

              {/* G. Forecast error and settlement-period analysis */}
              <div className="charts-grid-split">
                <ErrorChart
                  intervals={evaluation.intervals}
                  deliveryDate={evaluation.delivery_date}
                />
                <SettlementPeriodChart
                  data={evaluation.sp_summary}
                  deliveryDate={evaluation.delivery_date}
                />
              </div>

              {/* H. Detailed interval table */}
              <IntervalTable
                intervals={evaluation.intervals}
                onInspectInterval={(startTime) => setInspectedStartTime(startTime)}
              />
            </div>
          )}
        </>
      )}

      {/* I. Forecast publication history modal */}
      <EvolutionModal
        startTime={inspectedStartTime}
        decisionCutoff={evaluation?.decision_cutoff || `${decisionDate}T${decisionCutoff.replace(/Z$/, '')}Z`}
        onClose={() => setInspectedStartTime(null)}
      />
    </div>
  );
}

export default App;
