import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FilterBar } from '../components/FilterBar';

describe('FilterBar Component', () => {
  it('renders presets and handles date and cutoff changes', () => {
    const onDateChange = vi.fn();
    const onCutoffChange = vi.fn();
    const onRefresh = vi.fn();
    const onExport = vi.fn();

    render(
      <FilterBar
        decisionDate="2026-01-05"
        onDecisionDateChange={onDateChange}
        decisionCutoff="12:00:00"
        onDecisionCutoffChange={onCutoffChange}
        onRefresh={onRefresh}
        onExport={onExport}
        isLoading={false}
      />
    );

    // Preset buttons
    expect(screen.getByText('05 Jan')).toBeInTheDocument();
    expect(screen.getByText('15 Jan')).toBeInTheDocument();

    // Click 15 Jan preset
    fireEvent.click(screen.getByText('15 Jan'));
    expect(onDateChange).toHaveBeenCalledWith('2026-01-15');

    // Change cutoff dropdown
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '11:00:00' } });
    expect(onCutoffChange).toHaveBeenCalledWith('11:00:00');

    // Click Refresh
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    expect(onRefresh).toHaveBeenCalled();

    // Click Export
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
    expect(onExport).toHaveBeenCalled();
  });

  it('disables refresh button when loading', () => {
    render(
      <FilterBar
        decisionDate="2026-01-05"
        onDecisionDateChange={vi.fn()}
        decisionCutoff="12:00:00"
        onDecisionCutoffChange={vi.fn()}
        onRefresh={vi.fn()}
        onExport={vi.fn()}
        isLoading={true}
      />
    );

    const refreshBtn = screen.getByRole('button', { name: /Fetching.../i });
    expect(refreshBtn).toBeDisabled();
  });
});
