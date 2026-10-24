import React from 'react';
import { ArrowRight, Calendar, Clock } from 'lucide-react';

interface PageContextProps {
  decisionDate: string;
  deliveryDate: string;
  decisionCutoff: string;
  timezone?: string;
}

export const PageContext: React.FC<PageContextProps> = ({
  decisionDate,
  deliveryDate,
  decisionCutoff,
  timezone = 'Europe/London (GMT)',
}) => {
  // Format dates for display, e.g. "05 Jan 2026"
  const formatDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
      }
    } catch {
      // fallback
    }
    return dateStr;
  };

  return (
    <section className="page-context-header" aria-labelledby="main-page-heading">
      <div className="page-title-block">
        <h1 id="main-page-heading" className="page-title">
          Wind forecast evaluation
        </h1>
        <p className="page-subtitle">
          Compare the forecast available at the purchasing cutoff with actual wind generation for the delivery day.
        </p>
      </div>

      <div className="operational-date-badge-group" aria-label="Evaluation timeline context">
        <div className="operational-date-step">
          <span className="operational-step-label">Decision Date (D-1)</span>
          <span className="operational-step-val" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
            {formatDate(decisionDate)}
          </span>
        </div>

        <div className="operational-arrow" aria-hidden="true">
          <ArrowRight size={14} />
        </div>

        <div className="operational-date-step">
          <span className="operational-step-label">Delivery Date (D)</span>
          <span className="operational-step-val" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Calendar size={12} style={{ color: 'var(--accent)' }} />
            {formatDate(deliveryDate)}
          </span>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 0.25rem' }} aria-hidden="true" />

        <div className="operational-date-step">
          <span className="operational-step-label">Purchasing Cutoff</span>
          <span className="operational-step-val" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Clock size={12} style={{ color: 'var(--text-muted)' }} />
            {decisionCutoff} · {timezone}
          </span>
        </div>
      </div>
    </section>
  );
};
