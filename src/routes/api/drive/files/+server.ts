import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getOrCreateDeepFolder, getFilesInFolder } from '$lib/server/drive';

export async function GET({ url, locals }: RequestEvent) {
    if (!locals.userAuthenticated || !locals.drive) {
        throw error(401, 'Unauthorized');
    }

    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');
    const type = url.searchParams.get('type') as 'facturas_emitidas' | 'facturas_recibidas';

    if (!year || !month || !type) {
        throw error(400, 'Missing required parameters: year, month, type');
    }

    try {
        // Encontraremos o crearemos la ruta facturas > año > mes > tipo
        const folderId = await getOrCreateDeepFolder(locals.drive, year, month, type);

        // Obtenemos los archivos dentro de esa ruta
        const files = await getFilesInFolder(locals.drive, folderId);

        return json({
            folderId,
            files
        });
    } catch (e: any) {
        console.error("Error fetching files from Drive API:", e);
        throw error(500, `Failed to fetch files from Google Drive: ${e.message}`);
    }
}
