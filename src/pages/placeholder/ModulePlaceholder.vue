<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/core/auth/auth.store';
import { flattenNavigation, getNavigationTitle, navigationItems } from '@/core/navigation/menu';
import { useNavigationStore } from '@/core/navigation/navigation.store';
import DsEmpty from '@/design-system/components/DsEmpty.vue';

const route = useRoute();
const { t } = useI18n();
const authStore = useAuthStore();
const navigationStore = useNavigationStore();
const runtimeItems = computed(() => navigationStore.items.length ? navigationStore.items : navigationItems);

const currentItem = computed(() => {
  const path = route.path;
  return flattenNavigation(runtimeItems.value).find((item) => item.path === path);
});

const parentItem = computed(() => {
  const matchedId = currentItem.value?.id;
  return flattenNavigation(runtimeItems.value).find((item) => item.children?.some((child) => child.id === matchedId));
});

const sectionItems = computed(() => currentItem.value?.sections || []);
const canView = computed(() => {
  const permission = currentItem.value?.viewPermission;
  return !permission || authStore.can(permission);
});
</script>

<template>
  <section class="placeholder-page">
    <header v-if="canView" class="placeholder-page__header">
      <p class="placeholder-page__eyebrow">{{ parentItem ? getNavigationTitle(parentItem, t) : t('app.name') }}</p>
      <h1>{{ currentItem ? getNavigationTitle(currentItem, t) : t('routes.modulePlaceholder') }}</h1>
      <p>{{ currentItem ? t(currentItem.descKey) : t('routeDescriptions.modulePlaceholder') }}</p>
    </header>

    <div v-if="canView" class="placeholder-page__body">
      <section class="placeholder-panel">
        <h2>{{ t('placeholder.publicEditionTitle') }}</h2>
        <p>{{ t('placeholder.publicEditionDesc') }}</p>
      </section>

      <section class="placeholder-panel">
        <h2>{{ t('placeholder.availableTitle') }}</h2>
        <ul>
          <li v-for="item in sectionItems" :key="item">{{ item }}</li>
          <li v-if="sectionItems.length === 0">{{ t('placeholder.availableDesc') }}</li>
        </ul>
      </section>
    </div>

    <section v-else class="placeholder-page__denied">
      <DsEmpty :description="t('placeholder.permissionDenied')" />
    </section>
  </section>
</template>

<style scoped>
.placeholder-page {
  display: grid;
  gap: var(--space-4);
}

.placeholder-page__header,
.placeholder-page__denied,
.placeholder-panel {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
}

.placeholder-page__header {
  padding: var(--space-5) var(--space-6);
}

.placeholder-page__eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.placeholder-page__header h1 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 22px;
  font-weight: 600;
  line-height: 32px;
}

.placeholder-page__header p:last-child {
  max-width: 720px;
  margin: var(--space-2) 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 22px;
}

.placeholder-page__body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.placeholder-panel {
  padding: var(--space-5);
}

.placeholder-page__denied {
  padding: var(--space-8) var(--space-6);
}

.placeholder-panel h2 {
  margin: 0 0 var(--space-3);
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.placeholder-panel p,
.placeholder-panel li {
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 22px;
}

.placeholder-panel ul {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding-left: var(--space-4);
}

@media (max-width: 960px) {
  .placeholder-page__body {
    grid-template-columns: 1fr;
  }
}
</style>
