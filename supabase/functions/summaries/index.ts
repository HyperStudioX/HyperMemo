import { handleCors } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/response.ts';
import { requireUserId } from '../_shared/supabaseClient.ts';
import { readJson } from '../_shared/request.ts';
import { generateContent, parseTags } from '../_shared/ai.ts';
import { summarizePrompt, tagsPrompt } from '../_shared/prompts.ts';

type SummaryPayload = {
    title?: string;
    content?: string;
    url?: string;
};

/**
 * Generate tags for content using AI
 */
async function handleTagsGeneration(payload: SummaryPayload): Promise<Response> {
    const title = payload.title ?? '';
    const content = payload.content ?? '';

    if (!title && !content) {
        return jsonResponse(400, { error: 'Title or content is required' });
    }

    const prompt = tagsPrompt(title, content);
    const text = await generateContent(prompt);
    const tags = parseTags(text);

    return jsonResponse(200, { tags });
}

/**
 * Generate summary for content using AI
 */
async function handleSummaryGeneration(payload: SummaryPayload): Promise<Response> {
    const title = payload.title ?? '';
    const content = payload.content ?? '';
    const url = payload.url ?? '';

    if (!title && !content) {
        return jsonResponse(400, { error: 'Title or content is required' });
    }

    const prompt = summarizePrompt(title, content, url);
    const summary = await generateContent(prompt);

    return jsonResponse(200, { summary });
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

    try {
        await requireUserId(req);
    } catch (error) {
        return jsonResponse(401, { error: error instanceof Error ? error.message : String(error) });
    }

    try {
        const url = new URL(req.url);
        const isTagsRoute = url.pathname.endsWith('/tags');
        const body = (await readJson<SummaryPayload>(req)) ?? {};

        if (isTagsRoute) {
            return await handleTagsGeneration(body);
        }

        return await handleSummaryGeneration(body);
    } catch (error) {
        console.error('summaries function failed', error);
        return jsonResponse(500, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
