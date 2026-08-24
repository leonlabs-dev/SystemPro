<script setup lang="ts">
import { ChatLineRound, Clock, Close, Delete, Plus, Promotion, QuestionFilled, Service, Sunny, Warning } from '@element-plus/icons-vue';
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { aiApi, useAiAssistantStore, type AiMessage } from '@/domain/platform/ai-assistant';
import mascot from '@/assets/ai-assistant/mascot/idle_blink.webp';

const props = withDefaults(defineProps<{ compact?: boolean; closable?: boolean }>(), { compact: false, closable: false });
const emit = defineEmits<{ close: []; dragStart: [event: PointerEvent] }>();
const route = useRoute();
const store = useAiAssistantStore();
const input = ref('');
const historyVisible = ref(!props.compact && window.innerWidth > 720);
const scroll = ref<HTMLElement>();
const submitting = ref(false);
const lead = reactive({ name: '', companyName: '', phone: '', industry: '', requirement: '' });
const feedback = reactive({ category: 'SUGGESTION', content: '' });
const quickPrompts = [
  { icon: Sunny, label: '了解 SystemPro', prompt: '请介绍一下 SystemPro 的核心能力和适用场景' },
  { icon: ChatLineRound, label: '平台核心能力', prompt: 'SystemPro 在能源管理方面有哪些能力？' },
  { icon: Warning, label: '当前告警', prompt: '帮我查看当前未处理告警，并说明数据范围和更新时间' },
  { icon: Service, label: '合作咨询', prompt: '我想咨询 SystemPro 合作方案，应该如何联系？' },
];
const title = computed(() => 'SystemPro AI 助手');

onMounted(async () => {
  try { await store.initialize(); } catch (error) { ElMessage.error(error instanceof Error ? error.message : 'AI 助手初始化失败'); }
});
watch(() => store.messages.map((item) => item.content).join('|'), scrollBottom);

async function scrollBottom() { await nextTick(); if (scroll.value) scroll.value.scrollTop = scroll.value.scrollHeight; }
async function send(value = input.value) {
  const message = value.trim(); if (!message || store.streaming) return; input.value = '';
  try { await store.send(message, route.fullPath); } catch (error) { ElMessage.error(error instanceof Error ? error.message : '发送失败'); }
  await scrollBottom();
}
async function chooseSession(id: number) {
  try { await store.selectSession(id); if (props.compact) historyVisible.value = false; await scrollBottom(); }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : '加载历史失败'); }
}
async function archiveSession(id: number) {
  try { await aiApi.archive(id, store.visitorToken); if (store.currentSessionId === id) store.newChat(); await store.loadSessions(); }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : '归档失败'); }
}
async function rate(message: AiMessage, rating: number) {
  try {
    await aiApi.feedback({ sessionId: message.sessionId, messageId: message.id, visitorToken: store.visitorToken, category: 'ANSWER', rating });
    ElMessage.success('感谢您的反馈');
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '反馈提交失败'); }
}
async function submitLead() {
  if (!lead.name.trim() || !lead.phone.trim() || !lead.requirement.trim()) {
    ElMessage.warning('请填写姓名、手机号/微信号和需求描述'); return;
  }
  submitting.value = true;
  try {
    await aiApi.lead({ ...lead, consentAccepted: true, sessionId: store.currentSessionId, visitorToken: store.visitorToken, consentVersion: '2026-08-v2', sourceRoute: route.fullPath });
    ElMessage.success('咨询信息已提交，我们将在 12–24 小时内回复'); store.activeAction = undefined;
    Object.assign(lead, { name: '', companyName: '', phone: '', industry: '', requirement: '' });
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '咨询提交失败'); }
  finally { submitting.value = false; }
}
async function submitFeedback() {
  if (!feedback.content.trim()) { ElMessage.warning('请填写反馈内容'); return; }
  submitting.value = true;
  try {
    await aiApi.feedback({ sessionId: store.currentSessionId, visitorToken: store.visitorToken, category: feedback.category, content: feedback.content.trim() });
    ElMessage.success('反馈已提交'); feedback.content = ''; store.activeAction = undefined;
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '反馈提交失败'); }
  finally { submitting.value = false; }
}
function time(value: string) { return value ? value.replace('T', ' ').slice(5, 16) : ''; }
function sourceLabel(mode?: string) {
  if (mode === 'BUSINESS_TOOL') return '权限校验后的业务数据';
  if (mode === 'LOCAL' || mode === 'GUARDRAIL') return '本地安全流程';
  return 'SystemPro 知识库';
}
function startDrag(event: PointerEvent) {
  if (!props.compact || (event.target as HTMLElement).closest('button')) return;
  emit('dragStart', event);
}
</script>

<template>
  <section class="ai-chat" :class="{ 'is-compact': compact }">
    <button v-if="compact && historyVisible" class="ai-history-backdrop" type="button" aria-label="关闭对话历史" @click="historyVisible = false" />
    <aside v-if="historyVisible" class="ai-history">
      <header><strong>对话历史</strong><el-button circle text :icon="Plus" aria-label="新建对话" @click="store.newChat" /></header>
      <div class="ai-history__list">
        <button v-for="session in store.sessions" :key="session.id" type="button" :class="{ active: session.id === store.currentSessionId }" @click="chooseSession(session.id)">
          <span>{{ session.title }}</span><small>{{ time(session.lastMessageAt) }}</small>
          <el-icon class="archive" @click.stop="archiveSession(session.id)"><Delete /></el-icon>
        </button>
        <p v-if="!store.sessions.length">还没有历史对话</p>
      </div>
    </aside>

    <div class="ai-conversation">
      <header class="ai-chat__header" :class="{ 'is-draggable': compact }" @pointerdown="startDrag">
        <button class="ai-header__mascot" type="button" aria-label="查看对话历史" @click="historyVisible = !historyVisible"><img :src="mascot" alt="" /></button>
        <div><strong>{{ title }}</strong><small>数字化智能顾问 · 只读安全模式</small></div>
        <el-button v-if="compact" circle text :icon="Clock" aria-label="对话历史" @click="historyVisible = !historyVisible" />
        <el-button v-if="closable" circle text :icon="Close" aria-label="关闭助手" @click="emit('close')" />
      </header>

      <main ref="scroll" class="ai-messages">
        <section v-if="!store.messages.length" class="ai-welcome">
          <img :src="mascot" alt="SystemPro AI 助手" />
          <h2>你好，我是 SystemPro AI 助手</h2>
          <p>我可以介绍平台能力、帮助您找到页面，也可以在当前账号权限范围内查询只读业务数据。</p>
          <div class="ai-quick-grid">
            <button v-for="item in quickPrompts" :key="item.label" type="button" @click="send(item.prompt)">
              <el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span>
            </button>
          </div>
        </section>

        <article v-for="message in store.messages" :key="message.id" class="ai-message" :class="message.role.toLowerCase()">
          <img v-if="message.role === 'ASSISTANT'" :src="mascot" alt="" />
          <div class="ai-message__body">
            <div class="ai-message__bubble" :class="{ failed: message.status === 'FAILED' }">
              <span v-if="message.status === 'STREAMING' && !message.content" class="ai-thinking" role="status" aria-label="SystemPro AI 正在思考">
                <span>思考中</span><span class="ai-typing" aria-hidden="true"><i /><i /><i /></span>
              </span>
              <p v-else>{{ message.content }}</p>
            </div>
            <div v-if="message.references?.length" class="ai-references">
              <span v-for="reference in message.references" :key="reference.chunkId || reference.documentCode">{{ reference.documentName }}</span>
            </div>
            <div v-if="message.role === 'ASSISTANT' && message.status === 'COMPLETED'" class="ai-message__meta">
              <span>{{ sourceLabel(message.handlingMode) }}</span>
              <button type="button" @click="rate(message, 1)">有帮助</button><button type="button" @click="rate(message, -1)">需改进</button>
            </div>
          </div>
        </article>

        <section v-if="store.streaming && store.process.length > 1" class="ai-process">
          <header><el-icon><QuestionFilled /></el-icon><strong>处理过程</strong></header>
          <p v-for="(item, index) in store.process" :key="`${index}-${item}`"><i :class="{ active: index === store.process.length - 1 }" />{{ item }}</p>
        </section>

        <section v-if="store.activeAction === 'SHOW_LEAD_FORM'" class="ai-form-card">
          <header><div><strong>合作咨询</strong><small>平台不会泄露您的信息</small></div><el-button text :icon="Close" @click="store.activeAction = undefined" /></header>
          <el-input v-model="lead.name" maxlength="64" placeholder="您的姓名 *" />
          <el-input v-model="lead.companyName" maxlength="160" placeholder="企业名称（选填）" />
          <el-input v-model="lead.phone" maxlength="64" placeholder="手机号/微信号 *" />
          <el-input v-model="lead.industry" maxlength="96" placeholder="所属行业（选填）" />
          <el-input v-model="lead.requirement" type="textarea" :rows="3" maxlength="3000" show-word-limit placeholder="请描述您的需求 *" />
          <small class="ai-form-consent">提交即表示同意 SystemPro 仅使用您填写的手机号/微信号回复本次咨询；平台不会泄露您的信息，您也可随时要求删除。</small>
          <el-button type="primary" :loading="submitting" @click="submitLead">提交咨询</el-button>
        </section>

        <section v-if="store.activeAction === 'SHOW_FEEDBACK_FORM'" class="ai-form-card">
          <header><div><strong>问题反馈</strong><small>帮助我们持续改进产品</small></div><el-button text :icon="Close" @click="store.activeAction = undefined" /></header>
          <el-radio-group v-model="feedback.category"><el-radio-button label="SUGGESTION">产品建议</el-radio-button><el-radio-button label="BUG">问题报告</el-radio-button><el-radio-button label="PRODUCT">其他反馈</el-radio-button></el-radio-group>
          <el-input v-model="feedback.content" type="textarea" :rows="4" maxlength="2000" show-word-limit placeholder="请描述您的建议或问题" />
          <el-button type="primary" :loading="submitting" @click="submitFeedback">提交反馈</el-button>
        </section>
      </main>

      <footer class="ai-composer">
        <div class="ai-composer__control">
          <el-input v-model="input" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" maxlength="1000" placeholder="询问 SystemPro 产品、页面或业务数据…" @keydown.enter.exact.prevent="send()" />
          <el-button circle type="primary" :icon="Promotion" :loading="store.streaming" :disabled="!input.trim()" aria-label="发送" @click="send()" />
        </div>
        <small>AI 也可能出错，请核查重要信息。</small>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.ai-chat { position:relative; display:grid; grid-template-columns:260px minmax(0,1fr); height:100%; min-height:0; overflow:hidden; color:var(--color-text-primary); background:var(--color-bg-surface); border:1px solid var(--color-border-default); border-radius:var(--radius-lg); box-shadow:var(--shadow-panel); }
.ai-chat,.ai-chat * { box-sizing:border-box; }
.ai-chat.is-compact { grid-template-columns:minmax(0,1fr); border:0; border-radius:22px; box-shadow:none; }
.ai-history-backdrop { position:absolute; z-index:4; inset:68px 0 74px; padding:0; background:color-mix(in srgb,var(--color-text-primary) 14%,transparent); border:0; cursor:default; backdrop-filter:blur(1px); }
.is-compact .ai-history { position:absolute; z-index:5; inset:68px 0 74px 0; width:75%; max-width:300px; box-shadow:var(--shadow-panel); }
.ai-history { min-width:0; overflow:hidden; background:var(--color-bg-muted); border-right:1px solid var(--color-border-default); }
.ai-history header,.ai-chat__header { display:flex; align-items:center; gap:10px; min-height:68px; padding:0 16px; border-bottom:1px solid var(--color-border-default); }
.ai-history header { justify-content:space-between; }
.ai-history__list { display:grid; gap:4px; padding:10px; overflow:auto; }
.ai-history__list > button { position:relative; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:3px 8px; padding:10px 30px 10px 12px; color:inherit; text-align:left; background:transparent; border:0; border-radius:10px; cursor:pointer; }
.ai-history__list > button:hover,.ai-history__list > button.active { background:var(--color-bg-surface); }
.ai-history__list span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; }
.ai-history__list small { color:var(--color-text-secondary); font-size:11px; }
.ai-history__list .archive { position:absolute; top:13px; right:9px; opacity:0; }
.ai-history__list button:hover .archive { opacity:1; }
.ai-history__list p { padding:20px; color:var(--color-text-secondary); text-align:center; font-size:12px; }
.ai-conversation { display:grid; grid-template-rows:auto minmax(0,1fr) auto; min-width:0; min-height:0; background:var(--color-bg-default); }
.ai-chat__header { background:linear-gradient(110deg,color-mix(in srgb,var(--color-primary-100) 70%,var(--color-bg-surface)),var(--color-bg-surface)); }
.ai-chat__header.is-draggable { cursor:grab; touch-action:none; user-select:none; }
.ai-chat__header.is-draggable:active { cursor:grabbing; }
.ai-chat__header > div { display:grid; min-width:0; flex:1; gap:2px; }
.ai-chat__header strong,.ai-chat__header small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.ai-chat__header strong { font-size:15px; }.ai-chat__header small { color:var(--color-text-secondary); font-size:11px; }
.ai-header__mascot { width:44px; height:44px; padding:0; overflow:hidden; background:transparent; border:0; border-radius:50%; cursor:pointer; }.ai-header__mascot img { width:100%; height:100%; object-fit:contain; }
.ai-messages { min-width:0; min-height:0; overflow-x:hidden; overflow-y:auto; padding:24px; scroll-behavior:smooth; }
.ai-welcome { max-width:620px; margin:3vh auto 0; text-align:center; }.ai-welcome > img { width:108px; height:108px; object-fit:contain; }.ai-welcome h2 { margin:4px 0 8px; font-size:22px; }.ai-welcome p { max-width:520px; margin:0 auto; color:var(--color-text-secondary); line-height:1.7; }
.ai-quick-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:24px; }.ai-quick-grid button { display:flex; align-items:center; gap:10px; padding:14px; color:inherit; background:var(--color-bg-surface); border:1px solid var(--color-border-default); border-radius:12px; cursor:pointer; }.ai-quick-grid button:hover { border-color:var(--color-primary-400); box-shadow:var(--shadow-soft); }.ai-quick-grid .el-icon { color:var(--color-primary-500); font-size:18px; }
.ai-message { display:flex; align-items:flex-start; gap:8px; max-width:82%; margin:0 0 18px; }.ai-message.user { justify-content:flex-end; margin-left:auto; }.ai-message > img { width:34px; height:34px; object-fit:contain; }.ai-message__body { min-width:0; }.ai-message__bubble { padding:11px 14px; background:var(--color-bg-surface); border:1px solid var(--color-border-default); border-radius:4px 14px 14px; box-shadow:var(--shadow-soft); }.user .ai-message__bubble { color:white; background:var(--color-primary-500); border-color:var(--color-primary-500); border-radius:14px 4px 14px 14px; }.ai-message__bubble.failed { border-color:var(--color-error-default); }.ai-message__bubble p { margin:0; line-height:1.75; white-space:pre-wrap; overflow-wrap:anywhere; }
.ai-references { display:flex; flex-wrap:wrap; gap:5px; margin-top:7px; }.ai-references span { padding:3px 7px; color:var(--color-primary-600); background:var(--color-primary-50); border-radius:999px; font-size:10px; }.ai-message__meta { display:flex; align-items:center; gap:8px; margin-top:5px; color:var(--color-text-secondary); font-size:10px; }.ai-message__meta span { flex:1; }.ai-message__meta button { padding:0; color:inherit; background:none; border:0; cursor:pointer; }
.ai-process { max-width:76%; margin:0 0 18px 42px; padding:10px 12px; color:var(--color-text-secondary); background:var(--color-bg-muted); border-radius:10px; }.ai-process header { display:flex; align-items:center; gap:6px; margin-bottom:7px; }.ai-process p { margin:4px 0; font-size:11px; }.ai-process p i { display:inline-block; width:6px; height:6px; margin-right:7px; background:var(--color-success-default); border-radius:50%; }.ai-process p i.active { background:var(--color-primary-500); animation:pulse 1s infinite; }
.ai-form-card { display:grid; width:calc(100% - 42px); min-width:0; max-width:560px; gap:10px; margin:12px 0 20px 42px; padding:18px; overflow:hidden; background:var(--color-bg-surface); border:1px solid var(--color-border-default); border-radius:14px; box-shadow:var(--shadow-soft); }.ai-form-card header { display:flex; min-width:0; align-items:flex-start; justify-content:space-between; }.ai-form-card header div { display:grid; min-width:0; gap:3px; }.ai-form-card header small { color:var(--color-text-secondary); font-size:11px; }.ai-form-card > .el-button { justify-self:end; }.ai-form-card :deep(.el-input),.ai-form-card :deep(.el-textarea),.ai-form-card :deep(.el-radio-group) { width:100%; min-width:0; }.ai-form-row { display:grid; min-width:0; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:8px; }.ai-form-consent { color:var(--color-text-secondary); font-size:10px; line-height:1.6; }
.ai-composer { display:grid; gap:7px; padding:12px 16px 10px; background:var(--color-bg-surface); border-top:1px solid color-mix(in srgb,var(--color-primary-400) 30%,var(--color-border-default)); box-shadow:0 -8px 22px color-mix(in srgb,var(--color-text-primary) 5%,transparent); }.ai-composer__control{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:10px}.ai-composer small { padding-left:2px;color:var(--color-text-secondary);font-size:10px;line-height:1.4; }.ai-composer :deep(textarea) { min-height:40px!important; padding:10px 12px; box-shadow:none; resize:none; }
.ai-thinking { display:inline-flex; min-height:24px; align-items:center; gap:8px; color:var(--color-text-secondary); font-size:13px; line-height:24px; }.ai-typing { display:inline-flex; align-items:center; gap:4px; }.ai-typing i { width:6px; height:6px; background:var(--color-primary-500); border-radius:50%; animation:bounce 1s infinite; }.ai-typing i:nth-child(2){animation-delay:.15s}.ai-typing i:nth-child(3){animation-delay:.3s}
@keyframes bounce { 0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)} } @keyframes pulse { 50%{opacity:.35} }
@media (prefers-reduced-motion:reduce){.ai-typing i,.ai-process p i.active{animation:none}.ai-messages{scroll-behavior:auto}}
.is-compact .ai-messages { padding:16px 12px; }
.is-compact .ai-message { max-width:94%; }
.is-compact .ai-process { width:calc(100% - 42px); max-width:none; }
.is-compact .ai-form-card { width:100%; max-width:none; margin-left:0; padding:14px; }
@media (max-width:720px){.ai-chat{grid-template-columns:1fr}.ai-history{position:absolute;z-index:5;inset:68px 0 0;width:82%;box-shadow:var(--shadow-panel)}.ai-messages{padding:16px 12px}.ai-message{max-width:92%}.ai-form-card{width:100%;margin-left:0}.ai-form-row,.ai-quick-grid{grid-template-columns:1fr}}
</style>

