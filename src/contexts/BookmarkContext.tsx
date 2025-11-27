import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import type { Bookmark, BookmarkPayload } from '@/types/bookmark';
import {
  listBookmarks,
  saveBookmark,
  removeBookmark,
  BOOKMARK_CACHE_KEY
} from '@/services/bookmarkService';

export type BookmarkContextValue = {
  bookmarks: Bookmark[];
  loading: boolean;
  refresh: () => Promise<void>;
  save: (payload: BookmarkPayload & { id?: string }) => Promise<Bookmark>;
  remove: (id: string) => Promise<void>;
};

const BookmarkContext = createContext<BookmarkContextValue | undefined>(undefined);

export function BookmarkProvider({ children }: { children: React.ReactNode }) {
  const value = useProvideBookmarks();
  return <BookmarkContext.Provider value={value}>{children}</BookmarkContext.Provider>;
}

export function useBookmarksContext(): BookmarkContextValue {
  const context = useContext(BookmarkContext);
  if (!context) {
    throw new Error('useBookmarksContext must be used inside BookmarkProvider');
  }
  return context;
}

function useProvideBookmarks(): BookmarkContextValue {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listBookmarks();
      setBookmarks(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const handler: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area
    ) => {
      if (area === 'local' && changes[BOOKMARK_CACHE_KEY]) {
        const nextBookmarks = changes[BOOKMARK_CACHE_KEY].newValue as Bookmark[];
        setBookmarks(nextBookmarks ?? []);
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  const persist = useCallback(async (payload: BookmarkPayload & { id?: string }): Promise<Bookmark> => {
    const saved = await saveBookmark(payload);
    await refresh();
    return saved;
  }, [refresh]);

  const drop = useCallback(async (id: string) => {
    await removeBookmark(id);
    await refresh();
  }, [refresh]);

  return useMemo(
    () => ({ bookmarks, loading, refresh, save: persist, remove: drop }),
    [bookmarks, loading, refresh, persist, drop]
  );
}
