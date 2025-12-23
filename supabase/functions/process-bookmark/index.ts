import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { computeEmbedding, ensureSummary, ensureTags } from '../_shared/ai.ts';
import { normalizeTagResult } from '../_shared/tagUtils.ts';
import { DOMParser } from "deno-dom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

type BookmarkRecord = {
    id: string;
    user_id: string;
    title: string;
    url: string;
    summary: string | null;
    raw_content: string | null;
    embedding: string | null; // pgvector returns string or array
};

type WebhookPayload = {
    type: 'INSERT';
    table: 'bookmarks';
    record: BookmarkRecord;
    schema: 'public';
    old_record: null;
};

async function getOrCreateTag(userId: string, tagName: string): Promise<string> {
    const { data: existingTag } = await supabaseAdmin
        .from('tags')
        .select('id')
        .eq('user_id', userId)
        .eq('name', tagName)
        .single();

    if (existingTag) {
        return existingTag.id;
    }

    const { data: newTag, error } = await supabaseAdmin
        .from('tags')
        .insert({ user_id: userId, name: tagName })
        .select('id')
        .single();

    if (error || !newTag) {
        throw new Error(`Failed to create tag: ${error?.message}`);
    }

    return newTag.id;
}

type BookmarkTagAssociation = {
    tag_id: string;
    tags?: Array<{ name: string }> | { name: string } | null;
};

async function syncBookmarkTags(bookmarkId: string, userId: string, tagNames: string[]): Promise<void> {
    // Get current tag associations
    const { data: currentAssociations } = await supabaseAdmin
        .from('bookmark_tags')
        .select('tag_id, tags!inner(name)')
        .eq('bookmark_id', bookmarkId);

    const currentTagNames = new Set(
        (currentAssociations || [])
            .map((assoc: { tags: { name: string } | { name: string }[] | null }) => normalizeTagResult(assoc.tags)[0]?.name)
            .filter((name: unknown): name is string => Boolean(name))
    );
    // const newTagNames = new Set(tagNames);

    // Find tags to add (we only add new AI tags, we don't remove existing ones here to be safe)
    const tagsToAdd = tagNames.filter(name => !currentTagNames.has(name));

    // Add new associations
    for (const tagName of tagsToAdd) {
        const tagId = await getOrCreateTag(userId, tagName);
        await supabaseAdmin
            .from('bookmark_tags')
            .insert({ bookmark_id: bookmarkId, tag_id: tagId });
    }
}

async function fetchCurrentTags(bookmarkId: string): Promise<string[]> {
    const { data: currentAssociations } = await supabaseAdmin
        .from('bookmark_tags')
        .select('tags!inner(name)')
        .eq('bookmark_id', bookmarkId);

    return (currentAssociations || [])
        .map((assoc: { tags: { name: string } | { name: string }[] | null }) => normalizeTagResult(assoc.tags)[0]?.name)
        .filter((name: unknown): name is string => Boolean(name));
}

function cleanMarkdownContent(markdown: string, baseUrl: string): string {
    // Parse base URL for resolving relative links
    let origin = '';
    try {
        const urlObj = new URL(baseUrl);
        origin = urlObj.origin;
    } catch {
        // If URL parsing fails, just use empty origin
    }

    let cleaned = markdown;

    // Fix relative links: [text](/path) -> [text](https://domain.com/path)
    cleaned = cleaned.replace(/\]\(\/([^)]+)\)/g, `](${origin}/$1)`);

    // Remove orphaned link patterns like "](/path)" without preceding text
    cleaned = cleaned.replace(/\]\([^)]*\)(?!\])/g, '');

    // Remove empty links: [](url) or []()
    cleaned = cleaned.replace(/\[\]\([^)]*\)/g, '');

    // Remove broken image references
    cleaned = cleaned.replace(/!\[\]\([^)]*\)/g, '');

    // Clean up multiple consecutive newlines (more than 2)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Remove lines that are just numbers (like engagement counts: "60", "437", "2K")
    cleaned = cleaned.replace(/^[\d,.]+[KMB]?$/gm, '');

    // Remove lines that look like social media metrics (e.g., "774K775K")
    cleaned = cleaned.replace(/^[\d,.]+[KMB]?[\d,.]+[KMB]?$/gm, '');

    // Clean up resulting empty lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
}

async function fetchAndCleanContent(url: string): Promise<string | null> {
    try {
        console.log(`Fetching content from ${url}...`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; HyperMemoBot/1.0; +http://hypermemo.app)'
            }
        });

        if (!response.ok) {
            console.warn(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
            return null;
        }

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        if (!doc) {
            console.warn("Failed to parse HTML");
            return null;
        }

        const reader = new Readability(doc);
        const article = reader.parse();

        if (!article || !article.content) {
            console.warn("Readability failed to extract content");
            return null;
        }

        const turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced'
        });

        const rawMarkdown = turndownService.turndown(article.content);

        // Clean up the markdown content
        return cleanMarkdownContent(rawMarkdown, url);

    } catch (error) {
        console.error(`Error fetching/cleaning content for ${url}:`, error);
        return null;
    }
}

async function processBookmarkRecord(record: BookmarkRecord) {
    console.log(`Processing bookmark: ${record.id}`);

    const { id, user_id, title, url, raw_content, summary: initialSummary } = record;
    let rawContent = raw_content ?? '';
    const currentSummary = initialSummary ?? '';

    // 0. Fetch and clean content if URL is present
    if (url) {
        const cleanedContent = await fetchAndCleanContent(url);
        if (cleanedContent) {
            console.log("Successfully fetched and cleaned content from URL");
            rawContent = cleanedContent;
        } else {
            console.log("Falling back to provided raw_content");
        }
    }

    // 1. Fetch current tags (user might have added some)
    const currentTags = await fetchCurrentTags(id);

    // 2. Generate AI content
    console.log(`Generating summary and tags for ${id}...`);
    const generatedSummary = await ensureSummary(title, rawContent, url, currentSummary);
    const generatedTags = await ensureTags(title, rawContent, currentTags);

    // 3. Compute Embedding
    console.log(`Computing embedding for ${id}...`);
    const embedding = await computeEmbedding([title, generatedSummary, rawContent]);

    // 4. Update Bookmark Record
    const { error: updateError } = await supabaseAdmin
        .from('bookmarks')
        .update({
            summary: generatedSummary,
            raw_content: rawContent,
            embedding: embedding
        })
        .eq('id', id);

    if (updateError) {
        console.error('Failed to update bookmark:', updateError);
        throw updateError;
    }

    // 5. Sync Tags (Add new ones)
    if (generatedTags.length > 0) {
        await syncBookmarkTags(id, user_id, generatedTags);
    }

    console.log(`Successfully processed bookmark ${id}`);
}

serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
            },
        });
    }

    try {
        // 1. Check for Webhook
        const webhookSecret = req.headers.get('x-webhook-secret');
        if (webhookSecret === 'hypermemo-webhook-secret') {
            const payload: WebhookPayload = await req.json();
            const { record } = payload;
            if (!record || !record.id) {
                return new Response("No record found", { status: 400 });
            }
            await processBookmarkRecord(record);
            return new Response(JSON.stringify({ success: true }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // 2. Check for User Request (Authorization header)
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
            // Verify user
            const supabaseClient = createClient(
                supabaseUrl,
                Deno.env.get('SUPABASE_ANON_KEY') ?? '',
                { global: { headers: { Authorization: authHeader } } }
            );
            const { data: { user }, error } = await supabaseClient.auth.getUser();

            if (error || !user) {
                return new Response("Unauthorized", { status: 401, headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' } });
            }

            const { bookmark_id } = await req.json();
            if (!bookmark_id) {
                return new Response("Missing bookmark_id", { status: 400, headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' } });
            }

            // Fetch record
            const { data: record, error: fetchError } = await supabaseAdmin
                .from('bookmarks')
                .select('*')
                .eq('id', bookmark_id)
                .single();

            if (fetchError || !record) {
                return new Response("Bookmark not found", { status: 404, headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' } });
            }

            // Verify ownership
            if (record.user_id !== user.id) {
                return new Response("Forbidden", { status: 403, headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' } });
            }

            await processBookmarkRecord(record);
            return new Response(JSON.stringify({ success: true }), {
                headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }
            });
        }

        return new Response("Unauthorized", { status: 401 });

    } catch (error) {
        console.error("Error processing bookmark:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }
        });
    }
});
