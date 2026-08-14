// ============================================================
// 统一权限点字典 — 从 core 层重导出
//
// 实际定义位于 core/permission/permission.types.ts
// 本文件仅做向后兼容重导出，新代码请直接从 core 层 import。
// ============================================================

export type {
  PermissionSource,
  PermissionCategory,
  PermissionEntry,
} from '@/core/permission/permission.types';
