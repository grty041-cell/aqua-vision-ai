import type { Analytics, Job, ModelOption, VideoResults } from '../types';

const API_BASE = '/api/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body: { detail?: string } = await response.json();
      detail = body.detail || detail;
    } catch {
      detail = detail || 'The API returned an unreadable error response.';
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export function fetchAnalytics(): Promise<Analytics> {
  return request<Analytics>('/analytics');
}

export function fetchJobs(): Promise<Job[]> {
  return request<Job[]>('/jobs');
}

export function fetchJob(jobId: string): Promise<Job> {
  return request<Job>(`/jobs/${encodeURIComponent(jobId)}`);
}

export function fetchResults(jobId: string): Promise<VideoResults> {
  return request<VideoResults>(`/jobs/${encodeURIComponent(jobId)}/results`);
}

export function fetchModels(): Promise<ModelOption[]> {
  return request<ModelOption[]>('/models');
}

export function submitVideo(file: File, model: string): Promise<Job> {
  const body = new FormData();
  body.append('file', file);
  body.append('model', model);
  return request<Job>('/jobs', { method: 'POST', body });
}

export async function downloadReport(jobId: string, format: 'json' | 'csv' | 'pdf'): Promise<void> {
  const response = await fetch(
    `${API_BASE}/jobs/${encodeURIComponent(jobId)}/reports/${format}`,
  );
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body: { detail?: string } = await response.json();
      detail = body.detail || detail;
    } catch {
      detail = detail || 'The report could not be downloaded.';
    }
    throw new Error(detail);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `aquavision-${jobId}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function annotatedVideoUrl(jobId: string): string {
  return `${API_BASE}/jobs/${encodeURIComponent(jobId)}/video`;
}