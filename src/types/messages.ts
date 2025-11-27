export type RuntimeMessage =
  | { type: 'REQUEST_PAGE_CONTEXT' }
  | { type: 'PAGE_CONTEXT'; payload: PageContextPayload }
  | { type: 'SAVE_BOOKMARK'; payload: SaveBookmarkPayload }
  | { type: 'BOOKMARK_SAVED'; payload: BookmarkSavedPayload }
  | { type: 'CAPTURE_CONTENT' }
  | { type: 'CONTENT_CAPTURED'; payload: PageContextPayload }
  | { type: 'PING' };

export type PageContextPayload = {
  title: string;
  url: string;
  description?: string;
  content?: string;
  language?: string;
  favicon?: string;
};

export type SaveBookmarkPayload = {
  bookmarkId: string;
};

export type BookmarkSavedPayload = SaveBookmarkPayload & {
  status: 'success' | 'error';
  error?: string;
};
