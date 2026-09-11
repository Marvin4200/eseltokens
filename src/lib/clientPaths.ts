export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/eseltokens';

export function appPath(path: string = '/') {
  if (path === '/') return `${basePath}/`;
  return `${basePath}${path.startsWith('/') ? path : `/${path}`}`;
}

// next.config trailingSlash:true redirects every non-slash-terminated path with a 308 --
// browsers do NOT resend a POST body/headers reliably across that redirect in all cases, which
// silently turned every fetch(apiPath(...)) POST into an unexplained "Netzwerkfehler". Appending
// the trailing slash here means the client always requests the URL the server actually serves,
// so the redirect (and the bug class) never happens.
export function apiPath(path: string) {
  const full = `${basePath}${path.startsWith('/') ? path : `/${path}`}`;
  return full.endsWith('/') ? full : `${full}/`;
}
