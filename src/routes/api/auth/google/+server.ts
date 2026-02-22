import { createOAuth2Client } from '$lib/server/google';
import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export async function GET(event: RequestEvent) {
    const oauth2Client = createOAuth2Client();

    // The 'drive' scope allows full access to all Drive files.
    // It is required if the user wants to upload invoices to folders that were NOT created by this app.
    const scopes = [
        'https://www.googleapis.com/auth/drive'
    ];

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Demanda explícita del token de actualización (refresh token)
        scope: scopes,
        prompt: 'consent' // Fuerza a que siempre se muestre la pantalla de consentimiento para obtener el refresh token
    });

    throw redirect(302, url);
}
