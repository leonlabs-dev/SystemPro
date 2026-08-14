import { computed, ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue';
import { useRuntimeSettingsStore } from '@/core/settings/runtime-settings.store';

type ListRows<TRow> = Ref<TRow[]> | ComputedRef<TRow[]>;

interface UseListPageStateOptions<TRow> {
  rows: ListRows<TRow>;
  pageSize?: number;
  resetDeps?: () => unknown[];
  server?: boolean;
}

export function useListPageState<TRow>(options: UseListPageStateOptions<TRow>) {
  const runtimeSettings = useRuntimeSettingsStore();
  const page = ref(1);
  const pageSize = ref(options.pageSize ?? runtimeSettings.pageSize);
  const selectedRows = shallowRef<TRow[]>([]);

  const selectedCount = computed(() => selectedRows.value.length);

  const pagedRows = computed(() => {
    if (options.server) return options.rows.value;
    const start = (page.value - 1) * pageSize.value;
    return options.rows.value.slice(start, start + pageSize.value);
  });

  const tableRows = computed(() => pagedRows.value as Record<string, unknown>[]);

  function resetPage() {
    page.value = 1;
  }

  function updateSelected(rows: Record<string, unknown>[]) {
    selectedRows.value = rows as TRow[];
  }

  function clearSelectedRows() {
    selectedRows.value = [];
  }

  if (options.resetDeps) {
    watch(options.resetDeps, resetPage);
  }

  watch(pageSize, resetPage);

  if (!options.server) {
    watch(
      () => options.rows.value.length,
      (total) => {
        const maxPage = Math.max(1, Math.ceil(total / pageSize.value));
        if (page.value > maxPage) {
          page.value = maxPage;
        }
      },
    );
  }

  if (!options.pageSize) {
    watch(() => runtimeSettings.pageSize, (newSize) => { pageSize.value = newSize; });
  }

  return {
    page,
    pageSize,
    selectedRows,
    selectedCount,
    pagedRows,
    tableRows,
    resetPage,
    updateSelected,
    clearSelectedRows,
  };
}
