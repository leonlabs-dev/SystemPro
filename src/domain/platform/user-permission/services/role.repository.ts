import type { RoleQuery, RoleRecord } from '../types';

export function queryRoles(query: RoleQuery = {}, source: RoleRecord[] = []): RoleRecord[] {
  const keyword = query.keyword?.trim().toLowerCase();
  return source.filter((role) => {
    const matchesKeyword = !keyword
      || role.code.toLowerCase().includes(keyword)
      || role.name.toLowerCase().includes(keyword)
      || role.description.toLowerCase().includes(keyword);
    const matchesStatus = !query.status || role.status === query.status;
    const matchesDataScope = !query.dataScope || role.dataScope === query.dataScope;
    return matchesKeyword && matchesStatus && matchesDataScope;
  });
}
