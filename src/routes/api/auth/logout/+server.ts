import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export async function GET({ cookies }: RequestEvent) {
    cookies.delete('google_tokens', { path: '/' });
    throw redirect(302, '/');
}
