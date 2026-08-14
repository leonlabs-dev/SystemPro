<template>
  <section class="ds-device-console">
    <header class="ds-device-console__header">
      <slot name="heading" />
    </header>
    <div class="ds-device-console__body">
      <aside class="ds-device-console__scope">
        <slot name="scope" />
      </aside>
      <div class="ds-device-console__workspace">
        <section class="ds-device-console__actions">
          <slot name="actions" />
        </section>
        <section class="ds-device-console__parameters">
          <slot name="parameters" />
        </section>
      </div>
      <aside class="ds-device-console__confirm">
        <slot name="confirm" />
      </aside>
    </div>
  </section>
</template>

<style scoped>
.ds-device-console {
  width: calc(100% - 28px);
  min-width: 0;
  max-width: calc(100% - 28px);
  margin: 10px 14px 0;
  overflow: hidden;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  container-type: inline-size;
}

.ds-device-console__header {
  display: flex;
  height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-border-default);
  background: var(--color-bg-surface);
}

.ds-device-console__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 250px;
  grid-template-areas:
    "actions actions"
    "parameters confirm"
    "scope scope";
  grid-template-rows: 62px 72px 48px;
  align-items: stretch;
  padding: 0;
}

.ds-device-console--device-standard .ds-device-console__body {
  grid-template-areas:
    "actions actions"
    "parameters confirm";
  grid-template-rows: 66px 82px;
}

.ds-device-console--device-standard:not(.is-expanded) .ds-device-console__body {
  display: none;
}

.ds-device-console--device-standard .ds-device-console__scope {
  display: none;
}

.ds-device-console--device-standard .ds-device-console__actions :deep(.command-buttons),
.ds-device-console--device-standard .ds-device-console__actions :deep(.charging-actions > div),
.ds-device-console--device-standard .ds-device-console__actions :deep(.industry-actions > div),
.ds-device-console--device-standard .ds-device-console__actions :deep(.power-actions),
.ds-device-console--device-standard .ds-device-console__actions :deep(.scene-actions) {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-start;
  gap: 10px;
}

.ds-device-console--device-standard .ds-device-console__actions :deep(.command-buttons > button),
.ds-device-console--device-standard .ds-device-console__actions :deep(.charging-actions .el-button),
.ds-device-console--device-standard .ds-device-console__actions :deep(.industry-actions .el-button),
.ds-device-console--device-standard .ds-device-console__actions :deep(.power-actions .el-button),
.ds-device-console--device-standard .ds-device-console__actions :deep(.scene-actions .el-button) {
  width: auto;
  min-width: 120px;
  height: 42px;
  flex: 0 0 auto;
  padding: 0 18px;
}

.ds-device-console--device-standard .ds-device-console__actions :deep(.power-actions .el-button),
.ds-device-console--device-standard .ds-device-console__actions :deep(.scene-actions .el-button) {
  min-width: 88px;
  padding: 0 12px;
}

.ds-device-console--device-standard .ds-device-console__parameters {
  padding-top: 10px;
  padding-bottom: 10px;
}

.ds-device-console--device-standard .ds-device-console__parameters :deep(label) {
  margin-bottom: 8px !important;
}

.ds-device-console--device-standard .ds-device-console__parameters :deep(.temperature-input),
.ds-device-console--device-standard .ds-device-console__parameters :deep(.current-input),
.ds-device-console--device-standard .ds-device-console__parameters :deep(.number-unit) {
  width: 180px !important;
  height: 36px !important;
}

.ds-device-console--device-standard .ds-device-console__parameters :deep(.temperature-setting .el-input-number),
.ds-device-console--device-standard .ds-device-console__parameters :deep(.current-input .el-input-number),
.ds-device-console--device-standard .ds-device-console__parameters :deep(.number-unit .el-input-number) {
  width: 146px !important;
  height: 36px !important;
}

.ds-device-console--device-standard .ds-device-console__parameters :deep(.el-input-number .el-input),
.ds-device-console--device-standard .ds-device-console__parameters :deep(.el-input-number .el-input__wrapper) {
  height: 36px !important;
  min-height: 36px !important;
}

.ds-device-console--device-standard .ds-device-console__parameters :deep(.hvac-command-parameters),
.ds-device-console--device-standard .ds-device-console__parameters :deep(.charging-parameters) {
  grid-template-columns: 180px 300px 300px;
  align-items: start;
  justify-content: start;
  gap: 24px;
}

.ds-device-console--device-standard .ds-device-console__parameters :deep(.industry-parameters) {
  grid-template-columns: repeat(auto-fit, minmax(180px, 260px));
  align-items: start;
  justify-content: start;
  gap: 24px;
}

.ds-device-console--device-standard .ds-device-console__parameters :deep(.current-input > span),
.ds-device-console--device-standard .ds-device-console__parameters :deep(.number-unit > span) {
  width: 34px;
  min-width: 34px;
  padding: 0;
}

.ds-device-console--device-standard .ds-device-console__actions :deep(.el-button.active) {
  border-color: var(--color-primary-500);
  color: var(--color-primary-500);
  background: var(--color-primary-soft);
}

.ds-device-console--device-standard .ds-device-console__parameters :deep(.lighting-command-row) {
  grid-template-columns: minmax(300px, 360px) minmax(360px, 440px);
  align-items: center;
  justify-content: start;
  gap: 24px;
}

.ds-device-console__scope,
.ds-device-console__workspace,
.ds-device-console__confirm {
  min-width: 0;
}

.ds-device-console__scope {
  grid-area: scope;
  padding: 6px 16px;
  border-top: 1px solid var(--color-border-default);
  background: color-mix(in srgb, var(--color-bg-muted) 68%, var(--color-bg-surface));
}

.ds-device-console__workspace {
  display: contents;
}

.ds-device-console__actions,
.ds-device-console__parameters {
  min-width: 0;
}

.ds-device-console__actions {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  align-items: center;
  gap: 18px;
  grid-area: actions;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border-default);
}

.ds-device-console__parameters {
  grid-area: parameters;
  padding: 8px 16px;
}

.ds-device-console__confirm {
  grid-area: confirm;
  padding: 8px 16px;
  border-left: 1px solid var(--color-border-default);
}

.ds-device-console__scope :deep(> .selection-card),
.ds-device-console__scope :deep(> .control-scope),
.ds-device-console__scope :deep(> .charging-scope),
.ds-device-console__scope :deep(> .industry-scope) {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 12px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.ds-device-console__scope :deep(.selection-count),
.ds-device-console__scope :deep(.charging-count),
.ds-device-console__scope :deep(.industry-count) {
  display: none;
}

.ds-device-console__scope :deep(.segmented),
.ds-device-console__scope :deep(.charging-scope .el-radio-group),
.ds-device-console__scope :deep(.industry-scope .el-radio-group),
.ds-device-console__scope :deep(.control-scope .el-button-group) {
  width: auto !important;
  flex: 0 0 auto;
  margin: 0;
}

.ds-device-console__scope :deep(.selection-scope),
.ds-device-console__scope :deep(.charging-stats),
.ds-device-console__scope :deep(.industry-stats) {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 16px;
  margin: 0 0 0 auto;
  width: auto !important;
  flex: 0 0 auto;
  white-space: nowrap;
}

.ds-device-console__scope :deep(.control-scope .el-select),
.ds-device-console__scope :deep(.control-scope .el-tree-select) {
  width: min(300px, 28%);
  margin-left: auto;
}

.ds-device-console__actions :deep(> .command-block),
.ds-device-console__actions :deep(> .charging-actions),
.ds-device-console__actions :deep(> .industry-actions) {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.ds-device-console__actions :deep(.command-buttons),
.ds-device-console__actions :deep(.charging-actions > div),
.ds-device-console__actions :deep(.industry-actions > div) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
  gap: 8px;
}

.ds-device-console__actions :deep(.power-control),
.ds-device-console__actions :deep(.scene-control) {
  display: grid;
  min-width: 0;
  grid-template-columns: 68px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}

.ds-device-console__actions :deep(.scene-actions),
.ds-device-console__actions :deep(.power-actions) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(76px, 1fr));
  gap: 8px;
}

.ds-device-console__actions :deep(.command-buttons button),
.ds-device-console__actions :deep(.el-button) {
  width: 100%;
  min-width: 0;
  height: 38px;
  margin: 0;
  padding: 0 10px;
  overflow: hidden;
  line-height: 36px;
  white-space: nowrap;
}

.ds-device-console__actions :deep(.el-button span) {
  min-width: 0;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-device-console__parameters :deep(.hvac-command-parameters),
.ds-device-console__parameters :deep(.lighting-command-row),
.ds-device-console__parameters :deep(.charging-parameters),
.ds-device-console__parameters :deep(.industry-parameters) {
  display: grid;
  min-width: 0;
  height: 100%;
  grid-template-columns: repeat(auto-fit, minmax(176px, 1fr));
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 0;
  border: 0;
}

.ds-device-console__parameters :deep(.lighting-command-row) {
  grid-template-columns: minmax(220px, 0.8fr) minmax(330px, 1.2fr);
}

.ds-device-console__parameters :deep(.brightness-control),
.ds-device-console__parameters :deep(.temperature-control) {
  display: grid;
  min-width: 0;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}

.ds-device-console__parameters :deep(.temperature-input),
.ds-device-console__parameters :deep(.current-input),
.ds-device-console__parameters :deep(.number-unit),
.ds-device-console__parameters :deep(.el-radio-group) {
  width: 100%;
}

.ds-device-console__parameters :deep(.el-radio-group) {
  display: flex;
  flex-wrap: nowrap;
}

.ds-device-console__parameters :deep(.el-radio-button) {
  min-width: 0;
  flex: 1;
}

.ds-device-console__parameters :deep(.el-radio-button__inner) {
  display: flex;
  width: 100%;
  height: 36px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  overflow: hidden;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-device-console__confirm :deep(> .hvac-confirm),
.ds-device-console__confirm :deep(> .lighting-command-summary),
.ds-device-console__confirm :deep(> .charging-confirm),
.ds-device-console__confirm :deep(> .industry-confirm) {
  display: grid;
  width: 100%;
  min-width: 0;
  height: 100%;
  grid-template-columns: minmax(0, 1fr) minmax(126px, 154px);
  align-items: center;
  gap: 10px;
  padding: 0;
  border: 0;
}

.ds-device-console__confirm :deep(h3),
.ds-device-console__confirm :deep(.hvac-confirm__title),
.ds-device-console__confirm :deep(small),
.ds-device-console__confirm :deep(dl > div:not(:last-child)) {
  display: none;
}

.ds-device-console__confirm :deep(dl) {
  min-width: 0;
  margin: 0;
}

.ds-device-console__confirm :deep(dl > div:last-child) {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.ds-device-console__confirm :deep(dt) {
  display: none;
}

.ds-device-console__confirm :deep(dd) {
  width: 100%;
  margin: 0;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 12px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-device-console__confirm :deep(.el-button) {
  width: 100%;
  height: 40px;
  margin: 0;
}

.ds-device-console--device-standard .ds-device-console__confirm :deep(> .hvac-confirm),
.ds-device-console--device-standard .ds-device-console__confirm :deep(> .lighting-command-summary),
.ds-device-console--device-standard .ds-device-console__confirm :deep(> .charging-confirm),
.ds-device-console--device-standard .ds-device-console__confirm :deep(> .industry-confirm) {
  display: flex !important;
  height: 100%;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: center !important;
}

.ds-device-console--device-standard .ds-device-console__confirm {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 0;
  padding-bottom: 0;
}

.ds-device-console--device-standard .ds-device-console__confirm :deep(h3),
.ds-device-console--device-standard .ds-device-console__confirm :deep(dl),
.ds-device-console--device-standard .ds-device-console__confirm :deep(small) {
  display: none !important;
}

.ds-device-console--device-standard .ds-device-console__confirm :deep(.el-button) {
  display: flex !important;
  width: 100% !important;
  height: 44px !important;
  align-items: center !important;
  justify-content: center !important;
  margin: 0 !important;
  padding: 0 16px !important;
  line-height: 1 !important;
}

.ds-device-console--device-standard .ds-device-console__confirm :deep(.el-button > span) {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.ds-device-console__header :deep(> div) {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 16px;
}

.ds-device-console__header :deep(.el-icon) {
  display: none;
}

.ds-device-console__header :deep(strong) {
  min-width: 0;
  color: var(--color-text-primary);
  font-size: 16px;
}

.ds-device-console__header :deep(span) {
  color: var(--color-text-secondary);
  font-size: 13px;
  white-space: nowrap;
}

.ds-device-console__header :deep(.device-console-title) {
  color: var(--color-text-primary);
  font-size: 15px;
  font-weight: var(--font-weight-regular);
}

.ds-device-console__header :deep(.device-console-toggle) {
  height: auto;
  margin-left: 0 !important;
  padding: 0;
  border: 0;
  border-radius: 0;
  color: var(--color-primary-500) !important;
  background: transparent !important;
}

.ds-device-console--device-standard.is-expanded .ds-device-console__header :deep(.device-console-toggle) {
  color: var(--color-warning-default) !important;
  background: transparent !important;
}

.ds-device-console__header :deep(.device-console-toggle .el-icon) {
  display: inline-flex;
  color: inherit;
  font-size: 12px;
}

.ds-device-console__header :deep(.device-console-toggle > span),
.ds-device-console__header :deep(.device-console-toggle > span .el-icon) {
  color: inherit !important;
}

.ds-device-console__header :deep(.el-button) {
  margin-left: auto;
  font-size: 13px;
}

.ds-device-console__actions :deep(label),
.ds-device-console__actions :deep(h3),
.ds-device-console__parameters :deep(label),
.ds-device-console__parameters :deep(h3),
.ds-device-console__scope :deep(label),
.ds-device-console__scope :deep(h3) {
  flex: 0 0 auto;
  margin: 0 !important;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  line-height: 18px;
  white-space: nowrap;
}

@container (max-width: 760px) {
  .ds-device-console__body {
    grid-template-columns: 1fr;
    grid-template-areas: "actions" "parameters" "confirm" "scope";
    grid-template-rows: auto;
  }

  .ds-device-console__actions,
  .ds-device-console__parameters :deep(.lighting-command-row) {
    grid-auto-flow: row;
    grid-template-columns: 1fr;
  }

  .ds-device-console__confirm {
    border-top: 1px solid var(--color-border-default);
    border-left: 0;
  }

  .ds-device-console__scope :deep(> .selection-card),
  .ds-device-console__scope :deep(> .control-scope),
  .ds-device-console__scope :deep(> .charging-scope),
  .ds-device-console__scope :deep(> .industry-scope) {
    flex-wrap: wrap;
    height: auto;
  }
}
</style>
