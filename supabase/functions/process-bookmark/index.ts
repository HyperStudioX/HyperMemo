import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { computeEmbedding, ensureSummary, ensureTags } from '../_shared/ai.ts';
import { normalizeTagResult } from '../_shared/tagUtils.ts';

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

serve(async (req) => {
    try {
        const authHeader = req.headers.get('x-webhook-secret');
        if (authHeader !== 'hypermemo-webhook-secret') {
            return new Response("Unauthorized", { status: 401 });
        }

        const payload: WebhookPayload = await req.json();
        const { record } = payload;

        if (!record || !record.id) {
            return new Response("No record found", { status: 400 });
        }

        console.log(`Processing bookmark: ${record.id}`);

        const { id, user_id, title, url, raw_content, summary: initialSummary } = record;
        const rawContent = raw_content ?? '';
        const currentSummary = initialSummary ?? '';

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
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

    } catch (error) {
        console.error("Error processing bookmark:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});
