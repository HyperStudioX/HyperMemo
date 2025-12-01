import type { FC, KeyboardEvent, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import './ChatInput.css';

interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
    loading?: boolean;
    disabled?: boolean;
    placeholder?: string;
    tags?: string[];
    onRemoveTag?: (tag: string) => void;
    showTagSuggestions?: boolean;
    filteredTags?: string[];
    selectedTagIndex?: number;
    onTagSelect?: (tag: string) => void;
    onTagHover?: (index: number) => void;
    inputRef?: React.RefObject<HTMLTextAreaElement>;
    suggestionPlacement?: 'top' | 'bottom';
}

export const ChatInput: FC<ChatInputProps> = ({
    value,
    onChange,
    onSend,
    onKeyDown,
    loading = false,
    disabled = false,
    placeholder,
    tags = [],
    onRemoveTag,
    showTagSuggestions = false,
    filteredTags = [],
    selectedTagIndex = -1,
    onTagSelect,
    onTagHover,
    inputRef,
    suggestionPlacement = 'top'
}) => {
    const { t } = useTranslation();

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
        // Auto-resize textarea
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };

    return (
        <div className="chat-input-container" style={{ position: 'relative' }}>
            {tags.length > 0 && (
                <div className="chat-tags">
                    {tags.map(tag => (
                        <span key={tag} className="chat-tag">
                            @{tag}
                            {onRemoveTag && (
                                <button
                                    type="button"
                                    onClick={() => onRemoveTag(tag)}
                                    className="chat-tag-remove"
                                    aria-label={`Remove ${tag}`}
                                >
                                    ×
                                </button>
                            )}
                        </span>
                    ))}
                </div>
            )}

            {showTagSuggestions && (
                <div className={`tag-suggestions placement-${suggestionPlacement}`}>
                    {filteredTags.length > 0 ? (
                        filteredTags.map((tag, index) => (
                            <button
                                type="button"
                                key={tag}
                                onClick={() => onTagSelect?.(tag)}
                                className={`tag-suggestion ${index === selectedTagIndex ? 'active' : ''}`}
                                onMouseEnter={() => onTagHover?.(index)}
                            >
                                {tag}
                            </button>
                        ))
                    ) : (
                        <div className="tag-suggestion-empty">
                            No tags found
                        </div>
                    )}
                </div>
            )}

            <div className="chat-input-wrapper">
                <div className="chat-input-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <title>Search</title>
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                </div>
                <textarea
                    ref={inputRef}
                    value={value}
                    onChange={handleChange}
                    placeholder={placeholder || t('chat.placeholder')}
                    onKeyDown={onKeyDown}
                    className="chat-textarea"
                    rows={1}
                    disabled={disabled}
                />
                <button
                    type="button"
                    onClick={onSend}
                    disabled={loading || !value.trim() || disabled}
                    className="chat-send-button"
                >
                    {loading ? (
                        <div className="spinner" />
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <title>Send</title>
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
};
