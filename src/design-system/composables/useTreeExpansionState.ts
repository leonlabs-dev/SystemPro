import { nextTick, ref } from 'vue';

interface TreeNodeData {
  id: string;
}

export interface ExpansionTreeInstance {
  store?: {
    nodesMap: Record<string, { expanded: boolean }>;
  };
}

export function useTreeExpansionState(initialKeys: string[] = []) {
  const expandedKeys = ref([...initialKeys]);
  const expandedSet = new Set(initialKeys);

  function onNodeExpand(data: TreeNodeData) {
    expandedSet.add(data.id);
    syncKeys();
  }

  function onNodeCollapse(data: TreeNodeData) {
    expandedSet.delete(data.id);
    syncKeys();
  }

  function ensureExpanded(key?: string | null) {
    if (!key) return;
    expandedSet.add(key);
    syncKeys();
  }

  function restore(instance?: ExpansionTreeInstance) {
    nextTick(() => {
      const nodes = instance?.store?.nodesMap || {};
      Object.entries(nodes).forEach(([key, node]) => {
        node.expanded = expandedSet.has(key);
      });
    });
  }

  function setAll(instance: ExpansionTreeInstance | undefined, expanded: boolean) {
    const nodes = instance?.store?.nodesMap || {};
    expandedSet.clear();
    Object.entries(nodes).forEach(([key, node]) => {
      node.expanded = expanded;
      if (expanded) expandedSet.add(key);
    });
    syncKeys();
  }

  function syncKeys() {
    expandedKeys.value = [...expandedSet];
  }

  return { expandedKeys, onNodeExpand, onNodeCollapse, ensureExpanded, restore, setAll };
}
