import type React from 'react';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Bookmark as BookmarkIcon,
    FileText,
    MessageSquare,
    Plus,
    Search,
    Trash2,
    Save,
    Copy,
    Check,
    ExternalLink,
    Loader2,
    ChevronDown,
    LogOut,
    Settings,
    CreditCard,
    User,
    Sparkles,
    PanelRightClose,
    PanelRightOpen,
    Send,
    Globe,
    RefreshCw,
    Link,
    Bot,
    AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBookmarksContext } from '@/contexts/BookmarkContext';
import { getBookmark } from '@/services/bookmarkService';
import { supabase } from '@/services/supabaseClient';
import { generateSummary, extractSmartTags } from '@/services/mlService';
import { TagInput } from '@/components/TagInput';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { SubscriptionBadge } from '@/components/SubscriptionBadge';
import { SubscriptionManager } from '@/components/SubscriptionManager';
import { ChatInput, type ChatContextBookmark } from '@/components/ChatInput';
import { Drawer } from '@/components/Drawer';
import { Button } from '@/components/ui/button';
import type { Bookmark, ChatMessage, NoteDocument, ChatSession } from '@/types/bookmark';
import type { TagSummary } from '@/types/tag';
import type { Subscription } from '@/types/subscription';
import { streamAnswerFromBookmarks, type RagMatch, type ConversationMessage } from '@/services/ragService';
import { composeNoteFromBookmarks, generateNoteFromChat, saveNote, listNotes, deleteNote, exportNoteToGoogleDocs } from '@/services/notesService';
import { listTags } from '@/services/tagService';
import { getUserSubscription } from '@/services/subscriptionService';
import { ApiError } from '@/services/apiClient';
import { chromeStorage } from '@/utils/chrome';

// Helper to transform text with citation patterns into React nodes
function transformTextWithCitations(text: string, citations?: RagMatch[]): React.ReactNode {
    if (!text.includes('[')) return text;

    const parts = text.split(/(\[\d+\])/g);
    if (parts.length === 1) return text;

    return parts.map((part, index) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match && citations) {
            const citationIndex = Number.parseInt(match[1], 10) - 1;
            const citation = citations[citationIndex];
            if (citation) {
                return (
                    <a
                        key={`cite-${index}-${citation.bookmark.id}`}
                        href={citation.bookmark.url}
                        target="_blank"
                        rel="noreferrer"
                        className="relative inline-flex items-center px-1 mx-0.5 text-xs font-medium text-primary bg-primary/10 rounded hover:bg-primary/20 transition-colors group"
                    >
                        [{match[1]}]
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-text-primary text-bg-main rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">{citation.bookmark.title}</span>
                    </a>
                );
            }
        }
        return part || null;
    });
}

// Component to render message content with inline citations
function MessageContent({ content, citations }: { content: string; citations?: RagMatch[] }) {
    // Create custom components that process citations in text nodes
    const components = useMemo(() => ({
        a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) => (
            <a href={href} {...props} target="_blank" rel="noreferrer">{children}</a>
        ),
        p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { node?: unknown }) => {
            const processChildren = (child: React.ReactNode): React.ReactNode => {
                if (typeof child === 'string') {
                    return transformTextWithCitations(child, citations);
                }
                return child;
            };
            const processed = Array.isArray(children) ? children.map(processChildren) : processChildren(children);
            return <p {...props}>{processed}</p>;
        },
        li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement> & { node?: unknown }) => {
            const processChildren = (child: React.ReactNode): React.ReactNode => {
                if (typeof child === 'string') {
                    return transformTextWithCitations(child, citations);
                }
                return child;
            };
            const processed = Array.isArray(children) ? children.map(processChildren) : processChildren(children);
            return <li {...props}>{processed}</li>;
        },
        strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { node?: unknown }) => {
            const processChildren = (child: React.ReactNode): React.ReactNode => {
                if (typeof child === 'string') {
                    return transformTextWithCitations(child, citations);
                }
                return child;
            };
            const processed = Array.isArray(children) ? children.map(processChildren) : processChildren(children);
            return <strong {...props}>{processed}</strong>;
        },
        em: ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { node?: unknown }) => {
            const processChildren = (child: React.ReactNode): React.ReactNode => {
                if (typeof child === 'string') {
                    return transformTextWithCitations(child, citations);
                }
                return child;
            };
            const processed = Array.isArray(children) ? children.map(processChildren) : processChildren(children);
            return <em {...props}>{processed}</em>;
        }
    }), [citations]);

    return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {content}
        </ReactMarkdown>
    );
}

export default function DashboardApp() {
    const { user, login, logout, loading } = useAuth();
    const { bookmarks, save, remove } = useBookmarksContext();
    const { t } = useTranslation();

    // Navigation State
    const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'notes'>('chat');
    const [sidebarTab, setSidebarTab] = useState<'bookmarks' | 'notes'>('bookmarks');
    const [subscriptionDrawerOpen, setSubscriptionDrawerOpen] = useState(false);
    const [activeBookmarkId, setActiveBookmarkId] = useState<string | null>(null);
    const [detailedBookmark, setDetailedBookmark] = useState<Bookmark | null>(null);
    const [loadingContent, setLoadingContent] = useState(false);

    // Chat State
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [question, setQuestion] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);

    // Feature State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [noteTitle, setNoteTitle] = useState('HyperMemo Notes');
    const [note, setNote] = useState<NoteDocument | null>(null);
    const [exporting, setExporting] = useState(false);
    const [notes, setNotes] = useState<NoteDocument[]>([]);
    const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
    const [savingNote, setSavingNote] = useState(false);
    const [citations, setCitations] = useState<RagMatch[]>([]);
    const [isRegeneratingTags, setIsRegeneratingTags] = useState(false);
    const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);
    const [isRefetchingContent, setIsRefetchingContent] = useState(false);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);

    // Subscription State
    const [subscription, setSubscription] = useState<Subscription | null>(null);

    // Chat Tag State
    const [chatTags, setChatTags] = useState<string[]>([]);
    const [chatBookmarks, setChatBookmarks] = useState<ChatContextBookmark[]>([]);
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const [tagSearch, setTagSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);
    const bookmarkSignatureRef = useRef<string | null>(null);

    // Tag Data
    const [tagSummaries, setTagSummaries] = useState<TagSummary[]>([]);
    const [loadingTags, setLoadingTags] = useState(false);

    const refreshTags = useCallback(async () => {
        if (!user) {
            setTagSummaries([]);
            return;
        }
        try {
            setLoadingTags(true);
            const data = await listTags();
            setTagSummaries(data);
        } catch (error) {
            console.error('Failed to load tags', error);
        } finally {
            setLoadingTags(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            setTagSummaries([]);
            bookmarkSignatureRef.current = null;
            return;
        }
        const signature = bookmarks.map(bookmark => `${bookmark.id}:${(bookmark.tags || []).join(',')}`).join('|');
        if (bookmarkSignatureRef.current === signature) {
            return;
        }
        bookmarkSignatureRef.current = signature;
        void refreshTags();
    }, [user, bookmarks, refreshTags]);

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDangerous?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        isDangerous: false
    });

    // Profile Menu State
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);

    // Close profile menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setIsProfileMenuOpen(false);
            }
        };

        if (isProfileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isProfileMenuOpen]);

    const openConfirm = (title: string, message: string, onConfirm: () => void, isDangerous = false) => {
        setModalConfig({
            isOpen: true,
            title,
            message,
            onConfirm,
            isDangerous
        });
    };

    const closeConfirm = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
    };

    const activeBookmark = useMemo(
        () => bookmarks.find((b) => b.id === activeBookmarkId),
        [bookmarks, activeBookmarkId]
    );

    const selectedBookmarks = useMemo(
        () => bookmarks.filter((bookmark) => selectedIds.includes(bookmark.id)),
        [bookmarks, selectedIds]
    );

    const filteredBookmarks = useMemo(() => {
        if (!selectedTag) return bookmarks;
        return bookmarks.filter(b => b.tags?.includes(selectedTag));
    }, [bookmarks, selectedTag]);

    const activeSession = useMemo(
        () => sessions.find(s => s.id === activeSessionId) || null,
        [sessions, activeSessionId]
    );

    const messages = activeSession?.messages || [];

    // Check if user has Pro subscription
    const isPro = useMemo(() => {
        return subscription?.tier === 'pro' &&
            subscription?.status === 'active' &&
            new Date(subscription.endDate) > new Date();
    }, [subscription]);

    const availableTags = useMemo(() => {
        if (tagSummaries.length > 0) {
            return [...tagSummaries].sort((a, b) => a.name.localeCompare(b.name));
        }

        const counts = new Map<string, number>();
        for (const bookmark of bookmarks) {
            if (!bookmark.tags) continue;
            for (const name of bookmark.tags) {
                if (!name) continue;
                counts.set(name, (counts.get(name) ?? 0) + 1);
            }
        }

        return Array.from(counts.entries())
            .map(([name, bookmarkCount]) => ({
                id: name,
                name,
                bookmarkCount
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [tagSummaries, bookmarks]);

    const tagNames = useMemo(() => availableTags.map(tag => tag.name), [availableTags]);

    const filteredTags = useMemo(() => {
        if (!tagSearch) return tagNames;
        return tagNames.filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()));
    }, [tagNames, tagSearch]);

    // Load chat sessions on mount
    useEffect(() => {
        const loadSessions = async () => {
            const savedSessions = await chromeStorage.get<ChatSession[]>('chat_sessions', []);
            const lastActiveId = await chromeStorage.get<string | null>('active_session_id', null);

            if (savedSessions.length > 0) {
                setSessions(savedSessions);
                // Restore last active session or default to the first one (most recent usually)
                if (lastActiveId && savedSessions.find(s => s.id === lastActiveId)) {
                    setActiveSessionId(lastActiveId);
                } else {
                    setActiveSessionId(savedSessions[0].id);
                }
            } else {
                // Create initial session if none exist
                createNewSession(savedSessions);
            }
        };
        loadSessions();
    }, []);

    // Load notes on mount
    useEffect(() => {
        const loadNotes = async () => {
            const savedNotes = await listNotes();
            setNotes(savedNotes);
        };
        loadNotes();
    }, []);

    // Save sessions whenever they change (debounced)
    useEffect(() => {
        if (sessions.length > 0) {
            const timeoutId = setTimeout(() => {
                chromeStorage.set('chat_sessions', sessions);
            }, 500); // Debounce by 500ms to reduce storage writes
            return () => clearTimeout(timeoutId);
        }
    }, [sessions]);

    // Save active session ID (debounced)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            chromeStorage.set('active_session_id', activeSessionId);
        }, 300); // Shorter debounce for session switching
        return () => clearTimeout(timeoutId);
    }, [activeSessionId]);

    // Load user subscription
    useEffect(() => {
        const loadSubscription = async () => {
            if (user) {
                const sub = await getUserSubscription();
                setSubscription(sub);
            }
        };
        loadSubscription();
    }, [user]);

    const createNewSession = (currentSessions: ChatSession[] = sessions) => {
        const newSession: ChatSession = {
            id: crypto.randomUUID(),
            title: 'New Chat',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const updatedSessions = [newSession, ...currentSessions];
        setSessions(updatedSessions);
        setActiveSessionId(newSession.id);
        return newSession;
    };

    const askAIAboutBookmark = (bookmark: Bookmark) => {
        // Check subscription for chat feature
        if (!isPro) {
            openConfirm(
                t('subscription.upgradeTitle'),
                t('subscription.prompts.chat'),
                () => setSubscriptionDrawerOpen(true)
            );
            return;
        }

        // Create a new session with the bookmark as context
        const newSession: ChatSession = {
            id: crypto.randomUUID(),
            title: bookmark.title?.slice(0, 30) || 'Ask about bookmark',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setActiveTab('chat');

        // Set the question with a prompt about the bookmark (include link in markdown format)
        const bookmarkLink = `[${bookmark.title}](${bookmark.url})`;
        setQuestion(t('dashboard.askAIQuestion', { bookmark: bookmarkLink }));

        // Set chat context to this specific bookmark
        setChatBookmarks([{ id: bookmark.id, title: bookmark.title || 'Untitled' }]);
        setChatTags([]); // Clear any existing tags

        // Auto-resize the textarea after state update
        setTimeout(() => {
            if (chatInputRef.current) {
                chatInputRef.current.style.height = 'auto';
                chatInputRef.current.style.height = `${chatInputRef.current.scrollHeight}px`;
            }
        }, 0);
    };

    const deleteSession = (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        openConfirm(
            t('sidebar.deleteChat'),
            'Delete this chat?',
            async () => {
                // Optimistic update - update UI immediately
                const updatedSessions = sessions.filter(s => s.id !== sessionId);
                setSessions(updatedSessions);

                if (activeSessionId === sessionId) {
                    if (updatedSessions.length > 0) {
                        setActiveSessionId(updatedSessions[0].id);
                    } else {
                        createNewSession(updatedSessions);
                    }
                }

                // Save to storage in background
                chromeStorage.set('chat_sessions', updatedSessions).catch(error => {
                    console.error('Failed to save chat sessions', error);
                });
            },
            true
        );
    };

    // Handlers
    const handleLandingPageSearch = async () => {
        if (!question.trim()) return;

        if (!isPro) {
            openConfirm(
                t('subscription.upgradeTitle'),
                t('subscription.prompts.chat'),
                () => setSubscriptionDrawerOpen(true)
            );
            return;
        }

        // Create a new session for the landing page search
        const newSession: ChatSession = {
            id: crypto.randomUUID(),
            title: 'New Chat',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setActiveSessionId(newSession.id);
        setActiveTab('chat');
        await askAssistant(newSession);
    };

    const handleBookmarkClick = async (id: string) => {
        setActiveBookmarkId(id);
        setActiveTab('overview');

        const cacheKey = `bookmark_detail_${id}`;
        const cached = localStorage.getItem(cacheKey);
        let hasCached = false;

        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                setDetailedBookmark(parsed);
                hasCached = true;
            } catch (e) {
                console.error("Failed to parse cached bookmark", e);
            }
        }

        if (!hasCached) {
            setLoadingContent(true);
            setDetailedBookmark(null);
        }

        try {
            const fullBookmark = await getBookmark(id);
            setDetailedBookmark(fullBookmark);

            try {
                localStorage.setItem(cacheKey, JSON.stringify(fullBookmark));
            } catch (e) {
                console.warn("Failed to cache bookmark", e);
            }

            // Auto-generation is now handled by the backend

        } catch (error) {
            console.error('Failed to fetch full bookmark content', error);
        } finally {
            setLoadingContent(false);
        }
    };

    const handleDelete = () => {
        if (!activeBookmarkId) return;

        const bookmarkToDelete = bookmarks.find(b => b.id === activeBookmarkId);
        if (!bookmarkToDelete) return;

        const confirmMessage = `Are you sure you want to delete this bookmark?\n\n"${bookmarkToDelete.title || 'Untitled'}"`;

        openConfirm(
            t('dashboard.deleteBookmark'),
            confirmMessage,
            async () => {
                const bookmarkIdToDelete = activeBookmarkId;

                // Optimistic update - clear UI immediately
                setActiveBookmarkId(null);
                setDetailedBookmark(null);

                try {
                    // Delete in background
                    await remove(bookmarkIdToDelete);
                    await refreshTags();
                } catch (error) {
                    console.error('Failed to delete bookmark', error);
                    // Could restore the bookmark here if needed
                }
            },
            true
        );
    };

    const handleUpdateTags = async (newTags: string[]) => {
        if (!activeBookmark) return;

        // Optimistic update - update UI immediately
        const previousBookmark = activeBookmark;
        const optimisticBookmark = { ...activeBookmark, tags: newTags };

        // Update the bookmark in the local state immediately for smooth UX
        if (detailedBookmark) {
            setDetailedBookmark({ ...detailedBookmark, tags: newTags });
        }

        try {
            // Save to backend in the background
            await save(optimisticBookmark);
            await refreshTags();
        } catch (error) {
            // Revert on error
            console.error('Failed to update tags', error);
            if (detailedBookmark) {
                setDetailedBookmark({ ...detailedBookmark, tags: previousBookmark.tags || [] });
            }
        }
    };

    const handleRegenerateTags = async () => {
        if (!isPro) {
            openConfirm(
                t('subscription.upgradeTitle'),
                t('subscription.prompts.autoTag'),
                () => setSubscriptionDrawerOpen(true)
            );
            return;
        }
        if (!activeBookmark || !detailedBookmark) return;
        setIsRegeneratingTags(true);
        try {
            const tags = await extractSmartTags({
                content: detailedBookmark.rawContent || detailedBookmark.summary,
                title: activeBookmark.title,
                url: activeBookmark.url
            });
            await save({ ...activeBookmark, tags });
            await refreshTags();
        } catch (error) {
            console.error('Failed to regenerate tags', error);
        } finally {
            setIsRegeneratingTags(false);
        }
    };

    const handleRegenerateSummary = async () => {
        if (!isPro) {
            openConfirm(
                t('subscription.upgradeTitle'),
                t('subscription.prompts.aiSummary'),
                () => setSubscriptionDrawerOpen(true)
            );
            return;
        }
        if (!activeBookmark || !detailedBookmark) return;
        setIsRegeneratingSummary(true);
        try {
            const summary = await generateSummary({
                content: detailedBookmark.rawContent,
                title: activeBookmark.title,
                url: activeBookmark.url
            });
            await save({ ...activeBookmark, summary });
        } catch (error) {
            console.error('Failed to regenerate summary', error);
        } finally {
            setIsRegeneratingSummary(false);
        }
    };

    const handleChatInputChange = (value: string) => {
        setQuestion(value);

        const lastWord = value.split(' ').pop();
        if (lastWord?.startsWith('@')) {
            setShowTagSuggestions(true);
            setTagSearch(lastWord.slice(1));
            setSelectedIndex(0);
        } else {
            setShowTagSuggestions(false);
        }
    };

    const handleTagSelect = (tag: string) => {
        if (!chatTags.includes(tag)) {
            setChatTags([...chatTags, tag]);
        }

        // Remove the @search part from the question
        const words = question.split(' ');
        words.pop(); // Remove the last word (which is the @tag)
        setQuestion(`${words.join(' ')} `); // Add space for next typing

        setShowTagSuggestions(false);
        setTagSearch('');
        setSelectedIndex(0);
    };

    const handleRemoveChatTag = (tag: string) => {
        setChatTags(chatTags.filter(t => t !== tag));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, onSubmit?: () => void) => {
        if (showTagSuggestions && filteredTags.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % filteredTags.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + filteredTags.length) % filteredTags.length);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                handleTagSelect(filteredTags[selectedIndex]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowTagSuggestions(false);
                return;
            }
        }

        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (onSubmit) {
                onSubmit();
            } else {
                askAssistant();
            }
        }
    };

    const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(true);

    const handleResetSession = () => {
        if (!activeSessionId) return;
        openConfirm(
            t('sidebar.resetChat'),
            'Clear all messages in this chat?',
            async () => {
                const updatedSessions = sessions.map(s =>
                    s.id === activeSessionId
                        ? { ...s, messages: [], updatedAt: new Date().toISOString() }
                        : s
                );
                setSessions(updatedSessions);
                await chromeStorage.set('chat_sessions', updatedSessions);
            },
            true
        );
    };

    const handleSaveAsNote = async () => {
        if (!activeSession || activeSession.messages.length === 0) return;

        setSavingNote(true);
        try {
            // Generate a proper note using LLM
            const generatedNote = await generateNoteFromChat(activeSession);
            const savedNote = await saveNote(generatedNote);
            setNotes(prev => [savedNote, ...prev.filter(n => n.id !== savedNote.id)]);
            setActiveNoteId(savedNote.id);
            setSidebarTab('notes');
            setActiveTab('notes');
        } catch (error) {
            console.error('Failed to save note', error);
        } finally {
            setSavingNote(false);
        }
    };

    const handleDeleteNote = (noteId: string) => {
        openConfirm(
            t('notes.deleteNote'),
            t('notes.deleteConfirm'),
            async () => {
                await deleteNote(noteId);
                setNotes(prev => prev.filter(n => n.id !== noteId));
                if (activeNoteId === noteId) {
                    setActiveNoteId(null);
                }
            },
            true
        );
    };

    const activeNote = useMemo(
        () => notes.find(n => n.id === activeNoteId) || null,
        [notes, activeNoteId]
    );

    const handleCopyMessage = async (messageId: string, content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000);
        } catch (error) {
            console.error('Failed to copy message', error);
        }
    };

    const handleRegenerateResponse = async (messageIndex: number) => {
        if (!activeSessionId || regeneratingMessageId || chatLoading) return;

        const session = sessions.find(s => s.id === activeSessionId);
        if (!session || messageIndex < 1) return;

        // Get the user message before the assistant message
        const userMessage = session.messages[messageIndex - 1];
        if (!userMessage || userMessage.role !== 'user') return;

        setRegeneratingMessageId(session.messages[messageIndex].id);
        setChatLoading(true);
        setChatError(null);

        // Remove the assistant message we're regenerating and add a new placeholder
        const updatedMessages = session.messages.slice(0, messageIndex);
        const assistantMessageId = crypto.randomUUID();
        const assistantMessage: ChatMessage = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
            citations: []
        };

        setSessions(prevSessions => prevSessions.map(s =>
            s.id === activeSessionId
                ? { ...s, messages: [...updatedMessages, assistantMessage], updatedAt: new Date().toISOString() }
                : s
        ));

        // Get conversation history up to (but not including) the message being regenerated
        const conversationHistory: ConversationMessage[] = session.messages
            .slice(0, messageIndex - 1) // Exclude the user message that triggered this response
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content
            }));

        try {
            let streamedContent = '';
            let matches: RagMatch[] = [];
            const bookmarkIds = chatBookmarks.map(b => b.id);

            for await (const event of streamAnswerFromBookmarks(userMessage.content, chatTags, bookmarkIds, conversationHistory)) {
                if (event.type === 'matches') {
                    matches = event.matches;
                    setCitations(matches);
                    setSessions(prevSessions => prevSessions.map(s =>
                        s.id === activeSessionId
                            ? {
                                ...s,
                                messages: s.messages.map(m =>
                                    m.id === assistantMessageId
                                        ? { ...m, citations: matches }
                                        : m
                                ),
                                updatedAt: new Date().toISOString()
                            }
                            : s
                    ));
                } else if (event.type === 'content') {
                    streamedContent += event.content;
                    setSessions(prevSessions => prevSessions.map(s =>
                        s.id === activeSessionId
                            ? {
                                ...s,
                                messages: s.messages.map(m =>
                                    m.id === assistantMessageId
                                        ? { ...m, content: streamedContent }
                                        : m
                                ),
                                updatedAt: new Date().toISOString()
                            }
                            : s
                    ));
                } else if (event.type === 'error') {
                    throw new Error(event.error);
                }
            }
        } catch (error) {
            console.error('Failed to regenerate response', error);
            setChatError('Failed to regenerate response. Please try again.');
            // Restore the original messages on error
            setSessions(prevSessions => prevSessions.map(s =>
                s.id === activeSessionId
                    ? { ...s, messages: session.messages, updatedAt: new Date().toISOString() }
                    : s
            ));
        } finally {
            setRegeneratingMessageId(null);
            setChatLoading(false);
        }
    };

    const askAssistant = async (forcedSession?: ChatSession) => {
        const targetSessionId = forcedSession?.id || activeSessionId;
        if (!question.trim() || !targetSessionId) return;

        const currentQuestion = question;
        setQuestion('');
        if (chatInputRef.current) {
            chatInputRef.current.style.height = 'auto';
        }

        setChatLoading(true);
        setChatError(null);

        // Get current session's messages for conversation history (exclude system messages)
        const currentSession = forcedSession || sessions.find(s => s.id === targetSessionId);
        const conversationHistory: ConversationMessage[] = (currentSession?.messages || [])
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content
            }));

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: currentQuestion,
            createdAt: new Date().toISOString()
        };

        // Create a placeholder assistant message for streaming
        const assistantMessageId = crypto.randomUUID();
        const assistantMessage: ChatMessage = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
            citations: []
        };

        // Add both user message and placeholder assistant message in one update
        setSessions(prevSessions => {
            let currentSessions = prevSessions;
            // If a forced session is provided and not in the list, prepend it
            if (forcedSession && !currentSessions.find(s => s.id === forcedSession.id)) {
                currentSessions = [forcedSession, ...currentSessions];
            }

            const updatedSessions = currentSessions.map(s => {
                if (s.id === targetSessionId) {
                    // Update title if it's the first message
                    const title = s.messages.length === 0 ? currentQuestion.slice(0, 30) + (currentQuestion.length > 30 ? '...' : '') : s.title;
                    return {
                        ...s,
                        title,
                        messages: [...s.messages, userMessage, assistantMessage],
                        updatedAt: new Date().toISOString()
                    };
                }
                return s;
            });

            // Move active session to top
            const activeSessionIndex = updatedSessions.findIndex(s => s.id === targetSessionId);
            if (activeSessionIndex > 0) {
                const session = updatedSessions[activeSessionIndex];
                updatedSessions.splice(activeSessionIndex, 1);
                updatedSessions.unshift(session);
            }

            return updatedSessions;
        });

        try {
            let streamedContent = '';
            let matches: RagMatch[] = [];
            const bookmarkIds = chatBookmarks.map(b => b.id);

            for await (const event of streamAnswerFromBookmarks(currentQuestion, chatTags, bookmarkIds, conversationHistory)) {
                if (event.type === 'matches') {
                    matches = event.matches;
                    setCitations(matches);
                    // Update citations in the message
                    setSessions(prevSessions => prevSessions.map(s =>
                        s.id === targetSessionId
                            ? {
                                ...s,
                                messages: s.messages.map(m =>
                                    m.id === assistantMessageId
                                        ? { ...m, citations: matches }
                                        : m
                                ),
                                updatedAt: new Date().toISOString()
                            }
                            : s
                    ));
                } else if (event.type === 'content') {
                    streamedContent += event.content;
                    // Update the content progressively
                    setSessions(prevSessions => prevSessions.map(s =>
                        s.id === targetSessionId
                            ? {
                                ...s,
                                messages: s.messages.map(m =>
                                    m.id === assistantMessageId
                                        ? { ...m, content: streamedContent }
                                        : m
                                ),
                                updatedAt: new Date().toISOString()
                            }
                            : s
                    ));
                } else if (event.type === 'error') {
                    throw new Error(event.error);
                }
            }
        } catch (error) {
            console.error('Failed to query RAG backend', error);
            setChatError('Failed to get answer. Please try again.');
            // Remove the failed assistant message
            setSessions(prevSessions => prevSessions.map(s =>
                s.id === targetSessionId
                    ? {
                        ...s,
                        messages: s.messages.filter(m => m.id !== assistantMessageId),
                        updatedAt: new Date().toISOString()
                    }
                    : s
            ));
        } finally {
            setChatLoading(false);
        }
    };

    const toggleBookmarkSelection = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    const buildNote = async () => {
        if (!selectedBookmarks.length) return;
        const draft = await composeNoteFromBookmarks(noteTitle, selectedBookmarks);
        setNote(draft);
    };

    const handleRefetchContent = async () => {
        if (!activeBookmarkId) return;

        setIsRefetchingContent(true);
        try {
            const { error } = await supabase.functions.invoke('process-bookmark', {
                body: { bookmark_id: activeBookmarkId }
            });

            if (error) throw error;

            // Refresh the detailed view
            const fullBookmark = await getBookmark(activeBookmarkId);
            setDetailedBookmark(fullBookmark);
        } catch (error) {
            console.error('Failed to refetch content:', error);
        } finally {
            setIsRefetchingContent(false);
        }
    };

    const exportNote = async () => {
        if (!note) return;
        setExporting(true);
        const exported = await exportNoteToGoogleDocs(note);
        setNote(exported);
        setExporting(false);
    };

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-bg-main">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin w-8 h-8 text-primary" />
                    <p className="text-text-secondary">{t('app.loading')}</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-bg-subtle">
                <div className="bg-bg-main border border-border rounded-2xl shadow-md p-10 max-w-[400px] w-full text-center">
                    <div className="mb-6">
                        <img src="/icons/icon-128.png" alt="HyperMemo" className="w-20 h-20 mx-auto" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2 text-text-primary">{t('app.signInTitle')}</h1>
                    <p className="text-text-secondary mb-8">{t('app.signInDesc')}</p>
                    <button
                        type="button"
                        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-bg-main border border-border rounded-lg text-text-primary font-medium hover:bg-bg-subtle hover:border-text-secondary transition-colors"
                        onClick={login}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24">
                            <title>Google</title>
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        {t('app.signInGoogle')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-screen">
            {/* Left Sidebar - Bookmarks/Notes */}
            <aside className="w-[400px] min-w-[400px] bg-bg-subtle border-r border-border flex flex-col shrink-0">
                <div className="p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <img src="/icons/icon-48.png" alt="HyperMemo" className="w-8 h-8" />
                        <h1 className="text-xl font-semibold tracking-tight">{t('app.name')}</h1>
                    </div>
                </div>

                {/* Sidebar Tabs */}
                <div className="flex border-b border-border">
                    <button
                        type="button"
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${sidebarTab === 'bookmarks' ? 'text-primary border-b-2 border-primary bg-bg-main' : 'text-text-secondary hover:text-text-primary hover:bg-bg-main'}`}
                        onClick={() => {
                            setSidebarTab('bookmarks');
                            setActiveNoteId(null);
                        }}
                    >
                        <BookmarkIcon className="w-4 h-4" />
                        <span>{t('sidebar.bookmarks')}</span>
                        <span className="text-xs bg-bg-active px-1.5 py-0.5 rounded-full">{filteredBookmarks.length}</span>
                    </button>
                    <button
                        type="button"
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${sidebarTab === 'notes' ? 'text-primary border-b-2 border-primary bg-bg-main' : 'text-text-secondary hover:text-text-primary hover:bg-bg-main'}`}
                        onClick={() => {
                            setSidebarTab('notes');
                            setActiveTab('notes');
                            setActiveBookmarkId(null);
                        }}
                    >
                        <FileText className="w-4 h-4" />
                        <span>{t('sidebar.notes')}</span>
                        <span className="text-xs bg-bg-active px-1.5 py-0.5 rounded-full">{notes.length}</span>
                    </button>
                </div>

                {/* Bookmarks List */}
                {sidebarTab === 'bookmarks' && (
                    <>
                        <div className="px-4 py-3 border-b border-border bg-bg-subtle">
                            <select
                                value={selectedTag || ''}
                                onChange={(e) => setSelectedTag(e.target.value || null)}
                                className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-bg-main text-text-primary outline-none focus:ring-2 focus:ring-primary"
                                disabled={loadingTags && availableTags.length === 0}
                            >
                                <option value="">{t('sidebar.allTags')}</option>
                                {availableTags.map(tag => (
                                    <option key={tag.id} value={tag.name}>
                                        {tag.bookmarkCount !== undefined ? `${tag.name} (${tag.bookmarkCount})` : tag.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                            {filteredBookmarks.map((bookmark) => {
                                const hostname = new URL(bookmark.url).hostname;
                                const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
                                return (
                                    <div
                                        key={bookmark.id}
                                        className={`flex gap-3 p-3 rounded-lg cursor-pointer border transition-all ${activeBookmarkId === bookmark.id ? 'bg-bg-main border-primary shadow-sm' : 'border-transparent hover:bg-bg-main hover:border-border'}`}
                                        onClick={() => handleBookmarkClick(bookmark.id)}
                                        // biome-ignore lint/a11y/useSemanticElements: Nested interactive elements require div
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                handleBookmarkClick(bookmark.id);
                                            }
                                        }}
                                    >
                                        <div className="w-5 h-5 rounded flex-shrink-0 mt-0.5 bg-bg-active flex items-center justify-center">
                                            <img
                                                src={faviconUrl}
                                                alt=""
                                                className="w-4 h-4 rounded-sm"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                                    if (fallback) fallback.style.display = 'block';
                                                }}
                                            />
                                            <Globe style={{ display: 'none' }} className="w-3 h-3 text-text-secondary" />
                                        </div>
                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            <h3 className="text-[0.9375rem] font-medium line-clamp-2 leading-snug mb-1">{bookmark.title || t('dashboard.untitled')}</h3>
                                            <p className="text-xs text-text-secondary truncate">{hostname}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* Notes List */}
                {sidebarTab === 'notes' && (
                    <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                        {notes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
                                <FileText className="w-10 h-10 opacity-50" />
                                <p className="mt-3 text-sm">{t('notes.emptyMessage')}</p>
                            </div>
                        ) : (
                            notes.map((noteItem) => (
                                <div
                                    key={noteItem.id}
                                    className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer border transition-all ${activeNoteId === noteItem.id ? 'bg-bg-main border-primary shadow-sm' : 'border-transparent hover:bg-bg-main hover:border-border'}`}
                                    onClick={() => {
                                        setActiveNoteId(noteItem.id);
                                        setActiveTab('notes');
                                        setActiveBookmarkId(null);
                                    }}
                                    // biome-ignore lint/a11y/useSemanticElements: Nested interactive elements require div
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            setActiveNoteId(noteItem.id);
                                            setActiveTab('notes');
                                        }
                                    }}
                                >
                                    <h3 className="text-sm font-medium truncate">{noteItem.title}</h3>
                                    <button
                                        type="button"
                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-error/10 hover:text-error transition-all"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteNote(noteItem.id);
                                        }}
                                        title={t('notes.deleteNote')}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden bg-bg-main">
                <header className="px-8 border-b border-border flex justify-between items-center bg-bg-main h-16 shrink-0">
                    <div className="flex gap-6 h-full">
                        <button
                            type="button"
                            className={`flex items-center px-1 text-[0.9375rem] font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'text-primary border-primary' : 'text-text-secondary border-transparent hover:text-text-primary'}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            {t('sidebar.bookmarks')}
                        </button>
                        <button
                            type="button"
                            className={`flex items-center px-1 text-[0.9375rem] font-medium border-b-2 transition-colors ${activeTab === 'chat' ? 'text-primary border-primary' : 'text-text-secondary border-transparent hover:text-text-primary'}`}
                            onClick={() => setActiveTab('chat')}
                        >
                            {t('sidebar.chat')}
                        </button>
                        <button
                            type="button"
                            className={`flex items-center gap-2 px-1 text-[0.9375rem] font-medium border-b-2 transition-colors ${activeTab === 'notes' ? 'text-primary border-primary' : 'text-text-secondary border-transparent hover:text-text-primary'}`}
                            onClick={() => {
                                setActiveTab('notes');
                                setSidebarTab('notes');
                                setActiveBookmarkId(null);
                            }}
                        >
                            {t('sidebar.notes')}
                            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Beta</span>
                        </button>
                    </div>
                    <div className="flex items-center">
                        {activeTab === 'chat' && (
                            <button
                                type="button"
                                className={`p-2 rounded-md transition-colors mr-2 ${isChatHistoryOpen ? 'text-primary bg-bg-active' : 'text-text-secondary hover:bg-bg-subtle'}`}
                                onClick={() => setIsChatHistoryOpen(!isChatHistoryOpen)}
                                title={isChatHistoryOpen ? "Collapse History" : "Open History"}
                            >
                                {isChatHistoryOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setSubscriptionDrawerOpen(true)}
                            className="bg-transparent border-none p-0 cursor-pointer"
                        >
                            <SubscriptionBadge subscription={subscription} />
                        </button>
                        <div className="relative" ref={profileMenuRef}>
                            <button
                                type="button"
                                className="w-9 h-9 rounded-full overflow-hidden border-2 border-border hover:border-primary transition-colors"
                                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                                title={user.email || 'Profile'}
                            >
                                {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                                    <img
                                        src={user.user_metadata.avatar_url || user.user_metadata.picture}
                                        alt={user.email || 'User'}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-primary text-white flex items-center justify-center text-sm font-medium">
                                        {user.email?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                )}
                            </button>
                            {isProfileMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-bg-main border border-border rounded-lg shadow-md z-50 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-border">
                                        <div className="text-sm font-medium text-text-primary truncate">{user.email}</div>
                                    </div>
                                    <button
                                        type="button"
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-bg-subtle transition-colors"
                                        onClick={() => {
                                            setIsProfileMenuOpen(false);
                                            logout();
                                        }}
                                    >
                                        <LogOut className="w-4 h-4" />
                                        {t('app.signOut')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 max-w-[1200px] w-full mx-auto">
                    {activeTab === 'overview' && (
                        activeBookmark ? (
                            <div className="max-w-[1000px] mx-auto">
                                <header className="mb-8 border-b border-border pb-6">
                                    <div className="flex justify-between items-start gap-4">
                                        <h1 className="text-3xl font-bold leading-tight tracking-tight">{activeBookmark.title}</h1>
                                        <div className="flex gap-2 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-primary bg-primary/10 hover:bg-primary/20"
                                                onClick={() => askAIAboutBookmark(activeBookmark)}
                                                title={t('dashboard.askAI')}
                                            >
                                                <Sparkles className="w-5 h-5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-error hover:bg-error/10"
                                                onClick={handleDelete}
                                                title={t('dashboard.deleteBookmark')}
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 mt-4 text-sm text-text-secondary">
                                        <a href={activeBookmark.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                                            <ExternalLink className="w-4 h-4" />
                                            {new URL(activeBookmark.url).hostname}
                                        </a>
                                        <span>•</span>
                                        <span>{new Date(activeBookmark.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </header>

                                {/* Tags Section */}
                                <div className="flex items-center gap-3 mb-6 flex-wrap">
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs uppercase tracking-wider font-semibold text-text-secondary">{t('popup.fieldTags')}</span>
                                        <button
                                            type="button"
                                            className="p-1 rounded text-text-secondary hover:text-primary hover:bg-bg-subtle transition-colors disabled:opacity-50"
                                            onClick={handleRegenerateTags}
                                            disabled={isRegeneratingTags}
                                            title={t('dashboard.autoTag')}
                                        >
                                            <RefreshCw className={`w-3 h-3 ${isRegeneratingTags ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>
                                    <TagInput
                                        value={activeBookmark.tags || []}
                                        onChange={handleUpdateTags}
                                        placeholder={t('dashboard.addTags')}
                                    />
                                </div>

                                {/* AI Summary Section */}
                                <section className="bg-bg-subtle border border-border rounded-xl p-6 mb-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-lg font-semibold">{t('dashboard.summary')}</h2>
                                        <button
                                            type="button"
                                            className="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-bg-main transition-colors disabled:opacity-50"
                                            onClick={handleRegenerateSummary}
                                            disabled={isRegeneratingSummary}
                                            title={t('dashboard.regenerate')}
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${isRegeneratingSummary ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>
                                    <div className="prose max-w-none text-text-primary">
                                        {isRegeneratingSummary ? (
                                            <div className="flex gap-1">
                                                <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        ) : (
                                            <ReactMarkdown>
                                                {detailedBookmark?.summary || activeBookmark.summary || t('dashboard.noContent')}
                                            </ReactMarkdown>
                                        )}
                                    </div>
                                </section>

                                {/* Original Content Section */}
                                <section className="mb-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-lg font-semibold">Original Content</h2>
                                        <button
                                            type="button"
                                            className="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-bg-subtle transition-colors disabled:opacity-50"
                                            onClick={handleRefetchContent}
                                            disabled={isRefetchingContent || !activeBookmark}
                                            title="Refetch content from URL"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${isRefetchingContent ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>
                                    <div className="bg-bg-subtle border border-border rounded-xl p-6">
                                        {loadingContent || isRefetchingContent ? (
                                            <div className="flex justify-center items-center py-8 text-text-secondary">
                                                <Loader2 className="animate-spin w-6 h-6" />
                                            </div>
                                        ) : (
                                            detailedBookmark?.rawContent ? (
                                                <div className="prose max-w-none text-text-primary">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />
                                                        }}
                                                    >
                                                        {detailedBookmark.rawContent}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                <div className="text-text-secondary italic">
                                                    {detailedBookmark ? 'No original content captured for this bookmark.' : 'Select a bookmark to view content.'}
                                                </div>
                                            )
                                        )}
                                    </div>
                                </section>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="flex flex-col items-center gap-6 opacity-80 max-w-[600px] w-full mx-auto">
                                    <img src="/icons/icon-128.png" alt="HyperMemo" className="w-20 h-20" />
                                    <div className="text-center">
                                        <h1 className="text-3xl font-bold tracking-tight mb-2">{t('app.name')}</h1>
                                        <p className="text-lg text-text-secondary">{t('app.slogan')}</p>
                                    </div>

                                    <div className="w-full relative">
                                        <ChatInput
                                            value={question}
                                            onChange={handleChatInputChange}
                                            onSend={handleLandingPageSearch}
                                            onKeyDown={(e) => handleKeyDown(e, handleLandingPageSearch)}
                                            placeholder={t('dashboard.searchPlaceholder')}
                                            tags={chatTags}
                                            onRemoveTag={handleRemoveChatTag}
                                            bookmarks={chatBookmarks}
                                            onRemoveBookmark={(id) => setChatBookmarks(chatBookmarks.filter(b => b.id !== id))}
                                            showTagSuggestions={showTagSuggestions}
                                            filteredTags={filteredTags}
                                            selectedTagIndex={selectedIndex}
                                            onTagSelect={handleTagSelect}
                                            onTagHover={setSelectedIndex}
                                            suggestionPlacement="bottom"
                                        />
                                    </div>

                                    <p className="text-sm text-text-secondary">{t('dashboard.selectBookmark')}</p>
                                </div>
                            </div>
                        )
                    )}

                    {activeTab === 'chat' && (
                        <div className="flex flex-col h-full w-full px-4">
                            <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-6 scroll-smooth">
                                {messages.map((message, index) => (
                                    <div key={message.id} className={`flex gap-3 max-w-[90%] animate-fade-in mb-4 ${message.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${message.role === 'user' ? 'bg-primary' : 'bg-bg-active'}`}>
                                            {message.role === 'user' ? (
                                                user?.user_metadata?.avatar_url ? (
                                                    <img src={user.user_metadata.avatar_url} alt="You" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-white text-sm font-medium">{user?.email?.charAt(0).toUpperCase() || 'U'}</div>
                                                )
                                            ) : (
                                                <div className="text-primary">
                                                    <Sparkles className="w-5 h-5" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <div className={`px-4 py-3 rounded-2xl text-base ${message.role === 'user' ? 'bg-primary text-white rounded-tr-sm' : 'bg-bg-subtle rounded-tl-sm'}`}>
                                                {message.content ? (
                                                    <MessageContent content={message.content} citations={message.citations} />
                                                ) : message.role === 'assistant' ? (
                                                    <div className="flex gap-1">
                                                        <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </div>
                                                ) : null}
                                            </div>
                                            {message.role === 'assistant' && (
                                                <div className="flex gap-2 mt-2 opacity-0 hover:opacity-100 transition-opacity">
                                                    <button
                                                        type="button"
                                                        className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-subtle rounded transition-colors"
                                                        onClick={() => handleCopyMessage(message.id, message.content)}
                                                        title="Copy response"
                                                    >
                                                        {copiedMessageId === message.id ? (
                                                            <>
                                                                <Check className="w-3.5 h-3.5" />
                                                                <span>Copied!</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy className="w-3.5 h-3.5" />
                                                                <span>Copy</span>
                                                            </>
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-subtle rounded transition-colors disabled:opacity-50"
                                                        onClick={() => handleRegenerateResponse(index)}
                                                        disabled={regeneratingMessageId === message.id}
                                                        title="Regenerate response"
                                                    >
                                                        <RefreshCw className={`w-3.5 h-3.5 ${regeneratingMessageId === message.id ? 'animate-spin' : ''}`} />
                                                        <span>{regeneratingMessageId === message.id ? 'Regenerating...' : 'Regenerate'}</span>
                                                    </button>
                                                </div>
                                            )}
                                            {/* Only show citations after streaming is complete */}
                                            {message.citations && message.citations.length > 0 && !chatLoading && (
                                                <div className="mt-3 pt-3 border-t border-border">
                                                    <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{t('chat.sources')}</span>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {message.citations.map((citation) => (
                                                            <a
                                                                key={citation.bookmark.id}
                                                                href={citation.bookmark.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center px-2.5 py-1 text-xs bg-bg-active hover:bg-primary/10 text-text-primary hover:text-primary rounded-full transition-colors truncate max-w-[200px]"
                                                                title={citation.bookmark.title}
                                                            >
                                                                <span className="truncate">{citation.bookmark.title || t('dashboard.untitled')}</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {!messages.length && (
                                    <div className="flex flex-col items-center justify-center h-full text-center text-text-secondary">
                                        <div className="text-6xl mb-6">👋</div>
                                        <h3 className="text-2xl font-semibold mb-3 text-text-primary">{t('chat.welcomeTitle')}</h3>
                                        <p className="text-lg">{t('chat.welcomeSubtitle')}</p>
                                    </div>
                                )}
                            </div>
                            {/* Save as Note button */}
                            {messages.length > 0 && (
                                <div className="flex justify-start py-2">
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary bg-bg-subtle hover:bg-bg-active rounded-lg transition-colors disabled:opacity-50"
                                        onClick={handleSaveAsNote}
                                        disabled={savingNote || chatLoading}
                                    >
                                        <Save className="w-4 h-4" />
                                        {savingNote ? t('notes.saving') : t('notes.saveAsNote')}
                                    </button>
                                </div>
                            )}
                            <ChatInput
                                value={question}
                                onChange={handleChatInputChange}
                                onSend={() => askAssistant()}
                                onKeyDown={(e) => handleKeyDown(e, () => askAssistant())}
                                loading={chatLoading}
                                tags={chatTags}
                                onRemoveTag={handleRemoveChatTag}
                                bookmarks={chatBookmarks}
                                onRemoveBookmark={(id) => setChatBookmarks(chatBookmarks.filter(b => b.id !== id))}
                                showTagSuggestions={showTagSuggestions}
                                filteredTags={filteredTags}
                                selectedTagIndex={selectedIndex}
                                onTagSelect={handleTagSelect}
                                onTagHover={setSelectedIndex}
                                inputRef={chatInputRef}
                                suggestionPlacement="top"
                            />
                            {chatError && <p className="text-sm text-error mt-2">{chatError}</p>}
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div className="h-full">
                            {activeNote ? (
                                <div className="max-w-[1000px] mx-auto">
                                    <header className="mb-8 border-b border-border pb-6">
                                        <div className="flex justify-between items-start gap-4">
                                            <h1 className="text-3xl font-bold leading-tight tracking-tight">{activeNote.title}</h1>
                                            <div className="flex gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    className="p-2 rounded-lg text-error hover:bg-error/10 transition-colors"
                                                    onClick={() => handleDeleteNote(activeNote.id)}
                                                    title={t('notes.deleteNote')}
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 mt-4 text-sm text-text-secondary">
                                            {activeNote.sourceType === 'chat' && activeNote.chatSessionId ? (
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors"
                                                    onClick={() => {
                                                        if (activeNote.chatSessionId && sessions.find(s => s.id === activeNote.chatSessionId)) {
                                                            setActiveSessionId(activeNote.chatSessionId);
                                                            setActiveTab('chat');
                                                            setSidebarTab('bookmarks');
                                                            setActiveNoteId(null);
                                                        }
                                                    }}
                                                    title={t('notes.goToChat')}
                                                >
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                    {t('notes.fromChat')}
                                                </button>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-bg-subtle text-text-secondary rounded-full">
                                                    <BookmarkIcon className="w-3.5 h-3.5" />
                                                    {t('notes.fromBookmarks')}
                                                </span>
                                            )}
                                            <span>•</span>
                                            <span>{new Date(activeNote.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </header>

                                    <section className="bg-bg-subtle border border-border rounded-xl p-6">
                                        <div className="prose max-w-none text-text-primary">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />
                                                }}
                                            >
                                                {activeNote.body.replace(/^#\s+.+\n+/, '')}
                                            </ReactMarkdown>
                                        </div>
                                    </section>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <div className="flex flex-col items-center gap-6 opacity-80">
                                        <FileText className="w-16 h-16 opacity-40 text-text-secondary" />
                                        <div className="text-center">
                                            <h2 className="text-2xl font-semibold mb-2 text-text-primary">{t('notes.empty')}</h2>
                                            <p className="text-base text-text-secondary">{t('notes.emptyMessage')}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </main >

            {/* Right Sidebar - Chat History (Only in Chat Tab) */}
            {
                activeTab === 'chat' && isChatHistoryOpen && (
                    <aside className="w-[320px] min-w-[320px] bg-bg-subtle border-l border-border flex flex-col shrink-0">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                            <h2 className="text-sm font-semibold text-text-primary">{t('sidebar.chats')}</h2>
                            <button
                                type="button"
                                className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:text-primary hover:bg-bg-main transition-colors"
                                onClick={() => createNewSession()}
                                title={t('sidebar.newChat')}
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                            {sessions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
                                    <MessageSquare className="w-10 h-10 opacity-50" />
                                    <p className="mt-3 text-sm">No conversations yet</p>
                                </div>
                            ) : (
                                sessions.map((session) => (
                                    <div
                                        key={session.id}
                                        className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${activeSessionId === session.id ? 'bg-bg-main border-primary shadow-sm' : 'border-transparent hover:bg-bg-main hover:border-border'}`}
                                        onClick={() => setActiveSessionId(session.id)}
                                        // biome-ignore lint/a11y/useSemanticElements: Nested interactive elements require div
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                setActiveSessionId(session.id);
                                            }
                                        }}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-bg-active flex items-center justify-center shrink-0 text-text-secondary">
                                            <MessageSquare className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            <span className="block text-sm font-medium truncate">{session.title || 'New Chat'}</span>
                                            <span className="block text-xs text-text-secondary mt-0.5 truncate">
                                                {session.messages.length} messages · {new Date(session.updatedAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-error/10 hover:text-error transition-all text-text-secondary"
                                            onClick={(e) => deleteSession(e, session.id)}
                                            title={t('sidebar.deleteChat')}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </aside>
                )
            }

            <Drawer
                isOpen={subscriptionDrawerOpen}
                onClose={() => setSubscriptionDrawerOpen(false)}
                title={t('subscription.title')}
            >
                <SubscriptionManager />
            </Drawer>

            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={closeConfirm}
                onConfirm={modalConfig.onConfirm}
                title={modalConfig.title}
                message={modalConfig.message}
                isDangerous={modalConfig.isDangerous}
            />
        </div >
    );
}
