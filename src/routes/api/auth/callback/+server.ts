import { createOAuth2Client } from '$lib/server/google';
import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export async function GET({ url, cookies }: RequestEvent) {
    const code = url.searchParams.get('code');

    if (code) {
        const oauth2Client = createOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);

        // Guardar los tokens (access + refresh) en una cookie persistente y segura
        cookies.set('google_tokens', JSON.stringify(tokens), {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30 // 30 días
        });
    }

    throw redirect(302, '/');
}
