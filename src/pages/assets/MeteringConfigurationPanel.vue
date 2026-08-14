<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  Delete,
  EditPen,
  Plus,
  Refresh,
  Setting,
} from "@element-plus/icons-vue";
import { ApiError } from "@/core/api/contracts";
import { enumLabel } from "@/core/i18n/enum-labels";
import { useAuthStore } from "@/core/auth/auth.store";
import DsEmpty from "@/design-system/components/DsEmpty.vue";
import DsTag from "@/design-system/components/DsTag.vue";
import {
  meteringApi,
  meteringPermissions,
  type CustomerMeteringSetup,
  type MeterAsset,
  type MeteringArea,
  type MeteringPoint,
  type TariffPeriodRate,
  type TariffPeriodType,
  type TariffPlan,
  type TariffTimeRule,
} from "@/domain/iot/assets/meter";
import type { TenantRecord } from "@/domain/platform/org";
import type { ResourceNode } from "@/domain/platform/org/resource";

const props = defineProps<{
  spaceTree: ResourceNode[];
  tenants: TenantRecord[];
  meters: MeterAsset[];
}>();
const auth = useAuthStore();
const { locale } = useI18n();
const tx = (zh: string, en: string) => (locale.value === "en-US" ? en : zh);

const periodTypes: TariffPeriodType[] = [
  "SHARP_PEAK",
  "PEAK",
  "FLAT",
  "VALLEY",
  "DEEP_VALLEY",
];
const periodLabel = (value: string) =>
  ({
    SHARP_PEAK: tx("尖峰", "Sharp peak"),
    PEAK: tx("峰", "Peak"),
    FLAT: tx("平", "Flat"),
    VALLEY: tx("谷", "Valley"),
    DEEP_VALLEY: tx("深谷", "Deep valley"),
  })[value] || value;
const loading = ref(false);
const saving = ref(false);
const tab = ref<"areas" | "points" | "tariffs">("areas");
const areas = ref<MeteringArea[]>([]);
const tariffs = ref<TariffPlan[]>([]);
const points = ref<MeteringPoint[]>([]);
const overview = ref({
  areaCount: 0,
  pointCount: 0,
  tariffCount: 0,
  boundPointCount: 0,
  tenantAreaCount: 0,
  commonAreaCount: 0,
});
const dialog = ref<"area" | "tariff" | "point" | "">("");
const editingId = ref(0);
const setupVisible = ref(false);
const setupStep = ref(0);
const canView = computed(() => auth.can(meteringPermissions.view));
const activeMutationPermission = computed(() =>
  editingId.value ? meteringPermissions.update : meteringPermissions.create,
);

const areaForm = reactive<any>({
  code: "",
  name: "",
  areaType: "TENANT",
  rootSpaceNodeId: "",
  tenantId: "",
  effectiveFrom: "",
  status: "ACTIVE",
  remark: "",
  version: undefined,
});
const tariffForm = reactive<any>(emptyTariff());
const pointForm = reactive<any>({
  code: "",
  name: "",
  meteringAreaId: "",
  spaceNodeId: "",
  energyType: "ELECTRICITY",
  purposeType: "TENANT",
  flowDirection: "CONSUMPTION",
  settlementMode: "POSTPAID",
  unitSymbol: "kWh",
  tariffPlanId: "",
  meterId: "",
  channelCode: "TOTAL_ACTIVE_ENERGY",
  status: "ACTIVE",
  remark: "",
  version: undefined,
});
const setupForm = reactive<any>({
  tenantId: "",
  rootSpaceNodeId: "",
  meterId: "",
  tariffPlanId: "",
  areaName: "",
  pointName: "",
  channelCode: "TOTAL_ACTIVE_ENERGY",
  settlementMode: "POSTPAID",
  remark: "",
});

function defaultRates(): TariffPeriodRate[] {
  return periodTypes.map((periodType, index) => ({
    periodType,
    unitPrice: [1, 2, 1, 2, 1][index],
  }));
}
function defaultRules(): TariffTimeRule[] {
  return [
    rule("00:00-06:00", 0, 360, "DEEP_VALLEY", 1),
    rule("06:00-08:00", 360, 480, "FLAT", 2),
    rule("08:00-11:00", 480, 660, "PEAK", 3),
    rule("11:00-13:00", 660, 780, "FLAT", 4),
    rule("13:00-15:00", 780, 900, "VALLEY", 5),
    rule("15:00-18:00", 900, 1080, "FLAT", 6),
    rule("18:00-21:00", 1080, 1260, "SHARP_PEAK", 7),
    rule("21:00-24:00", 1260, 1440, "VALLEY", 8),
  ];
}
function rule(
  name: string,
  startMinute: number,
  endMinute: number,
  periodType: TariffPeriodType,
  priority: number,
): TariffTimeRule {
  return {
    ruleName: name,
    seasonCode: "ALL_YEAR",
    monthFrom: 1,
    monthTo: 12,
    dayType: "ALL_DAYS",
    startMinute,
    endMinute,
    periodType,
    priority,
  };
}
function emptyTariff() {
  return {
    code: "",
    name: "",
    energyType: "ELECTRICITY",
    billingMode: "TIME_OF_USE",
    unitPrice: 0.8,
    currency: "CNY",
    regionCode: "CN-SH",
    customerCategory: "COMMERCIAL",
    voltageLevel: "LOW_VOLTAGE",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: "",
    status: "ACTIVE",
    remark: "",
    periodRates: defaultRates(),
    timeRules: defaultRules(),
    version: undefined,
  };
}

const tenantOptions = computed(() =>
  props.tenants.filter((tenant) => tenant.status !== "vacated"),
);
const selectedSetupTenant = computed(() =>
  tenantOptions.value.find((tenant) => tenant.id === setupForm.tenantId),
);
const selectedAreaTenant = computed(() =>
  tenantOptions.value.find((tenant) => tenant.id === areaForm.tenantId),
);
const setupSpaceTree = computed(() =>
  filterSpaceTree(selectedSetupTenant.value?.resourceNodeIds || []),
);
const areaSpaceTree = computed(() =>
  areaForm.areaType === "TENANT"
    ? filterSpaceTree(selectedAreaTenant.value?.resourceNodeIds || [])
    : props.spaceTree,
);
const setupMeters = computed(() =>
  props.meters.filter((meter) => {
    if (!setupForm.rootSpaceNodeId) return false;
    return (
      isWithinSpace(meter.spaceNodeId, setupForm.rootSpaceNodeId) &&
      (!meter.ownerTenantId || meter.ownerTenantId === setupForm.tenantId) &&
      meter.status === "active"
    );
  }),
);
const setupTariffs = computed(() =>
  tariffs.value.filter(
    (item) => item.energyType === "ELECTRICITY" && item.status === "ACTIVE",
  ),
);
const activeArea = computed(() =>
  areas.value.find((item) => String(item.id) === pointForm.meteringAreaId),
);
const pointSpaceTree = computed(() =>
  activeArea.value
    ? filterSpaceTree([String(activeArea.value.rootSpaceNodeId)])
    : props.spaceTree,
);
const pointMeters = computed(() =>
  props.meters.filter(
    (meter) =>
      !pointForm.spaceNodeId ||
      isWithinSpace(meter.spaceNodeId, pointForm.spaceNodeId),
  ),
);
const setupReady = computed(
  () =>
    setupForm.tenantId &&
    setupForm.rootSpaceNodeId &&
    setupForm.meterId &&
    setupForm.tariffPlanId &&
    setupForm.areaName.trim() &&
    setupForm.pointName.trim(),
);

watch(
  () => setupForm.tenantId,
  () => {
    setupForm.rootSpaceNodeId = "";
    setupForm.meterId = "";
    const roots = selectedSetupTenant.value?.resourceNodeIds || [];
    if (roots.length === 1) setupForm.rootSpaceNodeId = roots[0];
    if (selectedSetupTenant.value) {
      setupForm.areaName = `${selectedSetupTenant.value.name}${tx("计量区", " metering area")}`;
      setupForm.pointName = `${selectedSetupTenant.value.name}${tx("总用电", " total electricity")}`;
    }
  },
);
watch(
  () => setupForm.rootSpaceNodeId,
  () => {
    setupForm.meterId = "";
  },
);
watch(
  () => areaForm.tenantId,
  () => {
    areaForm.rootSpaceNodeId = "";
    const roots = selectedAreaTenant.value?.resourceNodeIds || [];
    if (roots.length === 1) areaForm.rootSpaceNodeId = roots[0];
  },
);
watch(
  () => areaForm.areaType,
  (value) => {
    if (value !== "TENANT") areaForm.tenantId = "";
    areaForm.rootSpaceNodeId = "";
  },
);
watch(
  () => pointForm.meteringAreaId,
  () => {
    pointForm.spaceNodeId = activeArea.value
      ? String(activeArea.value.rootSpaceNodeId)
      : "";
    pointForm.meterId = "";
  },
);

function allNodes(nodes = props.spaceTree): ResourceNode[] {
  return nodes.flatMap((node) => [node, ...allNodes(node.children || [])]);
}
function isWithinSpace(candidateId: string, rootId: string) {
  const root = allNodes().find((node) => node.id === rootId);
  if (!root) return false;
  return [root, ...allNodes(root.children || [])].some(
    (node) => node.id === candidateId,
  );
}
function filterSpaceTree(authorizedIds: string[]) {
  const allowed = new Set(authorizedIds);
  const visit = (nodes: ResourceNode[], inside = false): ResourceNode[] =>
    nodes.flatMap((node) => {
      const currentInside = inside || allowed.has(node.id);
      const children = visit(node.children || [], currentInside);
      if (!currentInside && !children.length) return [];
      // Ancestors are retained only to show the authorized path. They must not be
      // selectable, otherwise a customer bound to one floor could be configured
      // against its building or campus ancestor.
      return [{ ...node, disabled: !currentInside, children } as ResourceNode];
    });
  return visit(props.spaceTree);
}

async function load() {
  if (!canView.value) return;
  loading.value = true;
  try {
    const [o, a, t, p] = await Promise.all([
      meteringApi.overview(),
      meteringApi.areas(),
      meteringApi.tariffs(),
      meteringApi.points(),
    ]);
    overview.value = o;
    areas.value = a;
    tariffs.value = t;
    points.value = p;
  } catch (error) {
    message(
      error,
      tx("计量配置加载失败", "Failed to load metering configuration"),
    );
  } finally {
    loading.value = false;
  }
}
function openSetup() {
  if (!auth.canEnter(meteringPermissions.create)) return;
  Object.assign(setupForm, {
    tenantId: "",
    rootSpaceNodeId: "",
    meterId: "",
    tariffPlanId: "",
    areaName: "",
    pointName: "",
    channelCode: "TOTAL_ACTIVE_ENERGY",
    settlementMode: "POSTPAID",
    remark: "",
  });
  setupStep.value = 0;
  setupVisible.value = true;
}
function reset(type: "area" | "tariff" | "point") {
  if (!auth.canEnter(meteringPermissions.create)) return;
  editingId.value = 0;
  dialog.value = type;
  if (type === "area")
    Object.assign(areaForm, {
      code: "",
      name: "",
      areaType: "TENANT",
      rootSpaceNodeId: "",
      tenantId: "",
      effectiveFrom: "",
      status: "ACTIVE",
      remark: "",
      version: undefined,
    });
  if (type === "tariff") Object.assign(tariffForm, emptyTariff());
  if (type === "point")
    Object.assign(pointForm, {
      code: "",
      name: "",
      meteringAreaId: "",
      spaceNodeId: "",
      energyType: "ELECTRICITY",
      purposeType: "TENANT",
      flowDirection: "CONSUMPTION",
      settlementMode: "POSTPAID",
      unitSymbol: "kWh",
      tariffPlanId: "",
      meterId: "",
      channelCode: "TOTAL_ACTIVE_ENERGY",
      status: "ACTIVE",
      remark: "",
      version: undefined,
    });
}
function editArea(row: MeteringArea) {
  if (!auth.canEnter(meteringPermissions.update)) return;
  dialog.value = "area";
  editingId.value = row.id;
  Object.assign(areaForm, {
    ...row,
    rootSpaceNodeId: String(row.rootSpaceNodeId),
    tenantId: row.tenantId ? String(row.tenantId) : "",
    effectiveFrom: row.effectiveFrom || "",
  });
}
function editTariff(row: TariffPlan) {
  if (!auth.canEnter(meteringPermissions.update)) return;
  dialog.value = "tariff";
  editingId.value = row.id;
  Object.assign(tariffForm, {
    ...row,
    effectiveTo: row.effectiveTo || "",
    periodRates: row.periodRates.map((x) => ({ ...x })),
    timeRules: row.timeRules.map((x) => ({ ...x })),
  });
}
function editPoint(row: MeteringPoint) {
  if (!auth.canEnter(meteringPermissions.update)) return;
  dialog.value = "point";
  editingId.value = row.id;
  Object.assign(pointForm, {
    ...row,
    meteringAreaId: String(row.meteringAreaId),
    spaceNodeId: String(row.spaceNodeId),
    tariffPlanId: row.tariffPlanId ? String(row.tariffPlanId) : "",
    meterId: row.meterId ? String(row.meterId) : "",
    channelCode: row.channelCode || "",
  });
}

async function submitSetup() {
  if (!auth.can(meteringPermissions.create)) return;
  if (!setupReady.value) {
    ElMessage.warning(tx("请完成全部开通步骤", "Complete every setup step"));
    return;
  }
  saving.value = true;
  try {
    const body: CustomerMeteringSetup = {
      tenantId: Number(setupForm.tenantId),
      rootSpaceNodeId: Number(setupForm.rootSpaceNodeId),
      areaName: setupForm.areaName.trim(),
      pointName: setupForm.pointName.trim(),
      meterId: Number(setupForm.meterId),
      tariffPlanId: Number(setupForm.tariffPlanId),
      channelCode: setupForm.channelCode.trim(),
      settlementMode: setupForm.settlementMode,
      remark: setupForm.remark,
    };
    await meteringApi.setupCustomer(body);
    setupVisible.value = false;
    await load();
    ElMessage.success(
      tx(
        "客户计量已开通，区域、计量点、通道和计费关系已同时生效",
        "Customer metering setup is active",
      ),
    );
  } catch (error) {
    message(error, tx("客户计量开通失败", "Customer setup failed"));
  } finally {
    saving.value = false;
  }
}
async function save() {
  if (!auth.can(activeMutationPermission.value)) return;
  saving.value = true;
  try {
    if (dialog.value === "area") {
      if (
        !areaForm.name ||
        !areaForm.rootSpaceNodeId ||
        (areaForm.areaType === "TENANT" && !areaForm.tenantId)
      )
        throw new Error(tx("请完整填写计量区域", "Complete the metering area"));
      const body = {
        ...areaForm,
        rootSpaceNodeId: Number(areaForm.rootSpaceNodeId),
        tenantId: areaForm.tenantId ? Number(areaForm.tenantId) : null,
        effectiveFrom: areaForm.effectiveFrom || null,
      };
      editingId.value
        ? await meteringApi.updateArea(editingId.value, body)
        : await meteringApi.createArea(body);
    }
    if (dialog.value === "tariff") {
      if (!tariffForm.name || !tariffForm.effectiveFrom)
        throw new Error(tx("请完整填写计费方案", "Complete the tariff plan"));
      const body = {
        ...tariffForm,
        effectiveTo: tariffForm.effectiveTo || null,
        periodRates:
          tariffForm.billingMode === "TIME_OF_USE"
            ? tariffForm.periodRates
            : [],
        timeRules:
          tariffForm.billingMode === "TIME_OF_USE" ? tariffForm.timeRules : [],
      };
      editingId.value
        ? await meteringApi.updateTariff(editingId.value, body)
        : await meteringApi.createTariff(body);
    }
    if (dialog.value === "point") {
      if (
        !pointForm.name ||
        !pointForm.meteringAreaId ||
        !pointForm.spaceNodeId
      )
        throw new Error(tx("请完整填写计量点", "Complete the metering point"));
      const body = {
        ...pointForm,
        meteringAreaId: Number(pointForm.meteringAreaId),
        spaceNodeId: Number(pointForm.spaceNodeId),
        tariffPlanId: pointForm.tariffPlanId
          ? Number(pointForm.tariffPlanId)
          : null,
        meterId: pointForm.meterId ? Number(pointForm.meterId) : null,
        channelCode: pointForm.meterId ? pointForm.channelCode : null,
      };
      editingId.value
        ? await meteringApi.updatePoint(editingId.value, body)
        : await meteringApi.createPoint(body);
    }
    dialog.value = "";
    ElMessage.success(tx("保存成功", "Saved"));
    await load();
  } catch (error) {
    message(error, tx("保存失败", "Save failed"));
  } finally {
    saving.value = false;
  }
}
async function remove(type: "area" | "tariff" | "point", row: any) {
  if (!auth.can(meteringPermissions.delete)) return;
  try {
    await ElMessageBox.confirm(
      tx(`确认删除“${row.name}”？`, `Delete “${row.name}”?`),
      tx("删除确认", "Confirm deletion"),
      { type: "warning" },
    );
    if (type === "area") await meteringApi.deleteArea(row.id, row.version);
    if (type === "tariff") await meteringApi.deleteTariff(row.id, row.version);
    if (type === "point") await meteringApi.deletePoint(row.id, row.version);
    await load();
    ElMessage.success(tx("已删除", "Deleted"));
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    message(error, tx("删除失败", "Delete failed"));
  }
}
function message(error: unknown, fallback: string) {
  ElMessage.error(
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : fallback,
  );
}
const areaTypeLabel = (value: string) =>
  ({
    TENANT: tx("客户计量区", "Customer area"),
    COMMON: tx("公共计量区", "Common area"),
    GENERATION: tx("发电计量区", "Generation area"),
    STORAGE: tx("储能计量区", "Storage area"),
  })[value] || value;
const statusLabel = (value: string) =>
  ({
    ACTIVE: tx("启用", "Active"),
    DISABLED: tx("停用", "Disabled"),
  })[value] || value;
const energyLabel = (value: string) =>
  ({
    ELECTRICITY: tx("电", "Electricity"),
    WATER: tx("水", "Water"),
    COOLING: tx("冷量", "Cooling"),
    HEATING: tx("热量", "Heating"),
    GAS: tx("燃气", "Gas"),
  })[value] || value;
const minuteLabel = (value: number) =>
  value === 1440
    ? "24:00"
    : `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
onMounted(load);
</script>

<template>
  <section v-loading="loading" class="metering-config">
    <template v-if="canView">
      <header class="config-intro">
        <div>
          <h3>{{ tx("计量与结算配置", "Metering & settlement") }}</h3>
          <p>
            {{
              tx(
                "客户、空间、物理表计和结算规则分层管理，通过开通向导一次建立有效关系。",
                "Manage customers, spaces, physical meters and settlement rules separately, then activate them in one guided flow.",
              )
            }}
          </p>
        </div>
        <div class="config-intro__actions">
          <el-button :icon="Refresh" @click="load">{{
            tx("刷新", "Refresh")
          }}</el-button
          ><el-button
            v-permission.preview="meteringPermissions.create"
            type="primary"
            :icon="Setting"
            @click="openSetup"
            >{{ tx("客户计量开通", "Customer setup") }}</el-button
          >
        </div>
      </header>

      <section class="workflow-guide">
        <div>
          <strong>1</strong
          ><span>{{ tx("客户与空间", "Customer & space") }}</span>
        </div>
        <i />
        <div>
          <strong>2</strong><span>{{ tx("物理表计", "Physical meter") }}</span>
        </div>
        <i />
        <div>
          <strong>3</strong><span>{{ tx("计费方案", "Tariff plan") }}</span>
        </div>
        <i />
        <div>
          <strong>4</strong
          ><span>{{ tx("计量点生效", "Point activated") }}</span>
        </div>
      </section>

      <div class="config-kpis">
        <article>
          <span>{{ tx("计量区域", "Areas") }}</span
          ><strong>{{ overview.areaCount }}</strong>
        </article>
        <article>
          <span>{{ tx("计量点", "Points") }}</span
          ><strong>{{ overview.pointCount }}</strong>
        </article>
        <article>
          <span>{{ tx("计费方案", "Tariffs") }}</span
          ><strong>{{ overview.tariffCount }}</strong>
        </article>
        <article>
          <span>{{ tx("已绑定通道", "Bound points") }}</span
          ><strong>{{ overview.boundPointCount }}</strong>
        </article>
      </div>

      <el-tabs v-model="tab" class="config-tabs"
        ><el-tab-pane
          :label="tx('计量区域', 'Metering areas')"
          name="areas" /><el-tab-pane
          :label="tx('计量点与通道', 'Points & channels')"
          name="points" /><el-tab-pane
          :label="tx('计费方案', 'Tariff plans')"
          name="tariffs"
      /></el-tabs>
      <div class="table-toolbar">
        <p v-if="tab === 'areas'">
          {{
            tx(
              "客户授权空间是可用上限；计量区域是本次结算的精确范围。",
              "Authorized spaces are the maximum scope; a metering area is the exact settlement scope.",
            )
          }}
        </p>
        <p v-else-if="tab === 'points'">
          {{
            tx(
              "计量点承载用途、流向与结算，物理电表仅提供采集通道。",
              "Points carry purpose, flow and settlement; meters provide physical channels.",
            )
          }}
        </p>
        <p v-else>
          {{
            tx(
              "支持单一计价和中国常用尖、峰、平、谷、深谷分时规则。",
              "Supports flat pricing and structured five-period time-of-use pricing.",
            )
          }}
        </p>
        <el-button
          v-permission.preview="meteringPermissions.create"
          type="primary"
          :icon="Plus"
          @click="
            reset(
              tab === 'areas' ? 'area' : tab === 'points' ? 'point' : 'tariff',
            )
          "
          >{{ tx("新增", "New") }}</el-button
        >
      </div>

      <el-table
        v-if="tab === 'areas'"
        :data="areas"
        row-key="id"
        class="config-table"
        ><el-table-column
          prop="name"
          :label="tx('区域名称', 'Area')"
          min-width="190"
          ><template #default="{ row }"
            ><strong>{{ row.name }}</strong
            ><small>{{ row.code }}</small></template
          ></el-table-column
        ><el-table-column :label="tx('区域类型', 'Type')" width="132"
          ><template #default="{ row }">{{
            areaTypeLabel(row.areaType)
          }}</template></el-table-column
        ><el-table-column
          prop="rootSpaceName"
          :label="tx('空间范围', 'Space scope')"
          min-width="170"
          show-overflow-tooltip
        /><el-table-column
          prop="tenantName"
          :label="tx('当前客户', 'Current customer')"
          min-width="160"
          ><template #default="{ row }">{{
            row.tenantName || tx("不适用", "N/A")
          }}</template></el-table-column
        ><el-table-column :label="tx('状态', 'Status')" width="92"
          ><template #default="{ row }"
                ><DsTag
                  :type="row.status === 'ACTIVE' ? 'success' : 'neutral'"
                  >{{ statusLabel(row.status) }}</DsTag
            ></template
          ></el-table-column
        ><el-table-column
          :label="tx('操作', 'Actions')"
          width="132"
          fixed="right"
          ><template #default="{ row }"
            ><div class="ds-row-actions">
              <el-button
                v-permission.preview="meteringPermissions.update"
                text
                :icon="EditPen"
                @click="editArea(row)"
                >{{ tx("编辑", "Edit") }}</el-button
              ><el-button
                v-permission="meteringPermissions.delete"
                text
                type="danger"
                :icon="Delete"
                @click="remove('area', row)"
                >{{ tx("删除", "Delete") }}</el-button
              >
            </div></template
          ></el-table-column
        ></el-table
      >
      <el-table
        v-else-if="tab === 'points'"
        :data="points"
        row-key="id"
        class="config-table"
        ><el-table-column
          prop="name"
          :label="tx('计量点', 'Point')"
          min-width="180"
          ><template #default="{ row }"
            ><strong>{{ row.name }}</strong
            ><small>{{ row.code }}</small></template
          ></el-table-column
        ><el-table-column
          prop="meteringAreaName"
          :label="tx('计量区域', 'Area')"
          min-width="150"
        /><el-table-column
          :label="tx('能源 / 用途', 'Energy / purpose')"
          width="156"
          ><template #default="{ row }"
            >{{ energyLabel(row.energyType) }} / {{ enumLabel('purposeType', row.purposeType, locale) }}</template
          ></el-table-column
        ><el-table-column
          prop="tariffPlanName"
          :label="tx('计费方案', 'Tariff')"
          min-width="150"
          ><template #default="{ row }">{{
            row.tariffPlanName || "--"
          }}</template></el-table-column
        ><el-table-column
          :label="tx('物理通道', 'Physical channel')"
          min-width="210"
          show-overflow-tooltip
          ><template #default="{ row }">{{
            row.meterName ? `${row.meterName} / ${row.channelCode}` : "--"
          }}</template></el-table-column
        ><el-table-column
          :label="tx('操作', 'Actions')"
          width="132"
          fixed="right"
          ><template #default="{ row }"
            ><div class="ds-row-actions">
              <el-button
                v-permission.preview="meteringPermissions.update"
                text
                @click="editPoint(row)"
                >{{ tx("编辑", "Edit") }}</el-button
              ><el-button
                v-permission="meteringPermissions.delete"
                text
                type="danger"
                @click="remove('point', row)"
                >{{ tx("删除", "Delete") }}</el-button
              >
            </div></template
          ></el-table-column
        ></el-table
      >
      <el-table v-else :data="tariffs" row-key="id" class="config-table"
        ><el-table-column
          prop="name"
          :label="tx('方案名称', 'Plan')"
          min-width="190"
          ><template #default="{ row }"
            ><strong>{{ row.name }}</strong
            ><small>{{ row.code }}</small></template
          ></el-table-column
        ><el-table-column :label="tx('计价模式', 'Mode')" width="132"
          ><template #default="{ row }">{{
            row.billingMode === "TIME_OF_USE"
              ? tx("分时计价", "Time of use")
              : tx("单一计价", "Flat")
          }}</template></el-table-column
        ><el-table-column
          :label="tx('时段价格', 'Period prices')"
          min-width="260"
          ><template #default="{ row }"
            ><div class="rate-summary" v-if="row.periodRates?.length">
              <span v-for="rate in row.periodRates" :key="rate.periodType"
                >{{ periodLabel(rate.periodType) }} {{ rate.unitPrice }}</span
              >
            </div>
            <span v-else>{{ row.currency }} {{ row.unitPrice }}</span></template
          ></el-table-column
        ><el-table-column
          prop="effectiveFrom"
          :label="tx('生效日期', 'Effective from')"
          width="130"
        /><el-table-column
          :label="tx('操作', 'Actions')"
          width="132"
          fixed="right"
          ><template #default="{ row }"
            ><div class="ds-row-actions">
              <el-button
                v-permission.preview="meteringPermissions.update"
                text
                @click="editTariff(row)"
                >{{ tx("编辑", "Edit") }}</el-button
              ><el-button
                v-permission="meteringPermissions.delete"
                text
                type="danger"
                @click="remove('tariff', row)"
                >{{ tx("删除", "Delete") }}</el-button
              >
            </div></template
          ></el-table-column
        ></el-table
      >

      <el-dialog
        v-model="setupVisible"
        :title="tx('客户计量开通', 'Customer metering setup')"
        width="860px"
        destroy-on-close
        class="setup-dialog"
      >
        <el-steps :active="setupStep" align-center finish-status="success"
          ><el-step :title="tx('客户空间', 'Customer')" /><el-step
            :title="tx('表计通道', 'Meter')" /><el-step
            :title="tx('计费结算', 'Tariff')" /><el-step
            :title="tx('确认开通', 'Review')"
        /></el-steps>
        <div class="setup-body">
          <el-form v-if="setupStep === 0" label-position="top" class="form-grid"
            ><el-form-item :label="tx('客户档案', 'Customer record')" required
              ><el-select v-model="setupForm.tenantId" filterable
                ><el-option
                  v-for="item in tenantOptions"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id" /></el-select></el-form-item
            ><el-form-item
              :label="tx('结算空间范围', 'Settlement space')"
              required
              ><el-tree-select
                v-model="setupForm.rootSpaceNodeId"
                :data="setupSpaceTree"
                node-key="id"
                :props="{ label: 'name', children: 'children' }"
                check-strictly
                default-expand-all
                :disabled="
                  !setupForm.tenantId ||
                  selectedSetupTenant?.resourceNodeIds?.length === 1
                "
              /><small
                v-if="setupForm.tenantId && !setupSpaceTree.length"
                class="field-error"
                >{{
                  tx(
                    "该客户尚未关联空间，请先在客户档案完成空间授权。",
                    "This customer has no authorized space.",
                  )
                }}</small
              ></el-form-item
            ><el-form-item :label="tx('计量区域名称', 'Area name')" required
              ><el-input v-model="setupForm.areaName" /></el-form-item
            ><el-form-item :label="tx('计量点名称', 'Point name')" required
              ><el-input v-model="setupForm.pointName" /></el-form-item
          ></el-form>
          <el-form
            v-else-if="setupStep === 1"
            label-position="top"
            class="form-grid"
            ><el-form-item
              :label="tx('空间内可用电表', 'Available meter')"
              required
              ><el-select v-model="setupForm.meterId" filterable
                ><el-option
                  v-for="item in setupMeters"
                  :key="item.id"
                  :label="`${item.name} · ${item.serialNumber}`"
                  :value="item.id" /></el-select
              ><small
                v-if="setupForm.rootSpaceNodeId && !setupMeters.length"
                class="field-error"
                >{{
                  tx(
                    "该空间内没有可用电表，请先在“设备资产”新增或调整电表安装空间。",
                    "No available meter exists in this space.",
                  )
                }}</small
              ></el-form-item
            ><el-form-item :label="tx('采集通道', 'Channel')" required
              ><el-input v-model="setupForm.channelCode" /></el-form-item
            ><el-alert
              class="span-2"
              :title="
                tx(
                  '电表是可更换的采集设备；客户结算关系保存在计量点，不会永久绑死设备。',
                  'Meters are replaceable data sources; settlement belongs to the logical point.',
                )
              "
              type="info"
              :closable="false"
              show-icon
          /></el-form>
          <el-form
            v-else-if="setupStep === 2"
            label-position="top"
            class="form-grid"
            ><el-form-item :label="tx('计费方案', 'Tariff plan')" required
              ><el-select v-model="setupForm.tariffPlanId" filterable
                ><el-option
                  v-for="item in setupTariffs"
                  :key="item.id"
                  :label="`${item.name} · ${item.billingMode === 'TIME_OF_USE' ? tx('分时', 'TOU') : tx('单价', 'Flat')}`"
                  :value="String(item.id)" /></el-select
              ><small v-if="!setupTariffs.length" class="field-error">{{
                tx(
                  "暂无有效电力计费方案，请先在高级配置中新增。",
                  "Create an active electricity tariff first.",
                )
              }}</small></el-form-item
            ><el-form-item :label="tx('结算方式', 'Settlement mode')"
              ><el-select v-model="setupForm.settlementMode"
                ><el-option
                  :label="tx('后付费', 'Postpaid')"
                  value="POSTPAID" /><el-option
                  :label="tx('预付费', 'Prepaid')"
                  value="PREPAID" /><el-option
                  :label="tx('内部核算', 'Internal')"
                  value="INTERNAL" /></el-select></el-form-item
            ><el-form-item class="span-2" :label="tx('备注', 'Remark')"
              ><el-input
                v-model="setupForm.remark"
                type="textarea"
                :rows="3"
                maxlength="500"
                show-word-limit /></el-form-item
          ></el-form>
          <el-descriptions v-else :column="2" border class="setup-review"
            ><el-descriptions-item :label="tx('客户', 'Customer')">{{
              selectedSetupTenant?.name
            }}</el-descriptions-item
            ><el-descriptions-item :label="tx('空间', 'Space')">{{
              allNodes().find((x) => x.id === setupForm.rootSpaceNodeId)?.name
            }}</el-descriptions-item
            ><el-descriptions-item :label="tx('计量区域', 'Area')">{{
              setupForm.areaName
            }}</el-descriptions-item
            ><el-descriptions-item :label="tx('计量点', 'Point')">{{
              setupForm.pointName
            }}</el-descriptions-item
            ><el-descriptions-item :label="tx('物理电表', 'Meter')">{{
              setupMeters.find((x) => x.id === setupForm.meterId)?.name
            }}</el-descriptions-item
            ><el-descriptions-item :label="tx('计费方案', 'Tariff')">{{
              setupTariffs.find((x) => String(x.id) === setupForm.tariffPlanId)
                ?.name
            }}</el-descriptions-item></el-descriptions
          >
        </div>
        <template #footer
          ><div class="dialog-footer">
            <el-button @click="setupVisible = false">{{
              tx("取消", "Cancel")
            }}</el-button
            ><span /><el-button v-if="setupStep > 0" @click="setupStep--">{{
              tx("上一步", "Back")
            }}</el-button
            ><el-button
              v-if="setupStep < 3"
              type="primary"
              :disabled="
                (setupStep === 0 &&
                  (!setupForm.tenantId || !setupForm.rootSpaceNodeId)) ||
                (setupStep === 1 && !setupForm.meterId) ||
                (setupStep === 2 && !setupForm.tariffPlanId)
              "
              @click="setupStep++"
              >{{ tx("下一步", "Next") }}</el-button
            ><el-button
              v-else
              v-permission="meteringPermissions.create"
              type="primary"
              :loading="saving"
              :disabled="!setupReady"
              @click="submitSetup"
              >{{ tx("确认开通", "Activate") }}</el-button
            >
          </div></template
        >
      </el-dialog>

      <el-dialog
        :model-value="!!dialog"
        :title="
          tx(
            editingId ? '编辑高级配置' : '新增高级配置',
            editingId
              ? 'Edit advanced configuration'
              : 'New advanced configuration',
          )
        "
        :width="dialog === 'tariff' ? '920px' : '760px'"
        destroy-on-close
        @update:model-value="
          (value: boolean) => {
            if (!value) dialog = '';
          }
        "
      >
        <el-form v-if="dialog === 'area'" label-position="top"
          ><div class="form-grid">
            <el-form-item :label="tx('区域编码', 'Area code')"
              ><el-input
                v-model="areaForm.code"
                :disabled="!!editingId"
                :placeholder="
                  tx('留空自动生成', 'Generated when blank')
                " /></el-form-item
            ><el-form-item :label="tx('区域名称', 'Area name')" required
              ><el-input v-model="areaForm.name" /></el-form-item
            ><el-form-item :label="tx('区域类型', 'Area type')" required
              ><el-select v-model="areaForm.areaType"
                ><el-option
                  v-for="value in ['TENANT', 'COMMON', 'GENERATION', 'STORAGE']"
                  :key="value"
                  :label="areaTypeLabel(value)"
                  :value="value" /></el-select></el-form-item
            ><el-form-item
              v-if="areaForm.areaType === 'TENANT'"
              :label="tx('客户档案', 'Customer record')"
              required
              ><el-select v-model="areaForm.tenantId" filterable
                ><el-option
                  v-for="item in tenantOptions"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id" /></el-select></el-form-item
            ><el-form-item :label="tx('空间范围', 'Space scope')" required
              ><el-tree-select
                v-model="areaForm.rootSpaceNodeId"
                :data="areaSpaceTree"
                node-key="id"
                :props="{ label: 'name', children: 'children' }"
                check-strictly
                default-expand-all
                :disabled="
                  areaForm.areaType === 'TENANT' &&
                  (!areaForm.tenantId ||
                    selectedAreaTenant?.resourceNodeIds?.length === 1)
                " /></el-form-item
            ><el-form-item :label="tx('状态', 'Status')"
              ><el-select v-model="areaForm.status"
                ><el-option label="ACTIVE" value="ACTIVE" /><el-option
                  label="DISABLED"
                  value="DISABLED" /></el-select
            ></el-form-item></div
        ></el-form>
        <el-form v-else-if="dialog === 'tariff'" label-position="top"
          ><div class="form-grid">
            <el-form-item :label="tx('方案编码', 'Plan code')"
              ><el-input
                v-model="tariffForm.code"
                :disabled="!!editingId"
                :placeholder="
                  tx('留空自动生成', 'Generated when blank')
                " /></el-form-item
            ><el-form-item :label="tx('方案名称', 'Plan name')" required
              ><el-input v-model="tariffForm.name" /></el-form-item
            ><el-form-item :label="tx('计价模式', 'Billing mode')"
              ><el-select v-model="tariffForm.billingMode"
                ><el-option
                  :label="tx('分时计价', 'Time of use')"
                  value="TIME_OF_USE" /><el-option
                  :label="tx('单一计价', 'Flat')"
                  value="FLAT" /></el-select></el-form-item
            ><el-form-item :label="tx('适用地区', 'Region')"
              ><el-input
                v-model="tariffForm.regionCode"
                placeholder="CN-SH" /></el-form-item
            ><el-form-item :label="tx('生效日期', 'Effective from')"
              ><el-date-picker
                v-model="tariffForm.effectiveFrom"
                type="date"
                value-format="YYYY-MM-DD" /></el-form-item
            ><el-form-item :label="tx('结束日期', 'Effective to')"
              ><el-date-picker
                v-model="tariffForm.effectiveTo"
                type="date"
                value-format="YYYY-MM-DD"
                clearable
            /></el-form-item>
          </div>
          <el-form-item
            v-if="tariffForm.billingMode === 'FLAT'"
            :label="tx('单价（元/kWh）', 'Unit price')"
            ><el-input-number
              v-model="tariffForm.unitPrice"
              :min="0"
              :precision="6" /></el-form-item
          ><template v-else
            ><h4 class="form-section-title">
              {{ tx("尖峰平谷价格（元/kWh）", "Period prices") }}
            </h4>
            <div class="rate-editor">
              <el-form-item
                v-for="rate in tariffForm.periodRates"
                :key="rate.periodType"
                :label="periodLabel(rate.periodType)"
                ><el-input-number
                  v-model="rate.unitPrice"
                  :min="0"
                  :precision="6"
                  controls-position="right"
              /></el-form-item>
            </div>
            <h4 class="form-section-title">
              {{ tx("每日 24 小时时段", "24-hour schedule") }}
            </h4>
            <div class="rule-editor">
              <div v-for="item in tariffForm.timeRules" :key="item.priority">
                <span
                  >{{ minuteLabel(item.startMinute) }}–{{
                    minuteLabel(item.endMinute)
                  }}</span
                ><el-select v-model="item.periodType"
                  ><el-option
                    v-for="value in periodTypes"
                    :key="value"
                    :label="periodLabel(value)"
                    :value="value"
                /></el-select>
              </div></div></template
        ></el-form>
        <el-form v-else-if="dialog === 'point'" label-position="top"
          ><div class="form-grid">
            <el-form-item :label="tx('计量点编码', 'Point code')"
              ><el-input
                v-model="pointForm.code"
                :disabled="!!editingId"
                :placeholder="
                  tx('留空自动生成', 'Generated when blank')
                " /></el-form-item
            ><el-form-item :label="tx('计量点名称', 'Point name')" required
              ><el-input v-model="pointForm.name" /></el-form-item
            ><el-form-item :label="tx('计量区域', 'Metering area')" required
              ><el-select v-model="pointForm.meteringAreaId"
                ><el-option
                  v-for="item in areas"
                  :key="item.id"
                  :label="item.name"
                  :value="String(item.id)" /></el-select></el-form-item
            ><el-form-item :label="tx('安装 / 统计空间', 'Space')" required
              ><el-tree-select
                v-model="pointForm.spaceNodeId"
                :data="pointSpaceTree"
                node-key="id"
                :props="{ label: 'name', children: 'children' }"
                check-strictly
                default-expand-all /></el-form-item
            ><el-form-item :label="tx('计费方案', 'Tariff')"
              ><el-select v-model="pointForm.tariffPlanId" clearable
                ><el-option
                  v-for="item in tariffs.filter(
                    (x) => x.energyType === pointForm.energyType,
                  )"
                  :key="item.id"
                  :label="item.name"
                  :value="String(item.id)" /></el-select></el-form-item
            ><el-form-item :label="tx('物理电表', 'Physical meter')"
              ><el-select v-model="pointForm.meterId" clearable
                ><el-option
                  v-for="item in pointMeters"
                  :key="item.id"
                  :label="`${item.name} (${item.serialNumber})`"
                  :value="item.id" /></el-select></el-form-item
            ><el-form-item
              v-if="pointForm.meterId"
              :label="tx('通道编码', 'Channel code')"
              required
              ><el-input v-model="pointForm.channelCode" /></el-form-item
            ><el-form-item :label="tx('结算方式', 'Settlement')"
              ><el-select v-model="pointForm.settlementMode"
                ><el-option value="NONE" label="NONE" /><el-option
                  value="PREPAID"
                  label="PREPAID" /><el-option
                  value="POSTPAID"
                  label="POSTPAID" /><el-option
                  value="INTERNAL"
                  label="INTERNAL" /></el-select
            ></el-form-item></div
        ></el-form>
        <template #footer
          ><el-button @click="dialog = ''">{{ tx("取消", "Cancel") }}</el-button
          ><el-button
            v-permission="activeMutationPermission"
            type="primary"
            :loading="saving"
            @click="save"
            >{{ tx("保存", "Save") }}</el-button
          ></template
        >
      </el-dialog>
    </template>
    <DsEmpty
      v-else
      :description="
        tx(
          '当前角色未授予查看计量高级配置的权限',
          'The current role cannot view advanced metering configuration',
        )
      "
    />
  </section>
</template>

<style scoped>
.metering-config {
  padding: var(--space-4);
}
.config-intro,
.table-toolbar,
.config-intro__actions,
.dialog-footer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.config-intro,
.table-toolbar {
  justify-content: space-between;
}
.config-intro h3,
.config-intro p,
.table-toolbar p {
  margin: 0;
}
.config-intro h3 {
  font-size: var(--font-heading-sm);
}
.config-intro p,
.table-toolbar p {
  margin-top: 3px;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}
.config-intro__actions {
  flex: 0 0 auto;
}
.workflow-guide {
  min-height: 58px;
  margin-top: var(--space-4);
  padding: 0 var(--space-4);
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-bg-muted);
}
.workflow-guide div {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
}
.workflow-guide strong {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--color-primary-500);
  background: var(--color-primary-50);
}
.workflow-guide span {
  font-size: var(--font-body-sm);
}
.workflow-guide i {
  height: 1px;
  margin: 0 var(--space-4);
  flex: 1;
  background: var(--color-border-default);
}
.config-kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: var(--space-4) 0;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
}
.config-kpis article {
  min-width: 0;
  height: 72px;
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-right: 1px solid var(--color-border-default);
}
.config-kpis article:last-child {
  border-right: 0;
}
.config-kpis span {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}
.config-kpis strong {
  margin-top: 2px;
  font-size: 22px;
}
.config-tabs {
  margin-top: var(--space-1);
}
.table-toolbar {
  min-height: 52px;
}
.table-toolbar p {
  max-width: 72%;
}
.config-table :deep(small) {
  display: block;
  margin-top: 2px;
  color: var(--color-text-secondary);
}
.rate-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}
.setup-body {
  min-height: 310px;
  padding: var(--space-6) var(--space-2) var(--space-2);
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 var(--space-4);
}
.form-grid :deep(.el-select),
.form-grid :deep(.el-tree-select),
.form-grid :deep(.el-date-editor) {
  width: 100%;
}
.span-2 {
  grid-column: 1 / -1;
}
.field-error {
  display: block;
  margin-top: 6px;
  color: var(--color-danger-default);
  line-height: 1.5;
}
.dialog-footer span {
  flex: 1;
}
.setup-review {
  margin-top: var(--space-4);
}
.form-section-title {
  margin: var(--space-4) 0 var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border-default);
}
.rate-editor {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-3);
}
.rate-editor :deep(.el-input-number) {
  width: 100%;
}
.rule-editor {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2) var(--space-4);
}
.rule-editor div {
  display: grid;
  grid-template-columns: 120px 1fr;
  align-items: center;
  gap: var(--space-3);
}
.rule-editor span {
  color: var(--color-text-secondary);
  font-size: var(--font-body-sm);
}
@media (max-width: 1100px) {
  .workflow-guide i {
    margin: 0 var(--space-2);
  }
  .rate-editor {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 900px) {
  .config-kpis {
    grid-template-columns: repeat(2, 1fr);
  }
  .workflow-guide span {
    display: none;
  }
  .form-grid,
  .rule-editor {
    grid-template-columns: 1fr;
  }
}
</style>
