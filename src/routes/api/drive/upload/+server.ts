import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { Readable } from 'stream';

export async function POST({ request, locals }: RequestEvent) {
    if (!locals.userAuthenticated || !locals.drive) {
        throw error(401, 'Unauthorized');
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const targetFolderId = formData.get('folderId') as string;

        if (!file || !targetFolderId) {
            throw error(400, 'File and folderId are required');
        }

        // Convert Svelte Request File to ArrayBuffer then Buffer for Googleapis
        const buffer = Buffer.from(await file.arrayBuffer());

        const requestBody = {
            name: file.name,
            parents: [targetFolderId],
        };

        const media = {
            mimeType: file.type,
            body: Readable.from(buffer),
        };

        // Usa google.drive en vez de fetch para subir para gestionar auth
        // IMPORTANTE: En API Route edge mode a veces Readable no va. Ojo con NodeJS vs Edge.
        const response = await locals.drive.files.create({
            requestBody,
            media,
            fields: 'id, name, webViewLink'
        });

        return json({
            success: true,
            file: response.data
        });
    } catch (e: any) {
        console.error("Error al subir archivo a Drive", e);
        throw error(500, `Failed to upload file to Google Drive: ${e.message}`);
    }
}
