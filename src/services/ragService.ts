import type { Bookmark } from '@/types/bookmark';
import { apiClient } from '@/services/apiClient';

export type RagMatch = {
  bookmark: Bookmark;
  score: number;
};

export type RagResponse = {
  answer: string;
  matches: RagMatch[];
};

export async function draftAnswerFromBookmarks(question: string): Promise<RagResponse> {
  return apiClient.post<RagResponse>('/rag/query', { question });
}
