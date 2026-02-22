import { google } from 'googleapis';
import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';
import { createOAuth2Client } from '$lib/server/google';

export const handle: Handle = async ({ event, resolve }) => {
    const tokensCookie = event.cookies.get('google_tokens');

    if (tokensCookie) {
        try {
            const tokens = JSON.parse(tokensCookie);
            const authClient = createOAuth2Client();
            authClient.setCredentials(tokens);

            // Inyectar el cliente de drive autenticado en los `locals` de la petición
            // @ts-ignore (We will fix types in app.d.ts)
            event.locals.drive = google.drive({ version: 'v3', auth: authClient });
            event.locals.userAuthenticated = true;
        } catch (e) {
            console.error("Error parsing google_tokens", e);
            event.cookies.delete('google_tokens', { path: '/' });
            event.locals.userAuthenticated = false;
        }
    } else {
        event.locals.userAuthenticated = false;
    }

    return resolve(event);
};
