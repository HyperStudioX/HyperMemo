import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listBookmarks, saveBookmark, BOOKMARK_CACHE_KEY } from './bookmarkService';
import { apiClient } from '@/services/apiClient';
import { chromeStorage } from '@/utils/chrome';
import type { Bookmark } from '@/types/bookmark';

// Mock dependencies
vi.mock('@/services/apiClient', () => ({
    apiClient: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock('@/utils/chrome', () => ({
    chromeStorage: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

describe('bookmarkService', () => {
    const mockBookmarks: Bookmark[] = [
        {
            id: '1',
            title: 'Test 1',
            url: 'https://test1.com',
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01',
            summary: 'Summary 1',
            tags: []
        },
        {
            id: '2',
            title: 'Test 2',
            url: 'https://test2.com',
            createdAt: '2023-01-02',
            updatedAt: '2023-01-02',
            summary: 'Summary 2',
            tags: []
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('listBookmarks', () => {
        it('should fetch bookmarks from API and update cache', async () => {
            vi.mocked(apiClient.get).mockResolvedValue(mockBookmarks);

            const result = await listBookmarks();

            expect(apiClient.get).toHaveBeenCalledWith('/bookmarks');
            expect(chromeStorage.set).toHaveBeenCalledWith(BOOKMARK_CACHE_KEY, mockBookmarks);
            expect(result).toEqual(mockBookmarks);
        });

        it('should fall back to cache if API fails', async () => {
            vi.mocked(apiClient.get).mockRejectedValue(new Error('API Error'));
            vi.mocked(chromeStorage.get).mockResolvedValue(mockBookmarks);

            const result = await listBookmarks();

            expect(apiClient.get).toHaveBeenCalledWith('/bookmarks');
            expect(chromeStorage.get).toHaveBeenCalledWith(BOOKMARK_CACHE_KEY, []);
            expect(result).toEqual(mockBookmarks);
        });
    });

    describe('saveBookmark', () => {
        it('should create a new bookmark via POST and refresh cache', async () => {
            const newBookmark = { title: 'New', url: 'https://new.com', tags: [], summary: 'New Summary' };
            const savedBookmark = { ...newBookmark, id: '3', createdAt: '2023-01-03', updatedAt: '2023-01-03' };

            vi.mocked(apiClient.post).mockResolvedValue(savedBookmark);
            vi.mocked(apiClient.get).mockResolvedValue([...mockBookmarks, savedBookmark]);

            const result = await saveBookmark(newBookmark);

            expect(apiClient.post).toHaveBeenCalledWith('/bookmarks', newBookmark);
            expect(apiClient.get).toHaveBeenCalledWith('/bookmarks'); // Refresh cache
            expect(result).toEqual(savedBookmark);
        });

        it('should update an existing bookmark via PUT and refresh cache', async () => {
            const updatePayload = {
                id: '1',
                title: 'Updated',
                url: 'https://test1.com',
                tags: [],
                summary: 'Summary 1'
            };
            const updatedBookmark = { ...mockBookmarks[0], ...updatePayload, updatedAt: '2023-01-04' };

            vi.mocked(apiClient.put).mockResolvedValue(updatedBookmark);
            vi.mocked(apiClient.get).mockResolvedValue([updatedBookmark, mockBookmarks[1]]);

            const result = await saveBookmark(updatePayload);

            expect(apiClient.put).toHaveBeenCalledWith('/bookmarks/1', updatePayload);
            expect(apiClient.get).toHaveBeenCalledWith('/bookmarks'); // Refresh cache
            expect(result).toEqual(updatedBookmark);
        });
    });
});
