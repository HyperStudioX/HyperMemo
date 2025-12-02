import { handleCors } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/response.ts';
import { requireUserId, supabaseAdmin } from '../_shared/supabaseClient.ts';
import { readJson } from '../_shared/request.ts';
import { embedText, generateContent } from '../_shared/ai.ts';
import { ragPrompt } from '../_shared/prompts.ts';

type RagPayload = {
    question?: string;
    tags?: string[];
};

type RpcMatch = {
    id: string;
    user_id: string;
    title: string;
    url: string;
    summary: string;
    raw_content: string;
    tags: string[];
    created_at: string;
    updated_at: string;
    similarity: number;
};

type RagMatch = {
    bookmark: {
        id: string;
        title: string;
        url: string;
        summary: string;
        tags: string[];
    };
    score: number;
};

/**
 * Build formatted sources text from matches for the RAG prompt
 */
function buildSourcesText(matches: RagMatch[]): string {
    return matches
        .map((match, index) => `[S${index + 1}] ${match.bookmark.title} — ${match.bookmark.summary}`)
        .join('\n');
}

/**
 * Resolve tag names to IDs
 */
async function resolveTagIds(userId: string, tagNames: string[]): Promise<string[]> {
    if (tagNames.length === 0) {
        return [];
    }

    const { data, error } = await supabaseAdmin
        .from('tags')
        .select('id')
        .eq('user_id', userId)
        .in('name', tagNames);

    if (error) {
        throw new Error(error.message);
    }

    return data?.map(t => t.id) || [];
}

/**
 * Search bookmarks using pgvector RPC
 */
async function searchBookmarks(
    userId: string,
    queryEmbedding: number[],
    tagIds: string[]
): Promise<RpcMatch[]> {
    const { data, error } = await supabaseAdmin.rpc('match_bookmarks', {
        query_embedding: queryEmbedding,
        match_threshold: 0.1, // Low threshold to get enough candidates for re-ranking
        match_count: 50,      // Fetch top 50 to allow for re-ranking
        filter_user_id: userId,
        filter_tag_ids: tagIds.length > 0 ? tagIds : null
    });

    if (error) {
        throw new Error(error.message);
    }

    return (data || []) as RpcMatch[];
}

/**
 * Calculate hybrid score and rank bookmarks
 */
function rankBookmarks(
    matches: RpcMatch[],
    requestTags: string[],
    topK = 5
): RagMatch[] {
    return matches
        .map((match) => {
            // Calculate tag boost
            let tagBoost = 0;
            if (requestTags.length > 0) {
                // Count how many request tags are present in the bookmark's tags
                // Note: match.tags are tag names from the RPC
                const matchCount = match.tags.filter(t => requestTags.includes(t)).length;
                tagBoost = (matchCount / requestTags.length) * 0.2;
            }

            const finalScore = match.similarity + tagBoost;

            return {
                bookmark: {
                    id: match.id,
                    title: match.title,
                    url: match.url,
                    summary: match.summary,
                    tags: match.tags
                },
                score: finalScore
            };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
}

/**
 * Main RAG query handler
 */
async function handleRagQuery(userId: string, question: string, tags: string[]): Promise<Response> {
    // Embed the question
    const queryEmbedding = await embedText(question);
    if (!queryEmbedding.length) {
        return jsonResponse(400, { error: 'Unable to embed the question' });
    }

    // Resolve tag IDs if tags provided
    const tagIds = await resolveTagIds(userId, tags);

    // If tags were provided but none found in DB, and we want strict filtering?
    // The previous logic was: if tags provided, we MUST match them.
    // If resolveTagIds returns empty but tags were provided, it means the tags don't exist.
    // In that case, searchBookmarks with empty tagIds (null) would return ALL bookmarks, which is wrong.
    // We should return early if tags were requested but none found.
    if (tags.length > 0 && tagIds.length === 0) {
        return jsonResponse(200, {
            answer: 'No bookmarks found with the selected tags.',
            matches: []
        });
    }

    // Search bookmarks using RPC
    const searchResults = await searchBookmarks(userId, queryEmbedding, tagIds);

    if (searchResults.length === 0) {
        return jsonResponse(200, {
            answer: 'No matching bookmarks yet.',
            matches: []
        });
    }

    // Rank bookmarks (apply hybrid scoring)
    const matches = rankBookmarks(searchResults, tags);

    // Generate answer using RAG
    const prompt = ragPrompt(question, buildSourcesText(matches));
    const answer = matches.length ? await generateContent(prompt) : 'No matching bookmarks yet.';

    return jsonResponse(200, { answer, matches });
}

/**
 * Deno serve entry point
 */
Deno.serve(async (req: Request): Promise<Response> => {
    const cors = handleCors(req);
    if (cors) {
        return cors;
    }

    if (req.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    let userId: string;
    try {
        userId = await requireUserId(req);
    } catch (error) {
        return jsonResponse(401, { error: error instanceof Error ? error.message : String(error) });
    }

    try {
        const body = (await readJson<RagPayload>(req)) ?? {};
        const question = (body.question ?? '').trim();
        const tags = body.tags ?? [];

        if (question.length < 3) {
            return jsonResponse(400, { error: 'Question is too short' });
        }

        return await handleRagQuery(userId, question, tags);
    } catch (error) {
        console.error('rag-query function failed', error);
        return jsonResponse(500, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
