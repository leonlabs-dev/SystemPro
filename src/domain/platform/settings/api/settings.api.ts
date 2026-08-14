import { request } from '@/core/api/http-client';

export interface ParameterOption { label: string; value: string }
export interface SystemParameter {
  id: number; key: string; name: string; category: 'GENERAL' | 'ACCOUNT' | 'SECURITY' | 'LOGIN';
  valueType: 'TEXT' | 'INTEGER' | 'BOOLEAN' | 'SELECT'; value: string; defaultValue: string;
  options: ParameterOption[]; description: string; editable: boolean; sortOrder: number;
  version: number; updatedAt: string;
}
export interface DictionaryItem {
  id: number; typeId: number; value: string; label: string; color?: string; description?: string;
  builtIn: boolean; status: 'ACTIVE' | 'DISABLED'; sortOrder: number; version: number;
  createdAt: string; updatedAt: string;
}
export interface AuditSummary { todayOperations: number; successRate: number; activeActors: number; loginFailures: number }
export interface OperationAudit {
  id: number; actorId: number; actorName: string; actionCode: string; resourceType: string;
  resourceId?: string; requestId?: string; result: 'SUCCESS' | 'FAILURE'; detailJson?: string; occurredAt: string;
}
export interface PageResult<T> { items: T[]; total: number; page: number; pageSize: number }
export interface AuditFilters {
  keyword?: string; result?: string; actionCode?: string; from?: string; to?: string; page?: number; pageSize?: number;
}
export interface RuntimeSettings {
  pageSize: number; dateFormat: string; timeZone: string;
  defaultAccountStatus: string; forcePasswordChange: boolean; deviceDefaultView: 'CARD' | 'LIST';
  readonlyActionMode: 'HIDDEN' | 'DISABLED' | 'PREVIEW';
}
export interface LocaleDefinition {
  code: string; nativeName: string; englishName: string; enabled: boolean;
  defaultLocale: boolean; fallbackLocale: string; sortOrder: number;
}
export type TranslationResourceType = 'DICTIONARY_TYPE' | 'DICTIONARY_ITEM' | 'MENU' | 'ROLE'
  | 'ORGANIZATION' | 'POSITION' | 'SPACE' | 'TENANT' | 'IDENTITY_PROVIDER';
export interface TranslationResource {
  resourceType: TranslationResourceType; resourceId: number; resourceCode: string;
  sourceName: string; translatedName?: string; translatedDescription?: string; version?: number;
}
export interface TranslationCoverage { resourceType: TranslationResourceType; total: number; translated: number }

export const fetchSystemParameters = () => request<SystemParameter[]>('/api/v1/settings/parameters');
export const fetchRuntimeSettings = () => request<RuntimeSettings>('/api/v1/settings/parameters/runtime');
export const updateSystemParameters = (items: Array<Pick<SystemParameter, 'key' | 'value' | 'version'>>) =>
  request<SystemParameter[]>('/api/v1/settings/parameters', { method: 'PUT', body: JSON.stringify({ items }) });
export const resetSystemParameters = (category: string) =>
  request<SystemParameter[]>(`/api/v1/settings/parameters/reset?category=${category}`, { method: 'POST' });

export const fetchLocales = () => request<LocaleDefinition[]>('/api/v1/settings/i18n/locales');
export const fetchRuntimeLocales = () => request<LocaleDefinition[]>('/api/v1/settings/i18n/runtime-locales');
export const updateLocales = (locales: LocaleDefinition[]) => request<LocaleDefinition[]>('/api/v1/settings/i18n/locales', {
  method: 'PUT', body: JSON.stringify({ locales }),
});
export const fetchTranslationCoverage = (locale: string) =>
  request<TranslationCoverage[]>(`/api/v1/settings/i18n/coverage?locale=${encodeURIComponent(locale)}`);
export const fetchTranslationResources = (type: TranslationResourceType, locale: string, keyword = '') => {
  const query = new URLSearchParams({ type, locale });
  if (keyword) query.set('keyword', keyword);
  return request<TranslationResource[]>(`/api/v1/settings/i18n/resources?${query}`);
};
export const updateTranslationResource = (resource: TranslationResource, locale: string,
  input: { displayName: string; description?: string; version: number }) =>
  request<TranslationResource>(`/api/v1/settings/i18n/resources/${resource.resourceType}/${resource.resourceId}/${encodeURIComponent(locale)}`, {
    method: 'PUT', body: JSON.stringify(input),
  });

export const fetchRuntimeDictionary = (code: string) =>
  request<DictionaryItem[]>(`/api/v1/settings/dictionaries/runtime/${encodeURIComponent(code)}`);

function auditQuery(filters: AuditFilters) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return query.toString();
}
export const fetchAuditSummary = () => request<AuditSummary>('/api/v1/settings/audit-logs/summary');
export const fetchOperationAudits = (filters: AuditFilters) =>
  request<PageResult<OperationAudit>>(`/api/v1/settings/audit-logs/operations?${auditQuery(filters)}`);
