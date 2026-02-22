import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export async function PUT({ params, request, locals }: RequestEvent) {
    if (!locals.userAuthenticated || !locals.drive) {
        throw error(401, 'Unauthorized');
    }

    const fileId = params.id;
    if (!fileId) throw error(400, 'Falta el ID del archivo');

    try {
        const body = await request.json();
        const newName = body.name;

        if (!newName) throw error(400, 'Falta el nuevo nombre');

        const response = await locals.drive.files.update({
            fileId: fileId,
            requestBody: { name: newName },
            fields: 'id, name, mimeType, webViewLink, thumbnailLink, createdTime'
        });

        return json(response.data);
    } catch (e: any) {
        console.error("Error al renombrar archivo:", e);
        throw error(500, `Error al renombrar: ${e.message}`);
    }
}

export async function DELETE({ params, locals }: RequestEvent) {
    if (!locals.userAuthenticated || !locals.drive) {
        throw error(401, 'Unauthorized');
    }

    const fileId = params.id;
    if (!fileId) throw error(400, 'Falta el ID del archivo');

    try {
        await locals.drive.files.update({
            fileId: fileId,
            requestBody: { trashed: true }
        });

        return json({ success: true });
    } catch (e: any) {
        console.error("Error al eliminar archivo:", e);
        throw error(500, `Error al eliminar: ${e.message}`);
    }
}
