export const appConfig = {
  layout: {
    sidebarExpandedWidth: 208,
    sidebarCollapsedWidth: 48,
    topbarHeight: 56,
  },
  density: 'compact',
  dataFreshness: {
    freshMs: 30_000,
    staleWarningMs: 120_000,
  },
} as const;
