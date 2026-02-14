import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
    // Match all paths except static files and API routes
    matcher: ['/', '/(en|ru|uz)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
