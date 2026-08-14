<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Grid,
  Lightning,
  List,
  MoreFilled,
  Search,
  Setting,
  SwitchButton,
  Timer,
  View,
} from "@element-plus/icons-vue";
import { computed, onActivated, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import CHARGING_DEVICE_IMAGE from "@/assets/images/car/charging-display.webp";
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
type ConnectorState = "CHARGING" | "IDLE" | "FAULT" | "OFFLINE";
type ChargingRuntime = {
  communication: Communication;
  connectors: Array<{
    name: string;
    state: ConnectorState;
    power: number | null;
  }>;
  current: number | null;
  voltage: number | null;
  todayEnergy: number;
  duration: string;
  updatedAt: string;
};
type Row = DeviceAsset & {
  systemId: string;
  systemName: string;
  systemMode: string;
  runtime: ChargingRuntime;
};
type Association = "ASSIGNED" | "UNASSIGNED";

const { t, te } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const runtimeSettings = useRuntimeSettingsStore();
const permissions = deviceAssetPermissions("CHARGING");
const systemPermissions = deviceSystemPermissions("CHARGING");
const loading = ref(true);
const rows = ref<Row[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(runtimeSettings.pageSize);
const keyword = ref("");
const subtype = ref("");
const systemId = ref("");
const spaceId = ref("");
const assetStatus = ref("");
const association = ref<Association>("ASSIGNED");
const viewMode = ref<"card" | "list">("card");
const selectedIds = ref<number[]>([]);
const consoleExpanded = ref(false);
const pendingAction = ref("");
const currentLimit = ref(32);
const chargeMode = ref("IMMEDIATE");
const strategy = ref("PEAK_SHAVING");
const lastCommand = ref("");
const systems = ref<Array<[string, string]>>([]);
const spaces = ref<ResourceNode[]>([]);
let keywordTimer: number | undefined;

const canView = computed(() => auth.can(permissions.view));
const canControl = computed(() => auth.can(permissions.control));
const canExploreEdit = computed(() => auth.canEnterAll([permissions.update, systemPermissions.update]));
const canExploreControl = computed(() => auth.canEnter(permissions.control));
const selectedRows = computed(() =>
  rows.value.filter((row) => selectedIds.value.includes(Number(row.id))),
);
const allPageSelected = computed(
  () =>
    rows.value.length > 0 &&
    rows.value.every((row) => selectedIds.value.includes(Number(row.id))),
);
const subtypes = ["CHARGER", "CONNECTOR", "POWER_CONTROLLER"];

function labelSubtype(value: string) {
  const key = `deviceSystemPage.subtype.${value}`;
  return te(key) ? t(key) : value;
}

function buildRuntime(asset: DeviceAsset): ChargingRuntime {
  const seed = Number(asset.id) * 43 + asset.name.length * 17;
  const disabled = asset.status !== "ACTIVE";
  const communication: Communication = disabled
    ? "OFFLINE"
    : seed % 17 === 0
      ? "MAINTENANCE"
      : seed % 11 === 0
        ? "WARNING"
        : seed % 7 === 0
          ? "OFFLINE"
          : "ONLINE";
  const reachable = communication === "ONLINE" || communication === "WARNING";
  const connectorCount = asset.subtype === "CHARGER" && seed % 3 === 0 ? 2 : 1;
  const connectors = Array.from({ length: connectorCount }, (_, index) => {
    const connectorSeed = seed + index * 19;
    const state: ConnectorState = !reachable
      ? "OFFLINE"
      : communication === "WARNING" && index === 0
        ? "FAULT"
        : connectorSeed % 3 === 0
          ? "CHARGING"
          : "IDLE";
    return {
      name: `${t("deviceSystemPage.chargingConsole.connector")} ${String.fromCharCode(65 + index)}`,
      state,
      power:
        state === "CHARGING"
          ? Number((7.2 + (connectorSeed % 54)).toFixed(1))
          : state === "IDLE"
            ? 0
            : null,
    };
  });
  const charging = connectors.some((item) => item.state === "CHARGING");
  return {
    communication,
    connectors,
    current: reachable ? (charging ? 32 + (seed % 89) : 0) : null,
    voltage: reachable
      ? asset.capacityUnit === "kW" && Number(asset.capacityValue) >= 60
        ? 750
        : 230
      : null,
    todayEnergy: reachable ? Number((6.4 + (seed % 420) / 10).toFixed(1)) : 0,
    duration: charging
      ? `${String(seed % 3).padStart(2, "0")}:${String(seed % 60).padStart(2, "0")}:${String((seed * 3) % 60).padStart(2, "0")}`
      : "--",
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
      : t("deviceSystemPage.chargingConsole.messages.loadFailed"),
  );
}

async function load() {
  if (!canView.value) return;
  loading.value = true;
  try {
    const query = {
      keyword: keyword.value.trim() || undefined,
      status: assetStatus.value || undefined,
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
        ? await deviceAssetApi.unassigned("CHARGING", query)
        : await deviceAssetApi.page("CHARGING", query);
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
      fetchAllPages((page, pageSize) => deviceSystemApi.page("CHARGING", { page, pageSize })),
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
  const ids = rows.value.map((row) => Number(row.id));
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
    association.value === "UNASSIGNED" ||
    !selectedRows.value.length
  ) {
    if (!selectedRows.value.length)
      ElMessage.warning(
        t("deviceSystemPage.chargingConsole.messages.selectFirst"),
      );
    return;
  }
  pendingAction.value = pendingAction.value === action ? "" : action;
}

function applyCommand() {
  if (!pendingAction.value || !selectedRows.value.length || !canControl.value)
    return;
  const detail =
    pendingAction.value === "CURRENT_LIMIT"
      ? `${currentLimit.value}A`
      : pendingAction.value === "CHARGE_MODE"
        ? t(`deviceSystemPage.chargingConsole.modes.${chargeMode.value}`)
        : pendingAction.value === "STRATEGY"
          ? t(`deviceSystemPage.chargingConsole.strategies.${strategy.value}`)
          : "";
  lastCommand.value = `${t(`deviceSystemPage.chargingConsole.actions.${pendingAction.value}`)}${detail ? ` · ${detail}` : ""} · ${selectedRows.value.length}`;
  ElMessage.success(
    t("deviceSystemPage.chargingConsole.messages.recorded", {
      count: selectedRows.value.length,
    }),
  );
  pendingAction.value = "";
}

function singleCommand(row: Row, action: string) {
  if (!canControl.value) return;
  ElMessage.info(
    t("deviceSystemPage.deviceAsset.control.singleCommand", {
      name: row.name,
      action,
    }),
  );
}

function resetFilters() {
  keyword.value = "";
  subtype.value = "";
  systemId.value = "";
  spaceId.value = "";
  assetStatus.value = "";
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
    ? t("deviceSystemPage.chargingConsole.maintenance")
    : t(`deviceSystemPage.communication.${value}`);
}

function connectorTone(value: ConnectorState) {
  return value === "CHARGING"
    ? "primary"
    : value === "IDLE"
      ? "success"
      : value === "FAULT"
        ? "error"
        : "neutral";
}

function livePower(row: Row) {
  return row.runtime.connectors
    .reduce((sum, item) => sum + (item.power || 0), 0)
    .toFixed(1);
}

function editSystem(row: Row) {
  if (!canExploreEdit.value || !row.systemId) return;
  router.push({
    path: "/assets/charging-piles",
    query: { edit: row.systemId },
  });
}

watch(
  [page, pageSize, subtype, systemId, spaceId, assetStatus, association],
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
    :title="t('deviceSystemPage.deviceAsset.title.CHARGING')"
    page-class="charging-device-page ds-domain-dense"
    :loading="canView && loading"
  >
    <template v-if="canView">
      <DsDeviceCommandConsole
        class="ds-device-console--device-standard"
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
        <template #actions
          ><div class="charging-actions">
            <label>{{
              t("deviceSystemPage.chargingConsole.batchActions")
            }}</label>
            <div>
              <el-button
                v-permission.preview="permissions.control"
                :class="{ active: pendingAction === 'ENABLE' }"
                :icon="SwitchButton"
                :disabled="!selectedRows.length"
                @click="chooseAction('ENABLE')"
                >{{ t("deviceSystemPage.chargingConsole.enable") }}</el-button
              ><el-button
                v-permission.preview="permissions.control"
                :class="{ active: pendingAction === 'DISABLE' }"
                :disabled="!selectedRows.length"
                @click="chooseAction('DISABLE')"
                >{{ t("deviceSystemPage.chargingConsole.disable") }}</el-button
              ><el-button
                v-permission.preview="permissions.control"
                :class="{ active: pendingAction === 'CURRENT_LIMIT' }"
                :icon="Lightning"
                :disabled="!selectedRows.length"
                @click="chooseAction('CURRENT_LIMIT')"
                >{{
                  t("deviceSystemPage.chargingConsole.currentLimit")
                }}</el-button
              ><el-button
                v-permission.preview="permissions.control"
                :class="{ active: pendingAction === 'CHARGE_MODE' }"
                :icon="Calendar"
                :disabled="!selectedRows.length"
                @click="chooseAction('CHARGE_MODE')"
                >{{
                  t("deviceSystemPage.chargingConsole.chargeMode")
                }}</el-button
              ><el-button
                v-permission.preview="permissions.control"
                :class="{ active: pendingAction === 'STRATEGY' }"
                :icon="Timer"
                :disabled="!selectedRows.length"
                @click="chooseAction('STRATEGY')"
                >{{ t("deviceSystemPage.chargingConsole.strategy") }}</el-button
              >
            </div>
          </div></template
        >
        <template #parameters
          ><div class="charging-parameters">
            <div>
              <label>{{
                t("deviceSystemPage.chargingConsole.maxCurrent")
              }}</label>
              <div class="current-input">
                <el-input-number
                  v-model="currentLimit"
                  :min="6"
                  :max="250"
                  :disabled="pendingAction !== 'CURRENT_LIMIT'"
                  controls-position="right"
                /><span>A</span>
              </div>
            </div>
            <div>
              <label>{{
                t("deviceSystemPage.chargingConsole.chargeMode")
              }}</label
              ><el-radio-group
                v-model="chargeMode"
                :disabled="pendingAction !== 'CHARGE_MODE'"
                size="small"
                ><el-radio-button label="IMMEDIATE">{{
                  t("deviceSystemPage.chargingConsole.modes.IMMEDIATE")
                }}</el-radio-button
                ><el-radio-button label="CARD">{{
                  t("deviceSystemPage.chargingConsole.modes.CARD")
                }}</el-radio-button
                ><el-radio-button label="RESERVATION">{{
                  t("deviceSystemPage.chargingConsole.modes.RESERVATION")
                }}</el-radio-button></el-radio-group
              >
            </div>
            <div>
              <label>{{ t("deviceSystemPage.chargingConsole.strategy") }}</label
              ><el-radio-group
                v-model="strategy"
                :disabled="pendingAction !== 'STRATEGY'"
                size="small"
                ><el-radio-button label="PEAK_SHAVING">{{
                  t("deviceSystemPage.chargingConsole.strategies.PEAK_SHAVING")
                }}</el-radio-button
                ><el-radio-button label="ECONOMY">{{
                  t("deviceSystemPage.chargingConsole.strategies.ECONOMY")
                }}</el-radio-button
                ><el-radio-button label="NIGHT">{{
                  t("deviceSystemPage.chargingConsole.strategies.NIGHT")
                }}</el-radio-button></el-radio-group
              >
            </div>
          </div></template
        >
        <template #confirm
          ><div class="charging-confirm">
            <h3>{{ t("deviceSystemPage.chargingConsole.confirmTitle") }}</h3>
            <dl>
              <div>
                <dt>
                  {{ t("deviceSystemPage.chargingConsole.targetStation") }}
                </dt>
                <dd>
                  {{
                    systemId
                      ? systems.find((item) => item[0] === systemId)?.[1]
                      : t("deviceSystemPage.chargingConsole.currentResult")
                  }}
                </dd>
              </div>
              <div>
                <dt>
                  {{ t("deviceSystemPage.chargingConsole.selectedDevices") }}
                </dt>
                <dd>{{ selectedRows.length }}</dd>
              </div>
              <div>
                <dt>
                  {{ t("deviceSystemPage.chargingConsole.pendingCommand") }}
                </dt>
                <dd>
                  {{
                    pendingAction
                      ? t(
                          `deviceSystemPage.chargingConsole.actions.${pendingAction}`,
                        )
                      : t("deviceSystemPage.chargingConsole.notSelected")
                  }}
                </dd>
              </div>
            </dl>
            <small>{{
              lastCommand || t("deviceSystemPage.chargingConsole.notExecuted")
            }}</small
            ><el-button
              v-permission="permissions.control"
              type="primary"
              :disabled="!pendingAction || !selectedRows.length || !canControl"
              @click="applyCommand"
              >{{ t("deviceSystemPage.chargingConsole.apply") }}</el-button
            >
          </div></template
        >
      </DsDeviceCommandConsole>

      <section class="charging-query">
        <header>
          <div>
            <strong>{{
              t("deviceSystemPage.chargingConsole.filtersTitle")
            }}</strong
            ><span>{{
              t("deviceSystemPage.chargingConsole.realBoundary")
            }}</span>
          </div>
          <div class="charging-asset-range">
            <label>{{
              t("deviceSystemPage.chargingConsole.controlScope")
            }}</label
            ><el-radio-group v-model="association" size="small"
              ><el-radio-button label="ASSIGNED">{{
                t("deviceSystemPage.chargingConsole.inStation")
              }}</el-radio-button
              ><el-radio-button label="UNASSIGNED">{{
                t("deviceSystemPage.chargingConsole.unassigned")
              }}</el-radio-button></el-radio-group
            >
          </div>
        </header>
          <div class="charging-filters ds-list-filter ds-list-filter--adaptive">
          <div class="charging-filter-fields">
            <el-select
              v-model="systemId"
              clearable
              :disabled="association === 'UNASSIGNED'"
              :placeholder="t('deviceSystemPage.chargingConsole.allStations')"
              ><el-option
                v-for="item in systems"
                :key="item[0]"
                :value="item[0]"
                :label="item[1]" /></el-select
            ><el-tree-select
              v-model="spaceId"
              :data="spaces"
              node-key="id"
              check-strictly
              clearable
              filterable
              :placeholder="t('deviceSystemPage.chargingConsole.allSpaces')"
              :props="{ label: 'name', children: 'children', value: 'id' }"
            /><el-select
              v-model="assetStatus"
              clearable
              :placeholder="t('deviceSystemPage.chargingConsole.archiveStatus')"
              ><el-option
                :label="t('deviceSystemPage.status.ACTIVE')"
                value="ACTIVE" /><el-option
                :label="t('deviceSystemPage.status.DISABLED')"
                value="DISABLED" /></el-select
            ><el-select
              v-model="subtype"
              clearable
              :placeholder="t('deviceSystemPage.deviceAsset.filters.subtype')"
              ><el-option
                v-for="item in subtypes"
                :key="item"
                :value="item"
                :label="labelSubtype(item)" /></el-select
            ><el-input
              v-model="keyword"
              clearable
              :prefix-icon="Search"
              :placeholder="t('deviceSystemPage.chargingConsole.keyword')"
            /><el-button @click="resetFilters">{{
              t("deviceSystemPage.actions.reset")
            }}</el-button>
          </div>
          <el-button-group class="charging-view-switch"
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

      <section class="charging-selection">
        <el-checkbox
          :model-value="allPageSelected"
          :indeterminate="selectedRows.length > 0 && !allPageSelected"
          :disabled="association === 'UNASSIGNED' || !rows.length"
          @change="togglePageSelection"
        /><strong>{{
          t("deviceSystemPage.chargingConsole.selected", {
            count: selectedRows.length,
          })
        }}</strong
        ><span>{{
          association === "UNASSIGNED"
            ? t("deviceSystemPage.chargingConsole.unassignedHint")
            : t("deviceSystemPage.chargingConsole.mockBoundary")
        }}</span
        ><el-button
          v-if="selectedRows.length"
          link
          type="primary"
          @click="selectedIds = []"
          >{{ t("deviceSystemPage.hvacConsole.clear") }}</el-button
        >
      </section>

      <section class="charging-content ds-list-table-shell">
        <div v-if="viewMode === 'card' && rows.length" class="charging-grid">
          <article
            v-for="row in rows"
            :key="row.id"
            class="charging-card"
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
            <p
              class="charging-location"
              :title="`${row.systemName} / ${row.installSpaceName}`"
            >
              {{ row.systemName }} · {{ row.installSpaceName }}
            </p>
            <div class="charging-reading">
              <div class="charger-image-slot">
                <img
                  :src="CHARGING_DEVICE_IMAGE"
                  :alt="`${row.name} · ${labelSubtype(row.subtype)}`"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div class="connector-list">
                <div
                  v-for="connector in row.runtime.connectors"
                  :key="connector.name"
                >
                  <span
                    ><i
                      :class="`connector-dot--${connector.state.toLowerCase()}`"
                    />{{ connector.name
                    }}<DsTag :type="connectorTone(connector.state)">{{
                      t(
                        `deviceSystemPage.chargingConsole.connectorState.${connector.state}`,
                      )
                    }}</DsTag></span
                  ><strong
                    >{{ connector.power == null ? "--" : connector.power }}
                    <small>kW</small></strong
                  >
                </div>
              </div>
            </div>
            <div class="charging-meta">
              <span
                >{{ t("deviceSystemPage.chargingConsole.todayEnergy") }}
                <strong>{{ row.runtime.todayEnergy }} kWh</strong></span
              ><span
                >{{ t("deviceSystemPage.chargingConsole.current") }}
                <strong>{{ row.runtime.current ?? "--" }} A</strong></span
              ><span
                >{{ t("deviceSystemPage.chargingConsole.voltage") }}
                <strong>{{ row.runtime.voltage ?? "--" }} V</strong></span
              ><span
                >{{ t("deviceSystemPage.chargingConsole.duration") }}
                <strong>{{ row.runtime.duration }}</strong></span
              ><span
                >{{ t("deviceSystemPage.chargingConsole.updated") }}
                <strong>{{ row.runtime.updatedAt }}</strong></span
              >
            </div>
            <footer class="ds-card-actions">
              <el-button
                :icon="SwitchButton"
                :disabled="association === 'UNASSIGNED' || !canControl"
                @click="
                  toggleSelection(Number(row.id), true);
                  singleCommand(
                    row,
                    t('deviceSystemPage.chargingConsole.enable'),
                  );
                "
                >{{
                  t("deviceSystemPage.chargingConsole.startStop")
                }}</el-button
              ><el-button
                :icon="Lightning"
                :disabled="association === 'UNASSIGNED' || !canControl"
                @click="
                  toggleSelection(Number(row.id), true);
                  singleCommand(
                    row,
                    t('deviceSystemPage.chargingConsole.currentLimit'),
                  );
                "
                >{{ t("deviceSystemPage.chargingConsole.limit") }}</el-button
              ><el-dropdown
                ><el-button :icon="MoreFilled">{{
                  t("deviceSystemPage.actions.more")
                }}</el-button
                ><template #dropdown
                  ><el-dropdown-menu
                    ><el-dropdown-item
                      :icon="Calendar"
                      :disabled="association === 'UNASSIGNED' || !canControl"
                      @click="
                        toggleSelection(Number(row.id), true);
                        singleCommand(
                          row,
                          t('deviceSystemPage.chargingConsole.reservation'),
                        );
                      "
                      >{{
                        t("deviceSystemPage.chargingConsole.reservation")
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
          v-else-if="viewMode === 'list' && rows.length"
          :rows="rows as unknown as Record<string, unknown>[]"
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
            min-width="160"
            show-overflow-tooltip
          /><el-table-column
            :label="t('deviceSystemPage.chargingConsole.livePower')"
            width="110"
            ><template #default="{ row }"
              >{{ livePower(row) }} kW</template
            ></el-table-column
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
            width="156"
            ><template #default="{ row }"
              ><div class="ds-row-actions">
                <el-button
                  link
                  type="primary"
                  :disabled="association === 'UNASSIGNED' || !canControl"
                  @click="
                    singleCommand(
                      row,
                      t('deviceSystemPage.chargingConsole.enable'),
                    )
                  "
                  >{{
                    t("deviceSystemPage.chargingConsole.startStop")
                  }}</el-button
                ><el-dropdown
                  ><el-button link :icon="MoreFilled">{{
                    t("deviceSystemPage.actions.more")
                  }}</el-button
                  ><template #dropdown
                    ><el-dropdown-menu
                      ><el-dropdown-item
                        v-if="auth.canShowAll([permissions.update, systemPermissions.update])"
                        :icon="Setting"
                        :disabled="!row.systemId || !canExploreEdit"
                        @click="editSystem(row)"
                        >{{
                          t("deviceSystemPage.actions.edit")
                        }}</el-dropdown-item
                      ><el-dropdown-item
                        :icon="Lightning"
                        :disabled="association === 'UNASSIGNED' || !canControl"
                        @click="
                          singleCommand(
                            row,
                            t('deviceSystemPage.chargingConsole.currentLimit'),
                          )
                        "
                        >{{
                          t("deviceSystemPage.chargingConsole.limit")
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
          v-if="!loading && !rows.length"
          :title="t('deviceSystemPage.chargingConsole.emptyTitle')"
          :description="
            association === 'UNASSIGNED'
              ? t('deviceSystemPage.chargingConsole.unassignedEmpty')
              : t('deviceSystemPage.chargingConsole.emptyDescription')
          "
        />
        <footer
          v-if="total"
          class="charging-pagination ds-list-table-footer ds-list-table-footer--pagination-only"
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
.charging-device-page {
  min-width: 0;
  max-width: 100%;
  overflow-x: clip;
}
.charging-device-page :deep(.ds-list-page-card) {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}
.charging-header-actions {
  display: flex;
  gap: 8px;
}
.charging-console,
.charging-query,
.charging-selection,
.charging-content,
.charging-pagination {
  width: calc(100% - 28px);
  min-width: 0;
  max-width: calc(100% - 28px);
  margin-left: 14px;
  margin-right: 14px;
}
.charging-console {
  margin-top: 10px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  overflow: hidden;
}
.charging-console > header {
  min-height: 44px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border-default);
  background: color-mix(
    in srgb,
    var(--color-bg-muted) 52%,
    var(--color-bg-surface)
  );
}
.charging-console > header > div {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
}
.charging-console > header .el-icon {
  color: var(--color-primary-500);
  font-size: 19px;
}
.charging-console > header > div > div {
  min-width: 0;
  display: grid;
  gap: 2px;
}
.charging-console > header span {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.charging-console__body {
  padding: 10px;
  display: grid;
  grid-template-columns: 225px minmax(0, 1fr) 230px;
  gap: 10px;
}
.charging-scope {
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: var(--color-bg-muted);
}
.charging-scope > label,
.charging-actions > label,
.charging-parameters label {
  display: block;
  margin-bottom: 7px;
  color: var(--color-text-secondary);
  font-size: 11px;
}
.charging-scope :deep(.el-radio-group) {
  width: 100%;
  display: flex;
}
.charging-scope :deep(.el-radio-button) {
  min-width: 0;
  flex: 1;
}
.charging-scope :deep(.el-radio-button__inner) {
  width: 100%;
  padding: 7px 4px;
}
.charging-count {
  margin: 13px 0 10px;
  display: flex;
  align-items: baseline;
  gap: 5px;
}
.charging-count strong {
  color: var(--color-primary-500);
  font-size: 30px;
}
.charging-count span {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.charging-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.charging-stats span {
  padding: 3px 6px;
  border: 1px solid var(--color-border-default);
  border-radius: 4px;
  color: var(--color-text-secondary);
  font-size: 10px;
  background: var(--color-bg-surface);
}
.charging-command-panel {
  min-width: 0;
  padding: 0 10px;
  border-right: 1px solid var(--color-border-default);
  border-left: 1px solid var(--color-border-default);
}
.charging-actions > div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.charging-actions :deep(.el-button) {
  min-width: 92px;
  height: 38px;
  margin: 0;
}
.charging-actions :deep(.el-button.active) {
  border-color: var(--color-primary-500);
  color: var(--color-primary-500);
  background: var(--color-primary-soft);
}
.charging-parameters {
  margin-top: 10px;
  padding-top: 9px;
  display: grid;
  grid-template-columns: 150px minmax(280px, 1fr) minmax(260px, 1fr);
  gap: 12px;
  border-top: 1px solid var(--color-border-default);
}
.charging-parameters > div {
  min-width: 0;
}
.current-input {
  display: flex;
  width: 145px;
}
.current-input :deep(.el-input-number) {
  width: 113px;
}
.current-input > span {
  display: grid;
  width: 32px;
  place-items: center;
  border: 1px solid var(--el-border-color);
  border-left: 0;
  border-radius: 0 var(--el-border-radius-base) var(--el-border-radius-base) 0;
  color: var(--color-text-secondary);
  background: var(--color-bg-muted);
}
.current-input :deep(.el-input__wrapper) {
  border-radius: var(--el-border-radius-base) 0 0 var(--el-border-radius-base);
}
.charging-parameters :deep(.el-radio-group) {
  display: flex;
  flex-wrap: nowrap;
}
.charging-parameters :deep(.el-radio-button) {
  min-width: 0;
}
.charging-parameters :deep(.el-radio-button__inner) {
  padding: 7px 8px;
}
.charging-confirm {
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 7px 2px;
}
.charging-confirm h3 {
  margin: 0 0 9px;
  font-size: 12px;
}
.charging-confirm dl {
  margin: 0;
  display: grid;
  gap: 7px;
}
.charging-confirm dl > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.charging-confirm dt {
  color: var(--color-text-secondary);
  font-size: 11px;
}
.charging-confirm dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 11px;
  font-weight: 600;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.charging-confirm > small {
  min-height: 32px;
  margin: 9px 0;
  color: var(--color-text-secondary);
  font-size: 10px;
  line-height: 16px;
}
.charging-confirm :deep(.el-button) {
  width: 100%;
  margin-top: auto;
}
.charging-query {
  margin-top: 10px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  overflow: hidden;
}
.charging-query > header {
  min-height: 38px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-border-default);
}
.charging-query > header > div {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.charging-query > header span {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.charging-filters {
  padding: 8px 10px;
  display: grid;
  grid-template-columns: minmax(180px, 230px) minmax(180px, 230px) minmax(
      140px,
      170px
    ) minmax(150px, 190px) minmax(240px, 360px) 68px 78px;
  justify-content: start;
  gap: 8px;
}
.charging-filters > * {
  min-width: 0;
}
.charging-view-switch {
  justify-self: start;
}
.charging-view-switch :deep(.el-button) {
  width: 38px;
  padding: 0;
}
.charging-selection {
  min-height: 42px;
  margin-top: 8px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: color-mix(
    in srgb,
    var(--color-primary-soft) 48%,
    var(--color-bg-surface)
  );
  overflow: hidden;
}
.charging-selection > span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.charging-content {
  min-height: 260px;
  margin-top: 10px;
  overflow: hidden;
}
.charging-grid {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.charging-card {
  min-width: 0;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  overflow: hidden;
}
.charging-card.selected {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 1px var(--color-primary-500);
}
.charging-card > header {
  min-width: 0;
  min-height: 54px;
  padding: 9px 10px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.charging-card > header > div {
  min-width: 0;
  display: grid;
  gap: 2px;
  flex: 1;
}
.charging-card > header strong,
.charging-card > header small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.charging-card > header small,
.charging-location {
  color: var(--color-text-secondary);
  font-size: 11px;
}
.charging-location {
  height: 28px;
  margin: 0;
  padding: 0 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.charging-reading {
  min-width: 0;
  min-height: 116px;
  padding: 9px 10px;
  display: grid;
  grid-template-columns: minmax(72px, 92px) minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  background: color-mix(
    in srgb,
    var(--color-primary-50) 38%,
    var(--color-bg-surface)
  );
}
.charger-image-slot {
  height: 94px;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.charger-image-slot img {
  display: block;
  width: 88px;
  height: 88px;
  object-fit: contain;
  filter: drop-shadow(0 8px 10px rgb(15 23 42 / 14%));
}
html[data-theme="dark"] .charger-image-slot img {
  filter: drop-shadow(0 8px 12px rgb(0 0 0 / 34%));
}
.connector-list {
  min-width: 0;
  display: grid;
  gap: 8px;
}
.connector-list > div {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
}
.connector-list > div > span {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
}
.connector-list > div > strong {
  font-size: 15px;
  white-space: nowrap;
}
.connector-list > div > strong small {
  font-size: 9px;
  font-weight: 400;
}
.connector-list i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
}
.connector-list .connector-dot--charging {
  background: var(--color-primary-500);
}
.connector-list .connector-dot--idle {
  background: var(--color-success-default);
}
.connector-list .connector-dot--fault {
  background: var(--color-danger-default);
}
.charging-meta {
  padding: 8px 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 9px;
  color: var(--color-text-secondary);
  font-size: 10px;
}
.charging-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.charging-meta span:last-child {
  grid-column: 1/-1;
}
.charging-meta strong {
  color: var(--color-text-primary);
  font-weight: 500;
}
.charging-card > footer {
  padding: 7px 8px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  border-top: 1px solid var(--color-border-default);
}
.charging-card > footer > * {
  min-width: 0;
}
.charging-card > footer :deep(.el-button) {
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 7px 2px;
  overflow: hidden;
}
.charging-card > footer :deep(.el-button span) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.charging-pagination {
  margin-top: 10px;
  margin-bottom: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border-default);
  overflow: hidden;
}
@media (max-width: 1500px) {
  .charging-console__body {
    grid-template-columns: 210px minmax(0, 1fr) 205px;
  }
  .charging-parameters {
    grid-template-columns: 145px repeat(2, minmax(230px, 1fr));
  }
  .charging-filters {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .charging-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 1150px) {
  .charging-console__body {
    grid-template-columns: 210px minmax(0, 1fr);
  }
  .charging-confirm {
    grid-column: 1/-1;
    padding: 10px;
    border-top: 1px solid var(--color-border-default);
  }
  .charging-confirm dl {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .charging-confirm :deep(.el-button) {
    width: 220px;
    margin-top: 8px;
  }
  .charging-parameters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .charging-parameters > div:last-child {
    grid-column: 1/-1;
  }
  .charging-filters {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .charging-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .charging-console__body {
    grid-template-columns: 1fr;
  }
  .charging-command-panel {
    padding: 10px 0;
    border: 0;
    border-top: 1px solid var(--color-border-default);
    border-bottom: 1px solid var(--color-border-default);
  }
  .charging-parameters,
  .charging-filters,
  .charging-grid {
    grid-template-columns: 1fr;
  }
  .charging-parameters > div:last-child {
    grid-column: auto;
  }
  .charging-confirm dl {
    grid-template-columns: 1fr;
  }
  .charging-query > header > div {
    align-items: flex-start;
    flex-direction: column;
  }
  .charging-selection {
    flex-wrap: wrap;
  }
}
.charging-filters {
  display: flex;
  grid-template-columns: none;
  align-items: flex-start;
  gap: 8px;
}
.charging-filter-fields {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(180px, 230px) minmax(180px, 230px) minmax(
      140px,
      170px
    ) minmax(150px, 190px) minmax(240px, 360px) 68px;
  gap: 8px;
}
.charging-filter-fields > * {
  min-width: 0;
}
.charging-view-switch {
  min-width: 78px;
  margin-left: auto;
  flex: 0 0 78px;
  display: flex;
  justify-content: flex-end;
}
.charging-view-switch :deep(.el-button) {
  width: 39px;
  min-width: 39px;
  padding: 0;
}
.charging-table-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
@media (max-width: 1500px) {
  .charging-filter-fields {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 1150px) {
  .charging-filter-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .charging-filter-fields {
    grid-template-columns: 1fr;
  }
}

.charging-filter-fields {
  grid-template-columns: 150px 150px 140px 150px minmax(220px, 300px) 68px;
}
@media (max-width: 1050px) {
  .charging-filter-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .charging-filter-fields {
    grid-template-columns: 1fr;
  }
}
.charging-query > header {
  justify-content: space-between;
  gap: 12px;
}
.charging-asset-range {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.charging-asset-range label {
  color: var(--color-text-secondary);
  font-size: 11px;
}
.charging-asset-range :deep(.el-radio-button__inner) {
  padding: 6px 10px;
}
</style>

<style>
html[data-theme="dark"]
  .charging-device-page
  .el-radio-button__original-radio:disabled:checked
  + .el-radio-button__inner {
  border-color: var(--color-border-default);
  color: var(--color-text-disabled);
  background: var(--color-bg-muted);
  box-shadow: none;
}
</style>
