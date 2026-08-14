<script setup lang="ts">
import { Check, Collection, Search, Setting } from "@element-plus/icons-vue";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "@/core/auth/auth.store";
import {
  ensureEnabledApplicationLocale,
  replaceRuntimeLocaleDefinitions,
  switchApplicationLocale,
} from "@/core/i18n/locale-runtime";
import DsEmpty from "@/design-system/components/DsEmpty.vue";
import DsDataTable from "@/design-system/components/DsDataTable.vue";
import DsListPageShell from "@/design-system/components/DsListPageShell.vue";
import DsPagination from "@/design-system/components/DsPagination.vue";
import DsTag from "@/design-system/components/DsTag.vue";
import { useRuntimeSettingsStore } from "@/core/settings/runtime-settings.store";
import {
  fetchLocales,
  fetchTranslationCoverage,
  fetchTranslationResources,
  updateLocales,
  updateTranslationResource,
  type LocaleDefinition,
  type TranslationCoverage,
  type TranslationResource,
  type TranslationResourceType,
} from "@/domain/platform/settings/api/settings.api";

const { t, locale } = useI18n();
const authStore = useAuthStore();
const runtimeSettings = useRuntimeSettingsStore();
const canView = computed(() => authStore.can("platform:i18n:resource:view"));
const canConfigure = computed(() =>
  authStore.can("platform:i18n:resource:config"),
);
const canUpdate = computed(() =>
  authStore.can("platform:i18n:resource:update"),
);
const canEnterUpdate = computed(() =>
  authStore.canEnter("platform:i18n:resource:update"),
);
const loading = ref(true);
const savingPolicy = ref(false);
const savingId = ref<number>();
const locales = ref<LocaleDefinition[]>([]);
const coverage = ref<TranslationCoverage[]>([]);
const resources = ref<TranslationResource[]>([]);
const targetLocale = ref("en-US");
const resourceType = ref<TranslationResourceType>("MENU");
const keyword = ref("");
const page = ref(1);
const pageSize = ref(runtimeSettings.pageSize);
let searchTimer: number | undefined;

const resourceTypes: TranslationResourceType[] = [
  "MENU",
  "ROLE",
  "ORGANIZATION",
  "POSITION",
  "SPACE",
  "TENANT",
  "IDENTITY_PROVIDER",
  "DICTIONARY_TYPE",
  "DICTIONARY_ITEM",
];
const enabledLocales = computed(() =>
  locales.value.filter((item) => item.enabled),
);
const activeCoverage = computed(() =>
  coverage.value.find((item) => item.resourceType === resourceType.value),
);
const coveragePercent = computed(() => {
  const item = activeCoverage.value;
  return item?.total ? Math.round((item.translated * 100) / item.total) : 100;
});
const pageResources = computed(() =>
  resources.value.slice(
    (page.value - 1) * pageSize.value,
    page.value * pageSize.value,
  ),
);

function typeLabel(type: TranslationResourceType) {
  return t(`i18nManagement.types.${type}`);
}

async function loadBase() {
  if (!canView.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    locales.value = await fetchLocales();
    if (
      !locales.value.some(
        (item) => item.code === targetLocale.value && item.enabled,
      )
    ) {
      targetLocale.value =
        locales.value.find((item) => item.enabled && !item.defaultLocale)
          ?.code ||
        locales.value.find((item) => item.enabled)?.code ||
        "zh-CN";
    }
    await loadResources();
  } catch (error) {
    ElMessage.error(
      error instanceof Error ? error.message : t("i18nManagement.loadFailed"),
    );
  } finally {
    loading.value = false;
  }
}

async function loadResources() {
  if (!canView.value) return;
  page.value = 1;
  [coverage.value, resources.value] = await Promise.all([
    fetchTranslationCoverage(targetLocale.value),
    fetchTranslationResources(
      resourceType.value,
      targetLocale.value,
      keyword.value.trim(),
    ),
  ]);
}

async function setDefault(code: string) {
  const snapshot = locales.value.map((item) => ({ ...item }));
  locales.value.forEach((item) => {
    item.defaultLocale = item.code === code;
  });
  const current = locales.value.find((item) => item.code === code);
  if (current) current.enabled = true;
  await persistPolicy(snapshot, code);
}

async function changeEnabled(item: LocaleDefinition, enabled: boolean) {
  const snapshot = locales.value.map((entry) => ({ ...entry }));
  item.enabled = enabled;
  await persistPolicy(snapshot);
}

async function persistPolicy(
  snapshot: LocaleDefinition[],
  switchToLocale?: string,
) {
  if (!canConfigure.value) return;
  savingPolicy.value = true;
  try {
    locales.value = await updateLocales(locales.value);
    replaceRuntimeLocaleDefinitions(locales.value);
    if (switchToLocale) await switchApplicationLocale(switchToLocale, true);
    else await ensureEnabledApplicationLocale();
    if (
      !locales.value.some(
        (item) => item.code === targetLocale.value && item.enabled,
      )
    ) {
      targetLocale.value =
        locales.value.find((item) => item.enabled && !item.defaultLocale)
          ?.code ||
        locales.value.find((item) => item.enabled)?.code ||
        "zh-CN";
    }
    ElMessage.success(t("i18nManagement.policySaved"));
  } catch (error) {
    locales.value = snapshot;
    ElMessage.error(
      error instanceof Error ? error.message : t("i18nManagement.saveFailed"),
    );
  } finally {
    savingPolicy.value = false;
  }
}

async function saveTranslation(row: TranslationResource) {
  if (!canUpdate.value || !row.translatedName?.trim()) return;
  savingId.value = row.resourceId;
  try {
    const updated = await updateTranslationResource(row, targetLocale.value, {
      displayName: row.translatedName.trim(),
      description: row.translatedDescription,
      version: row.version || 0,
    });
    Object.assign(row, updated);
    coverage.value = await fetchTranslationCoverage(targetLocale.value);
    if (resourceType.value === "MENU" && targetLocale.value === locale.value) {
      await authStore.refreshAuthorization(true);
    }
    ElMessage.success(t("i18nManagement.translationSaved"));
  } catch (error) {
    ElMessage.error(
      error instanceof Error ? error.message : t("i18nManagement.saveFailed"),
    );
  } finally {
    savingId.value = undefined;
  }
}

watch([targetLocale, resourceType], loadResources);
watch(keyword, () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(loadResources, 280);
});
watch(
  () => runtimeSettings.pageSize,
  (value) => {
    pageSize.value = value;
    page.value = 1;
  },
);
onMounted(async () => {
  await runtimeSettings.load().catch(() => undefined);
  pageSize.value = runtimeSettings.pageSize;
  await loadBase();
});
onUnmounted(() => {
  window.clearTimeout(searchTimer);
});
</script>

<template>
  <DsListPageShell
    :title="t('routes.languageManagement')"
    :loading="canView && loading"
    page-class="language-management-page"
  >
    <template #header-extra>
      <span class="language-page-subtitle">{{
        t("i18nManagement.subtitle")
      }}</span>
    </template>
    <div
      v-if="canView"
      class="language-workspace ds-list-master-detail"
    >
      <aside class="locale-panel ds-list-master-detail__directory">
        <header class="section-heading">
          <span class="section-heading__icon"
            ><el-icon><Setting /></el-icon
          ></span>
          <div>
            <h2>{{ t("i18nManagement.languagePolicy") }}</h2>
            <p>{{ t("i18nManagement.languagePolicyDesc") }}</p>
          </div>
        </header>
        <div class="locale-list">
          <article
            v-for="item in locales"
            :key="item.code"
            class="locale-card"
            :class="{ 'is-default': item.defaultLocale }"
          >
            <div class="locale-card__title">
              <span
                ><strong>{{ item.nativeName }}</strong
                ><small>{{ item.englishName }}</small></span
              >
              <DsTag v-if="item.defaultLocale" type="primary" size="small">{{
                t("i18nManagement.default")
              }}</DsTag>
            </div>
            <div class="locale-card__actions">
              <label
                >{{ t("i18nManagement.enabled") }}
                <el-switch
                  v-permission="'platform:i18n:resource:config'"
                  :model-value="item.enabled"
                  :loading="savingPolicy"
                  :disabled="
                    !canConfigure || item.defaultLocale || savingPolicy
                  "
                  @change="changeEnabled(item, Boolean($event))"
              /></label>
              <el-button
                v-permission="'platform:i18n:resource:config'"
                text
                type="primary"
                :disabled="!canConfigure || item.defaultLocale || savingPolicy"
                @click="setDefault(item.code)"
              >
                <el-icon><Check /></el-icon>{{ t("i18nManagement.default") }}
              </el-button>
            </div>
          </article>
        </div>
        <footer
          class="locale-panel__status"
          :class="{ 'is-saving': savingPolicy }"
        >
          <span class="locale-panel__status-dot" />
          {{
            savingPolicy
              ? t("i18nManagement.applying")
              : t("i18nManagement.appliesImmediately")
          }}
        </footer>
      </aside>

      <section class="translation-panel ds-list-master-detail__content">
        <header class="translation-header">
          <div class="section-heading">
            <span class="section-heading__icon"
              ><el-icon><Collection /></el-icon
            ></span>
            <div>
              <h2>{{ t("i18nManagement.resourceTranslations") }}</h2>
              <p>{{ t("i18nManagement.resourceTranslationsDesc") }}</p>
            </div>
          </div>
          <div class="coverage-meter">
            <span>{{ t("i18nManagement.coverage") }}</span>
            <strong>{{ coveragePercent }}%</strong>
            <el-progress :percentage="coveragePercent" :show-text="false" />
          </div>
        </header>

        <div
          class="translation-toolbar ds-list-filter ds-list-filter--adaptive ds-list-filter--nested"
        >
          <el-select
            v-model="targetLocale"
            :aria-label="t('i18nManagement.targetLanguage')"
          >
            <el-option
              v-for="item in enabledLocales"
              :key="item.code"
              :label="`${item.nativeName} · ${item.code}`"
              :value="item.code"
            />
          </el-select>
          <el-select
            v-model="resourceType"
            :aria-label="t('i18nManagement.resourceType')"
          >
            <el-option
              v-for="type in resourceTypes"
              :key="type"
              :label="typeLabel(type)"
              :value="type"
            />
          </el-select>
          <el-input
            v-model="keyword"
            clearable
            :placeholder="t('i18nManagement.searchPlaceholder')"
          >
            <template #prefix
              ><el-icon><Search /></el-icon
            ></template>
          </el-input>
          <div class="coverage-summary">
            <strong
              >{{ activeCoverage?.translated || 0 }}/{{
                activeCoverage?.total || 0
              }}</strong
            >
            <span>{{ t("i18nManagement.coverage") }}</span>
          </div>
        </div>

        <div
          class="translation-table-wrap ds-list-table-shell ds-list-table-shell--embedded"
        >
          <DsDataTable
            v-if="resources.length"
            :rows="pageResources as unknown as Record<string, unknown>[]"
            :columns="[]"
            row-key="resourceId"
            class="translation-table"
          >
            <el-table-column
              prop="resourceCode"
              label="Code"
              min-width="170"
              show-overflow-tooltip
            />
            <el-table-column
              :label="t('i18nManagement.sourceName')"
              min-width="150"
              show-overflow-tooltip
            >
              <template #default="{ row }"
                ><strong>{{ row.sourceName }}</strong></template
              >
            </el-table-column>
            <el-table-column
              :label="t('i18nManagement.translatedName')"
              min-width="210"
            >
              <template #default="{ row }"
                ><el-input
                  v-model="row.translatedName"
                  maxlength="128"
                  show-word-limit
                  :disabled="!canEnterUpdate"
              /></template>
            </el-table-column>
            <el-table-column
              :label="t('i18nManagement.translatedDescription')"
              min-width="240"
            >
              <template #default="{ row }"
                ><el-input
                  v-model="row.translatedDescription"
                  maxlength="255"
                  :disabled="!canEnterUpdate"
              /></template>
            </el-table-column>
            <el-table-column width="92" fixed="right" align="center">
              <template #default="{ row }">
                <el-button
                  v-permission="'platform:i18n:resource:update'"
                  type="primary"
                  text
                  :loading="savingId === row.resourceId"
                  :disabled="!canUpdate || !row.translatedName?.trim()"
                  @click="saveTranslation(row)"
                >
                  {{ t("i18nManagement.save") }}
                </el-button>
              </template>
            </el-table-column>
          </DsDataTable>
          <DsEmpty
            v-else
            :title="t('i18nManagement.missing')"
            :description="t('i18nManagement.missing')"
          />
          <footer
            v-if="resources.length"
            class="ds-list-table-footer ds-list-table-footer--pagination-only"
          >
            <DsPagination
              v-model:page="page"
              v-model:page-size="pageSize"
              :total="resources.length"
            />
          </footer>
        </div>
      </section>
    </div>
    <DsEmpty
      v-else
      :title="t('i18nManagement.resourceTranslations')"
      :description="t('i18nManagement.missing')"
    />
  </DsListPageShell>
</template>

<style scoped>
.language-page-subtitle {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-body);
  line-height: var(--line-body);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.language-workspace {
  display: grid;
  min-height: 518px;
  grid-template-columns: var(--ds-master-pane-width) minmax(0, 1fr);
  margin: var(--ds-page-filter-py-top) var(--ds-page-inset) var(--space-6);
  border-top: 1px solid var(--ds-list-divider);
}

.locale-panel,
.translation-panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--color-bg-surface);
}

.locale-panel {
  display: flex;
  flex-direction: column;
  padding: var(--space-5) var(--space-4) var(--space-4);
  border-right: 1px solid var(--ds-list-divider);
}

.section-heading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: var(--space-3);
}

.section-heading__icon {
  display: grid;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  place-items: center;
  color: var(--color-text-secondary);
  font-size: 16px;
}

.section-heading h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-h3);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-h3);
}

.section-heading p {
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}

.locale-list {
  display: grid;
  gap: var(--space-3);
  margin-top: var(--space-5);
}

.locale-card {
  padding: var(--space-4);
  border: 1px solid var(--ds-list-divider);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.locale-card.is-default {
  border-color: color-mix(
    in srgb,
    var(--color-primary-500) 62%,
    var(--color-border-default)
  );
  background: color-mix(
    in srgb,
    var(--color-primary-500) 7%,
    var(--color-bg-surface)
  );
  box-shadow: 0 4px 14px
    color-mix(in srgb, var(--color-primary-500) 9%, transparent);
}

.locale-card__title,
.locale-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.locale-card__title span {
  display: grid;
  min-width: 0;
  gap: var(--space-1);
}

.locale-card__title strong {
  color: var(--color-text-primary);
  font-size: var(--font-body);
}

.locale-card__title small,
.locale-card__actions {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.locale-card__actions {
  margin-top: var(--space-4);
}
.locale-card__actions label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.locale-panel__status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: auto;
  padding-top: var(--space-4);
  border-top: 1px solid var(--ds-list-divider);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}

.locale-panel__status-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: var(--color-success-default);
}

.locale-panel__status.is-saving .locale-panel__status-dot {
  background: var(--color-warning-default);
  animation: locale-saving-pulse 1s ease-in-out infinite;
}

@keyframes locale-saving-pulse {
  50% {
    opacity: 0.35;
  }
}

.translation-panel {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  padding: var(--space-5) var(--space-4) var(--space-4);
}

.translation-header {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-6);
}

.coverage-meter {
  display: grid;
  min-width: 220px;
  grid-template-columns: auto auto;
  align-items: center;
  gap: var(--space-1) var(--space-3);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.coverage-meter strong {
  justify-self: end;
  color: var(--color-text-primary);
  font-size: var(--font-h2);
}

.coverage-meter :deep(.el-progress) {
  grid-column: 1 / -1;
}

.translation-toolbar {
  display: grid;
  grid-template-columns: 180px 190px minmax(220px, 1fr) 88px;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-5) 0 var(--space-4);
}

.coverage-summary {
  display: grid;
  justify-items: end;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.coverage-summary strong {
  color: var(--color-text-primary);
  font-size: var(--font-body);
}

.translation-table-wrap {
  min-width: 0;
  min-height: 0;
}

.translation-table {
  width: 100%;
}

.translation-table:deep(.el-scrollbar__thumb:hover) {
  background-color: var(--ds-scrollbar-thumb-hover) !important;
}

@media (max-width: 1180px) {
  .language-workspace {
    grid-template-columns: var(--ds-master-pane-width-compact) minmax(0, 1fr);
  }
  .translation-toolbar {
    grid-template-columns: 1fr 1fr;
  }
  .coverage-summary {
    justify-items: start;
  }
}

@media (max-width: 860px) {
  .language-workspace {
    height: auto;
    grid-template-columns: 1fr;
    overflow: visible;
  }
  .locale-panel {
    padding: var(--space-4);
    border-right: 0;
    border-bottom: 1px solid var(--ds-list-divider);
  }
  .locale-list {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
  .locale-panel__status {
    margin-top: 16px;
  }
  .translation-panel {
    min-height: 560px;
    padding: var(--space-4);
  }
}
</style>
