import { onBeforeUnmount, type Ref } from 'vue';

/** Only the latest query may update data, errors or the loading indicator. */
export function useLatestRequest(loading: Ref<boolean>) {
  let revision = 0;
  let disposed = false;
  onBeforeUnmount(() => { disposed = true; revision += 1; });

  async function run<T>(query: () => Promise<T>, commit: (data: T) => void, onError: (error: unknown) => void): Promise<void> {
    if (disposed) return;
    const current = ++revision;
    loading.value = true;
    try {
      const data = await query();
      if (!disposed && current === revision) commit(data);
    } catch (error) {
      if (!disposed && current === revision) onError(error);
    } finally {
      if (!disposed && current === revision) loading.value = false;
    }
  }

  return { run };
}
