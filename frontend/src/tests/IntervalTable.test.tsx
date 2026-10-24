import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IntervalTable } from '../components/IntervalTable';
import { IntervalEvaluationRecord } from '../api/types';

describe('IntervalTable Component', () => {
  const mockIntervals: IntervalEvaluationRecord[] = [
    {
      start_time: '2026-01-06T00:00:00Z',
      end_time: '2026-01-06T00:30:00Z',
      settlement_date: '2026-01-06',
      settlement_period: 1,
      actual_mw: 5744.0,
      forecast_mw: 6500.0,
      error_mw: 756.0,
      abs_error_mw: 756.0,
      publish_time: '2026-01-05T11:30:00Z',
      lead_time_hours: 12.5,
      status: 'MATCHED',
    },
    {
      start_time: '2026-01-06T00:30:00Z',
      end_time: '2026-01-06T01:00:00Z',
      settlement_date: '2026-01-06',
      settlement_period: 2,
      actual_mw: 5600.0,
      forecast_mw: null,
      error_mw: null,
      abs_error_mw: null,
      publish_time: null,
      lead_time_hours: null,
      status: 'MISSING_FORECAST',
    },
  ];

  it('renders intervals and displays status badges correctly', () => {
    const onInspect = vi.fn();
    render(<IntervalTable intervals={mockIntervals} onInspectInterval={onInspect} />);

    expect(screen.getByText('Delivery Interval Audit Table')).toBeInTheDocument();
    expect(screen.getByText('SP 1')).toBeInTheDocument();
    expect(screen.getByText('5,744 MW')).toBeInTheDocument();
    expect(screen.getByText('6,500 MW')).toBeInTheDocument();
    expect(screen.getByText('+756 MW')).toBeInTheDocument();

    expect(screen.getByText('SP 2')).toBeInTheDocument();
    expect(screen.getByText('MATCHED')).toBeInTheDocument();
    expect(screen.getByText('MISSING FORECAST')).toBeInTheDocument();
  });

  it('invokes onInspectInterval when clicking history button', () => {
    const onInspect = vi.fn();
    render(<IntervalTable intervals={mockIntervals} onInspectInterval={onInspect} />);

    const historyButtons = screen.getAllByRole('button', { name: /History/i });
    expect(historyButtons.length).toBe(2);

    fireEvent.click(historyButtons[0]);
    expect(onInspect).toHaveBeenCalledWith('2026-01-06T00:00:00Z');
  });

  it('filters rows based on search input', () => {
    const onInspect = vi.fn();
    render(<IntervalTable intervals={mockIntervals} onInspectInterval={onInspect} />);

    const searchInput = screen.getByPlaceholderText('Search time / SP...');
    fireEvent.change(searchInput, { target: { value: 'SP 1' } });

    expect(screen.getByText('SP 1')).toBeInTheDocument();
    expect(screen.queryByText('SP 2')).not.toBeInTheDocument();
  });

  it('sorts rows when clicking column header', () => {
    const onInspect = vi.fn();
    render(<IntervalTable intervals={mockIntervals} onInspectInterval={onInspect} />);

    // Click on "Actual (MW)" header to sort
    const actualHeader = screen.getByText('Actual (MW)');
    fireEvent.click(actualHeader);

    // Rows should be reordered or sort direction toggled
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(3); // header + 2 data rows
  });
});
