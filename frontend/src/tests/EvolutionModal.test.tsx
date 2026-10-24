import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EvolutionModal } from '../components/EvolutionModal';
import { apiClient } from '../api/client';
import { ForecastHistoryResponse } from '../api/types';

describe('EvolutionModal Component', () => {
  const mockEvolution: ForecastHistoryResponse = {
    start_time: '2026-01-06T12:00:00Z',
    settlement_date: '2026-01-06',
    settlement_period: 25,
    decision_cutoff: '2026-01-05T12:00:00Z',
    versions_count: 2,
    selected_version: {
      publish_time: '2026-01-05T11:30:00Z',
      generation_mw: 10214.0,
      eligible: true,
      lead_time_hours: 24.5,
      is_selected: true,
    },
    versions: [
      {
        publish_time: '2026-01-05T09:30:00Z',
        generation_mw: 11228.0,
        eligible: true,
        lead_time_hours: 26.5,
        is_selected: false,
      },
      {
        publish_time: '2026-01-05T11:30:00Z',
        generation_mw: 10214.0,
        eligible: true,
        lead_time_hours: 24.5,
        is_selected: true,
      },
    ],
  };

  it('renders loading state and then timeline versions', async () => {
    vi.spyOn(apiClient, 'getForecastHistory').mockResolvedValueOnce(mockEvolution);
    const onClose = vi.fn();

    render(
      <EvolutionModal
        startTime="2026-01-06T12:00:00Z"
        decisionCutoff="12:00:00"
        onClose={onClose}
      />
    );

    expect(screen.getByText(/Loading Elexon publication evolution history/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Forecast Publication Evolution')).toBeInTheDocument();
    });

    expect(screen.getByText('★ SELECTED VERSION')).toBeInTheDocument();
    expect(screen.getByText('10,214 MW')).toBeInTheDocument();
    expect(screen.getByText('11,228 MW')).toBeInTheDocument();

    // Test close button
    const closeBtn = screen.getByRole('button');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('returns null when startTime is not provided', () => {
    const { container } = render(
      <EvolutionModal startTime={null} decisionCutoff="12:00:00" onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});
