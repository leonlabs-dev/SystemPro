import type { TenantQuery, TenantRecord } from '../types';

export function queryTenants(query: TenantQuery = {}, source: TenantRecord[]): TenantRecord[] {
  const keyword = query.keyword?.trim().toLowerCase();
  return source.filter((tenant) => {
    const matchesKeyword = !keyword
      || tenant.name.toLowerCase().includes(keyword)
      || tenant.code.toLowerCase().includes(keyword)
      || tenant.contactPerson.toLowerCase().includes(keyword)
      || tenant.contactPhone.includes(keyword);
    const matchesStatus = !query.status || tenant.status === query.status;
    return matchesKeyword && matchesStatus;
  });
}
