<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  pvPower: number;
  gridPower: number;
  storagePower: number;
  buildingPower: number;
  otherPower: number;
  chargingPower: number;
}>();

const assets = {
  campus: new URL('../../../assets/images/pv/cockpit-campus-bus.webp', import.meta.url).href,
  grid: new URL('../../../assets/images/pv/cockpit-grid.webp', import.meta.url).href,
  solar: new URL('../../../assets/images/pv/cockpit-solar.webp', import.meta.url).href,
  storage: new URL('../../../assets/images/pv/cockpit-storage.webp', import.meta.url).href,
  building: new URL('../../../assets/images/pv/cockpit-building-load.webp', import.meta.url).href,
  other: new URL('../../../assets/images/pv/cockpit-other-load.webp', import.meta.url).href,
  charging: new URL('../../../assets/images/pv/cockpit-charging-load.webp', import.meta.url).href,
};

const gridLabel = computed(() => props.gridPower >= 0 ? '电网上网' : '电网购电');
const storageLabel = computed(() => props.storagePower >= 0 ? '储能放电' : '储能充电');
const gridPath = computed(() => props.gridPower >= 0
  ? 'M292 326V279Q292 255 268 255H202'
  : 'M202 255H268Q292 255 292 279V326');
const storagePath = computed(() => props.storagePower >= 0
  ? 'M798 238H724Q700 238 700 262V326'
  : 'M700 326V262Q700 238 724 238H798');
const abs = (value: number) => Math.abs(value).toFixed(1);
</script>

<template>
  <div class="energy-stage">
    <svg class="energy-stage__paths" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="flow-soft-glow" x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <g class="flow-lines" filter="url(#flow-soft-glow)">
        <path class="flow-path is-amber" d="M500 104V178" />
        <path class="flow-path" :d="gridPath" />
        <path class="flow-path is-cyan" :d="storagePath" />
        <path class="flow-path" d="M500 370V407" />
        <path class="flow-path" d="M500 407H255Q245 407 245 417V459" />
        <path class="flow-path" d="M500 407V459" />
        <path class="flow-path" d="M500 407H745Q755 407 755 417V459" />
      </g>

    </svg>

    <svg class="energy-stage__arrows" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="flow-arrow-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g class="flow-moving-arrows" filter="url(#flow-arrow-glow)">
        <path class="flow-moving-arrow is-amber" d="M-8-4L7 0-8 4-4 0Z"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.90;.96;1" dur="2.2s" repeatCount="indefinite" /><animateMotion path="M500 104V178" dur="2.2s" calcMode="paced" repeatCount="indefinite" rotate="auto" /></path>
        <path class="flow-moving-arrow" d="M-8-4L7 0-8 4-4 0Z"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.90;.96;1" dur="2.2s" repeatCount="indefinite" /><animateMotion :path="gridPath" dur="2.2s" calcMode="paced" repeatCount="indefinite" rotate="auto" /></path>
        <path class="flow-moving-arrow is-cyan" d="M-8-4L7 0-8 4-4 0Z"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.90;.96;1" dur="2.2s" repeatCount="indefinite" /><animateMotion :path="storagePath" dur="2.2s" calcMode="paced" repeatCount="indefinite" rotate="auto" /></path>
        <path class="flow-moving-arrow" d="M-8-4L7 0-8 4-4 0Z"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.90;.96;1" dur="2.35s" repeatCount="indefinite" /><animateMotion path="M500 370V407H255Q245 407 245 417V459" dur="2.35s" calcMode="paced" repeatCount="indefinite" rotate="auto" /></path>
        <path class="flow-moving-arrow" d="M-8-4L7 0-8 4-4 0Z"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.90;.96;1" dur="1.9s" repeatCount="indefinite" /><animateMotion path="M500 370V459" dur="1.9s" calcMode="paced" repeatCount="indefinite" rotate="auto" /></path>
        <path class="flow-moving-arrow" d="M-8-4L7 0-8 4-4 0Z"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.90;.96;1" dur="2.35s" repeatCount="indefinite" /><animateMotion path="M500 370V407H745Q755 407 755 417V459" dur="2.35s" calcMode="paced" repeatCount="indefinite" rotate="auto" /></path>
      </g>
    </svg>

    <article class="energy-node energy-node--pv is-amber"><img :src="assets.solar" alt="" decoding="async" /><span><b>光伏出力</b><strong>{{ pvPower.toFixed(1) }}<small> kW</small></strong></span></article>
    <article class="energy-node energy-node--grid"><img :src="assets.grid" alt="" decoding="async" /><span><b>{{ gridLabel }}</b><strong>{{ abs(gridPower) }}<small> kW</small></strong></span></article>
    <article class="energy-node energy-node--storage is-cyan"><img :src="assets.storage" alt="" decoding="async" /><span><b>{{ storageLabel }}</b><strong>{{ abs(storagePower) }}<small> kW</small></strong></span></article>

    <div class="energy-stage__campus">
      <img :src="assets.campus" alt="园区交流母线与楼宇负荷" decoding="async" />
      <strong class="energy-stage__bus-title">园 区 交 流 母 线</strong>
      <div class="energy-stage__bus-metrics"><span>供给 <b>{{ (pvPower + Math.max(0, -gridPower) + Math.max(0, storagePower)).toFixed(1) }}</b> kW</span><i /><span>消耗 <b>{{ (buildingPower + otherPower + chargingPower).toFixed(1) }}</b> kW</span></div>
    </div>

    <article class="energy-node energy-node--load energy-node--building"><img :src="assets.building" alt="" decoding="async" /><span><b>楼宇负荷</b><strong>{{ buildingPower.toFixed(1) }}<small> kW</small></strong></span></article>
    <article class="energy-node energy-node--load energy-node--other"><img :src="assets.other" alt="" decoding="async" /><span><b>其他负荷</b><strong>{{ otherPower.toFixed(1) }}<small> kW</small></strong></span></article>
    <article class="energy-node energy-node--load energy-node--charging is-cyan"><img :src="assets.charging" alt="" decoding="async" /><span><b>充电负荷</b><strong>{{ chargingPower.toFixed(1) }}<small> kW</small></strong></span></article>
  </div>
</template>

<style scoped>
.energy-stage { position: relative; width: 100%; height: 100%; min-height: 0; overflow: hidden; background: radial-gradient(ellipse at 50% 54%, rgb(0 70 155 / 17%), transparent 58%); }
.energy-stage__paths { position: absolute; z-index: 1; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.energy-stage__arrows { position: absolute; z-index: 3; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.flow-path { fill: none; stroke: #48bfff; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }.flow-path.is-cyan { stroke: #48d8d3; }.flow-path.is-amber { stroke: #ffbb3a; }
.flow-moving-arrow { fill: #8cddff; opacity: .94; }.flow-moving-arrow.is-cyan { fill: #72f2df; }.flow-moving-arrow.is-amber { fill: #ffd064; }

.energy-node { position: absolute; z-index: 4; display: flex; width: clamp(158px, 17%, 190px); height: clamp(66px, 12.5%, 82px); box-sizing: border-box; align-items: center; gap: clamp(6px, .55vw, 10px); padding: 7px 14px 7px 8px; color: #dcecff; background: linear-gradient(135deg, rgb(5 41 81 / 93%), rgb(3 24 55 / 90%)); border: 1px solid rgb(43 119 185 / 34%); border-radius: 5px; box-shadow: inset 0 0 18px rgb(5 94 187 / 9%), 0 8px 22px rgb(0 5 20 / 20%); transform: translate(-50%, -50%); }
.energy-node img { width: clamp(46px, 4.25vw, 62px); height: clamp(46px, 4.25vw, 62px); flex: 0 0 clamp(46px, 4.25vw, 62px); object-fit: contain; filter: drop-shadow(0 3px 7px rgb(16 136 255 / 20%)); }.energy-node > span { display: flex; min-width: 0; flex-direction: column; gap: 2px; }.energy-node b { overflow: hidden; color: #d9e9fa; font-size: clamp(12px, .76vw, 15px); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }.energy-node strong { color: #39c8ff; font-family: "DIN Alternate", Bahnschrift, sans-serif; font-size: clamp(18px, 1.22vw, 23px); font-weight: 600; letter-spacing: .02em; white-space: nowrap; }.energy-node small { color: #8aa8c4; font-size: 10px; font-weight: 400; }.energy-node.is-amber { border-color: rgb(173 124 29 / 37%); }.energy-node.is-amber strong { color: #ffc13b; }.energy-node.is-cyan { border-color: rgb(33 141 128 / 34%); }.energy-node.is-cyan strong { color: #39e4d1; }
.energy-node--pv { top: 9.5%; left: 50%; }.energy-node--grid { top: 45.5%; left: 10.5%; }.energy-node--storage { top: 42.5%; left: 89.5%; }.energy-node--load { top: 89.5%; }.energy-node--building { left: 24.5%; }.energy-node--other { left: 50%; }.energy-node--charging { left: 75.5%; }

.energy-stage__campus { position: absolute; z-index: 2; top: 17%; left: 24%; width: 52%; height: 57%; text-align: center; }.energy-stage__campus > img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 12px 20px rgb(0 61 145 / 25%)); }.energy-stage__bus-title { position: absolute; right: 16%; bottom: 28.5%; left: 16%; color: #f1f7ff; font-size: clamp(14px, 1.1vw, 20px); font-weight: 700; letter-spacing: .13em; line-height: 1; text-shadow: 0 0 7px #369eff, 0 2px 2px #001235; white-space: nowrap; }
.energy-stage__bus-metrics { position: absolute; right: 20%; bottom: 6%; left: 20%; display: flex; height: clamp(38px, 8%, 48px); align-items: center; justify-content: center; gap: clamp(12px, 1.25vw, 22px); color: #87a7c5; background: rgb(2 26 60 / 91%); border: 1px solid rgb(42 107 167 / 36%); border-radius: 4px; box-shadow: inset 0 0 12px rgb(14 101 195 / 9%); font-size: clamp(10px, .67vw, 13px); white-space: nowrap; }.energy-stage__bus-metrics b { color: #2be1dc; font-family: Bahnschrift, sans-serif; font-size: clamp(16px, 1vw, 20px); }.energy-stage__bus-metrics i { width: 1px; height: 24px; background: rgb(72 130 183 / 42%); }
@media (max-width: 1450px) { .energy-node { width: 142px; padding-right: 8px; }.energy-node img { width: 44px; height: 44px; flex-basis: 44px; }.energy-node--grid { left: 9.5%; }.energy-node--storage { left: 90.5%; } }
@media (prefers-reduced-motion: reduce) { .flow-moving-arrows { display: none; } }
</style>
