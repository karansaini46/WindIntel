import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SummaryCards } from '../components/SummaryCards';
import { EvaluationMetrics, CoverageStatistics } from '../api/types';

describe('SummaryCards Component', () => {
  const mockMetrics: EvaluationMetrics = {
    mae: 1726.2,
    rmse: 2059.7,
    bias: 1376.0,
    mape: 29.5,
    mape_excluded_count: 2,
    matched_intervals: 24,
    coverage_percent: 50.0,
  };

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

  it('renders MAE, RMSE, Bias, and MAPE accurately', () => {
    render(<SummaryCards metrics={mockMetrics} coverage={mockCoverage} />);

    expect(screen.getByText('Mean Absolute Error')).toBeInTheDocument();
    expect(screen.getByText('1,726.2')).toBeInTheDocument();

    expect(screen.getByText('Root Mean Squared Error')).toBeInTheDocument();
    expect(screen.getByText('2,059.7')).toBeInTheDocument();

    expect(screen.getByText('Forecast Bias (Mean Error)')).toBeInTheDocument();
    expect(screen.getByText('+1,376')).toBeInTheDocument();
    expect(screen.getByText('Overforecasting (+)')).toBeInTheDocument();

    expect(screen.getByText('Mean Absolute % Error')).toBeInTheDocument();
    expect(screen.getByText('29.5%')).toBeInTheDocument();
    expect(screen.getByText('2 low-wind interval(s) excluded')).toBeInTheDocument();
  });

  it('handles negative bias with underforecasting badge', () => {
    const negMetrics = {
      ...mockMetrics,
      bias: -850.5,
    };
    render(<SummaryCards metrics={negMetrics} coverage={mockCoverage} />);
    expect(screen.getByText('-850.5')).toBeInTheDocument();
    expect(screen.getByText('Underforecasting (-)')).toBeInTheDocument();
  });

  it('handles null metrics gracefully without crashing', () => {
    const emptyMetrics: EvaluationMetrics = {
      mae: null,
      rmse: null,
      bias: null,
      mape: null,
      mape_excluded_count: 0,
      matched_intervals: 0,
      coverage_percent: 0.0,
    };
    render(<SummaryCards metrics={emptyMetrics} coverage={mockCoverage} />);
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThanOrEqual(3);
  });
});
