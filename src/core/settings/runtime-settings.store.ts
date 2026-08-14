import { defineStore } from 'pinia';
import { fetchRuntimeSettings } from '@/domain/platform/settings/api/settings.api';
import { isDemoMode } from '@/core/config/app-runtime';

const cachedPageSize = Number(localStorage.getItem('systempro.runtime.pageSize'));

export const useRuntimeSettingsStore = defineStore('core.runtime-settings', {
  state: () => ({
    loaded: false,
    loading: false,
    pageSize: Number.isFinite(cachedPageSize) && cachedPageSize >= 10 ? cachedPageSize : 10,
    dateFormat: 'YYYY-MM-DD',
    timeZone: 'Asia/Shanghai',
    defaultAccountStatus: 'ACTIVE',
    forcePasswordChange: false,
    deviceDefaultView: 'CARD' as 'CARD' | 'LIST',
    readonlyActionMode: 'PREVIEW' as 'HIDDEN' | 'DISABLED' | 'PREVIEW',
  }),
  actions: {
    async load(force = false) {
      if ((this.loaded && !force) || this.loading) return;
      if (isDemoMode) {
        this.loaded = true;
        return;
      }
      this.loading = true;
      try {
        const settings = await fetchRuntimeSettings();
        this.pageSize = settings.pageSize;
        this.dateFormat = settings.dateFormat;
        this.timeZone = settings.timeZone;
        this.defaultAccountStatus = settings.defaultAccountStatus;
        this.forcePasswordChange = settings.forcePasswordChange;
        this.deviceDefaultView = settings.deviceDefaultView;
        this.readonlyActionMode = settings.readonlyActionMode;
        this.loaded = true;
        localStorage.setItem('systempro.runtime.pageSize', String(settings.pageSize));
      } finally {
        this.loading = false;
      }
    },
  },
});
