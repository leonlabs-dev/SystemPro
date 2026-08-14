<script setup lang="ts">
defineProps<{ name: 'grid' | 'solar' | 'storage' | 'charging' | 'building' | 'other' | 'carbon' | 'revenue' | 'alarm' }>();
</script>

<template>
  <svg class="cockpit-icon" viewBox="0 0 64 64" aria-hidden="true">
    <g v-if="name === 'grid'" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3">
      <path d="M24 57 30 7h8l6 50M17 22h30M14 57h36M21 34h26M24 22l20 20M44 22 22 43" />
    </g>
    <g v-else-if="name === 'solar'" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3">
      <circle cx="48" cy="15" r="7" /><path d="M48 3v4m0 16v4M36 15h4m16 0h4M39.5 6.5l3 3m11-3-3 3" />
      <path d="m11 27 32-4 7 25-37 4-2-25Zm2 8 34-4M16 43l33-4M24 26l3 24m9-26 3 25M31 52v7m-9 0h19" />
    </g>
    <g v-else-if="name === 'storage'" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3">
      <rect x="14" y="8" width="36" height="49" rx="4" /><path d="M25 8V4h14v4M22 17h20M22 48h20m-7-25-10 14h9l-5 9" />
    </g>
    <g v-else-if="name === 'charging'" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3">
      <rect x="12" y="6" width="31" height="52" rx="4" /><rect x="18" y="12" width="19" height="15" rx="2" /><path d="M28 31 21 42h7l-3 9M43 17h7l3 5v21c0 5-7 5-7 0V29" />
    </g>
    <g v-else-if="name === 'building'" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="3">
      <path d="M10 57V22h23v35M33 57V7h21v50M5 57h54M16 29h5m5 0h2M16 38h5m5 0h2M16 47h5m5 0h2M40 16h7m-7 10h7m-7 10h7m-7 10h7" />
    </g>
    <g v-else-if="name === 'other'" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3">
      <path d="m7 31 25-20 25 20M12 28v29h40V28M22 57V40h20v17M22 31h5m10 0h5" />
    </g>
    <g v-else-if="name === 'carbon'" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3">
      <path d="M52 10C28 11 12 24 13 41c1 11 11 17 21 13 14-5 18-22 18-44Z" /><path d="M14 52c10-14 20-22 36-32M31 34c-1 7 1 13 5 19" />
    </g>
    <g v-else-if="name === 'revenue'" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3">
      <ellipse cx="32" cy="16" rx="20" ry="9" /><path d="M12 16v12c0 5 9 9 20 9s20-4 20-9V16M12 28v12c0 5 9 9 20 9s20-4 20-9V28M12 40v8c0 5 9 9 20 9s20-4 20-9v-8" />
    </g>
    <g v-else fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3">
      <path d="M32 7 58 55H6L32 7Z" /><path d="M32 22v17m0 8v1" />
    </g>
  </svg>
</template>

<style scoped>.cockpit-icon { display: block; width: 100%; height: 100%; }</style>
