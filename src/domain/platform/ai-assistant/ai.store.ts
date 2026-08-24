import { defineStore } from 'pinia';
import { useAuthStore } from '@/core/auth/auth.store';
import { ApiError } from '@/core/api/contracts';
import { aiAssistantEnabled, isDemoMode } from '@/core/config/app-runtime';
import { aiApi, streamAiChat } from './ai.api';
import type { AiMessage, AiReference, AiSession, AiStreamEvent } from './types';

const VISITOR_KEY = 'systempro.ai.visitor-token';
const VISIBLE_DELTA_INTERVAL_MS = 18;
const VISIBLE_DELTA_CHARS = 3;
const AI_CONFIGURATION_MESSAGE = 'AI 服务尚未配置。请由管理员在服务端配置模型 API Key，并接入兼容的 SystemPro AI 服务后重试。';
let pendingDeltas: string[] = [];
let deltaTimer: number | undefined;
let deltaTarget: AiMessage | undefined;
let deltaWaiters: Array<() => void> = [];

function enqueueVisibleDelta(assistant: AiMessage, content: string) {
  if (!content) return;
  deltaTarget = assistant;
  pendingDeltas.push(...Array.from(content));
  if (deltaTimer !== undefined) return;
  deltaTimer = window.setInterval(() => {
    if (!deltaTarget || !pendingDeltas.length) {
      window.clearInterval(deltaTimer);
      deltaTimer = undefined;
      const waiters = deltaWaiters.splice(0);
      waiters.forEach((resolve) => resolve());
      return;
    }
    deltaTarget.content += pendingDeltas.splice(0, VISIBLE_DELTA_CHARS).join('');
  }, VISIBLE_DELTA_INTERVAL_MS);
}

function waitForVisibleDeltas() {
  if (!pendingDeltas.length && deltaTimer === undefined) return Promise.resolve();
  return new Promise<void>((resolve) => deltaWaiters.push(resolve));
}

function resetVisibleDeltas() {
  if (deltaTimer !== undefined) window.clearInterval(deltaTimer);
  deltaTimer = undefined;
  pendingDeltas = [];
  deltaTarget = undefined;
  const waiters = deltaWaiters.splice(0);
  waiters.forEach((resolve) => resolve());
}

export const useAiAssistantStore = defineStore('platform.ai-assistant', {
  state: () => ({
    initialized: false, loading: false, streaming: false,
    visitorToken: '', ownerAccountId: undefined as number | undefined,
    sessions: [] as AiSession[], currentSessionId: undefined as number | undefined,
    messages: [] as AiMessage[], process: [] as string[],
    activeAction: undefined as 'SHOW_LEAD_FORM'|'SHOW_FEEDBACK_FORM'|undefined,
  }),
  getters: { currentSession: (state) => state.sessions.find((item) => item.id === state.currentSessionId) },
  actions: {
    async initialize() {
      const auth = useAuthStore(); const accountId = auth.account?.id;
      if (accountId === undefined || accountId === null) return;
      if (this.initialized && this.ownerAccountId === accountId) return;
      this.loading = true;
      try {
        this.ownerAccountId = accountId; this.initialized = false; this.currentSessionId = undefined;
        this.sessions = []; this.messages = []; this.process = []; this.activeAction = undefined;
        if (!aiAssistantEnabled || isDemoMode) {
          this.visitorToken = '';
          this.initialized = true;
          return;
        }
        const visitorKey = `${VISITOR_KEY}.${accountId}`;
        this.visitorToken = localStorage.getItem(visitorKey) || '';
        if (!this.visitorToken) {
          const visitor = await aiApi.createVisitor();
          this.visitorToken = visitor.visitorToken;
          localStorage.setItem(visitorKey, visitor.visitorToken);
        }
        try { await this.loadSessions(); }
        catch (error) {
          if (!(error instanceof ApiError) || error.code !== 'AI_VISITOR_INVALID') throw error;
          const visitor = await aiApi.createVisitor();
          this.visitorToken = visitor.visitorToken; localStorage.setItem(visitorKey, visitor.visitorToken);
          await this.loadSessions();
        }
        this.initialized = true;
      } finally { this.loading = false; }
    },
    async loadSessions() { this.sessions = (await aiApi.sessions(this.visitorToken)).items; },
    async selectSession(id: number) {
      this.currentSessionId = id; this.messages = await aiApi.messages(id, this.visitorToken);
      this.process = []; this.activeAction = undefined;
    },
    newChat() { this.currentSessionId = undefined; this.messages = []; this.process = []; this.activeAction = undefined; },
    async send(message: string, routePath: string) {
      if (this.streaming || !message.trim()) return;
      resetVisibleDeltas();
      this.streaming = true; this.process = ['正在连接 SystemPro AI']; this.activeAction = undefined;
      const temporary = Date.now();
      this.messages.push({ id: temporary, sessionId: this.currentSessionId || 0, role: 'USER', content: message.trim(), messageType: 'TEXT', handlingMode: 'PENDING', status: 'COMPLETED', createdAt: new Date().toISOString(), references: [] });
      const assistant: AiMessage = { id: temporary + 1, sessionId: this.currentSessionId || 0, role: 'ASSISTANT', content: '', messageType: 'TEXT', handlingMode: 'PENDING', status: 'STREAMING', createdAt: new Date().toISOString(), references: [] };
      this.messages.push(assistant);
      const visibleAssistant = this.messages[this.messages.length - 1];
      if (!aiAssistantEnabled || isDemoMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 320));
        enqueueVisibleDelta(visibleAssistant, AI_CONFIGURATION_MESSAGE);
        await waitForVisibleDeltas();
        visibleAssistant.handlingMode = 'LOCAL';
        visibleAssistant.status = 'COMPLETED';
        this.process = [];
        this.streaming = false;
        return;
      }
      try {
        await streamAiChat({ sessionId: this.currentSessionId, visitorToken: this.visitorToken, message: message.trim(), routePath, locale: localStorage.getItem('systempro.locale') === 'en-US' ? 'en-US' : 'zh-CN' }, (event) => this.applyEvent(event, visibleAssistant));
        await waitForVisibleDeltas();
        visibleAssistant.status = visibleAssistant.status === 'FAILED' ? 'FAILED' : 'COMPLETED'; await this.loadSessions();
      } catch (error) {
        resetVisibleDeltas();
        visibleAssistant.status = 'FAILED'; visibleAssistant.content = error instanceof Error ? error.message : 'AI 助手暂时不可用'; throw error;
      } finally { this.streaming = false; }
    },
    applyEvent(event: AiStreamEvent, assistant: AiMessage) {
      if (event.type === 'session' && event.sessionId) {
        this.currentSessionId = event.sessionId; assistant.sessionId = event.sessionId;
        if (event.assistantMessageId) assistant.id = event.assistantMessageId;
      } else if ((event.type === 'status' || event.type === 'tool') && event.message) {
        if (this.process[this.process.length - 1] !== event.message) this.process.push(event.message);
      } else if (event.type === 'delta') enqueueVisibleDelta(assistant, event.content || '');
      else if (event.type === 'reference' && event.documentCode) assistant.references.push({ documentCode: event.documentCode, documentName: event.documentName || event.documentCode, documentVersion: event.documentVersion, chunkId: event.chunkId, score: event.score } as AiReference);
      else if (event.type === 'action') this.activeAction = event.action;
      else if (event.type === 'done') {
        assistant.handlingMode = event.handlingMode || 'RAG'; assistant.provider = event.provider; assistant.modelName = event.model;
        assistant.inputTokens = event.inputTokens; assistant.outputTokens = event.outputTokens;
      } else if (event.type === 'error') { assistant.status = 'FAILED'; assistant.content ||= event.message || 'AI 助手暂时不可用'; }
    },
  },
});
