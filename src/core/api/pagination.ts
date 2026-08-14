export interface ApiPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Collects a reference dataset without assuming that its first page is complete.
 * Result lists should render one server page directly; this helper is reserved for
 * relationship editors, master directories and aggregate inputs that need every item.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<ApiPage<T>>,
  pageSize = 100,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  while (true) {
    const result = await fetchPage(page, pageSize);
    items.push(...result.items);
    if (!result.items.length || items.length >= result.total) return items;
    page += 1;
  }
}
