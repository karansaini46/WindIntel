import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CoverageAudit } from '../components/CoverageAudit';
import { CoverageStatistics } from '../api/types';

describe('CoverageAudit Component', () => {
  const mockCoverage: CoverageStatistics = {
    expected_intervals: 48,
    forecast_intervals_available: 24,
    actual_intervals_available: 48,
    matched_pairs: 24,
    missing_forecast_count: 24,
    missing_actual_count: 0,
    coverage_percent: 50.0,
    notes: 'Hourly WINDFOR on half-hourly settlement grid',
  };

  it('renders all coverage statistics counters accurately', () => {
    render(<CoverageAudit coverage={mockCoverage} warnings={[]} />);

    expect(screen.getByText('Expected Intervals:')).toBeInTheDocument();
    expect(screen.getAllByText('48').length).toBe(2);

    expect(screen.getByText('Forecasts Available:')).toBeInTheDocument();
    expect(screen.getByText('Actuals Metered:')).toBeInTheDocument();
    expect(screen.getByText('Matched Pairs:')).toBeInTheDocument();
    expect(screen.getByText('Missing Forecasts:')).toBeInTheDocument();
    expect(screen.getByText(mockCoverage.notes)).toBeInTheDocument();
  });

  it('renders operational warnings when present', () => {
    const warnings = ['Forecast coverage is 50.0%', '2 intervals excluded from MAPE'];
    render(<CoverageAudit coverage={mockCoverage} warnings={warnings} />);

    expect(screen.getByText('Operational Data Notice:')).toBeInTheDocument();
    expect(screen.getByText('Forecast coverage is 50.0%')).toBeInTheDocument();
    expect(screen.getByText('2 intervals excluded from MAPE')).toBeInTheDocument();
  });
});
