import type { OrganizationDraft, OrganizationNode } from '../organization';

export function cloneOrganizations(items: OrganizationNode[]): OrganizationNode[] {
  return items.map((item) => ({
    ...item,
    children: item.children ? cloneOrganizations(item.children) : undefined,
  }));
}

export function flattenOrganizations(items: OrganizationNode[]): OrganizationNode[] {
  return items.flatMap((item) => [item, ...flattenOrganizations(item.children || [])]);
}

export function findOrganization(items: OrganizationNode[], id: string): OrganizationNode | null {
  for (const item of items) {
    if (item.id === id) return item;
    const child = findOrganization(item.children || [], id);
    if (child) return child;
  }
  return null;
}

export function updateOrganization(items: OrganizationNode[], draft: OrganizationDraft): OrganizationNode[] {
  return items.map((item) => {
    if (item.id === draft.id) {
      return { ...item, ...draft, children: item.children };
    }
    return { ...item, children: item.children ? updateOrganization(item.children, draft) : undefined };
  });
}

export function insertOrganization(items: OrganizationNode[], node: OrganizationNode): OrganizationNode[] {
  if (!node.parentId) {
    return [node, ...items];
  }

  return items.map((item) => {
    if (item.id === node.parentId) {
      return { ...item, children: [...(item.children || []), node] };
    }
    return { ...item, children: item.children ? insertOrganization(item.children, node) : undefined };
  });
}

export function deleteOrganization(items: OrganizationNode[], id: string): OrganizationNode[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => ({ ...item, children: item.children ? deleteOrganization(item.children, id) : undefined }));
}

export function filterOrganizations(items: OrganizationNode[], keyword: string): OrganizationNode[] {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return items;

  return items.reduce<OrganizationNode[]>((next, item) => {
    const children = filterOrganizations(item.children || [], normalized);
    const matched = item.name.toLowerCase().includes(normalized)
      || item.code.toLowerCase().includes(normalized)
      || item.manager.toLowerCase().includes(normalized)
      || item.city.toLowerCase().includes(normalized);

    if (matched || children.length) {
      next.push({ ...item, children });
    }
    return next;
  }, []);
}
