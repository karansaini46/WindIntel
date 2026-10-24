export type IntervalStatus = 'MATCHED' | 'MISSING_FORECAST' | 'MISSING_ACTUAL' | 'UNPAIRED';

export interface IntervalEvaluationRecord {
  start_time: string;
  end_time: string;
  settlement_date: string;
  settlement_period: number;
  actual_mw: number | null;
  forecast_mw: number | null;
  error_mw: number | null;
  abs_error_mw: number | null;
  publish_time: string | null;
  lead_time_hours: number | null;
  status: IntervalStatus;
}

export interface EvaluationMetrics {
  mae: number | null;
  rmse: number | null;
  bias: number | null;
  mape: number | null;
  mape_excluded_count: number;
  matched_intervals: number;
  coverage_percent: number;
}

export interface CoverageStatistics {
  expected_intervals: number;
  forecast_intervals_available: number;
  actual_intervals_available: number;
  matched_pairs: number;
  missing_forecast_count: number;
  missing_actual_count: number;
  coverage_percent: number;
  notes: string;
}

export interface SettlementPeriodSummary {
  settlement_period: number;
  forecast_mw: number | null;
  actual_mw: number | null;
  error_mw: number | null;
  matched_count: number;
}

export interface EvaluationResponse {
  decision_date: string;
  decision_cutoff: string;
  delivery_date: string;
  timezone: string;
  unit: string;
  data_source: string;
  retrieval_status: string;
  cached: boolean;
  last_retrieved_at: string;
  metrics: EvaluationMetrics;
  coverage: CoverageStatistics;
  intervals: IntervalEvaluationRecord[];
  sp_summary: SettlementPeriodSummary[];
  warnings: string[];
}

export interface ForecastHistoryVersion {
  publish_time: string;
  generation_mw: number;
  eligible: boolean;
  lead_time_hours: number;
  is_selected: boolean;
}

export interface ForecastHistoryResponse {
  start_time: string;
  settlement_date?: string;
  settlement_period?: number;
  decision_cutoff?: string;
  selected_version?: ForecastHistoryVersion;
  versions_count: number;
  versions: ForecastHistoryVersion[];
}

export interface SystemMetadataResponse {
  supported_decision_dates: {
    start: string;
    end: string;
  };
  supported_delivery_dates: {
    start: string;
    end: string;
  };
  timezone: string;
  generation_unit: string;
  default_cutoff_time: string;
  data_source: string;
  datasets: Record<string, string>;
  last_successful_retrieval?: string;
  app_version: string;
}

export interface HealthCheckResponse {
  status: string;
  version: string;
  timestamp: string;
  cache_connected: boolean;
  upstream_api: string;
}
