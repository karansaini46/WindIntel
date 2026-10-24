import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from './api/client';
import { EvaluationResponse, SystemMetadataResponse } from './api/types';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { SummaryCards } from './components/SummaryCards';
import { CoverageAudit } from './components/CoverageAudit';
import { ForecastChart } from './components/ForecastChart';
import { ErrorChart } from './components/ErrorChart';
import { SettlementPeriodChart } from './components/SettlementPeriodChart';
import { IntervalTable } from './components/IntervalTable';
import { EvolutionModal } from './components/EvolutionModal';
import { AlertCircle, RefreshCw } from 'lucide-react';
import './styles/index.css';

export function App() {
  // Read initial params from URL if present
  const queryParams = new URLSearchParams(window.location.search);
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

  return (
    <div className="app-container">
      <Header
        metadata={metadata}
        decisionDate={decisionDate}
        decisionCutoff={decisionCutoff}
        isHealthy={isHealthy}
        isCached={evaluation?.cached ?? false}
        lastRetrievedAt={evaluation?.last_retrieved_at}
      />

      <FilterBar
        decisionDate={decisionDate}
        onDecisionDateChange={(d) => setDecisionDate(d)}
        decisionCutoff={decisionCutoff}
        onDecisionCutoffChange={(c) => setDecisionCutoff(c)}
        onRefresh={() => loadEvaluation(true)}
        onExport={handleExportCsv}
        isLoading={isLoading}
      />

      {error && (
        <div
          className="warning-alert"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            marginBottom: '1.5rem',
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Evaluation Error:</strong>
            <p style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>{error}</p>
            <button
              className="btn btn-secondary"
              style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              onClick={() => loadEvaluation(true)}
            >
              <RefreshCw size={12} /> Retry Evaluation
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          <div className="skeleton" style={{ height: '110px' }} />
          <div className="skeleton" style={{ height: '340px' }} />
          <div className="skeleton" style={{ height: '260px' }} />
        </div>
      )}

      {!isLoading && evaluation && (
        <>
          <SummaryCards metrics={evaluation.metrics} coverage={evaluation.coverage} />

          <CoverageAudit coverage={evaluation.coverage} warnings={evaluation.warnings} />

          <div className="charts-grid">
            <ForecastChart
              intervals={evaluation.intervals}
              deliveryDate={evaluation.delivery_date}
            />

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

            <IntervalTable
              intervals={evaluation.intervals}
              onInspectInterval={(startTime) => setInspectedStartTime(startTime)}
            />
          </div>
        </>
      )}

      <EvolutionModal
        startTime={inspectedStartTime}
        decisionCutoff={decisionCutoff}
        onClose={() => setInspectedStartTime(null)}
      />
    </div>
  );
}

export default App;
