import type { App } from 'vue';
import { ApiError } from '@/core/api/contracts';

const reportedErrors = new WeakSet<object>();

export function installErrorFeedback(app: App) {
  app.config.errorHandler = (error) => reportError(error);
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    reportError(event.reason);
  });
}

export function reportError(error: unknown) {
  if (error && typeof error === 'object') {
    if (reportedErrors.has(error)) return;
    reportedErrors.add(error);
  }

  const message = error instanceof ApiError
    ? error.message
    : error instanceof Error && error.message
      ? error.message
      : '操作未完成，请稍后重试';

  ElMessage.error({ message, duration: 4200, showClose: true });
  console.error(error);
}
