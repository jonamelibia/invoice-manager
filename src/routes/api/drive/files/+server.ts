import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getOrCreateDeepFolder, getFilesInFolder } from '$lib/server/drive';

export async function GET({ url, locals }: RequestEvent) {
    if (!locals.userAuthenticated || !locals.drive) {
        throw error(401, 'Unauthorized');
    }

    // Support both old API (year/month/type) and new API (folderId)
    const folderId = url.searchParams.get('folderId');
    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');
    const type = url.searchParams.get('type') as 'facturas_emitidas' | 'facturas_recibidas' | null;

    try {
        let targetFolderId: string;

        if (folderId) {
            // New API: direct folder ID
            targetFolderId = folderId;
        } else if (year && month && type) {
            // Legacy API: build path
            targetFolderId = await getOrCreateDeepFolder(locals.drive, year, month, type);
        } else {
            throw error(400, 'Missing required parameters: folderId or (year, month, type)');
        }

        // Get files in the folder
        const files = await getFilesInFolder(locals.drive, targetFolderId);

        return json({
            folderId: targetFolderId,
            files
        });
    } catch (e: any) {
        console.error("Error fetching files from Drive API:", e);
        if (e.status) throw e; // Re-throw SvelteKit errors
        throw error(500, `Failed to fetch files from Google Drive: ${e.message}`);
    }
}