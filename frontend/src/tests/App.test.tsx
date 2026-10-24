import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { App } from '../App';
import { apiClient } from '../api/client';
import { EvaluationResponse, SystemMetadataResponse, HealthCheckResponse } from '../api/types';

describe('App Component', () => {
  const mockHealth: HealthCheckResponse = {
    status: 'healthy',
    version: '1.0.0',
    timestamp: '2026-01-05T12:00:00Z',
    cache_connected: true,
    upstream_api: 'https://data.elexon.co.uk/bmrs/api/v1',
  };

  const mockMetadata: SystemMetadataResponse = {
    supported_decision_dates: { start: '2026-01-01', end: '2026-01-31' },
    supported_delivery_dates: { start: '2026-01-02', end: '2026-02-01' },
    timezone: 'Europe/London',
    generation_unit: 'MW',
    default_cutoff_time: '12:00:00',
    data_source: 'Elexon Insights Solution (BMRS)',
    last_successful_retrieval: '2026-01-05T12:00:00Z',
    app_version: '1.0.0',
  };

  const mockEvaluation: EvaluationResponse = {
    decision_date: '2026-01-05',
    decision_cutoff: '2026-01-05T12:00:00Z',
    delivery_date: '2026-01-06',
    timezone: 'Europe/London',
    unit: 'MW',
    data_source: 'Elexon BMRS (FUELHH + WINDFOR)',
    retrieval_status: 'SUCCESS',
    cached: true,
    last_retrieved_at: '2026-01-05T12:00:00Z',
    metrics: {
      mae: 1726.2,
      rmse: 2059.7,
      bias: 1376.0,
      mape: 29.5,
      mape_excluded_count: 2,
      matched_intervals: 24,
      coverage_percent: 50.0,
    },
    coverage: {
      expected_intervals: 48,
      forecast_intervals_available: 24,
      actual_intervals_available: 48,
      matched_pairs: 24,
      missing_forecast_count: 24,
      missing_actual_count: 0,
      coverage_percent: 50.0,
      notes: 'Hourly WINDFOR on half-hourly settlement grid',
    },
    intervals: [],
    sp_summary: [],
    warnings: [],
  };

  it('renders loading state initially and then displays the dashboard', async () => {
    vi.spyOn(apiClient, 'getHealth').mockResolvedValue(mockHealth);
    vi.spyOn(apiClient, 'getMetadata').mockResolvedValue(mockMetadata);
    vi.spyOn(apiClient, 'getEvaluation').mockResolvedValue(mockEvaluation);

    render(<App />);

    expect(screen.getByText('WindIntel')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Mean Absolute Error')).toBeInTheDocument();
    });

    expect(screen.getByText('1,726.2')).toBeInTheDocument();
    expect(screen.getByText('System Operational')).toBeInTheDocument();
  });

  it('renders API error state when evaluation fails', async () => {
    vi.spyOn(apiClient, 'getHealth').mockResolvedValue(mockHealth);
    vi.spyOn(apiClient, 'getMetadata').mockResolvedValue(mockMetadata);
    vi.spyOn(apiClient, 'getEvaluation').mockRejectedValue(new Error('Upstream Elexon Gateway 502'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Evaluation Error:')).toBeInTheDocument();
    });

    expect(screen.getByText('Upstream Elexon Gateway 502')).toBeInTheDocument();
  });
});
