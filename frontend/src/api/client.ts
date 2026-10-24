import {
  EvaluationResponse,
  ForecastHistoryResponse,
  HealthCheckResponse,
  SystemMetadataResponse,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.detail || errorBody.message || errorMessage;
      } catch {
        // use default status text
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async getHealth(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>('/api/health');
  }

  async getMetadata(): Promise<SystemMetadataResponse> {
    return this.request<SystemMetadataResponse>('/api/metadata');
  }

  async getEvaluation(params: {
    decision_date: string;
    decision_cutoff?: string;
    delivery_date?: string;
    force_refresh?: boolean;
  }): Promise<EvaluationResponse> {
    const searchParams = new URLSearchParams({
      decision_date: params.decision_date,
    });
    if (params.decision_cutoff) {
      searchParams.set('decision_cutoff', params.decision_cutoff);
    }
    if (params.delivery_date) {
      searchParams.set('delivery_date', params.delivery_date);
    }
    if (params.force_refresh) {
      searchParams.set('force_refresh', 'true');
    }

    return this.request<EvaluationResponse>(`/api/evaluation?${searchParams.toString()}`);
  }

  async getForecastHistory(params: {
    start_time: string;
    decision_cutoff?: string;
  }): Promise<ForecastHistoryResponse> {
    const searchParams = new URLSearchParams({
      start_time: params.start_time,
    });
    if (params.decision_cutoff) {
      searchParams.set('decision_cutoff', params.decision_cutoff);
    }

    return this.request<ForecastHistoryResponse>(`/api/forecast-history?${searchParams.toString()}`);
  }

  getExportUrl(params: {
    decision_date: string;
    decision_cutoff?: string;
    delivery_date?: string;
  }): string {
    const searchParams = new URLSearchParams({
      decision_date: params.decision_date,
    });
    if (params.decision_cutoff) {
      searchParams.set('decision_cutoff', params.decision_cutoff);
    }
    if (params.delivery_date) {
      searchParams.set('delivery_date', params.delivery_date);
    }
    return `${this.baseUrl}/api/export?${searchParams.toString()}`;
  }
}

export const apiClient = new ApiClient();
