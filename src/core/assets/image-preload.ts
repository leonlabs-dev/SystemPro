const imageCache = new Map<string, Promise<string>>();

export function preloadImage(url: string): Promise<string> {
  if (typeof Image === 'undefined') return Promise.resolve(url);

  const cached = imageCache.get(url);
  if (cached) return cached;

  const request = new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = async () => {
      try {
        await image.decode();
      } catch {
        // A completed load is still usable when decode() is unavailable or
        // the browser declines an explicit second decode.
      }
      resolve(url);
    };
    image.onerror = () => reject(new Error(`Unable to preload image: ${url}`));
    image.src = url;
  });

  imageCache.set(url, request);
  request.catch(() => imageCache.delete(url));
  return request;
}

export function preloadImageWhenIdle(url: string) {
  const load = () => { void preloadImage(url).catch(() => undefined); };
  const requestIdle = (window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  }).requestIdleCallback;
  if (requestIdle) {
    requestIdle.call(window, load, { timeout: 2_000 });
    return;
  }
  globalThis.setTimeout(load, 1_500);
}
