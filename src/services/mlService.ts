import { apiClient } from '@/services/apiClient';

export type SummaryRequest = {
  url?: string;
  title?: string;
  content?: string;
};

export async function generateSummary(payload: SummaryRequest): Promise<string> {
  const response = await apiClient.post<{ summary: string }>('/summaries', payload);
  return response.summary;
}

export async function extractSmartTags(payload: SummaryRequest): Promise<string[]> {
  const response = await apiClient.post<{ tags: string[] }>('/summaries/tags', payload);
  return response.tags;
}
