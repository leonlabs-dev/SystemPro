<script setup lang="ts">
import {
  Close,
  Delete,
  FullScreen,
  Plus,
  RefreshRight,
  Search,
} from '@element-plus/icons-vue';
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useActiveLocaleDataRefresh } from '@/core/i18n/use-active-locale-data-refresh';
import { useAuthStore } from '@/core/auth/auth.store';
import {
  createMenuCode,
  createPermissionCode as createManagedPermissionCode,
  nextPermissionAction,
  permissionActionOptions,
} from '@/core/code/business-code';

import { useMenuStore, type PersistedButton, type PersistedMenuNode } from '@/core/menu/menu.store';
import {
  cloneMenuResourceTree,
  createDefaultButtons,
  createPermissionEntriesFromMenuTree,
  flattenMenuResources,
} from '@/core/menu/menu-resource.factory';
import { usePermissionStore } from '@/core/permission/permission.store';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { useTreeExpansionState } from '@/design-system/composables/useTreeExpansionState';
import { menuIconMap } from '@/layout/menu-icons';
import {
  createMenu as createMenuApi,
  deleteMenu as deleteMenuApi,
  fetchMenuTree,
  updateMenu as updateMenuApi,
} from '@/domain/platform/user-permission/api/menu.api';

const { t } = useI18n();
const authStore = useAuthStore();

type ButtonPermission = PersistedButton;
type ManagedMenuNode = PersistedMenuNode;

interface MenuTreeInstance {
  setCurrentKey(key: string): void;
  store?: {
    nodesMap: Record<string, { expanded: boolean }>;
  };
}

const focusGuideStorageKey = 'systempro:menu-permission:focus-guide-dismissed';
const focusModeStorageKey = 'systempro:menu-permission:focus-mode';

const treeRef = ref<MenuTreeInstance>();
const menuKeyword = ref('');
const activeMenuId = ref('');
const activeTab = ref('base');
const menus = ref<ManagedMenuNode[]>([]);
const loading = ref(true);
const isFocusMode = ref(window.localStorage.getItem(focusModeStorageKey) !== 'standard');
const showFocusGuide = ref(!window.localStorage.getItem(focusGuideStorageKey));
const {
  expandedKeys,
  onNodeExpand,
  onNodeCollapse,
  ensureExpanded,
  restore: restoreExpansion,
  setAll: setAllExpanded,
} = useTreeExpansionState();

// ---- 共享 Store（资源字典 + 菜单状态） ----
const menuStore = useMenuStore();
const permissionStore = usePermissionStore();

/** 将当前 menus 的菜单状态和按钮权限同步到共享 Store */
function syncToSharedStores() {
  menuStore.replaceTree(menus.value);
  permissionStore.replaceBySource('menu-button', createPermissionEntriesFromMenuTree(menus.value));
}

const draft = reactive<Omit<ManagedMenuNode, 'children'>>({
  id: '',
  title: '',
  routeName: '',
  path: '',
  componentPath: '',
  permissionCode: '',
  activeTab: '',
  icon: '',
  parentId: '',
  type: 'menu',
  status: 'enabled',
  visible: 'visible',
  keepAlive: true,
  external: false,
  sort: 1,
  remark: '',
  buttonPermissions: [],
});

const flatMenus = computed(() => flattenMenus(menus.value));
const menuMap = computed(() => new Map(flatMenus.value.map((item) => [item.id, item])));
const activeMenu = computed(() => menuMap.value.get(activeMenuId.value) || flatMenus.value[0] || null);
const parentOptions = computed(() => [
  { label: t('common.root'), value: '' },
  ...flatMenus.value
    .filter((item) => item.id !== draft.id && item.type === 'catalog')
    .map((item) => ({ label: item.title, value: item.id })),
]);
const filteredMenuTree = computed(() => {
  const keyword = menuKeyword.value.trim().toLowerCase();
  if (!keyword) return menus.value;
  return filterMenus(menus.value, keyword);
});
const currentPathText = computed(() => getMenuBreadcrumb(activeMenu.value));
const isParentMenu = computed(() => Boolean(activeMenu.value?.children?.length));
const isPendingMenu = computed(() => Boolean(activeMenu.value?.id.startsWith('pending-')));
const isDirty = computed(() => {
  const source = activeMenu.value;
  if (!source) return false;

  if (source.id.startsWith('pending-')) return true;

  return source.title !== draft.title
    || source.routeName !== draft.routeName
    || source.path !== draft.path
    || source.componentPath !== draft.componentPath
    || source.permissionCode !== draft.permissionCode
    || source.activeTab !== draft.activeTab
    || source.icon !== draft.icon
    || source.parentId !== draft.parentId
    || source.type !== draft.type
    || source.status !== draft.status
    || source.visible !== draft.visible
    || source.keepAlive !== draft.keepAlive
    || source.external !== draft.external
    || source.sort !== draft.sort
    || source.remark !== draft.remark
    || !sameButtons(source.buttonPermissions, draft.buttonPermissions);
});

const iconOptions = Object.keys(menuIconMap).map((key) => ({ label: key, value: key }));

function flattenMenus(items: ManagedMenuNode[]): ManagedMenuNode[] {
  return flattenMenuResources(items);
}

function filterMenus(items: ManagedMenuNode[], keyword: string): ManagedMenuNode[] {
  return items.reduce<ManagedMenuNode[]>((next, item) => {
    const children = filterMenus(item.children || [], keyword);
    const matched = item.title.toLowerCase().includes(keyword)
      || item.path.toLowerCase().includes(keyword)
      || item.permissionCode.toLowerCase().includes(keyword);

    if (matched || children.length) {
      next.push({ ...item, children });
    }
    return next;
  }, []);
}

function cloneDraft(menu: ManagedMenuNode): Omit<ManagedMenuNode, 'children'> {
  return {
    id: menu.id,
    title: menu.title,
    routeName: menu.routeName,
    path: menu.path,
    componentPath: menu.componentPath,
    permissionCode: menu.permissionCode,
    activeTab: menu.activeTab,
    icon: menu.icon,
    parentId: menu.parentId,
    type: menu.type,
    status: menu.status,
    visible: menu.visible,
    keepAlive: menu.keepAlive,
    external: menu.external,
    sort: menu.sort,
    remark: menu.remark,
    buttonPermissions: menu.buttonPermissions.map((button) => ({ ...button })),
  };
}

function loadDraft(menu: ManagedMenuNode | null) {
  if (!menu) return;
  Object.assign(draft, cloneDraft(menu));
}

function sameButtons(a: ButtonPermission[], b: ButtonPermission[]) {
  if (a.length !== b.length) return false;
  return a.every((button, index) => {
    const next = b[index];
    return next
      && button.id === next.id
      && button.name === next.name
      && button.code === next.code
      && button.action === next.action
      && button.status === next.status;
  });
}

function dismissFocusGuide() {
  showFocusGuide.value = false;
  window.localStorage.setItem(focusGuideStorageKey, '1');
}

function toggleFocusMode() {
  isFocusMode.value = !isFocusMode.value;
  window.localStorage.setItem(focusModeStorageKey, isFocusMode.value ? 'focus' : 'standard');
  if (!isFocusMode.value) {
    dismissFocusGuide();
  }
}

function getMenuBreadcrumb(menu: ManagedMenuNode | null) {
  if (!menu) return t('menuPage.savebar.notSelected');
  const names = [menu.title];
  let parent = menuMap.value.get(menu.parentId);
  while (parent) {
    names.unshift(parent.title);
    parent = menuMap.value.get(parent.parentId);
  }
  return names.join(' / ');
}

async function selectMenu(menu: ManagedMenuNode) {
  if (menu.id === activeMenuId.value) return;
  if (isDirty.value) {
    await ElMessageBox.confirm(t('menuPage.message.unsavedConfirm'), t('menuPage.message.switchTitle'), {
      type: 'warning',
      confirmButtonText: t('menuPage.message.continueSwitch'),
      cancelButtonText: t('menuPage.message.cancel'),
    });
  }
  activeMenuId.value = menu.id;
}

function createMenu(parentId = '', asChild = false) {
  const parent = parentId ? menuMap.value.get(parentId) : null;
  const code = createMenuCode();
  const id = `pending-${code}`;
  const nextMenu: ManagedMenuNode = {
    id,
    title: asChild ? t('menuPage.message.newChildMenu') : t('menuPage.message.newMenu'),
    routeName: code,
    path: parent ? `${parent.path}/${code}` : `/${code}`,
    componentPath: 'views/custom/index.vue',
    permissionCode: parent ? createManagedPermissionCode(code, 'view') : '',
    activeTab: code,
    icon: parent ? '' : 'menu',
    parentId,
    type: parent ? 'menu' : 'catalog',
    status: 'enabled',
    visible: 'visible',
    keepAlive: true,
    external: false,
    sort: getSiblingCount(parentId) + 1,
    remark: t('menuPage.message.newMenuRemark'),
    buttonPermissions: parent ? createDefaultButtons(code) : [],
    children: [],
  };

  menus.value = insertMenu(menus.value, nextMenu, parentId);
  activeMenuId.value = id;
  expandParent(parentId);
  ElMessage.success(asChild ? t('menuPage.message.childAdded') : t('menuPage.message.menuAdded'));
}

function insertMenu(items: ManagedMenuNode[], menu: ManagedMenuNode, parentId: string): ManagedMenuNode[] {
  if (!parentId) return [...items, menu];
  return items.map((item) => {
    if (item.id === parentId) {
      return {
        ...item,
        type: 'catalog',
        keepAlive: false,
        icon: item.icon || 'menu',
        children: [...(item.children || []), menu],
      };
    }
    return {
      ...item,
      children: item.children ? insertMenu(item.children, menu, parentId) : item.children,
    };
  });
}

function getSiblingCount(parentId: string) {
  if (!parentId) return menus.value.length;
  return menuMap.value.get(parentId)?.children?.length || 0;
}

async function deleteCurrentMenu() {
  const menu = activeMenu.value;
  if (!menu) return;

  await ElMessageBox.confirm(t('menuPage.message.deleteConfirm', { name: menu.title }), t('menuPage.message.deleteTitle'), {
    type: 'warning',
    confirmButtonText: t('menuPage.message.delete'),
    cancelButtonText: t('menuPage.message.cancel'),
  });

  if (/^\d+$/.test(menu.id)) {
    await deleteMenuApi(menu.id);
  }
  menus.value = deleteMenu(menus.value, menu.id);
  activeMenuId.value = flatMenus.value[0]?.id || '';
  syncToSharedStores();
  ElMessage.success(t('menuPage.message.menuDeleted'));
}

function deleteMenu(items: ManagedMenuNode[], id: string): ManagedMenuNode[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => ({ ...item, children: item.children ? deleteMenu(item.children, id) : item.children }));
}

async function saveWorkspace() {
  if (!draft.title.trim() || !draft.path.trim()) {
    ElMessage.warning(t('menuPage.message.fillRequired'));
    return;
  }

  if (draft.title.trim().length > 12) {
    ElMessage.warning(t('menuPage.message.nameLength'));
    return;
  }

  if (draft.type !== 'catalog' && !draft.permissionCode.trim()) {
    ElMessage.warning(t('menuPage.message.permissionCodeFail'));
    return;
  }

  const nextMenu: ManagedMenuNode = {
    ...draft,
    title: draft.title.trim(),
    path: draft.path.trim(),
    permissionCode: draft.permissionCode.trim(),
    children: activeMenu.value?.children || [],
  };
  const saved = /^\d+$/.test(draft.id)
    ? await updateMenuApi(draft.id, nextMenu)
    : await createMenuApi(nextMenu);
  const savedId = saved.id;
  menus.value = cloneMenuResourceTree(await fetchMenuTree());
  activeMenuId.value = menuMap.value.has(savedId) ? savedId : (flatMenus.value[0]?.id || '');
  syncToSharedStores();
  await authStore.refreshAuthorization(true);
  loadDraft(activeMenu.value);
  await nextTick();
  treeRef.value?.setCurrentKey(activeMenuId.value);
  ElMessage.success(t('menuPage.message.saveSuccess'));
}

function updateMenu(items: ManagedMenuNode[], id: string, nextMenu: ManagedMenuNode): ManagedMenuNode[] {
  return items.map((item) => {
    if (item.id === id) {
      return {
        ...nextMenu,
        icon: nextMenu.type === 'catalog' ? nextMenu.icon || 'menu' : '',
        buttonPermissions: nextMenu.type === 'catalog' ? [] : nextMenu.buttonPermissions,
      };
    }
    return {
      ...item,
      children: item.children ? updateMenu(item.children, id, nextMenu) : item.children,
    };
  });
}

function resetWorkspace() {
  loadDraft(activeMenu.value);
  ElMessage.success(t('menuPage.message.resetSuccess'));
}

function addButtonPermission() {
  const action = nextPermissionAction(draft.buttonPermissions.map((button) => button.action));
  if (!action) {
    ElMessage.warning(t('menuPage.message.allActionsConfigured'));
    return;
  }
  draft.buttonPermissions.push({
    id: `pending-${crypto.randomUUID()}`,
    name: t(permissionActionOptions.find((item) => item.value === action)?.labelKey || 'common.actions.create'),
    code: createManagedPermissionCode(draft.routeName, action),
    action,
    status: 'enabled',
  });
}

function updateButtonAction(button: ButtonPermission) {
  button.code = createManagedPermissionCode(draft.routeName, button.action);
  const option = permissionActionOptions.find((item) => item.value === button.action);
  const label = option ? t(option.labelKey) : undefined;
  if (label && button.name === t('menuPage.message.defaultButtonName')) button.name = label;
}

function removeButtonPermission(id: string) {
  draft.buttonPermissions = draft.buttonPermissions.filter((button) => button.id !== id);
}

function expandAllMenus(expanded: boolean) {
  setAllExpanded(treeRef.value, expanded);
}

function expandParent(parentId: string) {
  ensureExpanded(parentId);
  nextTick(() => {
    if (parentId && treeRef.value?.store?.nodesMap[parentId]) {
      treeRef.value.store.nodesMap[parentId].expanded = true;
    }
    treeRef.value?.setCurrentKey(activeMenuId.value);
    restoreExpansion(treeRef.value);
  });
}

watch(flatMenus, (items) => {
  if (!activeMenuId.value && items.length) {
    activeMenuId.value = items[0].id;
  }
}, { immediate: true });

watch(activeMenu, (menu) => {
  loadDraft(menu);
  nextTick(() => {
    if (menu) treeRef.value?.setCurrentKey(menu.id);
  });
}, { immediate: true });

watch(() => draft.type, (type) => {
  if (type === 'catalog') {
    draft.permissionCode = '';
    draft.componentPath = '';
    draft.keepAlive = false;
    return;
  }

  if (!draft.permissionCode) {
    draft.permissionCode = createManagedPermissionCode(draft.routeName, 'view');
  }
  if (!draft.componentPath) {
    draft.componentPath = 'views/custom/index.vue';
  }
});

async function loadPageData() {
  const previousMenuId = activeMenuId.value;
  menus.value = cloneMenuResourceTree(await fetchMenuTree());
  syncToSharedStores();
  activeMenuId.value = previousMenuId && flatMenus.value.some((menu) => menu.id === previousMenuId)
    ? previousMenuId
    : flatMenus.value[0]?.id || '';
}

useActiveLocaleDataRefresh(loadPageData);
onMounted(async () => {
  try { await loadPageData(); } finally { loading.value = false; }
});
</script>

<template>
  <DsListPageShell :title="t('menuPage.focusBar.title')" :loading="loading" page-class="menu-permission-page">
    <template #header-extra>
      <span class="menu-page-subtitle">{{ t('menuPage.pageSubtitle') }}</span>
    </template>

    <section class="menu-workspace-shell" :class="{ 'is-focus': isFocusMode }">
      <header class="permission-focusbar">
        <div class="permission-focusbar__main">
          <strong>{{ t('menuPage.focusBar.title') }}</strong>
          <span>{{ t('menuPage.focusBar.description') }}</span>
        </div>
        <div class="permission-focusbar__guide">
          {{ isFocusMode ? t('menuPage.focusBar.guideFocusActive') : t('menuPage.focusBar.guideViewStandard') }}
        </div>
        <div class="permission-focusbar__actions">
          <el-tooltip :content="isFocusMode ? t('menuPage.focusBar.tooltipExitFocus') : t('menuPage.focusBar.tooltipEnterFocus')" placement="bottom">
            <button
              class="focus-mode-toggle"
              type="button"
              @click="toggleFocusMode"
            >
              <el-icon>
                <Close v-if="isFocusMode" />
                <FullScreen v-else />
              </el-icon>
              <span>{{ isFocusMode ? t('menuPage.focusBar.toggleExitFocus') : t('menuPage.focusBar.toggleEnterFocus') }}</span>
            </button>
          </el-tooltip>
        </div>
      </header>
      <div v-if="isFocusMode && showFocusGuide" class="focus-guide-mask">
        <section class="focus-guide-card" :aria-label="t('menuPage.focusGuide.eyebrow')">
          <button class="focus-guide-card__close" type="button" :aria-label="t('menuPage.focusGuide.gotIt')" @click="dismissFocusGuide">
            <el-icon><Close /></el-icon>
          </button>
          <span class="focus-guide-card__eyebrow">{{ t('menuPage.focusGuide.eyebrow') }}</span>
          <h3>{{ t('menuPage.focusGuide.title') }}</h3>
          <p>{{ t('menuPage.focusGuide.description') }}</p>
          <div class="focus-guide-card__actions">
            <el-button size="small" type="primary" @click="dismissFocusGuide">{{ t('menuPage.focusGuide.gotIt') }}</el-button>
          </div>
        </section>
      </div>
      <div class="menu-workspace">
        <aside class="menu-directory">
          <el-input
            v-model="menuKeyword"
            class="menu-directory__search"
            clearable
            :placeholder="t('menuPage.searchPlaceholder')"
            :prefix-icon="Search"
          />

          <el-tree
            v-if="filteredMenuTree.length"
            ref="treeRef"
            class="menu-resource-tree"
            node-key="id"
            :data="filteredMenuTree"
            :props="{ label: 'title', children: 'children' }"
            :default-expanded-keys="expandedKeys"
            highlight-current
            @node-click="selectMenu"
            @node-expand="onNodeExpand"
            @node-collapse="onNodeCollapse"
          >
            <template #default="{ data }">
              <span class="menu-tree-node" :class="{ 'is-child': data.parentId }">
                <el-icon v-if="!data.parentId && data.icon && menuIconMap[data.icon]" class="menu-tree-node__icon">
                  <component :is="menuIconMap[data.icon]" />
                </el-icon>
                <span>{{ data.title }}</span>
              </span>
            </template>
          </el-tree>
          <DsEmpty v-else :description="t('menuPage.empty.noMatching')" :action-label="t('menuPage.empty.clearSearch')" @retry="menuKeyword = ''" />

          <footer class="menu-directory__footer">
            <el-button v-permission.preview="'platform:menu:permission:create'" @click="createMenu(activeMenu?.parentId || '', false)">{{ t('menuPage.footer.addSibling') }}</el-button>
            <el-button v-permission.preview="'platform:menu:permission:create'" @click="activeMenu && createMenu(activeMenu.id, true)">{{ t('menuPage.footer.addChild') }}</el-button>
            <el-button v-permission="'platform:menu:permission:delete'" :icon="Delete" :disabled="!activeMenu" @click="deleteCurrentMenu">{{ t('menuPage.footer.deleteMenu') }}</el-button>
          </footer>
        </aside>

        <section v-if="activeMenu" class="menu-config">
          <header class="menu-pathbar">
            <span>{{ t('menuPage.pathBar.currentMenuLabel') }}</span>
            <strong>{{ currentPathText }}</strong>
          </header>

          <el-tabs v-model="activeTab" class="menu-tabs">
            <el-tab-pane :label="t('menuPage.tab.base')" name="base">
              <div class="menu-form-grid">
                <label class="menu-field is-title">
                  <span>{{ t('menuPage.form.menuName') }}</span>
                  <el-input v-model="draft.title" maxlength="12" show-word-limit />
                </label>
                <label class="menu-field">
                  <span>{{ t('menuPage.form.menuType') }}</span>
                  <el-select v-model="draft.type">
                    <el-option :label="t('menuPage.form.typeCatalog')" value="catalog" />
                    <el-option :label="t('menuPage.form.typeMenu')" value="menu" />
                  </el-select>
                </label>
                <label class="menu-field">
                  <span>{{ t('menuPage.form.parentMenu') }}</span>
                  <el-select v-model="draft.parentId" disabled>
                    <el-option v-for="item in parentOptions" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
                </label>
                <label class="menu-field">
                  <span>{{ t('menuPage.form.sort') }}</span>
                  <el-input-number v-model="draft.sort" :min="1" :max="999" controls-position="right" />
                </label>
                <label class="menu-field">
                  <span>{{ t('menuPage.form.menuCode') }}</span>
                  <el-input v-model="draft.routeName" disabled />
                </label>
                <label class="menu-field">
                  <span>{{ t('menuPage.form.routePath') }}</span>
                  <el-input v-model="draft.path" />
                </label>
                <label class="menu-field is-path">
                  <span>{{ t('menuPage.form.componentPath') }}</span>
                  <el-input v-model="draft.componentPath" :disabled="draft.type === 'catalog'" />
                </label>
                <label class="menu-field is-path">
                  <span>{{ t('menuPage.form.permissionCode') }}</span>
                  <el-input v-model="draft.permissionCode" disabled />
                </label>
                <label class="menu-field">
                  <span>{{ t('menuPage.form.icon') }}</span>
                  <el-select v-model="draft.icon" :disabled="draft.parentId !== '' || draft.type !== 'catalog'">
                    <el-option v-for="item in iconOptions" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
                </label>
                <label class="menu-field">
                  <span>{{ t('menuPage.form.activeTab') }}</span>
                  <el-input v-model="draft.activeTab" />
                </label>
                <label class="menu-field is-wide">
                  <span>{{ t('menuPage.form.remark') }}</span>
                  <el-input v-model="draft.remark" type="textarea" :rows="3" maxlength="200" show-word-limit />
                </label>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="t('menuPage.tab.display')" name="display">
              <div class="menu-rule-panel">
                <section class="menu-rule-row">
                  <div>
                    <strong>{{ t('menuPage.displayRules.menuStatus') }}</strong>
                    <span>{{ t('menuPage.displayRules.menuStatusDesc') }}</span>
                  </div>
                  <span class="menu-rule-row__control">
                    <el-radio-group v-model="draft.status" class="rule-segmented">
                      <el-radio-button label="enabled">{{ t('common.enabled') }}</el-radio-button>
                      <el-radio-button label="disabled">{{ t('common.disabled') }}</el-radio-button>
                    </el-radio-group>
                  </span>
                </section>
                <section class="menu-rule-row">
                  <div>
                    <strong>{{ t('menuPage.displayRules.menuVisible') }}</strong>
                    <span>{{ t('menuPage.displayRules.menuVisibleDesc') }}</span>
                  </div>
                  <span class="menu-rule-row__control">
                    <el-radio-group v-model="draft.visible" class="rule-segmented">
                      <el-radio-button label="visible">{{ t('menuPage.displayRules.menuVisibleShow') }}</el-radio-button>
                      <el-radio-button label="hidden">{{ t('menuPage.displayRules.menuVisibleHide') }}</el-radio-button>
                    </el-radio-group>
                  </span>
                </section>
                <section class="menu-rule-row">
                  <div>
                    <strong>KeepAlive</strong>
                    <span>{{ t('menuPage.displayRules.keepAliveDesc') }}</span>
                  </div>
                  <span class="menu-rule-row__control">
                    <el-switch v-model="draft.keepAlive" :disabled="draft.type === 'catalog'" />
                  </span>
                </section>
                <section class="menu-rule-row">
                  <div>
                    <strong>{{ t('menuPage.displayRules.externalMenu') }}</strong>
                    <span>{{ t('menuPage.displayRules.externalMenuDesc') }}</span>
                  </div>
                  <span class="menu-rule-row__control">
                    <el-switch v-model="draft.external" />
                  </span>
                </section>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="t('menuPage.tab.buttons')" name="buttons">
              <section class="button-permission">
                <header class="button-permission__toolbar">
                  <div>
                    <strong>{{ t('menuPage.buttonPermission.config') }}</strong>
                    <span>{{ t('menuPage.buttonPermission.configDesc') }}</span>
                  </div>
                      <el-button
                        v-permission.preview="'platform:menu:permission:update'"
                        :disabled="draft.type === 'catalog' || !nextPermissionAction(draft.buttonPermissions.map((button) => button.action))"
                        :icon="Plus"
                        @click="addButtonPermission"
                      >{{ t('menuPage.buttonPermission.addButton') }}</el-button>
                </header>

                <div v-if="draft.type === 'menu' && draft.buttonPermissions.length" class="button-permission-table">
                  <div class="button-permission-table__head">
                    <span>{{ t('menuPage.buttonPermission.colName') }}</span>
                    <span>{{ t('menuPage.buttonPermission.colAction') }}</span>
                    <span>{{ t('menuPage.buttonPermission.colCode') }}</span>
                    <span>{{ t('menuPage.buttonPermission.colStatus') }}</span>
                    <span>{{ t('menuPage.buttonPermission.colOperation') }}</span>
                  </div>
                  <div v-for="button in draft.buttonPermissions" :key="button.id" class="button-permission-row">
                    <el-input v-model="button.name" />
                    <el-select v-model="button.action" :disabled="/^\d+$/.test(button.id)" @change="updateButtonAction(button)">
                      <el-option
                        v-for="item in permissionActionOptions"
                        :key="item.value"
                        :label="t(item.labelKey)"
                        :value="item.value"
                        :disabled="draft.buttonPermissions.some((candidate) => candidate.id !== button.id && candidate.action === item.value)"
                      />
                    </el-select>
                    <el-input v-model="button.code" disabled />
                    <el-select v-model="button.status">
                      <el-option :label="t('common.enabled')" value="enabled" />
                      <el-option :label="t('common.disabled')" value="disabled" />
                    </el-select>
                            <el-button v-permission.preview="'platform:menu:permission:update'" text type="danger" @click="removeButtonPermission(button.id)">{{ t('menuPage.buttonPermission.delete') }}</el-button>
                  </div>
                </div>
                <DsEmpty v-else :description="draft.type === 'catalog' ? t('menuPage.buttonPermission.catalogNoButtons') : t('menuPage.buttonPermission.noButtons')" />
              </section>
            </el-tab-pane>

          </el-tabs>
        </section>

        <section v-else class="menu-config menu-config--empty">
          <DsEmpty :description="t('menuPage.empty.noConfig')" :action-label="t('menuPage.empty.createMenu')" @retry="createMenu('', false)" />
        </section>
      </div>

      <footer class="menu-savebar">
        <div class="menu-savebar__meta">
          <span>{{ t('menuPage.savebar.currentMenuLabel') }}{{ activeMenu?.title || t('menuPage.savebar.notSelected') }}</span>
          <i :class="{ 'is-dirty': isDirty }" />
          <span>{{ isDirty ? t('menuPage.savebar.modified') : t('menuPage.savebar.unmodified') }}</span>
        </div>
        <div class="menu-savebar__actions">
          <el-button @click="expandAllMenus(true)">{{ t('menuPage.savebar.expandAll') }}</el-button>
          <el-button @click="expandAllMenus(false)">{{ t('menuPage.savebar.collapseAll') }}</el-button>
          <el-button :disabled="!isDirty" @click="resetWorkspace">{{ t('menuPage.savebar.cancel') }}</el-button>
          <el-button :icon="RefreshRight" :disabled="!isDirty" @click="resetWorkspace">{{ t('menuPage.savebar.reset') }}</el-button>
          <el-button
            v-permission="isPendingMenu ? 'platform:menu:permission:create' : 'platform:menu:permission:update'"
            type="primary"
            :disabled="!activeMenu || !isDirty"
            @click="saveWorkspace"
          >{{ t('menuPage.savebar.save') }}</el-button>
        </div>
      </footer>
    </section>
  </DsListPageShell>
</template>

<style scoped>
.menu-page-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}

.menu-workspace-shell {
  position: relative;
  display: grid;
  height: var(--ds-list-workspace-h);
  grid-template-rows: auto minmax(0, 1fr) auto;
  margin: var(--ds-page-filter-py-top) var(--ds-page-inset) var(--space-6);
  overflow: hidden;
  --font-body: 13px;
  --line-body: 20px;
}

.menu-workspace-shell.is-focus {
  position: fixed;
  z-index: 200;
  inset: var(--layout-topbar-height) 0 0;
  height: auto;
  margin: 0;
  border-width: 1px 0 0;
  border-radius: 0;
  background: var(--color-bg-surface);
  box-shadow: none;
}

.menu-workspace-shell.is-focus .menu-workspace {
  padding: 0 20px;
}

.menu-workspace-shell.is-focus .permission-focusbar {
  min-height: 46px;
  padding: 0 20px;
  border-bottom: 1px solid var(--ds-list-divider);
  background: color-mix(in srgb, var(--color-bg-surface) 96%, var(--color-bg-muted));
}

.permission-focusbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  min-height: 34px;
  align-items: center;
  gap: var(--space-4);
  padding: 0 0 var(--space-2);
}

.permission-focusbar__main {
  display: none;
  min-width: 0;
  align-items: baseline;
  gap: var(--space-3);
}

.menu-workspace-shell.is-focus .permission-focusbar__main {
  display: flex;
}

.permission-focusbar__main strong {
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
}

.permission-focusbar__main span,
.permission-focusbar__guide {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.permission-focusbar__guide {
  position: relative;
  padding-left: var(--space-3);
}

.permission-focusbar__guide::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary-500);
  content: '';
  transform: translateY(-50%);
}

.permission-focusbar__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.focus-mode-toggle {
  display: inline-flex;
  height: 30px;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-3);
  border: 1px solid var(--ds-list-divider);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: var(--font-caption);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
}

.focus-mode-toggle:hover {
  border-color: color-mix(in srgb, var(--color-primary-500) 42%, var(--ds-list-divider));
  background: color-mix(in srgb, var(--color-primary-500) 8%, var(--color-bg-surface));
  color: var(--color-primary-600);
}

.focus-guide-mask {
  position: absolute;
  z-index: 5;
  inset: 46px 0 0;
  background: rgb(15 23 42 / 32%);
}

.focus-guide-card {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  width: min(320px, calc(100vw - 48px));
  padding: var(--space-4);
  border: 1px solid var(--ds-list-divider);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  box-shadow: var(--shadow-panel);
}

.focus-guide-card::before {
  position: absolute;
  top: -7px;
  right: 44px;
  width: 12px;
  height: 12px;
  border-top: 1px solid var(--ds-list-divider);
  border-left: 1px solid var(--ds-list-divider);
  background: var(--color-bg-surface);
  content: '';
  transform: rotate(45deg);
}

.focus-guide-card__close {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.focus-guide-card__close:hover {
  background: var(--color-bg-muted);
  color: var(--color-text-primary);
}

.focus-guide-card__eyebrow {
  display: inline-flex;
  align-items: center;
  color: var(--color-primary-600);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-caption);
}

.focus-guide-card h3 {
  margin: var(--space-2) var(--space-6) var(--space-2) 0;
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-body);
}

.focus-guide-card p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-body);
}

.focus-guide-card__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-3);
}

.menu-workspace {
  display: grid;
  min-height: 0;
  grid-template-columns: var(--ds-master-pane-width) minmax(0, 1fr);
  border-top: 1px solid var(--ds-list-divider);
}

.menu-directory {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
  padding: var(--space-4) var(--space-5) var(--space-4) 0;
  border-right: 1px solid var(--ds-list-divider);
}

.menu-directory__search {
  margin-bottom: var(--space-3);
}

.menu-resource-tree {
  min-height: 0;
  overflow: auto;
  color: var(--color-text-primary);
  background: transparent;
}

.menu-resource-tree :deep(.el-tree-node__content) {
  min-height: 30px;
  margin-block: 2px;
  border-radius: var(--radius-md);
}

.menu-resource-tree :deep(.el-tree-node__content:focus-visible) {
  outline: none;
}

.menu-resource-tree :deep(.el-tree-node__content:hover),
.menu-resource-tree :deep(.el-tree-node.is-current > .el-tree-node__content),
.menu-resource-tree :deep(.el-tree-node:focus > .el-tree-node__content) {
  background: var(--color-bg-muted);
}

.menu-resource-tree :deep(.el-tree-node.is-current > .el-tree-node__content .el-tree-node__label) {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}

.menu-tree-node {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-body);
  line-height: var(--line-body);
}

.menu-tree-node.is-child {
  gap: 0;
}

.menu-tree-node__icon {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  color: var(--color-text-secondary);
  font-size: 16px;
  line-height: 16px;
}

.menu-tree-node__icon :deep(svg) {
  width: 1em;
  height: 1em;
}

.menu-directory__footer {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--ds-list-divider);
}

.menu-directory__footer .el-button + .el-button {
  margin-left: 0;
}

.menu-config {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--space-3);
  padding: var(--space-4) 0 var(--space-4) var(--space-5);
}

.menu-config--empty {
  place-items: center;
}

.menu-pathbar {
  display: flex;
  min-height: 34px;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}

.menu-pathbar strong {
  overflow: hidden;
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-tabs {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.menu-tabs :deep(.el-tabs__header) {
  flex: 0 0 auto;
  margin: 0 0 var(--space-3);
}

.menu-tabs :deep(.el-tabs__content) {
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.menu-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: var(--ds-list-divider);
}

.menu-tabs :deep(.el-tabs__item) {
  height: 34px;
  padding: 0 var(--space-5);
  color: var(--color-text-primary);
  font-size: var(--font-body);
  line-height: 34px;
}

.menu-tabs :deep(.el-tabs__item.is-active) {
  color: var(--color-primary-500);
}

.menu-tabs :deep(.el-tabs__active-bar) {
  background-color: var(--color-primary-500);
}

.menu-tabs :deep(.el-tab-pane) {
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding-right: var(--space-1);
}

.menu-form-grid {
  display: grid;
  align-content: start;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4) var(--space-5);
}

.menu-field {
  display: grid;
  min-width: 0;
  gap: var(--space-1);
}

.menu-field.is-wide {
  grid-column: 1 / -1;
}

.menu-field.is-title,
.menu-field.is-path {
  grid-column: span 2;
}

.menu-field span,
.menu-savebar__meta,
.menu-savebar__actions,
.menu-rule-row span,
.button-permission__toolbar span {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
  white-space: nowrap;
}

.menu-field :deep(.el-select),
.menu-field :deep(.el-input-number) {
  width: 100%;
}

.menu-rule-panel,
.button-permission {
  display: grid;
  align-content: start;
  overflow: hidden;
  border: 1px solid var(--ds-list-divider);
  border-radius: var(--radius-md);
}

.menu-rule-row {
  display: grid;
  min-height: 58px;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: center;
  gap: var(--space-4);
  padding: 0 var(--space-4);
  border-top: 1px solid var(--ds-list-divider);
}

.menu-rule-row:first-child {
  border-top: 0;
}

.menu-rule-row div,
.button-permission__toolbar div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.menu-rule-row strong,
.button-permission__toolbar strong {
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-body);
}

.menu-rule-row__control {
  display: inline-flex;
  min-width: 132px;
  justify-content: flex-end;
}

.menu-rule-row__control :deep(.rule-segmented) {
  display: inline-grid;
  width: 128px;
  grid-template-columns: repeat(2, 64px);
}

.menu-rule-row__control :deep(.rule-segmented .el-radio-button) {
  width: 64px;
}

.menu-rule-row__control :deep(.rule-segmented .el-radio-button__inner) {
  width: 64px;
  height: 30px;
  padding: 0;
  font-size: var(--font-caption);
  line-height: 28px;
}

.menu-rule-row__control :deep(.el-switch) {
  width: 44px;
  min-width: 44px;
}

.menu-rule-row__control :deep(.el-switch__core) {
  width: 44px !important;
  min-width: 44px;
}

.button-permission__toolbar {
  display: flex;
  min-height: 50px;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--ds-list-divider);
  background: var(--color-bg-muted);
}

.button-permission-table {
  display: grid;
}

.button-permission-table__head,
.button-permission-row {
  display: grid;
  grid-template-columns: minmax(120px, 0.8fr) 110px minmax(220px, 1.6fr) 100px 78px;
  align-items: center;
  gap: var(--space-3);
  min-height: 42px;
  padding: 0 var(--space-4);
  border-top: 1px solid color-mix(in srgb, var(--ds-list-divider) 62%, transparent);
}

.button-permission-table__head {
  min-height: 36px;
  color: var(--color-text-secondary);
  background: var(--color-bg-surface);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
}

.menu-workspace-shell :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner),
.menu-workspace-shell :deep(.el-switch.is-checked .el-switch__core) {
  border-color: var(--color-primary-500);
  background-color: var(--color-primary-500);
}

.menu-savebar {
  display: flex;
  min-height: var(--ds-table-footer-min-h);
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) 0 0;
  border-top: 1px solid var(--ds-list-divider);
}

.menu-workspace-shell.is-focus .menu-savebar {
  padding: var(--space-3) 20px 0;
}

.menu-savebar__meta,
.menu-savebar__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.menu-savebar__meta i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-disabled);
}

.menu-savebar__meta i.is-dirty {
  background: var(--color-warning-default);
}

.menu-savebar__actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.menu-savebar__actions .el-button + .el-button,
.button-permission__toolbar .el-button + .el-button {
  margin-left: 0;
}

@media (max-width: 1320px) {
  .menu-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1180px) {
  .menu-workspace {
    grid-template-columns: var(--ds-master-pane-width-compact) minmax(0, 1fr);
  }

  .menu-rule-row,
  .button-permission-table__head,
  .button-permission-row {
    grid-template-columns: 1fr;
    padding: var(--space-3) var(--space-4);
  }

  .menu-rule-row__control {
    justify-content: flex-start;
  }
}

@media (max-width: 820px) {
  .menu-workspace-shell {
    height: auto;
    min-height: var(--ds-list-workspace-h);
  }

  .menu-workspace,
  .menu-form-grid {
    grid-template-columns: 1fr;
  }

  .menu-directory {
    border-right: 0;
    border-bottom: 1px solid var(--ds-list-divider);
  }

  .menu-resource-tree {
    max-height: 320px;
  }

  .menu-savebar {
    align-items: stretch;
    flex-direction: column;
  }

  .menu-savebar__actions {
    justify-content: flex-end;
  }
}
</style>
