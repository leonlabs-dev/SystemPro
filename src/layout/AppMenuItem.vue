<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useLayoutStore } from '@/core/layout/layout.store';
import type { NavigationItem } from '@/core/navigation/menu';
import { getFirstNavigationPath, getNavigationTitle } from '@/core/navigation/menu';
import { openNavigationItem } from '@/core/navigation/open-navigation';
import { menuIconMap } from './menu-icons';

const props = defineProps<{
  item: NavigationItem;
}>();

const { t } = useI18n();
const layoutStore = useLayoutStore();
const router = useRouter();

const hasChildren = computed(() => Boolean(props.item.children?.length));
const itemIndex = computed(() => (hasChildren.value ? props.item.id : props.item.path));
const itemRoute = computed(() => getFirstNavigationPath(props.item));
const iconComponent = computed(() => (props.item.icon ? menuIconMap[props.item.icon] : undefined));
const renderedChildren = computed(() => {
  const result:Array<{kind:'section'|'menu';key:string;label?:string;item?:NavigationItem}>=[];
  let current='';
  for(const child of props.item.children||[]){
    if(layoutStore.menuType==='grouped'&&child.sectionGroup&&child.sectionGroup!==current){
      current=child.sectionGroup;
      result.push({kind:'section',key:`section-${current}`,label:current});
    }
    result.push({kind:'menu',key:child.id,item:child});
  }
  return result;
});
</script>

<template>
  <el-sub-menu v-if="hasChildren" :index="itemIndex">
    <template #title>
      <el-icon v-if="iconComponent">
        <component :is="iconComponent" />
      </el-icon>
      <span :title="getNavigationTitle(item, t)">{{ getNavigationTitle(item, t) }}</span>
    </template>
    <template v-for="entry in renderedChildren" :key="entry.key">
      <div v-if="entry.kind==='section'" class="app-menu-item__section">{{ t(entry.label!) }}</div>
      <AppMenuItem v-else :item="entry.item!" />
    </template>
  </el-sub-menu>

  <div
    v-else-if="item.openMode === 'new-window'"
    class="el-menu-item app-menu-item__standalone"
    role="menuitem"
    tabindex="0"
    @click="openNavigationItem(item, router)"
    @keydown.enter.prevent="openNavigationItem(item, router)"
    @keydown.space.prevent="openNavigationItem(item, router)"
  >
    <el-icon v-if="iconComponent">
      <component :is="iconComponent" />
    </el-icon>
    <span :title="getNavigationTitle(item, t)">{{ getNavigationTitle(item, t) }}</span>
    <span class="app-menu-item__external" aria-hidden="true">↗</span>
  </div>

  <el-menu-item v-else :index="itemRoute">
    <el-icon v-if="iconComponent">
      <component :is="iconComponent" />
    </el-icon>
    <span :title="getNavigationTitle(item, t)">{{ getNavigationTitle(item, t) }}</span>
  </el-menu-item>
</template>

<style scoped>
.app-menu-item__section{padding:10px 16px 3px;color:var(--color-text-disabled);font-size:10px;font-weight:600;letter-spacing:.05em;line-height:14px;user-select:none}
.app-menu-item__standalone { cursor: pointer; }
.app-menu-item__external { margin-left: auto; color: var(--color-text-disabled); font-size: 12px; }
</style>
