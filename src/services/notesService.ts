import type { Bookmark, NoteDocument } from '@/types/bookmark';
import { apiClient } from '@/services/apiClient';

function now(): string {
  return new Date().toISOString();
}

export async function composeNoteFromBookmarks(
  title: string,
  bookmarks: Bookmark[]
): Promise<NoteDocument> {
  const sections = bookmarks
    .map(
      (bookmark) => `### ${bookmark.title}\n- URL: ${bookmark.url}\n- Tags: ${
        bookmark.tags.join(', ') || 'untagged'
      }\n- Summary: ${bookmark.summary}\n`
    )
    .join('\n');

  return {
    id: crypto.randomUUID(),
    title,
    bookmarkIds: bookmarks.map((bookmark) => bookmark.id),
    body: `# ${title}\n\n${sections}`,
    status: 'draft',
    createdAt: now()
  };
}

export async function exportNoteToGoogleDocs(note: NoteDocument): Promise<NoteDocument> {
  return apiClient.post<NoteDocument>('/notes/export', { note });
}
