<script setup lang="ts">
import {
  AlarmClock,
  ArrowDown,
  ArrowUp,
  Bell,
  Connection,
  DataAnalysis,
  Grid,
  Lightning,
  List,
  Lock,
  Microphone,
  Monitor,
  MoreFilled,
  Odometer,
  Refresh,
  Search,
  Setting,
  SwitchButton,
  Timer,
  View,
} from "@element-plus/icons-vue";
import {
  computed,
  onActivated,
  onMounted,
  ref,
  watch,
  type Component,
} from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import PARKING_DEVICE_IMAGE from "@/assets/images/car/carDvc-display.webp";
import SOLAR_DEVICE_IMAGE from "@/assets/images/pv/pv-display.webp";
import STORAGE_DEVICE_IMAGE from "@/assets/images/pv/storage-display.webp";
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
  type DeviceSystemType,
} from "@/domain/iot/assets/device-system";
import { fetchSpaceTree } from "@/domain/platform/org/api/space.api";
import type { ResourceNode } from "@/domain/platform/org/resource";

type IndustryType = Extract<DeviceSystemType, "PARKING" | "SOLAR" | "STORAGE">;
type Communication = "ONLINE" | "OFFLINE" | "WARNING" | "MAINTENANCE";
type Association = "ASSIGNED" | "UNASSIGNED";
type Metric = {
  label: string;
  value: string;
  tone?: "normal" | "success" | "warning" | "danger";
};
type Runtime = {
  communication: Communication;
  state: string;
  metrics: Metric[];
  updatedAt: string;
};
type Row = DeviceAsset & {
  systemId: string;
  systemName: string;
  systemMode: string;
  runtime: Runtime;
};
type Config = {
  systemPath: string;
  subtypes: string[];
  actions: Array<{ code: string; icon: Component }>;
  modes: string[];
};

const props = defineProps<{ systemType: IndustryType }>();
const { t, te } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const runtimeSettings = useRuntimeSettingsStore();

const configs: Record<IndustryType, Config> = {
  PARKING: {
    systemPath: "/assets/parking",
    subtypes: ["BARRIER_GATE", "LANE_CONTROLLER", "CAMERA", "SPACE_DETECTOR"],
    actions: [
      { code: "OPEN_GATE", icon: SwitchButton },
      { code: "LOCK_GATE", icon: Lock },
      { code: "VOICE_BROADCAST", icon: Microphone },
      { code: "DISPLAY_REFRESH", icon: Monitor },
      { code: "WHITELIST_SYNC", icon: Refresh },
      { code: "NIGHT_MODE", icon: Timer },
    ],
    modes: ["SECURITY", "VISITOR", "MONTHLY", "NIGHT_PATROL"],
  },
  SOLAR: {
    systemPath: "/assets/pv-equipment",
    subtypes: [
      "PV_ARRAY",
      "INVERTER",
      "COMBINER_BOX",
      "GRID_CONNECTION_CABINET",
    ],
    actions: [
      { code: "START_STOP", icon: SwitchButton },
      { code: "POWER_LIMIT", icon: Odometer },
      { code: "MODE_SWITCH", icon: Connection },
      { code: "ALARM_RESET", icon: Bell },
      { code: "TIME_SYNC", icon: AlarmClock },
      { code: "CURVE_CALIBRATION", icon: DataAnalysis },
    ],
    modes: ["GRID_CONNECTED", "STANDBY", "MAINTENANCE"],
  },
  STORAGE: {
    systemPath: "/assets/storage-equipment",
    subtypes: ["PCS", "BMS", "BATTERY_CLUSTER", "BATTERY_PACK", "CONTROLLER"],
    actions: [
      { code: "CHARGE", icon: Lightning },
      { code: "DISCHARGE", icon: SwitchButton },
      { code: "STANDBY", icon: Timer },
      { code: "STRATEGY", icon: DataAnalysis },
      { code: "ALARM_RESET", icon: Bell },
      { code: "CALIBRATION", icon: Setting },
    ],
    modes: ["AUTO", "PEAK_SHAVING", "DEMAND_CONTROL", "BACKUP_POWER"],
  },
};

const deviceImages: Record<IndustryType, string> = {
  PARKING: PARKING_DEVICE_IMAGE,
  SOLAR: SOLAR_DEVICE_IMAGE,
  STORAGE: STORAGE_DEVICE_IMAGE,
};

const config = computed(() => configs[props.systemType]);
const deviceImage = computed(() => deviceImages[props.systemType]);
const permissions = computed(() => deviceAssetPermissions(props.systemType));
const systemPermissions = computed(() =>
  deviceSystemPermissions(props.systemType),
);
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
const powerLimit = ref(80);
const targetSoc = ref(80);
const gateDuration = ref(5);
const operatingMode = ref(config.value.modes[0]);
const lastCommand = ref("");
const systems = ref<Array<[string, string]>>([]);
const spaces = ref<ResourceNode[]>([]);
let keywordTimer: number | undefined;
let mounted = false;

const canView = computed(() => auth.can(permissions.value.view));
const canControl = computed(() => auth.can(permissions.value.control));
const canExploreEdit = computed(() => auth.canEnterAll([permissions.value.update, systemPermissions.value.update]));
const canExploreControl = computed(() => auth.canEnter(permissions.value.control));
const selectedRows = computed(() =>
  rows.value.filter((row) => selectedIds.value.includes(Number(row.id))),
);
const allPageSelected = computed(
  () =>
    rows.value.length > 0 &&
    rows.value.every((row) => selectedIds.value.includes(Number(row.id))),
);

function namespace(suffix: string) {
  return `deviceSystemPage.industryConsole.${suffix}`;
}
function typeKey(suffix: string) {
  return namespace(`${props.systemType}.${suffix}`);
}
function labelSubtype(value: string) {
  const key = `deviceSystemPage.subtype.${value}`;
  return te(key) ? t(key) : value;
}
function stateLabel(value: Communication) {
  return value === "MAINTENANCE"
    ? t(namespace("common.maintenance"))
    : t(`deviceSystemPage.communication.${value}`);
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

function metric(
  label: string,
  value: string,
  tone: Metric["tone"] = "normal",
): Metric {
  return { label: t(namespace(`metrics.${label}`)), value, tone };
}

function buildRuntime(asset: DeviceAsset): Runtime {
  const seed = Number(asset.id) * 41 + asset.name.length * 13;
  const communication: Communication =
    asset.status !== "ACTIVE"
      ? "OFFLINE"
      : seed % 17 === 0
        ? "MAINTENANCE"
        : seed % 11 === 0
          ? "WARNING"
          : seed % 7 === 0
            ? "OFFLINE"
            : "ONLINE";
  const reachable = communication === "ONLINE" || communication === "WARNING";
  const updatedAt = reachable
    ? `${String(8 + (seed % 4)).padStart(2, "0")}:${String(seed % 60).padStart(2, "0")}`
    : "--";
  if (props.systemType === "PARKING") {
    const state = !reachable
      ? "offline"
      : asset.subtype === "BARRIER_GATE"
        ? "passage"
        : asset.subtype === "CAMERA"
          ? "recognizing"
          : "normal";
    const metrics =
      asset.subtype === "BARRIER_GATE"
        ? [
            metric("todayPassages", reachable ? `${420 + (seed % 680)}` : "--"),
            metric(
              "currentState",
              t(typeKey(`states.${state}`)),
              reachable ? "success" : "warning",
            ),
            metric("operations", reachable ? `${80 + (seed % 240)}` : "--"),
          ]
        : asset.subtype === "CAMERA"
          ? [
              metric(
                "recognitionRate",
                reachable ? `${(97 + (seed % 28) / 10).toFixed(1)}%` : "--",
              ),
              metric(
                "recognitions",
                reachable ? `${860 + (seed % 920)}` : "--",
              ),
              metric("currentState", t(typeKey(`states.${state}`))),
            ]
          : asset.subtype === "SPACE_DETECTOR"
            ? [
                metric(
                  "detectedSpaces",
                  reachable ? `${18 + (seed % 63)}` : "--",
                ),
                metric("occupancy", reachable ? `${40 + (seed % 51)}%` : "--"),
                metric("currentState", t(typeKey(`states.${state}`))),
              ]
            : [
                metric("laneState", t(typeKey(`states.${state}`))),
                metric("temperature", reachable ? `${28 + (seed % 9)}℃` : "--"),
                metric(
                  "todayPassages",
                  reachable ? `${350 + (seed % 700)}` : "--",
                ),
              ];
    return { communication, state, metrics, updatedAt };
  }
  if (props.systemType === "SOLAR") {
    const state = !reachable
      ? "offline"
      : communication === "WARNING"
        ? "alarm"
        : "generating";
    const metrics =
      asset.subtype === "INVERTER"
        ? [
            metric(
              "livePower",
              reachable ? `${(42 + (seed % 58)).toFixed(1)} kW` : "--",
              "success",
            ),
            metric(
              "todayGeneration",
              reachable ? `${(320 + (seed % 460)).toFixed(1)} kWh` : "--",
            ),
            metric(
              "efficiency",
              reachable ? `${(97 + (seed % 18) / 10).toFixed(1)}%` : "--",
            ),
          ]
        : asset.subtype === "PV_ARRAY"
          ? [
              metric(
                "capacity",
                `${asset.capacityValue || 0} ${asset.capacityUnit || "kWp"}`,
              ),
              metric(
                "irradiance",
                reachable ? `${620 + (seed % 260)} W/m²` : "--",
              ),
              metric(
                "moduleTemperature",
                reachable ? `${34 + (seed % 14)}℃` : "--",
              ),
            ]
          : asset.subtype === "COMBINER_BOX"
            ? [
                metric("stringCount", `${12 + (seed % 9)}`),
                metric(
                  "current",
                  reachable ? `${(10 + (seed % 90) / 10).toFixed(1)} A` : "--",
                ),
                metric(
                  "temperature",
                  reachable ? `${30 + (seed % 11)}℃` : "--",
                ),
              ]
            : [
                metric(
                  "livePower",
                  reachable ? `${(180 + (seed % 420)).toFixed(1)} kW` : "--",
                  "success",
                ),
                metric(
                  "powerFactor",
                  reachable ? `${(0.96 + (seed % 3) / 100).toFixed(2)}` : "--",
                ),
                metric(
                  "frequency",
                  reachable
                    ? `${(49.9 + (seed % 3) / 10).toFixed(1)} Hz`
                    : "--",
                ),
              ];
    return { communication, state, metrics, updatedAt };
  }
  const state = !reachable
    ? "offline"
    : communication === "WARNING"
      ? "alarm"
      : seed % 3 === 0
        ? "discharging"
        : seed % 3 === 1
          ? "charging"
          : "standby";
  const signedPower =
    state === "charging"
      ? -(45 + (seed % 70))
      : state === "discharging"
        ? 35 + (seed % 80)
        : 0;
  const metrics =
    asset.subtype === "BMS"
      ? [
          metric("soc", reachable ? `${35 + (seed % 58)}%` : "--"),
          metric("soh", reachable ? `${91 + (seed % 8)}%` : "--"),
          metric(
            "temperature",
            reachable ? `${25 + (seed % 18)}℃` : "--",
            communication === "WARNING" ? "danger" : "normal",
          ),
        ]
      : asset.subtype === "PCS"
        ? [
            metric(
              "livePower",
              reachable
                ? `${signedPower > 0 ? "+" : ""}${signedPower} kW`
                : "--",
              signedPower >= 0 ? "success" : "warning",
            ),
            metric(
              "voltageCurrent",
              reachable ? `800 V / ${Math.abs(signedPower) + 80} A` : "--",
            ),
            metric(
              "efficiency",
              reachable ? `${(96 + (seed % 25) / 10).toFixed(1)}%` : "--",
            ),
          ]
        : asset.subtype === "BATTERY_CLUSTER" ||
            asset.subtype === "BATTERY_PACK"
          ? [
              metric("soc", reachable ? `${38 + (seed % 55)}%` : "--"),
              metric("soh", reachable ? `${90 + (seed % 9)}%` : "--"),
              metric("temperature", reachable ? `${24 + (seed % 13)}℃` : "--"),
            ]
          : [
              metric("operatingMode", t(typeKey(`states.${state}`))),
              metric("temperature", reachable ? `${25 + (seed % 9)}℃` : "--"),
              metric(
                "todayEnergy",
                reachable ? `${(0.6 + (seed % 28) / 10).toFixed(2)} MWh` : "--",
              ),
            ];
  return { communication, state, metrics, updatedAt };
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
        ? await deviceAssetApi.unassigned(props.systemType, query)
        : await deviceAssetApi.page(props.systemType, query);
    rows.value = result.items.map(enrich);
    total.value = result.total;
    selectedIds.value = selectedIds.value.filter((id) =>
      rows.value.some((row) => Number(row.id) === id),
    );
  } catch (error) {
    ElMessage.error(
      error instanceof ApiError
        ? error.message
        : t(namespace("common.loadFailed")),
    );
  } finally {
    loading.value = false;
  }
}

async function loadFoundations() {
  try {
    const [systemRows, spaceTree] = await Promise.all([
      fetchAllPages((page, pageSize) => deviceSystemApi.page(props.systemType, { page, pageSize })),
      fetchSpaceTree(),
    ]);
    systems.value = systemRows.map((item) => [item.id, item.name]);
    spaces.value = spaceTree;
  } catch (error) {
    ElMessage.error(
      error instanceof ApiError
        ? error.message
        : t(namespace("common.loadFailed")),
    );
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
      ElMessage.warning(t(namespace("common.selectFirst")));
    return;
  }
  pendingAction.value = pendingAction.value === action ? "" : action;
}
function applyCommand() {
  if (!pendingAction.value || !selectedRows.value.length || !canControl.value)
    return;
  lastCommand.value = `${t(typeKey(`actions.${pendingAction.value}`))} · ${selectedRows.value.length}`;
  ElMessage.success(
    t(namespace("common.recorded"), { count: selectedRows.value.length }),
  );
  pendingAction.value = "";
}
function singleCommand(row: Row, action: string) {
  if (!canControl.value || association.value === "UNASSIGNED") return;
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
function editSystem(row: Row) {
  if (!canExploreEdit.value || !row.systemId) return;
  router.push({ path: config.value.systemPath, query: { edit: row.systemId } });
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
  () => props.systemType,
  () => {
    viewMode.value = runtimeSettings.deviceDefaultView === "LIST" ? "list" : "card";
    operatingMode.value = config.value.modes[0];
    selectedIds.value = [];
    pendingAction.value = "";
    page.value = 1;
    if (mounted) {
      void loadFoundations();
      void load();
    }
  },
);
onMounted(async () => {
  await runtimeSettings.load();
  pageSize.value = runtimeSettings.pageSize;
  viewMode.value = runtimeSettings.deviceDefaultView === 'LIST' ? 'list' : 'card';
  await loadFoundations();
  await load();
  mounted = true;
});
onActivated(() => {
  if (mounted) void load();
});
</script>

<template>
  <DsListPageShell
    :title="t(`deviceSystemPage.deviceAsset.title.${systemType}`)"
    page-class="operational-device-page ds-domain-dense"
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
          ><div class="industry-actions">
            <label>{{ t(namespace("common.batchActions")) }}</label>
            <div>
              <el-button
                v-for="action in config.actions"
                v-permission.preview="permissions.control"
                :key="action.code"
                :class="{ active: pendingAction === action.code }"
                :icon="action.icon"
                :disabled="
                  !selectedRows.length ||
                  !canExploreControl ||
                  association === 'UNASSIGNED'
                "
                @click="chooseAction(action.code)"
                >{{ t(typeKey(`actions.${action.code}`)) }}</el-button
              >
            </div>
          </div></template
        >
        <template #parameters
          ><div class="industry-parameters">
            <div v-if="systemType === 'PARKING'">
              <label>{{ t(typeKey("parameters.duration")) }}</label>
              <div class="number-unit">
                <el-input-number
                  v-model="gateDuration"
                  :min="1"
                  :max="30"
                  :disabled="
                    !selectedRows.length ||
                    !canExploreControl ||
                    association === 'UNASSIGNED'
                  "
                  controls-position="right"
                /><span>s</span>
              </div>
            </div>
            <div v-else>
              <label>{{ t(typeKey("parameters.powerLimit")) }}</label>
              <div class="number-unit">
                <el-input-number
                  v-model="powerLimit"
                  :min="0"
                  :max="systemType === 'SOLAR' ? 100 : 800"
                  :disabled="
                    !selectedRows.length ||
                    !canExploreControl ||
                    association === 'UNASSIGNED'
                  "
                  controls-position="right"
                /><span>{{ systemType === "SOLAR" ? "%" : "kW" }}</span>
              </div>
            </div>
            <div v-if="systemType === 'STORAGE'">
              <label>{{ t(typeKey("parameters.targetSoc")) }}</label>
              <div class="number-unit">
                <el-input-number
                  v-model="targetSoc"
                  :min="10"
                  :max="100"
                  :disabled="
                    !selectedRows.length ||
                    !canExploreControl ||
                    association === 'UNASSIGNED'
                  "
                  controls-position="right"
                /><span>%</span>
              </div>
            </div>
            <div class="mode-parameter">
              <label>{{ t(typeKey("parameters.mode")) }}</label
              ><el-radio-group
                v-model="operatingMode"
                :disabled="
                  !selectedRows.length ||
                  !canExploreControl ||
                  association === 'UNASSIGNED'
                "
                size="small"
                ><el-radio-button
                  v-for="mode in config.modes"
                  :key="mode"
                  :label="mode"
                  >{{ t(typeKey(`modes.${mode}`)) }}</el-radio-button
                ></el-radio-group
              >
            </div>
          </div></template
        >
        <template #confirm
          ><div class="industry-confirm">
            <h3>{{ t(namespace("common.confirmTitle")) }}</h3>
            <dl>
              <div>
                <dt>{{ t(namespace("common.targetSystem")) }}</dt>
                <dd>
                  {{
                    systemId
                      ? systems.find((item) => item[0] === systemId)?.[1]
                      : t(namespace("common.currentResult"))
                  }}
                </dd>
              </div>
              <div>
                <dt>{{ t(namespace("common.selectedDevices")) }}</dt>
                <dd>{{ selectedRows.length }}</dd>
              </div>
              <div>
                <dt>{{ t(namespace("common.pendingCommand")) }}</dt>
                <dd>
                  {{
                    pendingAction
                      ? t(typeKey(`actions.${pendingAction}`))
                      : t(namespace("common.notSelected"))
                  }}
                </dd>
              </div>
            </dl>
            <small>{{
              lastCommand || t(namespace("common.notExecuted"))
            }}</small
            ><el-button
              v-permission="permissions.control"
              type="primary"
              :disabled="!pendingAction || !selectedRows.length || !canControl"
              @click="applyCommand"
              >{{ t(namespace("common.apply")) }}</el-button
            >
          </div></template
        >
      </DsDeviceCommandConsole>

      <section class="industry-query">
        <header>
          <div>
            <strong>{{ t(namespace("common.filtersTitle")) }}</strong
            ><span>{{ t(namespace("common.realBoundary")) }}</span>
          </div>
          <div class="industry-asset-range">
            <label>{{ t(namespace("common.assetRange")) }}</label
            ><el-radio-group v-model="association" size="small"
              ><el-radio-button label="ASSIGNED">{{
                t(namespace("common.assigned"))
              }}</el-radio-button
              ><el-radio-button label="UNASSIGNED">{{
                t(namespace("common.unassigned"))
              }}</el-radio-button></el-radio-group
            >
          </div>
        </header>
          <div class="industry-filter-bar ds-list-filter ds-list-filter--adaptive">
          <div class="industry-filter-fields">
            <el-select
              v-model="systemId"
              clearable
              :disabled="association === 'UNASSIGNED'"
              :placeholder="t(typeKey('allSystems'))"
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
              :placeholder="t(namespace('common.allSpaces'))"
              :props="{ label: 'name', children: 'children', value: 'id' }"
            /><el-select
              v-model="assetStatus"
              clearable
              :placeholder="t(namespace('common.archiveStatus'))"
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
                v-for="item in config.subtypes"
                :key="item"
                :value="item"
                :label="labelSubtype(item)" /></el-select
            ><el-input
              v-model="keyword"
              clearable
              :prefix-icon="Search"
              :placeholder="t(namespace('common.keyword'))"
            /><el-button @click="resetFilters">{{
              t("deviceSystemPage.actions.reset")
            }}</el-button>
          </div>
          <el-button-group class="industry-view-switch"
            ><el-button
              :type="viewMode === 'card' ? 'primary' : 'default'"
              :icon="Grid"
              :title="t('deviceSystemPage.viewMode.card')"
              @click="switchView('card')" /><el-button
              :type="viewMode === 'list' ? 'primary' : 'default'"
              :icon="List"
              :title="t('deviceSystemPage.viewMode.list')"
              @click="switchView('list')"
          /></el-button-group>
        </div>
      </section>

      <section class="industry-selection">
        <el-checkbox
          :model-value="allPageSelected"
          :indeterminate="selectedRows.length > 0 && !allPageSelected"
          :disabled="association === 'UNASSIGNED' || !rows.length"
          @change="togglePageSelection"
        /><strong>{{
          t(namespace("common.selected"), { count: selectedRows.length })
        }}</strong
        ><span>{{
          association === "UNASSIGNED"
            ? t(namespace("common.unassignedHint"))
            : t(typeKey("mockBoundary"))
        }}</span
        ><el-button
          v-if="selectedRows.length"
          link
          type="primary"
          @click="selectedIds = []"
          >{{ t("deviceSystemPage.hvacConsole.clear") }}</el-button
        >
      </section>

      <section class="industry-content ds-list-table-shell">
        <div v-if="viewMode === 'card' && rows.length" class="industry-grid">
          <article
            v-for="row in rows"
            :key="row.id"
            class="industry-card"
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
                stateLabel(row.runtime.communication)
              }}</DsTag>
            </header>
            <p
              class="industry-location"
              :title="`${row.systemName} / ${row.installSpaceName}`"
            >
              {{ row.systemName }} · {{ row.installSpaceName }}
            </p>
            <div class="industry-reading">
              <div class="industry-image-slot">
                <img
                  :src="deviceImage"
                  :alt="`${row.name} · ${labelSubtype(row.subtype)}`"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div class="industry-metrics">
                <strong>{{ labelSubtype(row.subtype) }}</strong>
                <div v-for="item in row.runtime.metrics" :key="item.label">
                  <label>{{ item.label }}</label
                  ><span :class="`metric--${item.tone || 'normal'}`">{{
                    item.value
                  }}</span>
                </div>
              </div>
            </div>
            <div class="industry-meta">
              <span>{{ t(namespace("common.simulatedRuntime")) }}</span
              ><span
                >{{ t(namespace("metrics.updated")) }}
                <strong>{{ row.runtime.updatedAt }}</strong></span
              >
            </div>
            <footer class="ds-card-actions">
              <el-button
                :icon="config.actions[0].icon"
                :disabled="association === 'UNASSIGNED' || !canControl"
                @click="
                  toggleSelection(Number(row.id), true);
                  singleCommand(
                    row,
                    t(typeKey(`actions.${config.actions[0].code}`)),
                  );
                "
                >{{
                  t(typeKey(`actions.${config.actions[0].code}`))
                }}</el-button
              ><el-button
                v-permission.preview="[permissions.update, systemPermissions.update]"
                :icon="Setting"
                :disabled="!row.systemId"
                @click="editSystem(row)"
                >{{ t(namespace("common.profile")) }}</el-button
              ><el-dropdown
                ><el-button :icon="MoreFilled">{{
                  t("deviceSystemPage.actions.more")
                }}</el-button
                ><template #dropdown
                  ><el-dropdown-menu
                    ><el-dropdown-item
                      :icon="config.actions[1].icon"
                      :disabled="association === 'UNASSIGNED' || !canControl"
                      @click="
                        toggleSelection(Number(row.id), true);
                        singleCommand(
                          row,
                          t(typeKey(`actions.${config.actions[1].code}`)),
                        );
                      "
                      >{{
                        t(typeKey(`actions.${config.actions[1].code}`))
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
            width="140"
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
            min-width="170"
            show-overflow-tooltip
          /><el-table-column
            :label="t(namespace('common.primaryMetric'))"
            width="130"
            ><template #default="{ row }">{{
              row.runtime.metrics[0]?.value || "--"
            }}</template></el-table-column
          ><el-table-column
            :label="t('deviceSystemPage.deviceAsset.labels.communication')"
            width="100"
            ><template #default="{ row }"
              ><DsTag :type="statusTone(row.runtime.communication)">{{
                stateLabel(row.runtime.communication)
              }}</DsTag></template
            ></el-table-column
          ><el-table-column
            :label="t('deviceSystemPage.deviceAsset.labels.operation')"
            fixed="right"
            width="176"
            ><template #default="{ row }"
              ><div class="ds-row-actions">
                <el-button
                  link
                  type="primary"
                  :disabled="association === 'UNASSIGNED' || !canControl"
                  @click="
                    singleCommand(
                      row,
                      t(typeKey(`actions.${config.actions[0].code}`)),
                    )
                  "
                  >{{ t(namespace("common.operate")) }}</el-button
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
                        >{{ t(namespace("common.profile")) }}</el-dropdown-item
                      ><el-dropdown-item
                        :icon="config.actions[1].icon"
                        :disabled="association === 'UNASSIGNED' || !canControl"
                        @click="
                          singleCommand(
                            row,
                            t(typeKey(`actions.${config.actions[1].code}`)),
                          )
                        "
                        >{{
                          t(typeKey(`actions.${config.actions[1].code}`))
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
          :title="t(namespace('common.emptyTitle'))"
          :description="
            association === 'UNASSIGNED'
              ? t(namespace('common.unassignedEmpty'))
              : t(typeKey('emptyDescription'))
          "
        />
        <footer
          v-if="total"
          class="industry-pagination ds-list-table-footer ds-list-table-footer--pagination-only"
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
.operational-device-page {
  min-width: 0;
  max-width: 100%;
  overflow-x: clip;
}
.operational-device-page :deep(.ds-list-page-card) {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}
.industry-header-actions {
  display: flex;
  gap: 8px;
}
.industry-console,
.industry-query,
.industry-selection,
.industry-content,
.industry-pagination {
  width: calc(100% - 28px);
  min-width: 0;
  max-width: calc(100% - 28px);
  margin-right: 14px;
  margin-left: 14px;
}
.industry-console {
  margin-top: 10px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  overflow: hidden;
}
.industry-console > header {
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
.industry-console > header > div {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
}
.industry-console > header .el-icon {
  color: var(--color-primary-500);
  font-size: 19px;
}
.industry-console > header > div > div {
  min-width: 0;
  display: grid;
  gap: 2px;
}
.industry-console > header span {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.industry-console__body {
  padding: 10px;
  display: grid;
  grid-template-columns: 196px minmax(0, 1fr) 208px;
  align-items: stretch;
  gap: 8px;
}
.industry-scope {
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: var(--color-bg-muted);
}
.industry-scope > label,
.industry-actions > label,
.industry-parameters label {
  display: block;
  margin-bottom: 6px;
  color: var(--color-text-secondary);
  font-size: 11px;
}
.industry-scope :deep(.el-radio-group) {
  width: 100%;
  display: flex;
}
.industry-scope :deep(.el-radio-button) {
  min-width: 0;
  flex: 1;
}
.industry-scope :deep(.el-radio-button__inner) {
  width: 100%;
  padding: 6px 4px;
}
.industry-count {
  margin: 8px 0 6px;
  display: flex;
  align-items: baseline;
  gap: 5px;
}
.industry-count strong {
  color: var(--color-primary-500);
  font-size: 26px;
  line-height: 1;
}
.industry-count span {
  color: var(--color-text-secondary);
  font-size: 11px;
}
.industry-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.industry-stats span {
  padding: 2px 5px;
  border: 1px solid var(--color-border-default);
  border-radius: 4px;
  color: var(--color-text-secondary);
  font-size: 10px;
  background: var(--color-bg-surface);
}
.industry-command-panel {
  min-width: 0;
  padding: 0 8px;
  border-left: 1px solid var(--color-border-default);
  overflow: hidden;
}
.industry-actions > div {
  display: grid;
  grid-template-columns: repeat(6, minmax(72px, 1fr));
  gap: 5px;
}
.industry-actions :deep(.el-button) {
  width: 100%;
  min-width: 0;
  height: 34px;
  margin: 0;
  padding: 4px 5px;
  overflow: hidden;
}
.industry-actions :deep(.el-button span) {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.industry-actions :deep(.el-button.active) {
  border-color: var(--color-primary-500);
  color: var(--color-primary-500);
  background: var(--color-primary-soft);
}
.industry-parameters {
  margin-top: 8px;
  padding-top: 7px;
  display: flex;
  align-items: end;
  gap: 10px;
  border-top: 1px solid var(--color-border-default);
}
.industry-parameters > div {
  min-width: 0;
}
.number-unit {
  display: flex;
  width: 142px;
}
.number-unit :deep(.el-input-number) {
  width: 100px;
}
.number-unit > span {
  display: grid;
  min-width: 42px;
  padding: 0 4px;
  place-items: center;
  border: 1px solid var(--el-border-color);
  border-left: 0;
  border-radius: 0 var(--el-border-radius-base) var(--el-border-radius-base) 0;
  color: var(--color-text-secondary);
  background: var(--color-bg-muted);
}
.number-unit :deep(.el-input__wrapper) {
  border-radius: var(--el-border-radius-base) 0 0 var(--el-border-radius-base);
}
.mode-parameter {
  min-width: 0;
  flex: 1;
}
.mode-parameter :deep(.el-radio-group) {
  display: flex;
  flex-wrap: wrap;
}
.mode-parameter :deep(.el-radio-button) {
  min-width: 0;
}
.mode-parameter :deep(.el-radio-button__inner) {
  padding: 6px 7px;
}
.industry-confirm {
  min-width: 0;
  padding: 2px 0 0 8px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--color-border-default);
}
.industry-confirm h3 {
  margin: 0 0 6px;
  font-size: 11px;
}
.industry-confirm dl {
  margin: 0;
  display: grid;
  gap: 4px;
}
.industry-confirm dl > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.industry-confirm dt {
  color: var(--color-text-secondary);
  font-size: 10px;
}
.industry-confirm dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 10px;
  font-weight: 600;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.industry-confirm > small {
  min-height: 16px;
  margin: 5px 0;
  color: var(--color-text-secondary);
  font-size: 10px;
  line-height: 16px;
}
.industry-confirm :deep(.el-button) {
  width: 100%;
  height: 32px;
  margin-top: auto;
}
.industry-query {
  margin-top: 10px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  overflow: hidden;
}
.industry-query > header {
  min-height: 38px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-border-default);
}
.industry-query > header > div {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.industry-query > header span {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.industry-filter-bar {
  padding: 8px 10px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.industry-filter-fields {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(170px, 220px) minmax(170px, 220px) minmax(
      130px,
      160px
    ) minmax(145px, 180px) minmax(240px, 340px) 68px;
  gap: 8px;
}
.industry-filter-fields > * {
  min-width: 0;
}
.industry-view-switch {
  margin-left: auto;
  flex: 0 0 78px;
  display: flex;
  justify-content: flex-end;
}
.industry-view-switch :deep(.el-button) {
  width: 39px;
  min-width: 39px;
  padding: 0;
}
.industry-selection {
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
.industry-selection > span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.industry-content {
  min-height: 260px;
  margin-top: 10px;
  overflow: hidden;
}
.industry-grid {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.industry-card {
  min-width: 0;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  overflow: hidden;
}
.industry-card.selected {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 1px var(--color-primary-500);
}
.industry-card > header {
  min-width: 0;
  min-height: 54px;
  padding: 9px 10px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.industry-card > header > div {
  min-width: 0;
  display: grid;
  gap: 2px;
  flex: 1;
}
.industry-card > header strong,
.industry-card > header small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.industry-card > header small,
.industry-location {
  color: var(--color-text-secondary);
  font-size: 11px;
}
.industry-location {
  height: 28px;
  margin: 0;
  padding: 0 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.industry-reading {
  min-width: 0;
  min-height: 130px;
  padding: 9px 10px;
  display: grid;
  grid-template-columns: minmax(78px, 98px) minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  background: color-mix(
    in srgb,
    var(--color-primary-50) 38%,
    var(--color-bg-surface)
  );
}
.industry-image-slot {
  height: 104px;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.industry-image-slot img {
  display: block;
  width: 100%;
  height: 92px;
  object-fit: contain;
  filter: drop-shadow(0 8px 10px rgb(15 23 42 / 14%));
}
html[data-theme="dark"] .industry-image-slot img {
  filter: drop-shadow(0 8px 12px rgb(0 0 0 / 34%));
}
.industry-metrics {
  min-width: 0;
  display: grid;
  gap: 7px;
}
.industry-metrics > strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.industry-metrics > div {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(70px, 1fr) auto;
  gap: 8px;
  font-size: 10px;
}
.industry-metrics label {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.industry-metrics span {
  font-weight: 600;
  white-space: nowrap;
}
.metric--success {
  color: var(--color-success-default);
}
.metric--warning {
  color: var(--color-warning-default);
}
.metric--danger {
  color: var(--color-danger-default);
}
.industry-meta {
  padding: 7px 10px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 9px;
}
.industry-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.industry-meta strong {
  color: var(--color-text-primary);
  font-weight: 500;
}
.industry-card > footer {
  padding: 7px 8px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  border-top: 1px solid var(--color-border-default);
}
.industry-card > footer > * {
  min-width: 0;
}
.industry-card > footer :deep(.el-button) {
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 7px 2px;
  overflow: hidden;
}
.industry-card > footer :deep(.el-button span) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.industry-table-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.industry-pagination {
  margin-top: 10px;
  margin-bottom: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border-default);
  overflow: hidden;
}
@media (max-width: 1400px) {
  .industry-console__body {
    grid-template-columns: 188px minmax(0, 1fr) 190px;
  }
  .industry-filter-fields {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .industry-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 1100px) {
  .industry-console__body {
    grid-template-columns: 184px minmax(0, 1fr);
  }
  .industry-actions > div {
    grid-template-columns: repeat(3, minmax(80px, 1fr));
  }
  .industry-confirm {
    grid-column: 1/-1;
    padding: 8px 0 0;
    display: grid;
    grid-template-columns: 90px minmax(0, 1fr) minmax(120px, 180px) 170px;
    align-items: center;
    gap: 10px;
    border-top: 1px solid var(--color-border-default);
    border-left: 0;
  }
  .industry-confirm h3,
  .industry-confirm > small {
    margin: 0;
  }
  .industry-confirm dl {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .industry-confirm :deep(.el-button) {
    height: 32px;
    margin: 0;
  }
  .industry-parameters {
    flex-wrap: wrap;
  }
  .mode-parameter {
    flex-basis: 100%;
  }
  .industry-filter-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .industry-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .industry-console__body {
    grid-template-columns: 1fr;
  }
  .industry-command-panel {
    padding: 8px 0;
    border: 0;
    border-top: 1px solid var(--color-border-default);
    border-bottom: 1px solid var(--color-border-default);
  }
  .industry-actions > div,
  .industry-filter-fields,
  .industry-grid,
  .industry-confirm {
    grid-template-columns: 1fr;
  }
  .industry-filter-bar {
    align-items: flex-end;
  }
  .industry-view-switch {
    align-self: flex-end;
  }
  .industry-confirm dl {
    grid-template-columns: 1fr;
  }
  .industry-query > header > div {
    align-items: flex-start;
    flex-direction: column;
  }
  .industry-selection {
    flex-wrap: wrap;
  }
}
.industry-query > header {
  justify-content: space-between;
  gap: 12px;
}
.industry-asset-range {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.industry-asset-range label {
  color: var(--color-text-secondary);
  font-size: 11px;
}
.industry-asset-range :deep(.el-radio-button__inner) {
  padding: 6px 10px;
}
</style>
