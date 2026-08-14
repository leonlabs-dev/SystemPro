<script setup lang="ts">
import {
  Aim,
  ArrowDown,
  ArrowUp,
  Briefcase,
  Grid,
  List,
  MagicStick,
  Moon,
  MoreFilled,
  Search,
  Setting,
  Sunny,
  SwitchButton,
  View,
} from "@element-plus/icons-vue";
import { computed, onActivated, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import LIGHTING_DEVICE_IMAGE from "@/assets/images/lighting/light-display.webp";
import { ApiError } from "@/core/api/contracts";
import { fetchAllPages } from "@/core/api/pagination";
import { useAuthStore } from "@/core/auth/auth.store";
import { useRuntimeSettingsStore } from "@/core/settings/runtime-settings.store";
import DsEmpty from "@/design-system/components/DsEmpty.vue";
import DsDataTable from "@/design-system/components/DsDataTable.vue";
import DsDeviceCommandConsole from "@/design-system/components/DsDeviceCommandConsole.vue";
import DsListPageShell from "@/design-system/components/DsListPageShell.vue";
import DsPagination from "@/design-system/components/DsPagination.vue";
import DsTag from "@/design-system/components/DsTag.vue";
import {
  deviceAssetApi,
  deviceAssetPermissions,
  deviceSystemApi,
  deviceSystemPermissions,
  type DeviceAsset,
  type DeviceAssetListItem,
} from "@/domain/iot/assets/device-system";
import { fetchSpaceTree } from "@/domain/platform/org/api/space.api";
import type { ResourceNode } from "@/domain/platform/org/resource";

type Communication = "ONLINE" | "OFFLINE" | "WARNING" | "MAINTENANCE";
type LightingRuntime = {
  communication: Communication;
  brightness: number | null;
  colorTemperature: number | null;
  todayEnergy: number;
  updatedAt: string;
};
type Row = DeviceAsset & {
  systemId: string;
  systemName: string;
  systemMode: string;
  runtime: LightingRuntime;
};
type Association = "ASSIGNED" | "UNASSIGNED";

const { t, te } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const runtimeSettings = useRuntimeSettingsStore();
const permissions = deviceAssetPermissions("LIGHTING");
const systemPermissions = deviceSystemPermissions("LIGHTING");
const loading = ref(true);
const rows = ref<Row[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(runtimeSettings.pageSize);
const keyword = ref("");
const subtype = ref("");
const systemId = ref("");
const spaceId = ref("");
const communication = ref("");
const association = ref<Association>("ASSIGNED");
const viewMode = ref<"card" | "list">("card");
const selectedIds = ref<number[]>([]);
const consoleExpanded = ref(false);
const pendingAction = ref("");
const brightness = ref(80);
const colorTemperature = ref(4000);
const lastCommand = ref("");
const systems = ref<Array<[string, string]>>([]);
const spaces = ref<ResourceNode[]>([]);
let keywordTimer: number | undefined;

const canView = computed(() => auth.can(permissions.view));
const canControl = computed(() => auth.can(permissions.control));
const canExploreEdit = computed(() => auth.canEnterAll([permissions.update, systemPermissions.update]));
const canExploreControl = computed(() => auth.canEnter(permissions.control));
const filteredRows = computed(() =>
  communication.value
    ? rows.value.filter(
        (row) => row.runtime.communication === communication.value,
      )
    : rows.value,
);
const selectedRows = computed(() =>
  rows.value.filter((row) => selectedIds.value.includes(Number(row.id))),
);
const allPageSelected = computed(
  () =>
    filteredRows.value.length > 0 &&
    filteredRows.value.every((row) =>
      selectedIds.value.includes(Number(row.id)),
    ),
);
const subtypes = [
  "CEILING_LIGHT",
  "LINEAR_LIGHT",
  "DOWNLIGHT",
  "PENDANT_LIGHT",
  "SPOTLIGHT",
  "INDUSTRIAL_LIGHT",
  "WALL_LIGHT",
  "STREET_LIGHT",
  "DISTRIBUTION_CABINET",
  "LIGHT_CONTROLLER",
  "LUMINAIRE_GROUP",
];

function labelSubtype(value: string) {
  const key = `deviceSystemPage.subtype.${value}`;
  return te(key) ? t(key) : value;
}

function buildRuntime(asset: DeviceAsset): LightingRuntime {
  const seed = Number(asset.id) * 31 + asset.name.length * 7;
  const communicationStatus: Communication =
    asset.status !== "ACTIVE"
      ? "OFFLINE"
      : seed % 17 === 0
        ? "MAINTENANCE"
        : seed % 11 === 0
          ? "WARNING"
          : seed % 7 === 0
            ? "OFFLINE"
            : "ONLINE";
  const reachable =
    communicationStatus === "ONLINE" || communicationStatus === "WARNING";
  return {
    communication: communicationStatus,
    brightness: reachable ? 20 + (seed % 9) * 10 : null,
    colorTemperature: reachable
      ? [2700, 3000, 4000, 5000, 6500][seed % 5]
      : null,
    todayEnergy: reachable ? Number((0.2 + (seed % 240) / 100).toFixed(2)) : 0,
    updatedAt: reachable
      ? `${String(8 + (seed % 4)).padStart(2, "0")}:${String(seed % 60).padStart(2, "0")}`
      : "--",
  };
}

function enrich(item: DeviceAssetListItem): Row {
  return {
    ...item.asset,
    systemId: item.systemId || "",
    systemName: item.systemName || t("deviceSystemPage.lifecycle.unassigned"),
    systemMode: item.systemMode || "",
    runtime: buildRuntime(item.asset),
  };
}

function showError(error: unknown) {
  ElMessage.error(
    error instanceof ApiError
      ? error.message
      : t("deviceSystemPage.lightingConsole.messages.loadFailed"),
  );
}

async function load() {
  if (!auth.can(permissions.view)) return;
  loading.value = true;
  try {
    const query = {
      keyword: keyword.value.trim() || undefined,
      subtype: subtype.value || undefined,
      systemId:
        association.value === "ASSIGNED"
          ? systemId.value || undefined
          : undefined,
      spaceId: spaceId.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    };
    const result =
      association.value === "UNASSIGNED"
        ? await deviceAssetApi.unassigned("LIGHTING", query)
        : await deviceAssetApi.page("LIGHTING", query);
    rows.value = result.items.map(enrich);
    total.value = result.total;
    selectedIds.value = selectedIds.value.filter((id) =>
      rows.value.some((row) => Number(row.id) === id),
    );
  } catch (error) {
    showError(error);
  } finally {
    loading.value = false;
  }
}

async function loadFoundations() {
  try {
    const [systemRows, spaceTree] = await Promise.all([
      fetchAllPages((page, pageSize) => deviceSystemApi.page("LIGHTING", { page, pageSize })),
      fetchSpaceTree(),
    ]);
    systems.value = systemRows.map((item) => [item.id, item.name]);
    spaces.value = spaceTree;
  } catch (error) {
    showError(error);
  }
}

function switchView(mode: "card" | "list") {
  viewMode.value = mode;
}

function togglePageSelection() {
  const ids = filteredRows.value.map((row) => Number(row.id));
  selectedIds.value = allPageSelected.value
    ? selectedIds.value.filter((id) => !ids.includes(id))
    : [...new Set([...selectedIds.value, ...ids])];
}

function toggleSelection(id: number, checked: boolean) {
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, id])]
    : selectedIds.value.filter((item) => item !== id);
}

function chooseAction(action: string) {
  if (
    !canExploreControl.value ||
    !selectedRows.value.length ||
    association.value === "UNASSIGNED"
  ) {
    if (!selectedRows.value.length)
      ElMessage.warning(
        t("deviceSystemPage.lightingConsole.messages.selectFirst"),
      );
    return;
  }
  pendingAction.value = pendingAction.value === action ? "" : action;
}

function applyAction() {
  if (!canControl.value || !pendingAction.value || !selectedRows.value.length) return;
  const detail =
    pendingAction.value === "DIM"
      ? `${brightness.value}%`
      : pendingAction.value === "COLOR_TEMPERATURE"
        ? `${colorTemperature.value}K`
        : "";
  lastCommand.value = `${t(`deviceSystemPage.lightingConsole.actions.${pendingAction.value}`)}${detail ? ` · ${detail}` : ""} · ${selectedRows.value.length}`;
  ElMessage.success(
    t("deviceSystemPage.lightingConsole.messages.recorded", {
      count: selectedRows.value.length,
    }),
  );
}

function resetFilters() {
  keyword.value = "";
  subtype.value = "";
  systemId.value = "";
  spaceId.value = "";
  communication.value = "";
  page.value = 1;
  void load();
}

function statusTone(value: Communication) {
  return value === "ONLINE"
    ? "success"
    : value === "WARNING"
      ? "error"
      : value === "MAINTENANCE"
        ? "warning"
        : "neutral";
}

function statusLabel(value: Communication) {
  return value === "MAINTENANCE"
    ? t("deviceSystemPage.lightingConsole.maintenance")
    : t(`deviceSystemPage.communication.${value}`);
}

function editSystem(row: Row) {
  if (!canExploreEdit.value || !row.systemId) return;
  router.push({ path: "/assets/lighting", query: { edit: row.systemId } });
}

watch(
  [page, pageSize, subtype, systemId, spaceId, association],
  () => void load(),
);
watch(keyword, () => {
  if (keywordTimer) window.clearTimeout(keywordTimer);
  keywordTimer = window.setTimeout(() => {
    page.value = 1;
    void load();
  }, 350);
});
watch(
  () => runtimeSettings.pageSize,
  (value) => {
    pageSize.value = value;
    page.value = 1;
  },
);
onMounted(async () => {
  await runtimeSettings.load();
  pageSize.value = runtimeSettings.pageSize;
  viewMode.value = runtimeSettings.deviceDefaultView === 'LIST' ? 'list' : 'card';
  await loadFoundations();
});
onActivated(load);
</script>

<template>
  <DsListPageShell
    :title="t('deviceSystemPage.deviceAsset.title.LIGHTING')"
    page-class="lighting-device-page ds-domain-dense"
    :loading="canView && loading"
  >
    <template v-if="canView">
      <DsDeviceCommandConsole
        class="ds-device-console--device-standard ds-device-console--lighting"
        :class="{ 'is-expanded': consoleExpanded }"
      >
        <template #heading
          ><div>
            <span class="device-console-title">{{
              t("deviceSystemPage.deviceAsset.control.console")
            }}</span
            ><span>{{
              t("deviceSystemPage.deviceAsset.control.selected", {
                selected: selectedRows.length,
                total,
              })
            }}</span
            ><el-button
              class="device-console-toggle"
              link
              type="primary"
              @click="consoleExpanded = !consoleExpanded"
              >{{
                t(
                  consoleExpanded
                    ? "deviceSystemPage.hvacConsole.collapse"
                    : "deviceSystemPage.hvacConsole.expand",
                )
              }}<el-icon
                ><ArrowUp v-if="consoleExpanded" /><ArrowDown v-else /></el-icon
            ></el-button>
          </div>
          <el-button
            link
            type="primary"
            :disabled="!selectedRows.length"
            @click="selectedIds = []"
            >{{ t("deviceSystemPage.hvacConsole.clear") }}</el-button
          ></template
        >
        <template #actions>
          <article class="power-control">
            <h3>{{ t("deviceSystemPage.lightingConsole.power") }}</h3>
            <div class="power-actions">
              <el-button
                v-permission.preview="permissions.control"
                :class="{ active: pendingAction === 'POWER_ON' }"
                :icon="SwitchButton"
                :disabled="!selectedRows.length"
                @click="chooseAction('POWER_ON')"
                >{{ t("deviceSystemPage.lightingConsole.powerOn") }}</el-button
              ><el-button
                v-permission.preview="permissions.control"
                :class="{ active: pendingAction === 'POWER_OFF' }"
                :disabled="!selectedRows.length"
                @click="chooseAction('POWER_OFF')"
                >{{ t("deviceSystemPage.lightingConsole.powerOff") }}</el-button
              >
            </div>
          </article>
          <article class="scene-control">
            <h3>{{ t("deviceSystemPage.lightingConsole.scenes") }}</h3>
            <div class="scene-actions">
              <el-button
                v-permission.preview="permissions.control"
                :class="{ active: pendingAction === 'SCENE_OFFICE' }"
                :disabled="!selectedRows.length"
                @click="chooseAction('SCENE_OFFICE')"
                ><el-icon><Briefcase /></el-icon
                >{{ t("deviceSystemPage.lightingConsole.office") }}</el-button
              ><el-button
                v-permission.preview="permissions.control"
                :class="{ active: pendingAction === 'SCENE_ENERGY' }"
                :disabled="!selectedRows.length"
                @click="chooseAction('SCENE_ENERGY')"
                ><el-icon><MagicStick /></el-icon
                >{{
                  t("deviceSystemPage.lightingConsole.energySaving")
                }}</el-button
              ><el-button
                v-permission.preview="permissions.control"
                :class="{ active: pendingAction === 'SCENE_PATROL' }"
                :disabled="!selectedRows.length"
                @click="chooseAction('SCENE_PATROL')"
                ><el-icon><Aim /></el-icon
                >{{ t("deviceSystemPage.lightingConsole.patrol") }}</el-button
              ><el-button
                v-permission.preview="permissions.control"
                :class="{ active: pendingAction === 'SCENE_NIGHT' }"
                :disabled="!selectedRows.length"
                @click="chooseAction('SCENE_NIGHT')"
                ><el-icon><Moon /></el-icon
                >{{ t("deviceSystemPage.lightingConsole.night") }}</el-button
              >
            </div>
          </article>
        </template>
        <template #parameters>
          <div class="lighting-command-row">
            <article class="brightness-control">
              <h3>{{ t("deviceSystemPage.lightingConsole.brightness") }}</h3>
              <div class="slider-row">
                <el-icon><Sunny /></el-icon
                ><el-slider
                  v-model="brightness"
                  :disabled="!selectedRows.length"
                  @change="chooseAction('DIM')"
                /><strong>{{ brightness }}%</strong>
              </div>
            </article>
            <article class="temperature-control">
              <h3>
                {{ t("deviceSystemPage.lightingConsole.colorTemperature") }}
              </h3>
              <div class="temperature-actions">
                <el-button
                  v-permission.preview="permissions.control"
                  v-for="item in [
                    [2700, 'warm'],
                    [4000, 'neutral'],
                    [6500, 'cool'],
                  ]"
                  :key="item[0]"
                  :class="{
                    active:
                      pendingAction === 'COLOR_TEMPERATURE' &&
                      colorTemperature === item[0],
                  }"
                  :disabled="!selectedRows.length"
                  @click="
                    colorTemperature = Number(item[0]);
                    chooseAction('COLOR_TEMPERATURE');
                  "
                  ><strong>{{
                    t(`deviceSystemPage.lightingConsole.${item[1]}`)
                  }}</strong
                  ><small>{{ item[0] }}K</small></el-button
                >
              </div>
            </article>
          </div>
        </template>
        <template #confirm
          ><div class="lighting-command-summary">
            <h3>{{ t("deviceSystemPage.lightingConsole.controlStatus") }}</h3>
            <dl>
              <div>
                <dt>
                  {{ t("deviceSystemPage.lightingConsole.targetDevices") }}
                </dt>
                <dd>{{ selectedRows.length }}</dd>
              </div>
              <div>
                <dt>
                  {{ t("deviceSystemPage.lightingConsole.selectedAction") }}
                </dt>
                <dd>
                  {{
                    pendingAction
                      ? t(
                          `deviceSystemPage.lightingConsole.actions.${pendingAction}`,
                        )
                      : t("deviceSystemPage.lightingConsole.notSelected")
                  }}
                </dd>
              </div>
            </dl>
            <small>{{
              lastCommand || t("deviceSystemPage.lightingConsole.notExecuted")
            }}</small
            ><el-button
              v-permission="permissions.control"
              type="primary"
              :disabled="!pendingAction || !selectedRows.length || !canControl"
              @click="applyAction"
              >{{ t("deviceSystemPage.lightingConsole.apply") }}</el-button
            >
          </div></template
        >
      </DsDeviceCommandConsole>

      <section class="lighting-query-panel">
        <header>
          <div>
            <strong>{{
              t("deviceSystemPage.lightingConsole.filtersTitle")
            }}</strong
            ><span>{{
              t("deviceSystemPage.lightingConsole.filtersHint")
            }}</span>
          </div>
          <div class="asset-range">
            <label>{{ t("deviceSystemPage.lightingConsole.assetRange") }}</label
            ><el-radio-group v-model="association" size="small"
              ><el-radio-button label="ASSIGNED">{{
                t("deviceSystemPage.lightingConsole.assigned")
              }}</el-radio-button
              ><el-radio-button label="UNASSIGNED">{{
                t("deviceSystemPage.lightingConsole.unassigned")
              }}</el-radio-button></el-radio-group
            >
          </div>
        </header>
        <div class="lighting-filters ds-list-filter ds-list-filter--adaptive">
          <div class="lighting-filter-fields">
            <el-select
              v-model="systemId"
              clearable
              :disabled="association === 'UNASSIGNED'"
              :placeholder="t('deviceSystemPage.lightingConsole.allSystems')"
              ><el-option
                v-for="item in systems"
                :key="item[0]"
                :value="item[0]"
                :label="item[1]"
            /></el-select>
            <el-tree-select
              v-model="spaceId"
              :data="spaces"
              node-key="id"
              check-strictly
              clearable
              filterable
              :placeholder="t('deviceSystemPage.lightingConsole.allSpaces')"
              :props="{ label: 'name', children: 'children', value: 'id' }"
            />
            <el-select
              v-model="communication"
              clearable
              :placeholder="t('deviceSystemPage.lightingConsole.allStates')"
              ><el-option
                v-for="item in ['ONLINE', 'OFFLINE', 'WARNING', 'MAINTENANCE']"
                :key="item"
                :value="item"
                :label="statusLabel(item as Communication)"
            /></el-select>
            <el-select
              v-model="subtype"
              clearable
              :placeholder="t('deviceSystemPage.deviceAsset.filters.subtype')"
              ><el-option
                v-for="item in subtypes"
                :key="item"
                :value="item"
                :label="labelSubtype(item)"
            /></el-select>
            <el-input
              v-model="keyword"
              clearable
              :prefix-icon="Search"
              :placeholder="t('deviceSystemPage.deviceAsset.filters.keyword')"
            />
            <el-button @click="resetFilters">{{
              t("deviceSystemPage.actions.reset")
            }}</el-button>
          </div>
          <el-button-group class="view-switch"
            ><el-button
              :type="viewMode === 'card' ? 'primary' : 'default'"
              :icon="Grid"
              @click="switchView('card')" /><el-button
              :type="viewMode === 'list' ? 'primary' : 'default'"
              :icon="List"
              @click="switchView('list')"
          /></el-button-group>
        </div>
      </section>

      <section class="selection-bar">
        <el-checkbox
          :model-value="allPageSelected"
          :indeterminate="selectedRows.length > 0 && !allPageSelected"
          :disabled="association === 'UNASSIGNED' || !filteredRows.length"
          @change="togglePageSelection"
        />
        <strong>{{
          t("deviceSystemPage.lightingConsole.selected", {
            count: selectedRows.length,
          })
        }}</strong>
        <span>{{
          association === "UNASSIGNED"
            ? t("deviceSystemPage.lightingConsole.unassignedHint")
            : t("deviceSystemPage.lightingConsole.mockBoundary")
        }}</span>
        <div class="selection-actions">
          <span>{{
            lastCommand ||
            t(
              selectedRows.length
                ? "deviceSystemPage.lightingConsole.chooseAction"
                : "deviceSystemPage.lightingConsole.selectDevice",
            )
          }}</span>
        </div>
      </section>

      <section class="lighting-content ds-list-table-shell">
        <div
          v-if="viewMode === 'card' && filteredRows.length"
          class="lighting-grid"
        >
          <article
            v-for="row in filteredRows"
            :key="row.id"
            class="lighting-card"
            :class="{ selected: selectedIds.includes(Number(row.id)) }"
          >
            <header>
              <el-checkbox
                v-if="association === 'ASSIGNED'"
                :model-value="selectedIds.includes(Number(row.id))"
                :aria-label="row.name"
                @change="toggleSelection(Number(row.id), Boolean($event))"
              />
              <div>
                <strong :title="row.name">{{ row.name }}</strong
                ><small>{{ row.code }}</small>
              </div>
              <DsTag :type="statusTone(row.runtime.communication)">{{
                statusLabel(row.runtime.communication)
              }}</DsTag>
            </header>
            <p class="space-path" :title="row.installSpaceName">
              {{ row.installSpaceName }}
            </p>
            <div class="lighting-reading">
              <div class="device-image-slot">
                <img
                  :src="LIGHTING_DEVICE_IMAGE"
                  :alt="`${row.name} · ${labelSubtype(row.subtype)}`"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div class="lighting-metrics">
                <span>{{ labelSubtype(row.subtype) }}</span>
                <div>
                  <label>{{
                    t("deviceSystemPage.lightingConsole.brightness")
                  }}</label
                  ><el-progress
                    :percentage="row.runtime.brightness || 0"
                    :show-text="false"
                  /><strong>{{
                    row.runtime.brightness == null
                      ? "--"
                      : `${row.runtime.brightness}%`
                  }}</strong>
                </div>
                <div>
                  <label>{{
                    t("deviceSystemPage.lightingConsole.colorTemperature")
                  }}</label
                  ><strong>{{
                    row.runtime.colorTemperature == null
                      ? "--"
                      : `${row.runtime.colorTemperature}K`
                  }}</strong>
                </div>
              </div>
            </div>
            <div class="lighting-meta">
              <span
                >{{ t("deviceSystemPage.lightingConsole.todayEnergy") }}
                <strong>{{ row.runtime.todayEnergy }} kWh</strong></span
              ><span
                >{{ t("deviceSystemPage.lightingConsole.updated") }}
                <strong>{{ row.runtime.updatedAt }}</strong></span
              >
            </div>
            <footer class="ds-card-actions">
              <el-button
                v-permission.preview="permissions.control"
                :disabled="association === 'UNASSIGNED'"
                :icon="SwitchButton"
                @click="
                  toggleSelection(Number(row.id), true);
                  chooseAction('POWER_ON');
                "
                >{{ t("deviceSystemPage.lightingConsole.switch") }}</el-button
              ><el-button
                v-permission.preview="permissions.control"
                :disabled="association === 'UNASSIGNED'"
                :icon="MagicStick"
                @click="
                  toggleSelection(Number(row.id), true);
                  chooseAction('SCENE_OFFICE');
                "
                >{{ t("deviceSystemPage.lightingConsole.scene") }}</el-button
              ><el-dropdown
                ><el-button :icon="MoreFilled">{{
                  t("deviceSystemPage.actions.more")
                }}</el-button
                ><template #dropdown
                  ><el-dropdown-menu
                    ><el-dropdown-item
                      v-if="auth.canShow(permissions.control)"
                      :icon="Sunny"
                      :disabled="association === 'UNASSIGNED' || !canExploreControl"
                      @click="
                        toggleSelection(Number(row.id), true);
                        chooseAction('DIM');
                      "
                      >{{
                        t("deviceSystemPage.lightingConsole.dim")
                      }}</el-dropdown-item
                    ><el-dropdown-item :icon="View">{{
                      t("deviceSystemPage.actions.view")
                    }}</el-dropdown-item
                    ><el-dropdown-item
                      v-if="auth.canShowAll([permissions.update, systemPermissions.update])"
                      :icon="Setting"
                      :disabled="!row.systemId || !canExploreEdit"
                      @click="editSystem(row)"
                      >{{
                        t("deviceSystemPage.actions.edit")
                      }}</el-dropdown-item
                    ></el-dropdown-menu
                  ></template
                ></el-dropdown
              >
            </footer>
          </article>
        </div>
        <DsDataTable
          v-else-if="viewMode === 'list' && filteredRows.length"
          :rows="filteredRows as unknown as Record<string, unknown>[]"
          :columns="[]"
          table-layout="fixed"
          ><el-table-column width="46"
            ><template #default="{ row }"
              ><el-checkbox
                v-if="association === 'ASSIGNED'"
                :model-value="selectedIds.includes(Number(row.id))"
                @change="
                  toggleSelection(Number(row.id), Boolean($event))
                " /></template></el-table-column
          ><el-table-column
            prop="name"
            :label="t('deviceSystemPage.deviceAsset.labels.device')"
            min-width="190"
            show-overflow-tooltip
          /><el-table-column
            prop="code"
            :label="t('deviceSystemPage.labels.assetCode')"
            min-width="150"
            show-overflow-tooltip
          /><el-table-column
            :label="t('deviceSystemPage.deviceAsset.labels.subtype')"
            width="130"
            ><template #default="{ row }">{{
              labelSubtype(row.subtype)
            }}</template></el-table-column
          ><el-table-column
            prop="systemName"
            :label="t('deviceSystemPage.deviceAsset.labels.system')"
            min-width="190"
            show-overflow-tooltip
          /><el-table-column
            prop="installSpaceName"
            :label="t('deviceSystemPage.deviceAsset.labels.installSpace')"
            min-width="180"
            show-overflow-tooltip
          /><el-table-column
            :label="t('deviceSystemPage.lightingConsole.brightness')"
            width="100"
            ><template #default="{ row }">{{
              row.runtime.brightness == null
                ? "--"
                : `${row.runtime.brightness}%`
            }}</template></el-table-column
          ><el-table-column
            :label="t('deviceSystemPage.deviceAsset.labels.communication')"
            width="100"
            ><template #default="{ row }"
              ><DsTag :type="statusTone(row.runtime.communication)">{{
                statusLabel(row.runtime.communication)
              }}</DsTag></template
            ></el-table-column
          ><el-table-column
            :label="t('deviceSystemPage.deviceAsset.labels.operation')"
            fixed="right"
            width="176"
            ><template #default="{ row }"
              ><div class="ds-row-actions">
                <el-button
                  v-permission.preview="permissions.control"
                  link
                  type="primary"
                  :disabled="association === 'UNASSIGNED'"
                  @click="
                    toggleSelection(Number(row.id), true);
                    chooseAction('POWER_ON');
                  "
                  >{{ t("deviceSystemPage.lightingConsole.switch") }}</el-button
                ><el-button
                  v-permission.preview="[permissions.update, systemPermissions.update]"
                  link
                  :disabled="!row.systemId"
                  @click="editSystem(row)"
                  >{{ t("deviceSystemPage.actions.edit") }}</el-button
                ><el-dropdown
                  ><el-button link>{{
                    t("deviceSystemPage.actions.more")
                  }}</el-button
                  ><template #dropdown
                    ><el-dropdown-menu
                      ><el-dropdown-item
                        v-if="auth.canShow(permissions.control)"
                        :icon="Sunny"
                        :disabled="association === 'UNASSIGNED' || !canExploreControl"
                        @click="
                          toggleSelection(Number(row.id), true);
                          chooseAction('DIM');
                        "
                        >{{
                          t("deviceSystemPage.lightingConsole.dim")
                        }}</el-dropdown-item
                      ><el-dropdown-item :icon="View">{{
                        t("deviceSystemPage.actions.view")
                      }}</el-dropdown-item></el-dropdown-menu
                    ></template
                  ></el-dropdown
                >
              </div></template
            ></el-table-column
          ></DsDataTable
        >
        <DsEmpty
          v-if="!loading && !filteredRows.length"
          :title="t('deviceSystemPage.lightingConsole.emptyTitle')"
          :description="
            association === 'UNASSIGNED'
              ? t('deviceSystemPage.lightingConsole.unassignedEmpty')
              : t('deviceSystemPage.lightingConsole.emptyDescription')
          "
        />
        <footer
          v-if="total"
          class="lighting-pagination ds-list-table-footer ds-list-table-footer--pagination-only"
        >
          <DsPagination
            v-model:page="page"
            v-model:page-size="pageSize"
            :total="total"
          />
        </footer>
      </section>
    </template>
    <DsEmpty
      v-else
      :description="t('deviceSystemPage.empty.permissionDenied')"
    />
  </DsListPageShell>
</template>

<style scoped>
.lighting-device-page {
  min-width: 0;
  max-width: 100%;
  overflow-x: clip;
}
.lighting-device-page :deep(.ds-list-page-card) {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}
.lighting-header-actions {
  display: flex;
  min-width: 0;
  gap: 8px;
}
.lighting-control-board,
.lighting-filters,
.selection-bar,
.lighting-content,
.lighting-pagination {
  width: calc(100% - 28px);
  min-width: 0;
  max-width: calc(100% - 28px);
}
.power-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.slider-row {
  display: grid;
  align-items: center;
}
.temperature-actions,
.scene-actions {
  display: grid;
}
.lighting-control-board .active {
  color: var(--color-primary-500);
  border-color: var(--color-primary-500);
  background: var(--color-primary-50);
}
.lighting-filters {
  margin: 10px 14px 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.lighting-filter-fields {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(160px, 210px) minmax(170px, 230px) minmax(
      140px,
      170px
    ) minmax(150px, 190px) minmax(240px, 360px) 68px;
  gap: 8px;
}
.lighting-filter-fields > * {
  min-width: 0;
  max-width: 100%;
}
.lighting-filter-fields :deep(.el-input),
.lighting-filter-fields :deep(.el-select),
.lighting-filter-fields :deep(.el-tree-select),
.lighting-filter-fields :deep(.el-input__wrapper),
.lighting-filter-fields :deep(.el-select__wrapper) {
  width: 100%;
  min-width: 0;
}
.view-switch {
  min-width: 78px;
  margin-left: auto;
  flex: 0 0 78px;
  display: flex;
  justify-content: flex-end;
}
.view-switch :deep(.el-button) {
  width: 39px;
  min-width: 39px;
  padding: 0;
}
.selection-bar {
  min-height: 48px;
  margin: 10px 14px 0;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  overflow: hidden;
}
.selection-bar > span {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selection-actions {
  min-width: 0;
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.selection-actions span {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lighting-content {
  min-height: 260px;
  margin: 10px 14px 0;
  overflow: hidden;
}
.lighting-grid {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.lighting-card {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  overflow: hidden;
}
.lighting-card.selected {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 1px var(--color-primary-500);
}
.lighting-card > header {
  min-width: 0;
  min-height: 54px;
  padding: 9px 10px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  overflow: hidden;
}
.lighting-card > header > div {
  min-width: 0;
  display: grid;
  gap: 2px;
  flex: 1;
}
.lighting-card > header strong,
.lighting-card > header small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lighting-card > header small,
.space-path {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}
.space-path {
  height: 30px;
  margin: 0;
  padding: 0 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lighting-reading {
  min-width: 0;
  min-height: 112px;
  padding: 8px 10px;
  display: grid;
  grid-template-columns: minmax(72px, 96px) minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  overflow: hidden;
  background: color-mix(
    in srgb,
    var(--color-primary-50) 38%,
    var(--color-bg-surface)
  );
}
.device-image-slot {
  min-width: 0;
  height: 90px;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.device-image-slot img {
  display: block;
  width: 94px;
  height: 76px;
  object-fit: contain;
  filter: drop-shadow(0 8px 10px rgb(15 23 42 / 14%));
}
html[data-theme="dark"] .device-image-slot img {
  filter: drop-shadow(0 8px 12px rgb(0 0 0 / 34%));
}
.lighting-metrics {
  min-width: 0;
  display: grid;
  gap: 8px;
}
.lighting-metrics > span {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lighting-metrics > div {
  min-width: 0;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 44px;
  align-items: center;
  gap: 7px;
  font-size: var(--font-caption);
}
.lighting-metrics > div:last-child {
  grid-template-columns: 38px minmax(0, 1fr);
}
.lighting-metrics label {
  color: var(--color-text-secondary);
}
.lighting-meta {
  min-width: 0;
  padding: 8px 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}
.lighting-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lighting-meta span:last-child {
  text-align: right;
}
.lighting-meta strong {
  color: var(--color-text-primary);
  font-weight: 500;
}
.lighting-card > footer {
  min-width: 0;
  padding: 7px 8px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  border-top: 1px solid var(--color-border-default);
  overflow: hidden;
}
.lighting-card > footer > * {
  min-width: 0;
  max-width: 100%;
}
.lighting-card > footer :deep(.el-button) {
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 7px 2px;
  overflow: hidden;
}
.lighting-card > footer :deep(.el-button span) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lighting-pagination {
  margin: 10px 14px 14px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border-default);
  overflow: hidden;
}
html[data-theme="dark"] .lighting-control-board .active {
  background: color-mix(
    in srgb,
    var(--color-primary-500) 16%,
    var(--color-bg-surface)
  );
}

.lighting-command-row {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(160px, 0.8fr) minmax(220px, 1.1fr) minmax(
      250px,
      1.25fr
    );
  gap: 10px;
}
.power-actions :deep(.el-button) {
  width: 100%;
  min-width: 0;
  height: 34px;
  margin: 0;
  padding: 5px 6px;
}
.slider-row {
  height: 34px;
  grid-template-columns: 20px minmax(72px, 1fr) 38px;
  gap: 7px;
}
.slider-row :deep(.el-icon) {
  font-size: 18px;
  color: var(--color-primary-500);
}
.temperature-actions {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}
.temperature-actions :deep(.el-button) {
  width: 100%;
  min-width: 0;
  height: 34px;
  margin: 0;
  padding: 3px;
  display: grid;
  gap: 0;
}
.temperature-actions strong {
  font-size: 10px;
}
.temperature-actions small {
  color: var(--color-text-secondary);
  font-size: 9px;
}
.temperature-actions strong,
.temperature-actions small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.scene-actions {
  width: min(100%, 440px);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}
.scene-actions :deep(.el-button) {
  width: 100%;
  min-width: 0;
  height: 30px;
  margin: 0;
  padding: 4px 6px;
  display: flex;
  gap: 4px;
  overflow: hidden;
}
.lighting-command-summary {
  min-width: 0;
  padding: 2px 0 0 8px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--color-border-default);
}
.lighting-command-summary dl {
  margin: 0;
  display: grid;
  gap: 5px;
}
.lighting-command-summary dl > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.lighting-command-summary dt {
  color: var(--color-text-secondary);
  font-size: 11px;
}
.lighting-command-summary dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 11px;
  font-weight: 600;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lighting-command-summary > small {
  min-height: 16px;
  margin: 6px 0;
  color: var(--color-text-secondary);
  font-size: 10px;
  line-height: 16px;
}
.lighting-command-summary :deep(.el-button) {
  width: 100%;
  height: 32px;
  margin-top: auto;
}
.lighting-query-panel {
  width: calc(100% - 28px);
  min-width: 0;
  max-width: calc(100% - 28px);
  margin: 10px 14px 0;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  overflow: hidden;
}
.lighting-query-panel > header {
  min-height: 38px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--color-border-default);
}
.lighting-query-panel > header > div:first-child {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.lighting-query-panel > header span {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-range {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.asset-range label {
  color: var(--color-text-secondary);
  font-size: 11px;
}
.asset-range :deep(.el-radio-button__inner) {
  padding: 6px 10px;
}
.lighting-filters {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 8px 10px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.lighting-table-actions {
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}
.selection-bar {
  min-height: 42px;
  margin-top: 8px;
  background: color-mix(
    in srgb,
    var(--color-primary-soft) 48%,
    var(--color-bg-surface)
  );
}
@media (max-width: 1400px) {
  .lighting-console-layout {
    grid-template-columns: 188px minmax(0, 1fr) 190px;
  }
  .lighting-command-row {
    grid-template-columns: minmax(145px, 0.75fr) minmax(190px, 1fr) minmax(
        220px,
        1.1fr
      );
  }
  .lighting-filter-fields {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .lighting-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 1180px) {
  .lighting-console-layout {
    grid-template-columns: 190px minmax(0, 1fr);
  }
  .lighting-command-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .temperature-control {
    grid-column: 1/-1;
  }
  .lighting-command-summary {
    grid-column: 1/-1;
    padding: 8px 0 0;
    display: grid;
    grid-template-columns: 100px minmax(260px, 1fr) minmax(120px, 180px) 170px;
    align-items: center;
    gap: 10px;
    border-top: 1px solid var(--color-border-default);
    border-left: 0;
  }
  .lighting-command-summary h3,
  .lighting-command-summary > small {
    margin: 0;
  }
  .lighting-command-summary dl {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .lighting-command-summary :deep(.el-button) {
    height: 32px;
    margin: 0;
  }
  .lighting-filter-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .lighting-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 820px) {
  .lighting-console-layout {
    grid-template-columns: 1fr;
  }
  .lighting-command-stack {
    padding: 8px 0;
    border: 0;
    border-top: 1px solid var(--color-border-default);
    border-bottom: 1px solid var(--color-border-default);
  }
  .lighting-command-summary {
    grid-template-columns: 1fr 1fr;
  }
  .lighting-command-summary dl {
    grid-column: 1/-1;
  }
  .lighting-query-panel > header {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (max-width: 600px) {
  .lighting-command-row,
  .lighting-filter-fields,
  .lighting-command-summary {
    grid-template-columns: 1fr;
  }
  .lighting-grid {
    grid-template-columns: 1fr;
  }
  .temperature-control {
    grid-column: auto;
  }
  .lighting-command-summary dl {
    grid-template-columns: 1fr;
  }
}
</style>
