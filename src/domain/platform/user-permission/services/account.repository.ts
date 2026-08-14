import type { AccountQuery, AccountRecord } from '../types';

export function queryAccounts(query: AccountQuery = {}, source: AccountRecord[] = []): AccountRecord[] {
  const keyword = query.keyword?.trim().toLowerCase();
  return source.filter((account) => {
    const matchesKeyword = !keyword
      || account.username.toLowerCase().includes(keyword)
      || account.email.toLowerCase().includes(keyword)
      || account.name.toLowerCase().includes(keyword);
    const matchesStatus = !query.status || account.status === query.status;
    const matchesRole = !query.role || account.role === query.role;
    const matchesDepartment = !query.department || account.department === query.department;
    const matchesOrgNode = !query.orgNodeId || account.orgNodeId === query.orgNodeId;
    return matchesKeyword && matchesStatus && matchesRole && matchesDepartment && matchesOrgNode;
  });
}
