import { app, BrowserWindow, ipcMain, dialog, Menu } from "electron";
import * as path from "path";
import path__default, { dirname, join } from "path";
import * as fs from "fs";
import { existsSync, readFileSync, statSync } from "fs";
import { Annotation, StateGraph } from "@langchain/langgraph";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { execSync } from "child_process";
import fs$1 from "fs/promises";
import { randomUUID } from "crypto";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { fileURLToPath } from "url";
import __cjs_url__ from "node:url";
import __cjs_path__ from "node:path";
import __cjs_mod__ from "node:module";
const __filename = __cjs_url__.fileURLToPath(import.meta.url);
const __dirname = __cjs_path__.dirname(__filename);
const require2 = __cjs_mod__.createRequire(import.meta.url);
class StateStreamManager {
  window = null;
  buffer = [];
  flushInterval = null;
  previousState = null;
  lastFlushTime = 0;
  options;
  destroyed = false;
  constructor(options = {}) {
    this.options = {
      bufferInterval: options.bufferInterval ?? 50,
      maxEventsPerSecond: options.maxEventsPerSecond ?? 20,
      maxBufferSize: options.maxBufferSize ?? 100,
      maxLogBuffer: options.maxLogBuffer ?? 1e3
    };
  }
  /**
   * Set BrowserWindow and start flushing
   */
  setWindow(window) {
    this.window = window;
    if (window && !this.destroyed) {
      this.startFlushing();
    } else {
      this.stopFlushing();
    }
  }
  /**
   * Process LangGraph state update
   */
  async processStateUpdate(state) {
    if (!this.window || this.destroyed)
      return;
    const events = this.detectChanges(this.previousState, state);
    events.forEach((event) => this.addToBuffer(event));
    this.previousState = this.cloneState(state);
    if (this.buffer.length >= this.options.maxBufferSize) {
      this.flush();
    }
  }
  /**
   * Detect changes and generate events
   */
  detectChanges(prev, current) {
    const events = [];
    if (!prev) {
      events.push({
        type: "state-init",
        data: current,
        timestamp: Date.now(),
        priority: "high"
      });
      return events;
    }
    const currentNode = this.getCurrentNode(current);
    const prevNode = this.getCurrentNode(prev);
    if (currentNode !== prevNode && currentNode) {
      events.push({
        type: "node-started",
        data: { nodeId: currentNode },
        timestamp: Date.now(),
        priority: "high"
      });
    }
    const taskUpdates = this.detectTaskChanges(prev.tasks, current.tasks);
    if (taskUpdates.length > 0) {
      events.push({
        type: "tasks-batch",
        data: taskUpdates,
        timestamp: Date.now(),
        priority: "normal"
      });
    }
    const newLogs = current.logs.slice(prev.logs.length);
    if (newLogs.length > 0) {
      events.push({
        type: "logs-batch",
        data: newLogs,
        timestamp: Date.now(),
        priority: "low"
      });
    }
    if (current.metadata.phase !== prev.metadata.phase) {
      events.push({
        type: "phase-change",
        data: {
          from: prev.metadata.phase,
          to: current.metadata.phase
        },
        timestamp: Date.now(),
        priority: "high"
      });
    }
    if (current.metadata.hasErrors && !prev.metadata.hasErrors) {
      events.push({
        type: "error",
        data: current.metadata.errors,
        timestamp: Date.now(),
        priority: "high"
      });
    }
    if (current.metadata.phase === "complete" && prev.metadata.phase !== "complete") {
      events.push({
        type: "complete",
        data: {
          totalTasks: current.metadata.totalTasks,
          tasksCompleted: current.metadata.tasksCompleted,
          tasksFailed: current.metadata.tasksFailed
        },
        timestamp: Date.now(),
        priority: "high"
      });
    }
    return events;
  }
  /**
   * Get current node from state (if available)
   */
  getCurrentNode(state) {
    const recentLogs = state.logs.slice(-10);
    for (const log of recentLogs.reverse()) {
      if (log.source && log.source !== "system") {
        return log.source;
      }
    }
    return null;
  }
  /**
   * Detect task changes
   */
  detectTaskChanges(prevTasks, currentTasks) {
    const taskMap = new Map(prevTasks.map((t) => [t.id, t]));
    const updates = [];
    for (const task of currentTasks) {
      const prevTask = taskMap.get(task.id);
      if (!prevTask || this.hasTaskChanged(prevTask, task)) {
        updates.push(task);
      }
    }
    return updates;
  }
  /**
   * Check if task has changed
   */
  hasTaskChanged(prev, current) {
    return prev.status !== current.status || prev.assignedEngineer !== current.assignedEngineer || prev.branchName !== current.branchName || prev.sessionId !== current.sessionId;
  }
  /**
   * Add event to buffer (priority sorted)
   */
  addToBuffer(event) {
    this.buffer.push(event);
    this.buffer.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  /**
   * Start periodic flushing
   */
  startFlushing() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.options.bufferInterval);
  }
  /**
   * Stop flushing
   */
  stopFlushing() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
  /**
   * Flush buffer (batch send)
   */
  flush() {
    if (!this.window || this.buffer.length === 0 || this.destroyed)
      return;
    const now = Date.now();
    const timeSinceLastFlush = now - this.lastFlushTime;
    const minInterval = 1e3 / this.options.maxEventsPerSecond;
    if (timeSinceLastFlush < minInterval) {
      return;
    }
    try {
      if (!this.window.isDestroyed()) {
        this.window.webContents.send("graph-events-batch", this.buffer);
      }
      this.buffer = [];
      this.lastFlushTime = now;
    } catch (error) {
      console.error("[StateStreamManager] Failed to flush events:", error);
    }
  }
  /**
   * Deep copy state
   */
  cloneState(state) {
    return JSON.parse(JSON.stringify(state, (key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      return value;
    }));
  }
  /**
   * Cleanup
   */
  destroy() {
    this.destroyed = true;
    this.stopFlushing();
    this.flush();
    this.buffer = [];
    this.previousState = null;
    this.window = null;
  }
}
const ParallelDevState = Annotation.Root({
  /**
   * Original user request
   */
  userRequest: Annotation,
  /**
   * All tasks in the workflow
   *
   * Reducer: Merge tasks by ID, replacing existing tasks with updates
   */
  tasks: Annotation({
    reducer: (state, update) => {
      const taskMap = new Map(state.map((t) => [t.id, t]));
      update.forEach((t) => taskMap.set(t.id, t));
      return Array.from(taskMap.values());
    },
    default: () => []
  }),
  /**
   * Completed tasks
   *
   * Reducer: Append new completed tasks
   */
  completedTasks: Annotation({
    reducer: (state, update) => {
      const existingIds = new Set(state.map((t) => t.id));
      const newTasks = update.filter((t) => !existingIds.has(t.id));
      return state.concat(newTasks);
    },
    default: () => []
  }),
  /**
   * Failed tasks
   *
   * Reducer: Append new failed tasks
   */
  failedTasks: Annotation({
    reducer: (state, update) => {
      const existingIds = new Set(state.map((t) => t.id));
      const newTasks = update.filter((t) => !existingIds.has(t.id));
      return state.concat(newTasks);
    },
    default: () => []
  }),
  /**
   * Code reviews
   *
   * Reducer: Append new reviews
   */
  reviews: Annotation({
    reducer: (state, update) => {
      return state.concat(update);
    },
    default: () => []
  }),
  /**
   * Merge queue
   *
   * Reducer: Merge by task ID, replacing existing merge tasks
   */
  mergeQueue: Annotation({
    reducer: (state, update) => {
      const mergeMap = new Map(state.map((m) => [m.taskId, m]));
      update.forEach((m) => mergeMap.set(m.taskId, m));
      return Array.from(mergeMap.values());
    },
    default: () => []
  }),
  /**
   * Active worktrees
   *
   * Reducer: Merge worktrees by task ID
   */
  worktrees: Annotation({
    reducer: (state, update) => {
      return new Map([...state, ...update]);
    },
    default: () => /* @__PURE__ */ new Map()
  }),
  /**
   * Log entries for UI display
   *
   * Reducer: Append new logs, keeping only the most recent 1000 entries
   */
  logs: Annotation({
    reducer: (state, update) => {
      const combined = state.concat(update);
      return combined.slice(-1e3);
    },
    default: () => []
  }),
  /**
   * Configuration
   *
   * Reducer: Replace (default)
   */
  config: Annotation,
  /**
   * Workflow metadata
   */
  metadata: Annotation({
    reducer: (state, update) => {
      return { ...state, ...update };
    },
    default: () => ({})
  }),
  /**
   * Sprint-driven development fields
   */
  /**
   * Global tasks (multi-project support)
   *
   * Reducer: Merge tasks by ID, replacing existing tasks with updates
   */
  globalTasks: Annotation({
    reducer: (state, update) => {
      const taskMap = new Map(state.map((t) => [t.id, t]));
      update.forEach((t) => taskMap.set(t.id, t));
      return Array.from(taskMap.values());
    },
    default: () => []
  }),
  /**
   * Project metadata (multi-project support)
   *
   * Reducer: Merge projects by project ID
   */
  projects: Annotation({
    reducer: (state, update) => {
      return new Map([...state, ...update]);
    },
    default: () => /* @__PURE__ */ new Map()
  }),
  /**
   * Sprint information
   *
   * Reducer: Merge sprints by ID, replacing existing sprints with updates
   */
  sprints: Annotation({
    reducer: (state, update) => {
      const sprintMap = new Map(state.map((s) => [s.id, s]));
      update.forEach((s) => sprintMap.set(s.id, s));
      return Array.from(sprintMap.values());
    },
    default: () => []
  }),
  /**
   * Active sprint
   *
   * Reducer: Replace (default)
   */
  activeSprint: Annotation({
    reducer: (state, update) => {
      return update ?? state;
    },
    default: () => null
  }),
  /**
   * Completed sprint IDs
   *
   * Reducer: Append new sprint IDs
   */
  completedSprintIds: Annotation({
    reducer: (state, update) => {
      return state.concat(update);
    },
    default: () => []
  }),
  /**
   * Current user request (for multi-project tracking)
   *
   * Reducer: Replace (default)
   */
  currentUserRequest: Annotation({
    reducer: (state, update) => {
      return update ?? state;
    },
    default: () => null
  }),
  /**
   * Continuation mode flag
   *
   * Reducer: Replace (default)
   */
  continuationMode: Annotation({
    reducer: (state, update) => {
      return update ?? state;
    },
    default: () => false
  }),
  /**
   * Current project ID
   *
   * Reducer: Replace (default)
   */
  currentProjectId: Annotation({
    reducer: (state, update) => {
      return update ?? state;
    },
    default: () => null
  }),
  /**
   * Scrum Development Flow fields (Phase 6)
   */
  /**
   * Story mapping approval status
   *
   * Reducer: Replace (default)
   */
  storyMappingApproved: Annotation({
    reducer: (state, update) => {
      return update ?? state;
    },
    default: () => null
  }),
  /**
   * Review feedback from story mapping or design review
   *
   * Reducer: Replace (default)
   */
  reviewFeedback: Annotation({
    reducer: (state, update) => {
      return update ?? state;
    },
    default: () => null
  }),
  /**
   * Story mapping (full data)
   *
   * Reducer: Replace (default)
   */
  storyMapping: Annotation({
    reducer: (state, update) => {
      return update ?? state;
    },
    default: () => null
  }),
  /**
   * Design documents metadata
   *
   * Reducer: Replace (default)
   */
  designDocs: Annotation({
    reducer: (state, update) => {
      return update ?? state;
    },
    default: () => null
  }),
  /**
   * Dependency graph
   *
   * Reducer: Replace (default)
   */
  dependencyGraph: Annotation({
    reducer: (state, update) => {
      return update ?? state;
    },
    default: () => null
  })
});
function createInitialState(userRequest, config) {
  return {
    userRequest,
    tasks: [],
    completedTasks: [],
    failedTasks: [],
    reviews: [],
    mergeQueue: [],
    worktrees: /* @__PURE__ */ new Map(),
    logs: [
      {
        timestamp: /* @__PURE__ */ new Date(),
        level: "info",
        source: "system",
        message: "Parallel development workflow started",
        data: { userRequest }
      }
    ],
    config,
    metadata: {
      startedAt: /* @__PURE__ */ new Date(),
      phase: "analysis",
      totalTasks: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      hasErrors: false,
      errors: []
    },
    // Sprint-driven development fields
    globalTasks: [],
    projects: /* @__PURE__ */ new Map(),
    sprints: [],
    activeSprint: null,
    completedSprintIds: [],
    currentUserRequest: null,
    continuationMode: false,
    currentProjectId: null,
    // Scrum Development Flow fields
    storyMappingApproved: null,
    reviewFeedback: null,
    storyMapping: null,
    designDocs: null,
    dependencyGraph: null
  };
}
class ClaudeAgentProvider {
  apiKey;
  model;
  currentSession = null;
  ready = false;
  /**
   * List of supported tools by Claude Agent SDK
   * Based on official documentation
   */
  static SUPPORTED_TOOLS = [
    "Read",
    "Write",
    "Edit",
    "Bash",
    "Glob",
    "Grep",
    "WebSearch",
    "WebFetch",
    "Task",
    "SlashCommand",
    "Skill",
    "TodoWrite",
    "AskUserQuestion"
  ];
  constructor(config) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || "";
    this.model = config.model || "claude-sonnet-4-5-20250929";
    if (!this.apiKey) {
      throw new Error(
        "Claude API key is required. Set ANTHROPIC_API_KEY environment variable or pass apiKey in config."
      );
    }
    this.ready = true;
  }
  /**
   * Execute a prompt using Claude Agent SDK
   */
  async *execute(prompt, options = {}) {
    const {
      maxTurns = 30,
      cwd = process.cwd(),
      allowedTools,
      disallowedTools,
      permissionMode = "default",
      resume,
      model,
      systemPrompt,
      includePartialMessages = false,
      providerOptions = {}
    } = options;
    try {
      const queryOptions = {
        model: model || this.model,
        maxTurns,
        cwd,
        permissionMode,
        ...providerOptions
      };
      if (allowedTools) {
        queryOptions.allowedTools = allowedTools;
      }
      if (disallowedTools) {
        queryOptions.disallowedTools = disallowedTools;
      }
      if (resume) {
        queryOptions.resume = resume;
      }
      if (systemPrompt) {
        queryOptions.systemPrompt = systemPrompt;
      }
      if (includePartialMessages) {
        queryOptions.includePartialMessages = true;
      }
      for await (const message of query({
        prompt,
        options: queryOptions
      })) {
        if (message.session_id) {
          this.currentSession = message.session_id;
        }
        const aiMessage = this.convertMessage(message);
        yield aiMessage;
      }
    } catch (error) {
      yield {
        type: "result",
        content: {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        },
        timestamp: /* @__PURE__ */ new Date()
      };
    }
  }
  /**
   * Convert Claude Agent SDK message to AIMessage
   */
  convertMessage(sdkMessage) {
    const baseMessage = {
      timestamp: /* @__PURE__ */ new Date()
    };
    switch (sdkMessage.type) {
      case "assistant":
        return {
          ...baseMessage,
          type: "assistant",
          content: sdkMessage.message,
          session_id: sdkMessage.session_id,
          uuid: sdkMessage.uuid
        };
      case "user":
        return {
          ...baseMessage,
          type: "user",
          content: sdkMessage.message,
          session_id: sdkMessage.session_id,
          uuid: sdkMessage.uuid
        };
      case "system":
        if (sdkMessage.subtype === "init") {
          return {
            ...baseMessage,
            type: "system",
            content: {
              cwd: sdkMessage.cwd,
              tools: sdkMessage.tools,
              model: sdkMessage.model,
              permissionMode: sdkMessage.permissionMode,
              mcp_servers: sdkMessage.mcp_servers
            },
            session_id: sdkMessage.session_id,
            uuid: sdkMessage.uuid
          };
        } else if (sdkMessage.subtype === "compact_boundary") {
          return {
            ...baseMessage,
            type: "system",
            content: {
              compactBoundary: sdkMessage.compact_metadata
            },
            session_id: sdkMessage.session_id,
            uuid: sdkMessage.uuid
          };
        } else if (sdkMessage.subtype === "hook_response") {
          return {
            ...baseMessage,
            type: "system",
            content: {
              hookResponse: {
                hook_name: sdkMessage.hook_name,
                hook_event: sdkMessage.hook_event,
                stdout: sdkMessage.stdout,
                stderr: sdkMessage.stderr,
                exit_code: sdkMessage.exit_code
              }
            },
            session_id: sdkMessage.session_id,
            uuid: sdkMessage.uuid
          };
        }
        return {
          ...baseMessage,
          type: "system",
          content: sdkMessage,
          session_id: sdkMessage.session_id
        };
      case "result":
        const isSuccess = sdkMessage.subtype === "success";
        return {
          ...baseMessage,
          type: "result",
          content: {
            duration: sdkMessage.duration_ms,
            tokenUsage: {
              input: sdkMessage.usage.input_tokens,
              output: sdkMessage.usage.output_tokens,
              total: sdkMessage.usage.input_tokens + sdkMessage.usage.output_tokens
            },
            cost: sdkMessage.total_cost_usd,
            permissionDenials: sdkMessage.permission_denials.length,
            success: isSuccess,
            result: isSuccess && "result" in sdkMessage ? sdkMessage.result : void 0,
            errors: !isSuccess && "errors" in sdkMessage ? sdkMessage.errors : void 0
          },
          session_id: sdkMessage.session_id,
          uuid: sdkMessage.uuid
        };
      case "stream_event":
        return {
          ...baseMessage,
          type: "partial",
          content: sdkMessage.event,
          session_id: sdkMessage.session_id,
          uuid: sdkMessage.uuid
        };
      case "tool_progress":
        return {
          ...baseMessage,
          type: "system",
          content: {
            toolProgress: {
              tool_name: sdkMessage.tool_name,
              tool_use_id: sdkMessage.tool_use_id,
              elapsed_time_seconds: sdkMessage.elapsed_time_seconds
            }
          },
          session_id: sdkMessage.session_id,
          uuid: sdkMessage.uuid
        };
      case "auth_status":
        return {
          ...baseMessage,
          type: "system",
          content: {
            authStatus: {
              isAuthenticating: sdkMessage.isAuthenticating,
              output: sdkMessage.output,
              error: sdkMessage.error
            }
          },
          session_id: sdkMessage.session_id,
          uuid: sdkMessage.uuid
        };
      default:
        return {
          ...baseMessage,
          type: "system",
          content: sdkMessage
        };
    }
  }
  /**
   * Resume a previous session
   */
  resumeSession(sessionId) {
    this.currentSession = sessionId;
  }
  /**
   * Get supported tools
   */
  getSupportedTools() {
    return ClaudeAgentProvider.SUPPORTED_TOOLS;
  }
  /**
   * Get provider name
   */
  getProviderName() {
    return "claude";
  }
  /**
   * Get current model
   */
  getModel() {
    return this.model;
  }
  /**
   * Check if provider is ready
   */
  isReady() {
    return this.ready;
  }
  /**
   * Get current session ID
   */
  getCurrentSession() {
    return this.currentSession;
  }
}
class MockAIProvider {
  mockResponses = /* @__PURE__ */ new Map();
  callCount = 0;
  lastPrompt = "";
  lastOptions = {};
  constructor() {
  }
  /**
   * Set mock response for a specific prompt pattern
   */
  setMockResponse(promptPattern, response) {
    const key = promptPattern instanceof RegExp ? promptPattern.source : promptPattern;
    this.mockResponses.set(key, response);
  }
  /**
   * Set default mock response (fallback)
   */
  setDefaultResponse(response) {
    this.mockResponses.set("__default__", response);
  }
  /**
   * Execute mock prompt
   */
  async *execute(prompt, options = {}) {
    this.callCount++;
    this.lastPrompt = prompt;
    this.lastOptions = options;
    let response;
    for (const [pattern, resp] of this.mockResponses.entries()) {
      if (pattern === "__default__") continue;
      const regex = new RegExp(pattern);
      if (regex.test(prompt)) {
        response = resp;
        break;
      }
    }
    if (!response) {
      response = this.mockResponses.get("__default__");
    }
    if (!response) {
      console.warn(`MockAIProvider: No response configured for prompt: ${prompt.substring(0, 100)}`);
      return;
    }
    if (response.shouldThrowError) {
      throw new Error(response.errorMessage || "Mock error");
    }
    if (response.delay) {
      await new Promise((resolve) => setTimeout(resolve, response.delay));
    }
    for (const message of response.messages) {
      yield message;
    }
  }
  /**
   * Resume session (mock)
   */
  resumeSession(sessionId) {
  }
  /**
   * Get supported tools
   */
  getSupportedTools() {
    return ["Read", "Write", "Edit", "Bash", "Glob", "Grep"];
  }
  /**
   * Get provider name
   */
  getProviderName() {
    return "mock";
  }
  /**
   * Get model
   */
  getModel() {
    return "mock-model";
  }
  /**
   * Check if ready
   */
  isReady() {
    return true;
  }
  /**
   * Get call count (for testing)
   */
  getCallCount() {
    return this.callCount;
  }
  /**
   * Get last prompt (for testing)
   */
  getLastPrompt() {
    return this.lastPrompt;
  }
  /**
   * Get last options (for testing)
   */
  getLastOptions() {
    return this.lastOptions;
  }
  /**
   * Reset mock state
   */
  reset() {
    this.callCount = 0;
    this.lastPrompt = "";
    this.lastOptions = {};
  }
}
class AIProviderFactory {
  /**
   * Create an AI provider based on configuration
   *
   * @param config - Provider configuration
   * @returns IAIProvider instance
   * @throws Error if provider type is not supported
   */
  static create(config) {
    const provider = config.provider;
    switch (provider) {
      case "mock":
        return AIProviderFactory.createMockProvider();
      case "claude":
        return new ClaudeAgentProvider({
          apiKey: config.claude?.apiKey,
          model: config.claude?.model
        });
      case "codex":
        throw new Error(
          'OpenAI Codex provider is not yet implemented. This will be added in a future release. Please use "claude" provider for now.'
        );
      default:
        throw new Error(
          `Unknown AI provider: ${provider}. Supported providers: claude, mock`
        );
    }
  }
  /**
   * Create a provider from environment variables
   *
   * @returns IAIProvider instance
   */
  static createFromEnv() {
    const provider = process.env.KUGUTSU_PROVIDER || "mock";
    if (provider === "mock") {
      return AIProviderFactory.createMockProvider();
    }
    const config = {
      provider,
      claude: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.CLAUDE_MODEL
      },
      codex: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL
      }
    };
    return AIProviderFactory.create(config);
  }
  /**
   * Create a pre-configured Mock provider for LangGraph workflow testing
   *
   * This configures mock responses for all workflow stages:
   * - Technology stack analysis
   * - Requirements analysis
   * - Task generation
   * - Code implementation
   * - Code review
   *
   * @returns Configured MockAIProvider instance
   */
  static createMockProvider() {
    const mockProvider = new MockAIProvider();
    mockProvider.setMockResponse(/Technology Stack Analysis/i, {
      messages: [{
        type: "assistant",
        content: JSON.stringify({
          languages: ["TypeScript", "JavaScript"],
          frameworks: ["Electron", "React", "LangGraph"],
          tools: ["npm", "electron-vite"],
          buildSystem: "npm"
        })
      }]
    });
    mockProvider.setMockResponse(/Requirements Analysis/i, {
      messages: [{
        type: "assistant",
        content: `要求分析結果:
- ユーザーの要求を理解しました
- 実装可能なタスクに分割します
- 依存関係を考慮した実装順序を決定します`
      }]
    });
    mockProvider.setMockResponse(/Task Generation/i, {
      messages: [{
        type: "assistant",
        content: JSON.stringify([
          {
            id: "task-1",
            title: "モックタスク1: 基本実装",
            description: "テスト用の基本機能を実装します",
            priority: 1,
            dependencies: [],
            estimatedTime: 30
          },
          {
            id: "task-2",
            title: "モックタスク2: UI改善",
            description: "ユーザーインターフェースを改善します",
            priority: 2,
            dependencies: ["task-1"],
            estimatedTime: 20
          }
        ])
      }]
    });
    mockProvider.setMockResponse(/実装|implementation|code/i, {
      messages: [{
        type: "assistant",
        content: `実装完了:
- ファイル作成: src/mock-feature.ts
- テストコード追加: tests/mock-feature.test.ts
- 正常に動作することを確認しました`
      }]
    });
    mockProvider.setMockResponse(/review|レビュー/i, {
      messages: [{
        type: "assistant",
        content: JSON.stringify({
          status: "approved",
          comments: "実装内容を確認しました。問題ありません。",
          suggestions: []
        })
      }]
    });
    return mockProvider;
  }
  /**
   * Get list of supported providers
   *
   * @returns Array of provider names
   */
  static getSupportedProviders() {
    return ["claude", "mock"];
  }
  /**
   * Check if a provider is supported
   *
   * @param provider - Provider name to check
   * @returns true if supported, false otherwise
   */
  static isProviderSupported(provider) {
    return AIProviderFactory.getSupportedProviders().includes(provider);
  }
}
async function productOwnerNode(state) {
  const { userRequest, config } = state;
  const providerConfig = {
    provider: config.provider || "claude",
    claude: {
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929"
    }
  };
  const provider = AIProviderFactory.create(providerConfig);
  console.log("📊 Product Owner: ユーザー要求を分析しています...");
  try {
    const techStackAnalysisPrompt = `
# Technology Stack Analysis

プロジェクトの技術スタックを分析してください。

## 対象リポジトリ
${config.baseRepoPath}

## タスク
以下を実行してください：
1. リポジトリ内の設定ファイルを確認（package.json, tsconfig.json, go.mod, requirements.txt等）
2. 使用されているプログラミング言語を特定
3. フレームワークとライブラリを特定
4. ビルドツールとテストフレームワークを特定

## 出力形式
JSON形式で以下の構造で出力してください：
\`\`\`json
{
  "languages": ["言語1", "言語2"],
  "frameworks": ["フレームワーク1"],
  "buildTools": ["ツール1"],
  "testingFrameworks": ["テストフレームワーク1"],
  "projectType": "プロジェクトタイプ"
}
\`\`\`
`;
    let techStackResult = "";
    for await (const message of provider.execute(techStackAnalysisPrompt, {
      maxTurns: 5,
      cwd: config.baseRepoPath,
      allowedTools: ["Read", "Glob", "Grep"],
      permissionMode: "acceptEdits"
    })) {
      if (message.type === "assistant" && message.content) {
        techStackResult += message.content;
      }
    }
    console.log("✅ 技術スタック分析完了");
    const requirementsAnalysisPrompt = `
# Requirements Analysis

以下の開発要求を分析してください。

## ユーザー要求
${userRequest}

## 技術スタック
${techStackResult}

## タスク
MECE原則（漏れなく、重複なく）に基づいて要求を分析し、以下を出力してください：

1. **機能要件**: 実装すべき機能のリスト
2. **非機能要件**: パフォーマンス、セキュリティ等の要件
3. **制約条件**: 技術的制約や依存関係

## 出力形式
JSON形式で以下の構造で出力してください：
\`\`\`json
{
  "functional": ["機能1", "機能2"],
  "nonFunctional": ["要件1"],
  "constraints": ["制約1"]
}
\`\`\`
`;
    let requirementsResult = "";
    for await (const message of provider.execute(requirementsAnalysisPrompt, {
      maxTurns: 5,
      cwd: config.baseRepoPath,
      allowedTools: ["Read", "Glob", "Grep"],
      permissionMode: "acceptEdits"
    })) {
      if (message.type === "assistant" && message.content) {
        requirementsResult += message.content;
      }
    }
    console.log("✅ 要求分析完了");
    const taskGenerationPrompt = `
# Task Generation

要求分析結果に基づいて、並列実行可能なタスクに分割してください。

## 要求分析結果
${requirementsResult}

## タスク生成の原則
1. **独立性**: 各タスクは他のタスクと独立して実行可能
2. **明確性**: タスクの目的と成果物が明確
3. **テスト駆動**: 各タスクはテストを含む
4. **適切な粒度**: 大きすぎず、小さすぎないサイズ

## 出力形式
JSON配列形式で、以下の構造で出力してください：
\`\`\`json
[
  {
    "id": "task-001",
    "title": "タスクタイトル",
    "description": "詳細な説明",
    "priority": 10,
    "dependencies": []
  }
]
\`\`\`

## 重要な注意事項
- タスクIDは "task-001" のような形式
- priorityは1-100の数値（高いほど優先度が高い）
- dependenciesは他のタスクIDの配列
- 依存関係は循環しないように
`;
    let tasksJson = "";
    for await (const message of provider.execute(taskGenerationPrompt, {
      maxTurns: 10,
      cwd: config.baseRepoPath,
      allowedTools: ["Read", "Glob", "Grep"],
      permissionMode: "acceptEdits"
    })) {
      if (message.type === "assistant" && message.content) {
        tasksJson += message.content;
      }
    }
    console.log("✅ タスク生成完了");
    console.log("📝 DEBUG: tasksJson content:", tasksJson);
    let tasks = [];
    try {
      const jsonMatch = tasksJson.match(/\[[\s\S]*\]/);
      console.log("📝 DEBUG: jsonMatch found:", jsonMatch ? "YES" : "NO");
      if (jsonMatch) {
        console.log("📝 DEBUG: jsonMatch[0]:", jsonMatch[0]);
        const parsedTasks = JSON.parse(jsonMatch[0]);
        console.log("📝 DEBUG: parsedTasks:", parsedTasks);
        tasks = parsedTasks.map((task, index) => ({
          id: task.id || `task-${String(index + 1).padStart(3, "0")}`,
          title: task.title || `Task ${index + 1}`,
          description: task.description || "",
          priority: task.priority || 50,
          dependencies: task.dependencies || [],
          status: "pending",
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }));
        console.log("📝 DEBUG: Final tasks array length:", tasks.length);
      } else {
        console.warn("⚠️ DEBUG: No JSON array found in tasksJson");
      }
    } catch (error) {
      console.error("❌ タスクのパースに失敗:", error);
      console.error("❌ DEBUG: tasksJson that failed to parse:", tasksJson);
      tasks = [
        {
          id: "task-001",
          title: userRequest.substring(0, 100),
          description: userRequest,
          priority: 100,
          dependencies: [],
          status: "pending",
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }
      ];
    }
    return {
      tasks,
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "info",
          source: "ProductOwnerNode",
          message: `${tasks.length}個のタスクを生成しました`,
          data: {
            taskCount: tasks.length,
            taskIds: tasks.map((t) => t.id)
          }
        }
      ],
      metadata: {
        phase: "development",
        totalTasks: tasks.length
      }
    };
  } catch (error) {
    console.error("❌ Product Owner Node エラー:", error);
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "ProductOwnerNode",
          message: `タスク生成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          data: { error }
        }
      ],
      metadata: {
        hasErrors: true,
        errors: [error instanceof Error ? error.message : String(error)]
      }
    };
  }
}
class GitWorktreeManager {
  baseRepoPath;
  worktreeBasePath;
  baseBranch;
  worktreeMutex = /* @__PURE__ */ new Map();
  constructor(baseRepoPath, worktreeBasePath, baseBranch = "main") {
    this.baseRepoPath = path.resolve(baseRepoPath);
    this.worktreeBasePath = path.resolve(worktreeBasePath);
    this.baseBranch = baseBranch;
    if (!fs.existsSync(this.worktreeBasePath)) {
      fs.mkdirSync(this.worktreeBasePath, { recursive: true });
    }
    this.ensureWorktreesInGitignore();
  }
  /**
   * .gitignoreにworktrees/**エントリーを確保する
   */
  ensureWorktreesInGitignore() {
    const gitignorePath = path.join(this.baseRepoPath, ".gitignore");
    try {
      let gitignoreContent = "";
      let hasWorktreesEntry = false;
      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
        const lines = gitignoreContent.split("\n");
        hasWorktreesEntry = lines.some(
          (line) => line.trim() === "worktrees/**" || line.trim() === "worktrees/" || line.trim().startsWith("worktrees/") && line.includes("**")
        );
      }
      if (!hasWorktreesEntry) {
        const entryToAdd = gitignoreContent && !gitignoreContent.endsWith("\n") ? "\nworktrees/**\n" : "worktrees/**\n";
        fs.writeFileSync(gitignorePath, gitignoreContent + entryToAdd, "utf-8");
        console.log("✅ .gitignoreにworktrees/**を追加しました");
      }
    } catch (error) {
      console.warn("⚠️ .gitignoreの更新に失敗しました:", error);
    }
  }
  /**
   * タスクID用のworktreeを作成（新しいパイプラインシステム用）
   */
  async createWorktree(taskId) {
    if (this.worktreeMutex.has(taskId)) {
      console.log(`⏳ Worktree作成処理を待機中: task-${taskId}`);
      return await this.worktreeMutex.get(taskId);
    }
    if (this.worktreeExists(taskId)) {
      const branchName = this.getBranchName(taskId);
      const worktreePath = this.getWorktreePath(taskId);
      console.log(`♻️ 既存のWorktreeを再利用: ${worktreePath}`);
      return { path: worktreePath, branchName };
    }
    const createPromise = this.doCreateWorktree(taskId);
    this.worktreeMutex.set(taskId, createPromise);
    try {
      const result = await createPromise;
      return result;
    } finally {
      this.worktreeMutex.delete(taskId);
    }
  }
  /**
   * タスクID用のworktreeを強制的に新規作成（依存関係解決後用）
   */
  async createWorktreeForced(taskId) {
    console.log(`🔄 強制的に新規Worktreeを作成: task-${taskId}`);
    if (this.worktreeMutex.has(taskId)) {
      console.log(`⏳ Worktree作成処理を待機中: task-${taskId}`);
      await this.worktreeMutex.get(taskId);
    }
    await this.removeWorktree(taskId);
    const createPromise = this.doCreateWorktree(taskId, true);
    this.worktreeMutex.set(taskId, createPromise);
    try {
      const result = await createPromise;
      return result;
    } finally {
      this.worktreeMutex.delete(taskId);
    }
  }
  /**
   * タスクIDをサニタイズして安全なブランチ名を生成
   */
  sanitizeTaskId(taskId) {
    return taskId.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/--+/g, "-").replace(/^-|-$/g, "");
  }
  /**
   * 実際のworktree作成処理
   */
  async doCreateWorktree(taskId, forceNew = false) {
    const sanitizedTaskId = this.sanitizeTaskId(taskId);
    const branchName = `feature/task-${sanitizedTaskId}`;
    const worktreePath = path.join(this.worktreeBasePath, `task-${sanitizedTaskId}`);
    try {
      if (fs.existsSync(worktreePath)) {
        await this.removeWorktree(taskId);
      }
      let branchExists = false;
      try {
        execSync(`git rev-parse --quiet --verify ${branchName}`, {
          cwd: this.baseRepoPath,
          stdio: "pipe"
        });
        branchExists = true;
        if (forceNew) {
          console.log(`🗑️ 既存ブランチを削除して新規作成: ${branchName}`);
          try {
            execSync(`git branch -D ${branchName}`, {
              cwd: this.baseRepoPath,
              stdio: "pipe"
            });
            branchExists = false;
          } catch (deleteError) {
            console.warn(`⚠️ ブランチ削除に失敗: ${deleteError}`);
          }
        } else {
          console.log(`♻️ 既存ブランチを再利用: ${branchName}`);
        }
      } catch {
        console.log(`🆕 新規ブランチを作成: ${branchName}`);
      }
      const actionText = forceNew ? "最新の状態から再作成" : "作業を開始";
      console.log(`📍 ローカルの${this.baseBranch}ブランチから${actionText}`);
      const command = branchExists ? ["git", "worktree", "add", worktreePath, branchName] : ["git", "worktree", "add", "-b", branchName, worktreePath, this.baseBranch];
      console.log(`🌿 Worktree作成中: ${branchName} -> ${worktreePath}`);
      execSync(command.join(" "), {
        cwd: this.baseRepoPath,
        stdio: "pipe"
      });
      console.log(`✅ Worktree作成完了: ${worktreePath}`);
      return { path: worktreePath, branchName };
    } catch (error) {
      console.error(`❌ Worktree作成エラー (task-${taskId}):`, error);
      throw new Error(`Failed to create worktree for task ${taskId}: ${error}`);
    }
  }
  /**
   * タスク用のworktreeを作成（レガシー用）
   */
  async createWorktreeForTask(task, baseBranch = "main") {
    const branchName = `feature/task-${task.id}`;
    const worktreePath = path.join(this.worktreeBasePath, `task-${task.id}`);
    try {
      if (fs.existsSync(worktreePath)) {
        await this.removeWorktree(task.id);
      }
      let branchExists = false;
      try {
        execSync(`git rev-parse --quiet --verify ${branchName}`, {
          cwd: this.baseRepoPath,
          stdio: "pipe"
        });
        branchExists = true;
        console.log(`♻️ 既存ブランチを再利用: ${branchName}`);
      } catch {
        console.log(`🆕 新規ブランチを作成: ${branchName}`);
      }
      const command = branchExists ? ["git", "worktree", "add", worktreePath, branchName] : ["git", "worktree", "add", "-b", branchName, worktreePath, baseBranch];
      console.log(`🌿 Worktree作成中: ${branchName} -> ${worktreePath}`);
      execSync(command.join(" "), {
        cwd: this.baseRepoPath,
        stdio: "pipe"
      });
      task.branchName = branchName;
      task.worktreePath = worktreePath;
      console.log(`✅ Worktree作成完了: ${worktreePath}`);
      return worktreePath;
    } catch (error) {
      console.error(`❌ Worktree作成エラー (task-${task.id}):`, error);
      throw new Error(`Failed to create worktree for task ${task.id}: ${error}`);
    }
  }
  /**
   * worktreeを削除
   */
  async removeWorktree(taskId) {
    const sanitizedTaskId = this.sanitizeTaskId(taskId);
    const worktreePath = path.join(this.worktreeBasePath, `task-${sanitizedTaskId}`);
    try {
      if (fs.existsSync(worktreePath)) {
        console.log(`🗑️ Worktree削除中: ${worktreePath}`);
        execSync(`git worktree remove "${worktreePath}" --force`, {
          cwd: this.baseRepoPath,
          stdio: "pipe"
        });
        console.log(`✅ Worktree削除完了: task-${taskId}`);
      }
    } catch (error) {
      console.error(`❌ Worktree削除エラー (task-${taskId}):`, error);
    }
  }
  /**
   * 全てのworktreeをリスト表示
   */
  async listWorktrees() {
    try {
      const output = execSync("git worktree list --porcelain", {
        cwd: this.baseRepoPath,
        encoding: "utf-8",
        stdio: "pipe"
      });
      const worktrees = [];
      const lines = output.trim().split("\n");
      let currentWorktree = {};
      for (const line of lines) {
        if (line.startsWith("worktree ")) {
          if (currentWorktree.path) {
            worktrees.push(currentWorktree);
          }
          currentWorktree = { path: line.substring(9) };
        } else if (line.startsWith("branch ")) {
          currentWorktree.branch = line.substring(7);
        } else if (line.startsWith("HEAD ")) {
          currentWorktree.commit = line.substring(5);
        } else if (line === "locked") {
          currentWorktree.locked = true;
        } else if (line === "") {
          if (currentWorktree.path) {
            worktrees.push(currentWorktree);
            currentWorktree = {};
          }
        }
      }
      if (currentWorktree.path) {
        worktrees.push(currentWorktree);
      }
      return worktrees;
    } catch (error) {
      console.error("❌ Worktreeリスト取得エラー:", error);
      return [];
    }
  }
  /**
   * タスク完了後のクリーンアップ
   */
  async cleanupCompletedTask(taskId, options = {}) {
    const sanitizedTaskId = this.sanitizeTaskId(taskId);
    const branchName = `feature/task-${sanitizedTaskId}`;
    try {
      await this.removeWorktree(taskId);
      if (options.deleteBranch) {
        try {
          execSync(`git branch -d ${branchName}`, {
            cwd: this.baseRepoPath,
            stdio: "pipe"
          });
          console.log(`🗑️ ブランチ削除完了: ${branchName}`);
        } catch (branchError) {
          try {
            execSync(`git branch -D ${branchName}`, {
              cwd: this.baseRepoPath,
              stdio: "pipe"
            });
            console.log(`🗑️ ブランチ強制削除完了: ${branchName}`);
          } catch (forceBranchError) {
            console.warn(`⚠️ ブランチ削除中にエラー: ${forceBranchError}`);
          }
        }
      }
      console.log(`🧹 クリーンアップ完了: task-${taskId}`);
    } catch (error) {
      console.error(`❌ クリーンアップエラー (task-${taskId}):`, error);
    }
  }
  /**
   * 指定したタスクのworktreeパスを取得
   */
  getWorktreePath(taskId) {
    const sanitizedTaskId = this.sanitizeTaskId(taskId);
    return path.join(this.worktreeBasePath, `task-${sanitizedTaskId}`);
  }
  /**
   * 指定したタスクのブランチ名を取得
   */
  getBranchName(taskId) {
    const sanitizedTaskId = this.sanitizeTaskId(taskId);
    return `feature/task-${sanitizedTaskId}`;
  }
  /**
   * worktreeが存在するかチェック
   */
  worktreeExists(taskId) {
    const worktreePath = this.getWorktreePath(taskId);
    return fs.existsSync(worktreePath) && fs.statSync(worktreePath).isDirectory();
  }
  /**
   * 全てのタスクworktreeをクリーンアップ
   */
  async cleanupAllTaskWorktrees(options = {}) {
    try {
      const worktrees = await this.listWorktrees();
      for (const worktree of worktrees) {
        if (worktree.branch && worktree.branch.startsWith("feature/task-")) {
          const taskId = worktree.branch.replace("feature/task-", "");
          await this.cleanupCompletedTask(taskId, { deleteBranch: options.deleteBranches });
        }
      }
      if (options.deleteBranches) {
        await this.cleanupOrphanedTaskBranches();
      }
      console.log("🧹 全タスクworktreeのクリーンアップ完了");
    } catch (error) {
      console.error("❌ 全クリーンアップエラー:", error);
    }
  }
  /**
   * 指定したパスの変更をaddしてcommitする
   *
   * @param paths - git addするパス（複数指定可能）
   * @param message - コミットメッセージ
   * @returns コミットが実行された場合true、変更がない場合false
   */
  async addAndCommit(paths, message) {
    try {
      const pathArray = Array.isArray(paths) ? paths : [paths];
      for (const p of pathArray) {
        execSync(`git add "${p}"`, {
          cwd: this.baseRepoPath,
          stdio: "pipe"
        });
      }
      try {
        execSync("git diff --cached --quiet", {
          cwd: this.baseRepoPath,
          stdio: "pipe"
        });
        console.log("📝 コミットする変更がありません");
        return false;
      } catch {
      }
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: this.baseRepoPath,
        stdio: "pipe"
      });
      console.log(`✅ コミット完了: ${message.split("\n")[0]}`);
      return true;
    } catch (error) {
      console.error("❌ git add/commit エラー:", error);
      throw new Error(`Failed to commit changes: ${error}`);
    }
  }
  /**
   * 孤立したタスクブランチ（worktreeが存在しないfeature/task-*ブランチ）を削除
   */
  async cleanupOrphanedTaskBranches() {
    try {
      const output = execSync("git branch", {
        cwd: this.baseRepoPath,
        encoding: "utf-8",
        stdio: "pipe"
      });
      const branches = output.split("\n").map((line) => line.trim().replace(/^\*\s*/, "")).filter((branch) => branch.startsWith("feature/task-")).filter((branch) => branch !== "");
      const worktrees = await this.listWorktrees();
      const worktreeBranches = new Set(
        worktrees.filter((wt) => wt.branch && wt.branch.startsWith("feature/task-")).map((wt) => wt.branch)
      );
      for (const branch of branches) {
        if (!worktreeBranches.has(branch)) {
          try {
            console.log(`🗑️ 孤立したタスクブランチを削除: ${branch}`);
            execSync(`git branch -D ${branch}`, {
              cwd: this.baseRepoPath,
              stdio: "pipe"
            });
            console.log(`✅ ブランチ削除完了: ${branch}`);
          } catch (branchError) {
            console.warn(`⚠️ ブランチ削除中にエラー: ${branch}`, branchError);
          }
        }
      }
    } catch (error) {
      console.warn("⚠️ 孤立ブランチの削除中にエラー:", error);
    }
  }
}
async function engineerDispatchNode(state) {
  const { tasks, completedTasks, config } = state;
  console.log("🚀 Engineer Dispatch: タスクを割り当てています...");
  try {
    const gitWorktreeManager = new GitWorktreeManager(
      config.baseRepoPath,
      config.worktreeBasePath,
      config.baseBranch
    );
    const completedIds = new Set(completedTasks.map((t) => t.id));
    const executableTasks = tasks.filter((task) => {
      if (task.status !== "pending") return false;
      return task.dependencies.every((depId) => completedIds.has(depId));
    });
    if (executableTasks.length === 0) {
      console.log("⏸️ 実行可能なタスクがありません");
      return {
        logs: [
          {
            timestamp: /* @__PURE__ */ new Date(),
            level: "info",
            source: "EngineerDispatchNode",
            message: "実行可能なタスクがありません"
          }
        ]
      };
    }
    executableTasks.sort((a, b) => b.priority - a.priority);
    const tasksToDispatch = executableTasks.slice(0, config.maxEngineers);
    console.log(`📋 ${tasksToDispatch.length}個のタスクをディスパッチします`);
    const updatedTasks = [];
    const newWorktrees = /* @__PURE__ */ new Map();
    const logs = [];
    for (const task of tasksToDispatch) {
      try {
        const result = await gitWorktreeManager.createWorktree(task.id);
        const updatedTask = {
          ...task,
          status: "in_progress",
          worktreePath: result.path,
          branchName: result.branchName,
          updatedAt: /* @__PURE__ */ new Date()
        };
        updatedTasks.push(updatedTask);
        newWorktrees.set(task.id, {
          path: result.path,
          branch: result.branchName,
          taskId: task.id,
          createdAt: /* @__PURE__ */ new Date(),
          active: true
        });
        logs.push({
          timestamp: /* @__PURE__ */ new Date(),
          level: "info",
          source: "EngineerDispatchNode",
          message: `タスク ${task.id} をディスパッチしました`,
          data: {
            taskId: task.id,
            worktreePath: result.path,
            branchName: result.branchName
          },
          taskId: task.id
        });
        console.log(`✅ タスク ${task.id}: ${result.path}`);
      } catch (error) {
        logs.push({
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "EngineerDispatchNode",
          message: `タスク ${task.id} のworktree作成に失敗: ${error instanceof Error ? error.message : String(error)}`,
          data: {
            taskId: task.id,
            error
          },
          taskId: task.id
        });
        console.error(`❌ タスク ${task.id} の作成失敗:`, error);
      }
    }
    return {
      tasks: updatedTasks,
      worktrees: newWorktrees,
      logs
    };
  } catch (error) {
    console.error("❌ Engineer Dispatch Node エラー:", error);
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "EngineerDispatchNode",
          message: `タスクディスパッチに失敗: ${error instanceof Error ? error.message : String(error)}`,
          data: { error }
        }
      ],
      metadata: {
        hasErrors: true,
        errors: [error instanceof Error ? error.message : String(error)]
      }
    };
  }
}
async function engineerNode(state, taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) {
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "EngineerNode",
          message: `タスク ${taskId} が見つかりません`,
          taskId
        }
      ]
    };
  }
  if (!task.worktreePath) {
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "EngineerNode",
          message: `タスク ${taskId} のworktreeが設定されていません`,
          taskId
        }
      ]
    };
  }
  console.log(`👷 Engineer: タスク ${taskId} を実装しています...`);
  try {
    const providerConfig = {
      provider: state.config.provider || "claude",
      claude: {
        model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929"
      }
    };
    const provider = AIProviderFactory.create(providerConfig);
    const dependenciesSection = task.dependencies.length > 0 ? `このタスクは以下のタスクに依存しています：
${task.dependencies.map((depId) => `- ${depId}`).join("\n")}

これらのタスクの変更内容を確認し、整合性を保ってください。` : "このタスクに依存関係はありません。";
    const implementationPrompt = `
# Task Implementation

以下のタスクを実装してください。

## タスク情報
- **ID**: ${task.id}
- **タイトル**: ${task.title}
- **説明**: ${task.description}

## 作業ディレクトリ
${task.worktreePath}

## 実装要件

### 1. テスト駆動開発（TDD）
- まずテストを作成してください
- テストを実行して失敗を確認してください
- その後、テストをパスする実装を行ってください

### 2. コミット
- 適切な単位でgit commitを作成してください
- コミットメッセージは明確で説明的に

### 3. コード品質
- 既存のコードスタイルに従ってください
- エラーハンドリングを適切に実装してください
- 必要に応じてドキュメントを追加してください

### 4. 依存関係
${dependenciesSection}

## 完了条件
- すべてのテストが通過する
- コードレビュー可能な状態
- 適切なコミットが作成されている

## 重要な注意
- **git add と git commit は実行してください**
- ただし、**git push は実行しないでください**（レビュー後にマージします）
`;
    const messages = [];
    let sessionId = task.sessionId;
    for await (const message of provider.execute(implementationPrompt, {
      maxTurns: state.config.maxTurns,
      cwd: task.worktreePath,
      permissionMode: "acceptEdits",
      allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      resume: task.sessionId
    })) {
      messages.push(message);
      if (message.session_id) {
        sessionId = message.session_id;
      }
      if (message.type === "assistant" && message.content) {
        console.log(`  💬 ${JSON.stringify(message.content).substring(0, 100)}...`);
      }
    }
    console.log(`✅ タスク ${taskId} の実装が完了しました`);
    const completedTask = {
      ...task,
      status: "completed",
      sessionId,
      updatedAt: /* @__PURE__ */ new Date()
    };
    return {
      tasks: [completedTask],
      completedTasks: [completedTask],
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "info",
          source: "EngineerNode",
          message: `タスク ${taskId} が完了しました`,
          data: {
            taskId,
            messageCount: messages.length,
            sessionId
          },
          taskId,
          sessionId
        }
      ],
      metadata: {
        tasksCompleted: (state.metadata.tasksCompleted || 0) + 1
      }
    };
  } catch (error) {
    console.error(`❌ タスク ${taskId} の実装に失敗:`, error);
    const failedTask = {
      ...task,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      updatedAt: /* @__PURE__ */ new Date()
    };
    return {
      tasks: [failedTask],
      failedTasks: [failedTask],
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "EngineerNode",
          message: `タスク ${taskId} が失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          data: {
            taskId,
            error
          },
          taskId
        }
      ],
      metadata: {
        tasksFailed: (state.metadata.tasksFailed || 0) + 1,
        hasErrors: true,
        errors: [
          ...state.metadata.errors || [],
          `Task ${taskId}: ${error instanceof Error ? error.message : String(error)}`
        ]
      }
    };
  }
}
async function reviewNode(state, taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) {
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "ReviewNode",
          message: `タスク ${taskId} が見つかりません`,
          taskId
        }
      ]
    };
  }
  if (!task.worktreePath) {
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "ReviewNode",
          message: `タスク ${taskId} のworktreeが設定されていません`,
          taskId
        }
      ]
    };
  }
  console.log(`🔍 Review: タスク ${taskId} をレビューしています...`);
  try {
    const providerConfig = {
      provider: state.config.provider || "claude",
      claude: {
        model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929"
      }
    };
    const provider = AIProviderFactory.create(providerConfig);
    const reviewPrompt = `
# Code Review

以下のタスクのコードレビューを実施してください。

## タスク情報
- **ID**: ${task.id}
- **タイトル**: ${task.title}
- **説明**: ${task.description}
- **ブランチ**: ${task.branchName}

## 作業ディレクトリ
${task.worktreePath}

## レビュー観点

### 1. コード品質
- コードは読みやすく、保守しやすいか
- 適切な命名規則が使われているか
- 適切なコメントが付いているか
- 重複コードがないか

### 2. テストカバレッジ
- 適切なテストが書かれているか
- テストは実行可能か
- エッジケースがカバーされているか

### 3. セキュリティ
- セキュリティ上の脆弱性がないか
- 入力のバリデーションが適切か
- 機密情報の漏洩リスクがないか

### 4. パフォーマンス
- パフォーマンス上の問題がないか
- 適切なデータ構造が使われているか

### 5. ドキュメント
- 必要なドキュメントが追加されているか
- API仕様が明確か

## レビュー結果の出力形式

以下の形式で結論を出力してください：

\`\`\`
REVIEW_STATUS: APPROVED または CHANGES_REQUESTED
\`\`\`

そして、コメントを箇条書きで記載してください。
`;
    const reviewComments = [];
    let reviewStatus = "approved";
    for await (const message of provider.execute(reviewPrompt, {
      maxTurns: 10,
      cwd: task.worktreePath,
      allowedTools: ["Read", "Grep", "Glob", "Bash"],
      permissionMode: "acceptEdits"
    })) {
      if (message.type === "assistant" && message.content) {
        const content = JSON.stringify(message.content);
        reviewComments.push(content);
        if (content.includes("CHANGES_REQUESTED")) {
          reviewStatus = "changes_requested";
        }
      }
    }
    const hasIssues = reviewStatus === "changes_requested" || reviewComments.some((c) => {
      const lowerC = c.toLowerCase();
      return lowerC.includes("issue") || lowerC.includes("problem") || lowerC.includes("concern") || lowerC.includes("fix");
    });
    const finalStatus = hasIssues ? "changes_requested" : "approved";
    console.log(`${finalStatus === "approved" ? "✅" : "⚠️"} タスク ${taskId} のレビュー: ${finalStatus}`);
    const review = {
      taskId: task.id,
      reviewer: "TechLeadAI",
      status: finalStatus,
      comments: reviewComments,
      timestamp: /* @__PURE__ */ new Date()
    };
    return {
      reviews: [review],
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: finalStatus === "approved" ? "info" : "warn",
          source: "ReviewNode",
          message: `タスク ${taskId} のレビュー完了: ${finalStatus}`,
          data: {
            taskId,
            reviewStatus: finalStatus,
            commentCount: reviewComments.length
          },
          taskId
        }
      ]
    };
  } catch (error) {
    console.error(`❌ タスク ${taskId} のレビューに失敗:`, error);
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "ReviewNode",
          message: `タスク ${taskId} のレビューに失敗: ${error instanceof Error ? error.message : String(error)}`,
          data: {
            taskId,
            error
          },
          taskId
        }
      ],
      metadata: {
        hasErrors: true,
        errors: [
          ...state.metadata.errors || [],
          `Review ${taskId}: ${error instanceof Error ? error.message : String(error)}`
        ]
      }
    };
  }
}
async function mergeCoordinatorNode(state) {
  const { reviews, tasks, config, mergeQueue } = state;
  console.log("🔄 Merge Coordinator: マージを調整しています...");
  try {
    const gitWorktreeManager = new GitWorktreeManager(
      config.baseRepoPath,
      config.worktreeBasePath,
      config.baseBranch
    );
    const approvedReviews = reviews.filter((r) => r.status === "approved");
    const approvedTaskIds = new Set(approvedReviews.map((r) => r.taskId));
    const existingMergeTaskIds = new Set(mergeQueue.map((m) => m.taskId));
    const tasksToMerge = tasks.filter(
      (t) => t.status === "completed" && approvedTaskIds.has(t.id) && !existingMergeTaskIds.has(t.id) && t.branchName
    );
    if (tasksToMerge.length === 0) {
      console.log("⏸️ マージ可能なタスクがありません");
      return {
        logs: [
          {
            timestamp: /* @__PURE__ */ new Date(),
            level: "info",
            source: "MergeCoordinatorNode",
            message: "マージ可能なタスクがありません"
          }
        ]
      };
    }
    console.log(`📋 ${tasksToMerge.length}個のタスクをマージキューに追加します`);
    const newMergeTasks = tasksToMerge.map((task) => ({
      taskId: task.id,
      sourceBranch: task.branchName,
      targetBranch: config.baseBranch,
      status: "pending",
      attemptedAt: /* @__PURE__ */ new Date()
    }));
    const updatedMergeTasks = [];
    const logs = [];
    for (const mergeTask of newMergeTasks) {
      try {
        console.log(`🔀 マージ実行: ${mergeTask.sourceBranch} → ${mergeTask.targetBranch}`);
        const { execSync: execSync2 } = await import("child_process");
        process.chdir(config.baseRepoPath);
        execSync2(`git checkout ${mergeTask.targetBranch}`, { stdio: "pipe" });
        try {
          execSync2(`git merge ${mergeTask.sourceBranch} --no-ff -m "Merge ${mergeTask.taskId}"`, {
            stdio: "pipe"
          });
          updatedMergeTasks.push({
            ...mergeTask,
            status: "completed",
            completedAt: /* @__PURE__ */ new Date()
          });
          logs.push({
            timestamp: /* @__PURE__ */ new Date(),
            level: "info",
            source: "MergeCoordinatorNode",
            message: `タスク ${mergeTask.taskId} のマージ成功`,
            data: { taskId: mergeTask.taskId },
            taskId: mergeTask.taskId
          });
          console.log(`✅ マージ成功: ${mergeTask.taskId}`);
        } catch (mergeError) {
          const errorOutput = mergeError instanceof Error ? mergeError.message : String(mergeError);
          if (errorOutput.includes("conflict") || errorOutput.includes("CONFLICT")) {
            const conflictFilesOutput = execSync2("git diff --name-only --diff-filter=U", {
              encoding: "utf-8"
            });
            const conflictFiles = conflictFilesOutput.split("\n").filter((f) => f.trim().length > 0);
            execSync2("git merge --abort", { stdio: "pipe" });
            updatedMergeTasks.push({
              ...mergeTask,
              status: "conflict",
              conflictFiles
            });
            logs.push({
              timestamp: /* @__PURE__ */ new Date(),
              level: "warn",
              source: "MergeCoordinatorNode",
              message: `タスク ${mergeTask.taskId} でコンフリクト検出`,
              data: {
                taskId: mergeTask.taskId,
                conflictFiles
              },
              taskId: mergeTask.taskId
            });
            console.log(`⚠️ コンフリクト検出: ${mergeTask.taskId}`);
          } else {
            throw mergeError;
          }
        }
      } catch (error) {
        console.error(`❌ マージエラー: ${mergeTask.taskId}`, error);
        updatedMergeTasks.push({
          ...mergeTask,
          status: "pending",
          error: error instanceof Error ? error.message : String(error)
        });
        logs.push({
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "MergeCoordinatorNode",
          message: `タスク ${mergeTask.taskId} のマージエラー: ${error instanceof Error ? error.message : String(error)}`,
          data: {
            taskId: mergeTask.taskId,
            error
          },
          taskId: mergeTask.taskId
        });
      }
    }
    return {
      mergeQueue: updatedMergeTasks,
      logs,
      metadata: {
        phase: "merge"
      }
    };
  } catch (error) {
    console.error("❌ Merge Coordinator Node エラー:", error);
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "MergeCoordinatorNode",
          message: `マージ調整に失敗: ${error instanceof Error ? error.message : String(error)}`,
          data: { error }
        }
      ],
      metadata: {
        hasErrors: true,
        errors: [
          ...state.metadata.errors || [],
          error instanceof Error ? error.message : String(error)
        ]
      }
    };
  }
}
async function conflictResolverNode(state) {
  const { mergeQueue, tasks } = state;
  console.log("🔧 Conflict Resolver: コンフリクトを解消しています...");
  try {
    const conflictMergeTasks = mergeQueue.filter((m) => m.status === "conflict");
    if (conflictMergeTasks.length === 0) {
      console.log("✅ コンフリクトはありません");
      return {
        logs: [
          {
            timestamp: /* @__PURE__ */ new Date(),
            level: "info",
            source: "ConflictResolverNode",
            message: "コンフリクトはありません"
          }
        ]
      };
    }
    console.log(`⚠️ ${conflictMergeTasks.length}個のコンフリクトを処理します`);
    const providerConfig = {
      provider: state.config.provider || "claude",
      claude: {
        model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929"
      }
    };
    const provider = AIProviderFactory.create(providerConfig);
    const updatedMergeTasks = [];
    const logs = [];
    for (const mergeTask of conflictMergeTasks) {
      const originalTask = tasks.find((t) => t.id === mergeTask.taskId);
      if (!originalTask || !originalTask.worktreePath) {
        console.log(`⏭️ タスク ${mergeTask.taskId} をスキップ（情報不足）`);
        continue;
      }
      console.log(`🔧 コンフリクト解消中: ${mergeTask.taskId}`);
      try {
        const conflictResolutionPrompt = `
# Merge Conflict Resolution

以下のマージコンフリクトを解消してください。

## タスク情報
- **ID**: ${originalTask.id}
- **タイトル**: ${originalTask.title}
- **説明**: ${originalTask.description}
- **ブランチ**: ${mergeTask.sourceBranch}

## コンフリクト情報
- **ターゲットブランチ**: ${mergeTask.targetBranch}
- **コンフリクトファイル**: ${mergeTask.conflictFiles?.join(", ") || "不明"}

## 作業ディレクトリ
${originalTask.worktreePath}

## 解決手順

### 1. コンフリクトファイルの確認
- コンフリクトが発生しているファイルを確認してください
- 両方の変更内容を理解してください

### 2. コンフリクトマーカーの解消
- \`<<<<<<<\`, \`=======\`, \`>>>>>>>\` マーカーを見つけてください
- 両方の変更を適切に統合してください
- コンフリクトマーカーをすべて削除してください

### 3. コードの整合性確認
- 統合後のコードが正しく動作するか確認してください
- テストを実行して問題がないか確認してください

### 4. コミット
- 解決後、適切なコミットメッセージでコミットしてください

## 重要な注意
- **両方の変更内容を尊重してください**
- **機能を失わないように統合してください**
- **テストが通ることを確認してください**
- **git add と git commit を実行してください**
- **git push は実行しないでください**
`;
        for await (const message of provider.execute(conflictResolutionPrompt, {
          maxTurns: 20,
          cwd: originalTask.worktreePath,
          permissionMode: "acceptEdits",
          allowedTools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
          resume: originalTask.sessionId
          // Resume original engineer's session
        })) {
          if (message.type === "assistant" && message.content) {
            console.log(`  💬 ${JSON.stringify(message.content).substring(0, 80)}...`);
          }
        }
        const { execSync: execSync2 } = await import("child_process");
        process.chdir(state.config.baseRepoPath);
        try {
          execSync2(`git checkout ${mergeTask.targetBranch}`, { stdio: "pipe" });
          execSync2(`git merge ${mergeTask.sourceBranch} --no-ff -m "Merge ${mergeTask.taskId} (conflict resolved)"`, {
            stdio: "pipe"
          });
          updatedMergeTasks.push({
            ...mergeTask,
            status: "completed",
            completedAt: /* @__PURE__ */ new Date()
          });
          logs.push({
            timestamp: /* @__PURE__ */ new Date(),
            level: "info",
            source: "ConflictResolverNode",
            message: `タスク ${mergeTask.taskId} のコンフリクト解消成功`,
            data: { taskId: mergeTask.taskId },
            taskId: mergeTask.taskId
          });
          console.log(`✅ コンフリクト解消成功: ${mergeTask.taskId}`);
        } catch (retryError) {
          console.error(`❌ コンフリクト解消失敗: ${mergeTask.taskId}`, retryError);
          try {
            execSync2("git merge --abort", { stdio: "pipe" });
          } catch {
          }
          logs.push({
            timestamp: /* @__PURE__ */ new Date(),
            level: "error",
            source: "ConflictResolverNode",
            message: `タスク ${mergeTask.taskId} のコンフリクト解消失敗: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
            data: {
              taskId: mergeTask.taskId,
              error: retryError
            },
            taskId: mergeTask.taskId
          });
        }
      } catch (error) {
        console.error(`❌ コンフリクト解消エラー: ${mergeTask.taskId}`, error);
        logs.push({
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "ConflictResolverNode",
          message: `タスク ${mergeTask.taskId} の処理エラー: ${error instanceof Error ? error.message : String(error)}`,
          data: {
            taskId: mergeTask.taskId,
            error
          },
          taskId: mergeTask.taskId
        });
      }
    }
    return {
      mergeQueue: updatedMergeTasks,
      logs
    };
  } catch (error) {
    console.error("❌ Conflict Resolver Node エラー:", error);
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "ConflictResolverNode",
          message: `コンフリクト解消に失敗: ${error instanceof Error ? error.message : String(error)}`,
          data: { error }
        }
      ],
      metadata: {
        hasErrors: true,
        errors: [
          ...state.metadata.errors || [],
          error instanceof Error ? error.message : String(error)
        ]
      }
    };
  }
}
class PriorityCalculator {
  /**
   * リクエストの新しさに基づくボーナスを計算
   *
   * @param requestTimestamp - タスクのリクエストタイムスタンプ
   * @param allProjects - 全プロジェクトのメタデータ
   * @returns 0-100のスケールでのrecencyBonus
   */
  static calculateRecencyBonus(requestTimestamp, allProjects) {
    const timestamps = Array.from(allProjects.values()).map((p) => p.requestTimestamp.getTime());
    if (timestamps.length === 0) {
      return 50;
    }
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const currentTimestamp = requestTimestamp.getTime();
    if (maxTimestamp === minTimestamp) {
      return 100;
    }
    const normalized = (currentTimestamp - minTimestamp) / (maxTimestamp - minTimestamp);
    return Math.round(normalized * 100);
  }
  /**
   * 依存関係の解決状況に基づくボーナスを計算
   *
   * @param task - 対象タスク
   * @param allTasks - 全タスクのリスト
   * @returns 0-100のスケールでのdependencyBonus
   */
  static calculateDependencyBonus(task, allTasks) {
    const dependencies = task.dependencies || [];
    if (dependencies.length === 0) {
      return 100;
    }
    const taskMap = new Map(allTasks.map((t) => [t.id, t]));
    let completedCount = 0;
    for (const depId of dependencies) {
      const depTask = taskMap.get(depId);
      if (depTask && depTask.status === "completed") {
        completedCount++;
      }
    }
    const completionRate = completedCount / dependencies.length;
    return Math.round(completionRate * 100);
  }
  /**
   * 動的優先度を計算
   *
   * @param task - 対象タスク
   * @param allTasks - 全タスクのリスト
   * @param allProjects - 全プロジェクトのメタデータ
   * @returns 0-1000のスケールでのdynamicPriority
   */
  static calculateDynamicPriority(task, allTasks, allProjects) {
    const basePriority = typeof task.priority === "number" ? task.priority : 50;
    const recencyBonus = this.calculateRecencyBonus(task.requestTimestamp, allProjects);
    const dependencyBonus = this.calculateDependencyBonus(task, allTasks);
    const dynamicPriority = basePriority * 0.5 + recencyBonus * 0.3 + dependencyBonus * 0.2;
    return Math.round(dynamicPriority);
  }
  /**
   * 複数のタスクの動的優先度を一括計算し、優先度順にソート
   *
   * @param tasks - タスクのリスト
   * @param allProjects - 全プロジェクトのメタデータ
   * @returns 優先度順にソートされたタスクリスト（高い順）
   */
  static calculateAndSortTasks(tasks, allProjects) {
    const tasksWithPriority = tasks.map((task) => ({
      ...task,
      dynamicPriority: this.calculateDynamicPriority(task, tasks, allProjects)
    }));
    return tasksWithPriority.sort((a, b) => b.dynamicPriority - a.dynamicPriority);
  }
  /**
   * 継続モードの検出
   *
   * ⚠️ このメソッドは廃止予定
   *
   * 継続モード判定は CheckModeNode で AI に判断させる必要があります。
   * 文字列パターンマッチングは使用しないでください。
   *
   * @deprecated CheckModeNodeのAI判定を使用してください
   * @param userRequest - ユーザーリクエスト文字列
   * @returns 継続モードかどうか
   */
  static detectContinuationMode(userRequest) {
    throw new Error(
      "detectContinuationMode() is deprecated. Use AI-driven detection in CheckModeNode instead."
    );
  }
  /**
   * プロジェクトの優先度を再計算
   *
   * 新しいリクエストが追加された際や、タスクの状態が変化した際に呼び出す
   *
   * @param tasks - 全グローバルタスク
   * @param allProjects - 全プロジェクトのメタデータ
   * @returns 優先度が更新されたタスクリスト
   */
  static recalculateAllPriorities(tasks, allProjects) {
    return tasks.map((task) => ({
      ...task,
      dynamicPriority: this.calculateDynamicPriority(task, tasks, allProjects)
    }));
  }
}
class FileSystemManager {
  /**
   * ディレクトリが存在しない場合は作成する
   *
   * @param dirPath - ディレクトリパス
   */
  static async ensureDirectory(dirPath) {
    if (!existsSync(dirPath)) {
      await fs$1.mkdir(dirPath, { recursive: true });
    }
  }
  /**
   * JSONファイルを読み込む
   *
   * @param filePath - ファイルパス
   * @returns パースされたJSONオブジェクト
   * @throws ファイルが存在しない、またはパースエラーの場合
   */
  static async readJSON(filePath) {
    const content = await fs$1.readFile(filePath, "utf-8");
    return JSON.parse(content);
  }
  /**
   * JSONファイルを読み込む（エラー時はデフォルト値を返す）
   *
   * @param filePath - ファイルパス
   * @param defaultValue - ファイルが存在しない場合のデフォルト値
   * @returns パースされたJSONオブジェクト、またはデフォルト値
   */
  static async readJSONSafe(filePath, defaultValue) {
    try {
      return await this.readJSON(filePath);
    } catch (error) {
      return defaultValue;
    }
  }
  /**
   * JSONファイルに書き込む
   *
   * @param filePath - ファイルパス
   * @param data - 保存するデータ
   * @param pretty - フォーマットするかどうか（デフォルト: true）
   */
  static async writeJSON(filePath, data, pretty = true) {
    const dirPath = path__default.dirname(filePath);
    await this.ensureDirectory(dirPath);
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await fs$1.writeFile(filePath, content, "utf-8");
  }
  /**
   * ファイルに書き込む
   *
   * @param filePath - ファイルパス
   * @param content - 書き込む内容
   */
  static async writeFile(filePath, content) {
    const dirPath = path__default.dirname(filePath);
    await this.ensureDirectory(dirPath);
    await fs$1.writeFile(filePath, content, "utf-8");
  }
  /**
   * ファイルが存在するかチェック
   *
   * @param filePath - ファイルパス
   * @returns ファイルが存在する場合true
   */
  static exists(filePath) {
    return existsSync(filePath);
  }
  /**
   * ファイルまたはディレクトリを削除
   *
   * @param targetPath - 削除対象のパス
   * @param recursive - ディレクトリの場合、再帰的に削除するか
   */
  static async remove(targetPath, recursive = true) {
    if (existsSync(targetPath)) {
      await fs$1.rm(targetPath, { recursive, force: true });
    }
  }
  /**
   * ディレクトリ内のファイル一覧を取得
   *
   * @param dirPath - ディレクトリパス
   * @returns ファイル名の配列
   */
  static async listFiles(dirPath) {
    if (!existsSync(dirPath)) {
      return [];
    }
    return await fs$1.readdir(dirPath);
  }
  /**
   * パスを結合
   *
   * @param segments - パスセグメント
   * @returns 結合されたパス
   */
  static join(...segments) {
    return path__default.join(...segments);
  }
  /**
   * 絶対パスに変換
   *
   * @param relativePath - 相対パス
   * @returns 絶対パス
   */
  static resolve(relativePath) {
    return path__default.resolve(relativePath);
  }
}
class DataPersistence {
  baseRepoPath;
  kugutsuDir;
  tasksDir;
  sprintsDir;
  projectsDir;
  constructor(baseRepoPath) {
    this.baseRepoPath = baseRepoPath;
    this.kugutsuDir = path__default.join(baseRepoPath, ".kugutsu");
    this.tasksDir = path__default.join(this.kugutsuDir, "tasks");
    this.sprintsDir = path__default.join(this.kugutsuDir, "sprints");
    this.projectsDir = path__default.join(this.kugutsuDir, "projects");
  }
  /**
   * 必要なディレクトリ構造を初期化
   */
  async initialize() {
    await FileSystemManager.ensureDirectory(this.kugutsuDir);
    await FileSystemManager.ensureDirectory(this.tasksDir);
    await FileSystemManager.ensureDirectory(this.sprintsDir);
    await FileSystemManager.ensureDirectory(this.projectsDir);
  }
  // ========================================
  // グローバルタスクキュー
  // ========================================
  /**
   * グローバルタスクキューを読み込む
   *
   * @returns グローバルタスクの配列
   */
  async loadGlobalQueue() {
    const filePath = path__default.join(this.tasksDir, "global-queue.json");
    const data = await FileSystemManager.readJSONSafe(filePath, {
      tasks: [],
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    });
    return data.tasks.map((task) => ({
      ...task,
      requestTimestamp: new Date(task.requestTimestamp)
    }));
  }
  /**
   * グローバルタスクキューを保存
   *
   * @param tasks - 保存するタスクの配列
   */
  async saveGlobalQueue(tasks) {
    const filePath = path__default.join(this.tasksDir, "global-queue.json");
    const data = {
      tasks,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
    await FileSystemManager.writeJSON(filePath, data);
  }
  // ========================================
  // スプリント管理
  // ========================================
  /**
   * アクティブなスプリントを読み込む
   *
   * @returns アクティブなスプリント、または null
   */
  async loadActiveSprint() {
    const filePath = path__default.join(this.sprintsDir, "active-sprint.json");
    const sprint = await FileSystemManager.readJSONSafe(filePath, null);
    if (!sprint) {
      return null;
    }
    return {
      ...sprint,
      startedAt: sprint.startedAt ? new Date(sprint.startedAt) : void 0,
      completedAt: sprint.completedAt ? new Date(sprint.completedAt) : void 0
    };
  }
  /**
   * アクティブなスプリントを保存
   *
   * @param sprint - 保存するスプリント、または null（クリア）
   */
  async saveActiveSprint(sprint) {
    const filePath = path__default.join(this.sprintsDir, "active-sprint.json");
    await FileSystemManager.writeJSON(filePath, sprint);
  }
  /**
   * スプリント履歴を読み込む
   *
   * @returns 完了したスプリントの配列
   */
  async loadSprintHistory() {
    const filePath = path__default.join(this.sprintsDir, "sprint-history.json");
    const data = await FileSystemManager.readJSONSafe(filePath, {
      sprints: [],
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    });
    return data.sprints.map((sprint) => ({
      ...sprint,
      startedAt: sprint.startedAt ? new Date(sprint.startedAt) : void 0,
      completedAt: sprint.completedAt ? new Date(sprint.completedAt) : void 0
    }));
  }
  /**
   * スプリント履歴を保存
   *
   * @param sprints - 保存するスプリントの配列
   */
  async saveSprintHistory(sprints) {
    const filePath = path__default.join(this.sprintsDir, "sprint-history.json");
    const data = {
      sprints,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
    await FileSystemManager.writeJSON(filePath, data);
  }
  /**
   * スプリントを履歴に追加
   *
   * @param sprint - 追加するスプリント
   */
  async addToSprintHistory(sprint) {
    const history = await this.loadSprintHistory();
    history.push(sprint);
    await this.saveSprintHistory(history);
  }
  // ========================================
  // プロジェクトメタデータ
  // ========================================
  /**
   * プロジェクトメタデータを読み込む
   *
   * @param projectId - プロジェクトID
   * @returns プロジェクトメタデータ、または null
   */
  async loadProjectMetadata(projectId) {
    const filePath = path__default.join(this.projectsDir, projectId, "project.json");
    const metadata = await FileSystemManager.readJSONSafe(filePath, null);
    if (!metadata) {
      return null;
    }
    return {
      ...metadata,
      requestTimestamp: new Date(metadata.requestTimestamp)
    };
  }
  /**
   * プロジェクトメタデータを保存
   *
   * @param projectId - プロジェクトID
   * @param metadata - プロジェクトメタデータ
   */
  async saveProjectMetadata(projectId, metadata) {
    const projectDir = path__default.join(this.projectsDir, projectId);
    await FileSystemManager.ensureDirectory(projectDir);
    const filePath = path__default.join(projectDir, "project.json");
    await FileSystemManager.writeJSON(filePath, metadata);
  }
  /**
   * 全てのプロジェクトメタデータを読み込む
   *
   * @returns プロジェクトIDをキーとするMap
   */
  async loadAllProjectMetadata() {
    const projectIds = await FileSystemManager.listFiles(this.projectsDir);
    const projects = /* @__PURE__ */ new Map();
    for (const projectId of projectIds) {
      const metadata = await this.loadProjectMetadata(projectId);
      if (metadata) {
        projects.set(projectId, metadata);
      }
    }
    return projects;
  }
  // ========================================
  // スクラム開発フロー: ストーリーマッピング
  // ========================================
  /**
   * ストーリーマッピングを保存
   *
   * @param projectId - プロジェクトID
   * @param storyMapping - ストーリーマッピングデータ
   */
  async saveStoryMapping(projectId, storyMapping) {
    const storyMappingDir = path__default.join(this.projectsDir, projectId, "story-mapping");
    await FileSystemManager.ensureDirectory(storyMappingDir);
    const filePath = path__default.join(storyMappingDir, "story-map.json");
    await FileSystemManager.writeJSON(filePath, storyMapping);
  }
  /**
   * ストーリーマッピングを読み込み
   *
   * @param projectId - プロジェクトID
   * @returns ストーリーマッピングデータ、または null
   */
  async loadStoryMapping(projectId) {
    const filePath = path__default.join(this.projectsDir, projectId, "story-mapping", "story-map.json");
    return await FileSystemManager.readJSONSafe(filePath, null);
  }
  /**
   * ストーリーマッピングのMarkdownを保存
   *
   * @param projectId - プロジェクトID
   * @param markdown - Markdownコンテンツ
   */
  async saveStoryMappingMarkdown(projectId, markdown) {
    const storyMappingDir = path__default.join(this.projectsDir, projectId, "story-mapping");
    await FileSystemManager.ensureDirectory(storyMappingDir);
    const filePath = path__default.join(storyMappingDir, "story-map.md");
    await FileSystemManager.writeFile(filePath, markdown);
  }
  /**
   * ストーリーマッピングのレビュー履歴を保存
   *
   * @param projectId - プロジェクトID
   * @param reviewHistory - レビュー履歴データ
   */
  async saveStoryMappingReviewHistory(projectId, reviewHistory) {
    const filePath = path__default.join(this.projectsDir, projectId, "story-mapping", "review-history.json");
    await FileSystemManager.writeJSON(filePath, reviewHistory);
  }
  /**
   * ストーリーマッピングのレビュー履歴を読み込み
   *
   * @param projectId - プロジェクトID
   * @returns レビュー履歴データ
   */
  async loadStoryMappingReviewHistory(projectId) {
    const filePath = path__default.join(this.projectsDir, projectId, "story-mapping", "review-history.json");
    return await FileSystemManager.readJSONSafe(filePath, { reviews: [] });
  }
  // ========================================
  // スクラム開発フロー: 設計書
  // ========================================
  /**
   * 設計書のMarkdownを保存
   *
   * @param projectId - プロジェクトID
   * @param markdown - Markdownコンテンツ
   */
  async saveDesignDocsMarkdown(projectId, markdown) {
    const designDir = path__default.join(this.projectsDir, projectId, "design");
    await FileSystemManager.ensureDirectory(designDir);
    const filePath = path__default.join(designDir, "design-docs.md");
    await FileSystemManager.writeFile(filePath, markdown);
  }
  /**
   * DB設計を保存
   *
   * @param projectId - プロジェクトID
   * @param schema - DB schemaデータ
   */
  async saveDatabaseSchema(projectId, schema) {
    const dbDir = path__default.join(this.projectsDir, projectId, "design", "database");
    await FileSystemManager.ensureDirectory(dbDir);
    const filePath = path__default.join(dbDir, "schema.json");
    await FileSystemManager.writeJSON(filePath, schema);
  }
  /**
   * DB設計を読み込み
   *
   * @param projectId - プロジェクトID
   * @returns DB schemaデータ、または null
   */
  async loadDatabaseSchema(projectId) {
    const filePath = path__default.join(this.projectsDir, projectId, "design", "database", "schema.json");
    return await FileSystemManager.readJSONSafe(filePath, null);
  }
  /**
   * ER図のMarkdownを保存
   *
   * @param projectId - プロジェクトID
   * @param markdown - Markdownコンテンツ（Mermaid含む）
   */
  async saveDatabaseERDiagram(projectId, markdown) {
    const dbDir = path__default.join(this.projectsDir, projectId, "design", "database");
    await FileSystemManager.ensureDirectory(dbDir);
    const filePath = path__default.join(dbDir, "er-diagram.md");
    await FileSystemManager.writeFile(filePath, markdown);
  }
  /**
   * API仕様を保存（OpenAPI形式）
   *
   * @param projectId - プロジェクトID
   * @param apiSpec - API仕様データ
   */
  async saveAPISpec(projectId, apiSpec) {
    const interfacesDir = path__default.join(this.projectsDir, projectId, "design", "interfaces");
    await FileSystemManager.ensureDirectory(interfacesDir);
    const filePath = path__default.join(interfacesDir, "api-spec.json");
    await FileSystemManager.writeJSON(filePath, apiSpec);
  }
  /**
   * API仕様を読み込み
   *
   * @param projectId - プロジェクトID
   * @returns API仕様データ、または null
   */
  async loadAPISpec(projectId) {
    const filePath = path__default.join(this.projectsDir, projectId, "design", "interfaces", "api-spec.json");
    return await FileSystemManager.readJSONSafe(filePath, null);
  }
  /**
   * API仕様のMarkdownを保存
   *
   * @param projectId - プロジェクトID
   * @param markdown - Markdownコンテンツ
   */
  async saveAPISpecMarkdown(projectId, markdown) {
    const interfacesDir = path__default.join(this.projectsDir, projectId, "design", "interfaces");
    await FileSystemManager.ensureDirectory(interfacesDir);
    const filePath = path__default.join(interfacesDir, "api-spec.md");
    await FileSystemManager.writeFile(filePath, markdown);
  }
  /**
   * UI/UX画面定義を保存
   *
   * @param projectId - プロジェクトID
   * @param screens - 画面定義データ
   */
  async saveUIUXScreens(projectId, screens) {
    const uiuxDir = path__default.join(this.projectsDir, projectId, "design", "uiux");
    await FileSystemManager.ensureDirectory(uiuxDir);
    const filePath = path__default.join(uiuxDir, "screens.json");
    await FileSystemManager.writeJSON(filePath, screens);
  }
  /**
   * UI/UX画面定義を読み込み
   *
   * @param projectId - プロジェクトID
   * @returns 画面定義データ、または null
   */
  async loadUIUXScreens(projectId) {
    const filePath = path__default.join(this.projectsDir, projectId, "design", "uiux", "screens.json");
    return await FileSystemManager.readJSONSafe(filePath, null);
  }
  /**
   * ワイヤーフレームのMarkdownを保存
   *
   * @param projectId - プロジェクトID
   * @param markdown - Markdownコンテンツ（Mermaid含む）
   */
  async saveUIUXWireframes(projectId, markdown) {
    const uiuxDir = path__default.join(this.projectsDir, projectId, "design", "uiux");
    await FileSystemManager.ensureDirectory(uiuxDir);
    const filePath = path__default.join(uiuxDir, "wireframes.md");
    await FileSystemManager.writeFile(filePath, markdown);
  }
  /**
   * 設計書のレビュー履歴を保存
   *
   * @param projectId - プロジェクトID
   * @param reviewHistory - レビュー履歴データ
   */
  async saveDesignReviewHistory(projectId, reviewHistory) {
    const designDir = path__default.join(this.projectsDir, projectId, "design");
    await FileSystemManager.ensureDirectory(designDir);
    const filePath = path__default.join(designDir, "review-history.json");
    await FileSystemManager.writeJSON(filePath, reviewHistory);
  }
  /**
   * 設計書のレビュー履歴を読み込み
   *
   * @param projectId - プロジェクトID
   * @returns レビュー履歴データ
   */
  async loadDesignReviewHistory(projectId) {
    const filePath = path__default.join(this.projectsDir, projectId, "design", "review-history.json");
    return await FileSystemManager.readJSONSafe(filePath, { reviews: [] });
  }
  // ========================================
  // スクラム開発フロー: タスク管理
  // ========================================
  /**
   * タスクリストを保存
   *
   * @param projectId - プロジェクトID
   * @param taskList - タスクリストデータ
   */
  async saveTaskList(projectId, taskList) {
    const tasksDir = path__default.join(this.projectsDir, projectId, "tasks");
    await FileSystemManager.ensureDirectory(tasksDir);
    const filePath = path__default.join(tasksDir, "task-list.json");
    await FileSystemManager.writeJSON(filePath, taskList);
  }
  /**
   * タスクリストを読み込み
   *
   * @param projectId - プロジェクトID
   * @returns タスクリストデータ
   */
  async loadTaskList(projectId) {
    const filePath = path__default.join(this.projectsDir, projectId, "tasks", "task-list.json");
    return await FileSystemManager.readJSONSafe(filePath, { tasks: [] });
  }
  /**
   * 依存関係グラフを保存
   *
   * @param projectId - プロジェクトID
   * @param dependencyGraph - 依存関係グラフデータ
   */
  async saveDependencyGraph(projectId, dependencyGraph) {
    const tasksDir = path__default.join(this.projectsDir, projectId, "tasks");
    await FileSystemManager.ensureDirectory(tasksDir);
    const filePath = path__default.join(tasksDir, "dependencies.json");
    await FileSystemManager.writeJSON(filePath, dependencyGraph);
  }
  /**
   * 依存関係グラフを読み込み
   *
   * @param projectId - プロジェクトID
   * @returns 依存関係グラフデータ
   */
  async loadDependencyGraph(projectId) {
    const filePath = path__default.join(this.projectsDir, projectId, "tasks", "dependencies.json");
    return await FileSystemManager.readJSONSafe(filePath, {
      graph: { nodes: [], edges: [] },
      executionPlan: []
    });
  }
  /**
   * Kanbanステートを保存
   *
   * @param projectId - プロジェクトID
   * @param kanbanState - Kanbanステートデータ
   */
  async saveKanbanState(projectId, kanbanState) {
    const tasksDir = path__default.join(this.projectsDir, projectId, "tasks");
    await FileSystemManager.ensureDirectory(tasksDir);
    const filePath = path__default.join(tasksDir, "kanban-state.json");
    await FileSystemManager.writeJSON(filePath, kanbanState);
  }
  /**
   * Kanbanステートを読み込み
   *
   * @param projectId - プロジェクトID
   * @returns Kanbanステートデータ
   */
  async loadKanbanState(projectId) {
    const filePath = path__default.join(this.projectsDir, projectId, "tasks", "kanban-state.json");
    return await FileSystemManager.readJSONSafe(filePath, {
      columns: {
        pending: { label: "Pending", taskIds: [], color: "amber" },
        ready: { label: "Ready", taskIds: [], color: "blue" },
        in_progress: { label: "In Progress", taskIds: [], color: "indigo" },
        in_review: { label: "In Review", taskIds: [], color: "purple" },
        completed: { label: "Completed", taskIds: [], color: "green" },
        failed: { label: "Failed", taskIds: [], color: "red" }
      },
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  /**
   * タスクのレビュー記録を保存
   *
   * @param projectId - プロジェクトID
   * @param taskId - タスクID
   * @param review - レビューデータ
   */
  async saveTaskReview(projectId, taskId, review) {
    const reviewsDir = path__default.join(this.projectsDir, projectId, "reviews");
    await FileSystemManager.ensureDirectory(reviewsDir);
    const filePath = path__default.join(reviewsDir, `${taskId}.json`);
    await FileSystemManager.writeJSON(filePath, review);
  }
  /**
   * タスクのレビュー記録を読み込み
   *
   * @param projectId - プロジェクトID
   * @param taskId - タスクID
   * @returns レビューデータ、または null
   */
  async loadTaskReview(projectId, taskId) {
    const filePath = path__default.join(this.projectsDir, projectId, "reviews", `${taskId}.json`);
    return await FileSystemManager.readJSONSafe(filePath, null);
  }
  // ========================================
  // ユーティリティ
  // ========================================
  /**
   * 全データをクリア（テスト用）
   */
  async clearAll() {
    await FileSystemManager.remove(this.tasksDir);
    await FileSystemManager.remove(this.sprintsDir);
    await this.initialize();
  }
  /**
   * プロジェクトデータをクリア
   *
   * @param projectId - プロジェクトID
   */
  async clearProject(projectId) {
    const projectDir = path__default.join(this.projectsDir, projectId);
    await FileSystemManager.remove(projectDir);
  }
}
async function checkModeNode(state) {
  const { userRequest, config } = state;
  console.log("🔍 CheckMode: ユーザーリクエストを分析しています...");
  console.log(`📝 リクエスト: ${userRequest}`);
  const persistence = new DataPersistence(config.baseRepoPath);
  await persistence.initialize();
  const globalTasks = await persistence.loadGlobalQueue();
  const projects = await persistence.loadAllProjectMetadata();
  console.log(`📊 既存タスク数: ${globalTasks.length}`);
  console.log(`📁 既存プロジェクト数: ${projects.size}`);
  const providerConfig = {
    provider: config.provider || "claude",
    claude: {
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929"
    }
  };
  const repositoryMetadata = await persistence.loadRepositoryMetadata();
  if (!repositoryMetadata) {
    console.log("🔍 初回実行: リポジトリ全体を分析しています...");
    const repositoryAnalysisPrompt = `
# リポジトリ全体の分析

このリポジトリ全体を分析し、以下の情報をJSON形式で出力してください。

## 分析項目

1. **基本情報**:
   - リポジトリ名（package.jsonやREADMEから推測）
   - 説明（READMEから）
   - 主要なプログラミング言語（TypeScript, JavaScript, Python等）
   - フレームワーク（React, Vue, Express, Django等）

2. **規模**:
   - ファイル数（概算）
   - コード行数（概算）

3. **技術スタック**:
   - フロントエンド（該当する場合）
   - バックエンド（該当する場合）
   - データベース（該当する場合）
   - インフラ（Docker, Kubernetes等）

4. **アーキテクチャ**:
   - アーキテクチャパターン（MVC, Clean Architecture, Layered等）
   - ディレクトリ構造の特徴

5. **コーディング規約**:
   - 命名規則（既存コードから推測）
   - コメントスタイル

## 出力形式

\`\`\`json
{
  "repositoryName": "...",
  "description": "...",
  "primaryLanguages": ["TypeScript", "JavaScript"],
  "frameworks": ["React", "Node.js"],
  "linesOfCode": 10000,
  "fileCount": 100,
  "techStack": {
    "frontend": {
      "framework": "React",
      "version": "19.0.0",
      "language": "TypeScript"
    },
    "backend": {
      "runtime": "Node.js",
      "framework": "Express",
      "language": "TypeScript"
    },
    "database": {
      "primary": "PostgreSQL"
    }
  },
  "architecture": {
    "pattern": "Clean Architecture",
    "layers": ["presentation", "application", "domain", "infrastructure"]
  },
  "codingStandards": {
    "namingConvention": "camelCase for variables, PascalCase for classes",
    "commentStyle": "JSDoc for public APIs"
  }
}
\`\`\`
`;
    const repositoryAnalysisProvider = AIProviderFactory.create(providerConfig);
    let repositoryAnalysisText = "";
    for await (const message of repositoryAnalysisProvider.execute(
      repositoryAnalysisPrompt,
      {
        maxTurns: 10,
        cwd: config.baseRepoPath,
        allowedTools: ["Read", "Glob", "Grep"],
        permissionMode: "acceptEdits"
      }
    )) {
      if (message.type === "assistant" && message.content) {
        if (typeof message.content === "string") {
          repositoryAnalysisText += message.content;
        } else {
          repositoryAnalysisText += JSON.stringify(message.content);
        }
      }
    }
    const repositoryJsonMatch = repositoryAnalysisText.match(/```json\n([\s\S]*?)\n```/);
    if (repositoryJsonMatch) {
      try {
        const analysisResult = JSON.parse(repositoryJsonMatch[1]);
        const metadata = {
          ...analysisResult,
          analyzedAt: (/* @__PURE__ */ new Date()).toISOString(),
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
          kugutsuVersion: "2.0.0",
          developmentPhase: "active"
        };
        await persistence.saveRepositoryMetadata(metadata);
        if (analysisResult.techStack) {
          await persistence.saveTechStack(analysisResult.techStack);
        }
        const architectureOverview = `# アーキテクチャ概要

**最終更新**: ${(/* @__PURE__ */ new Date()).toISOString()}

## アーキテクチャパターン

${analysisResult.architecture?.pattern || "N/A"}

## レイヤー構造

${analysisResult.architecture?.layers?.map((layer) => `- ${layer}`).join("\n") || "N/A"}

## 技術スタック

- **フロントエンド**: ${analysisResult.techStack?.frontend?.framework || "N/A"}
- **バックエンド**: ${analysisResult.techStack?.backend?.framework || "N/A"}
- **データベース**: ${analysisResult.techStack?.database?.primary || "N/A"}
`;
        await persistence.saveArchitectureOverview(architectureOverview);
        const codingStandards = `# コーディング規約

**最終更新**: ${(/* @__PURE__ */ new Date()).toISOString()}

## 命名規則

${analysisResult.codingStandards?.namingConvention || "N/A"}

## コメントスタイル

${analysisResult.codingStandards?.commentStyle || "N/A"}
`;
        await persistence.saveCodingStandards(codingStandards);
        console.log("✅ リポジトリ仕様を初期化しました");
        console.log("📝 repository/の変更をコミットしています...");
        const gitManager = new GitWorktreeManager(
          config.baseRepoPath,
          config.worktreeBasePath || "./worktrees",
          config.baseBranch || "main"
        );
        try {
          await gitManager.addAndCommit(
            ".kugutsu/repository/",
            "chore: Initialize repository specifications\n\n🤖 Generated with Kugutsu 2.0\n\nCo-Authored-By: Claude <noreply@anthropic.com>"
          );
        } catch (commitError) {
          console.warn("⚠️ repository/のコミットに失敗しました:", commitError);
        }
      } catch (error) {
        console.error("❌ リポジトリ分析結果のJSON解析に失敗しました:", error);
      }
    } else {
      console.warn("⚠️ リポジトリ分析結果からJSONを抽出できませんでした");
    }
  } else {
    console.log("✅ 既存のリポジトリ仕様を使用します");
  }
  const incompleteTasks = globalTasks.filter(
    (task) => task.status !== "completed" && task.status !== "failed"
  );
  let latestProject;
  if (projects.size > 0) {
    const sortedProjects = Array.from(projects.values()).sort(
      (a, b) => b.requestTimestamp.getTime() - a.requestTimestamp.getTime()
    );
    latestProject = sortedProjects[0];
  }
  const provider = AIProviderFactory.create(providerConfig);
  const continuationDetectionPrompt = `
# ユーザーリクエストの意図分析

以下のユーザーリクエストを分析し、継続モードか新規モードかを判定してください。

## ユーザーリクエスト
${userRequest}

## 既存プロジェクト情報
- 既存プロジェクト数: ${projects.size}
- 未完了タスク数: ${incompleteTasks.length}
- 最新プロジェクト: ${latestProject?.userRequest || "なし"}

## 判定基準
**継続モード**:
- 既存プロジェクトの続きを依頼している
- 既存の未完了タスクに関連する作業
- 文脈から既存作業の継続を示唆している

**新規モード**:
- 全く新しい機能や要求
- 既存プロジェクトと無関係
- 新規プロジェクトの開始を明示

## 出力形式
JSON形式で以下を出力してください：
\`\`\`json
{
  "isContinuation": true または false,
  "reasoning": "判定理由の説明"
}
\`\`\`
`;
  console.log("🤖 AI: 継続モード判定中...");
  let aiResponseText = "";
  for await (const message of provider.execute(continuationDetectionPrompt, {
    maxTurns: 5,
    cwd: config.baseRepoPath,
    allowedTools: [],
    permissionMode: "acceptEdits"
  })) {
    if (message.type === "assistant" && message.content) {
      if (typeof message.content === "string") {
        aiResponseText += message.content;
      } else {
        aiResponseText += JSON.stringify(message.content);
      }
    }
  }
  const jsonMatch = aiResponseText.match(/```json\n([\s\S]*?)\n```/);
  let isContinuation = false;
  let reasoning = "";
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[1]);
      isContinuation = result.isContinuation;
      reasoning = result.reasoning;
      console.log(`✅ AI判定: ${isContinuation ? "継続モード" : "新規モード"}`);
      console.log(`💭 理由: ${reasoning}`);
    } catch (error) {
      console.error("❌ AI応答のJSON解析に失敗しました:", error);
      isContinuation = false;
    }
  } else {
    console.warn("⚠️ AI応答からJSONを抽出できませんでした。新規モードとして扱います。");
    isContinuation = false;
  }
  let currentProjectId;
  let currentUserRequest;
  let continuationMode;
  if (isContinuation && projects.size > 0 && latestProject) {
    currentProjectId = latestProject.projectId;
    currentUserRequest = latestProject.userRequest;
    continuationMode = true;
    console.log(`✅ 継続モード: プロジェクト "${currentProjectId}" を再開します`);
    console.log(`📋 元のリクエスト: ${latestProject.userRequest}`);
    const incompleteTasks2 = globalTasks.filter(
      (task) => task.projectId === currentProjectId && task.status !== "completed" && task.status !== "failed"
    );
    console.log(`🔄 未完了タスク: ${incompleteTasks2.length}件`);
    const updatedTasks = PriorityCalculator.recalculateAllPriorities(
      globalTasks,
      projects
    );
    return {
      continuationMode,
      currentUserRequest,
      currentProjectId,
      globalTasks: updatedTasks,
      projects,
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "info",
          source: "check_mode",
          message: `継続モードで再開: プロジェクト ${currentProjectId}`,
          data: {
            projectId: currentProjectId,
            incompleteTasks: incompleteTasks2.length,
            totalTasks: globalTasks.length
          }
        }
      ]
    };
  } else {
    currentProjectId = randomUUID();
    currentUserRequest = userRequest;
    continuationMode = false;
    console.log(`🆕 新規モード: 新しいプロジェクト "${currentProjectId}" を開始します`);
    const newProjectMetadata = {
      projectId: currentProjectId,
      userRequest: currentUserRequest,
      requestTimestamp: /* @__PURE__ */ new Date(),
      totalTasks: 0,
      completedTasks: 0,
      needsStoryMapping: false
    };
    await persistence.saveProjectMetadata(currentProjectId, newProjectMetadata);
    const updatedProjects = new Map(projects);
    updatedProjects.set(currentProjectId, newProjectMetadata);
    return {
      continuationMode,
      currentUserRequest,
      currentProjectId,
      globalTasks,
      projects: updatedProjects,
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "info",
          source: "check_mode",
          message: `新規モードで開始: プロジェクト ${currentProjectId}`,
          data: {
            projectId: currentProjectId,
            userRequest: currentUserRequest
          }
        }
      ]
    };
  }
}
function checkModeRouter(state) {
  if (state.continuationMode) {
    console.log("➡️ ルーティング: sprint_planning (継続モード)");
    return "sprint_planning";
  } else {
    console.log("➡️ ルーティング: product_owner (新規モード)");
    return "product_owner";
  }
}
async function sprintPlanningNode(state) {
  const { globalTasks, projects, currentProjectId, config } = state;
  console.log("📅 SprintPlanning: スプリント計画を作成しています...");
  const persistence = new DataPersistence(config.baseRepoPath);
  await persistence.initialize();
  const existingActiveSprint = await persistence.loadActiveSprint();
  if (existingActiveSprint && existingActiveSprint.status === "active") {
    console.log(`⚠️ 既にアクティブなスプリントが存在します: ${existingActiveSprint.name}`);
    return {
      activeSprint: existingActiveSprint,
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "info",
          source: "sprint_planning",
          message: `既存のアクティブスプリント: ${existingActiveSprint.name}`
        }
      ]
    };
  }
  const unassignedTasks = globalTasks.filter(
    (task) => !task.sprint && task.status !== "completed" && task.status !== "failed"
  );
  console.log(`📊 未割り当てタスク: ${unassignedTasks.length}件`);
  if (unassignedTasks.length === 0) {
    console.log("✅ すべてのタスクがスプリントに割り当て済みです");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "info",
          source: "sprint_planning",
          message: "すべてのタスクがスプリントに割り当て済み"
        }
      ]
    };
  }
  const providerConfig = {
    provider: config.provider || "claude",
    claude: {
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929"
    }
  };
  const provider = AIProviderFactory.create(providerConfig);
  const sprintPlanningPrompt = `
# Sprint Planning

タスクをスプリントに分割してください。

## 制約条件
- 各スプリントは8-16時間の作業量
- E2Eでテスト・デプロイ可能な機能単位でグルーピング
- 依存関係を考慮し、依存元のタスクを先に配置
- スプリントゴールを明確に定義

## 未割り当てタスク
${JSON.stringify(
    unassignedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      dependencies: t.dependencies,
      dynamicPriority: t.dynamicPriority
    })),
    null,
    2
  )}

## 出力形式
JSON形式で以下の構造で出力してください：
\`\`\`json
{
  "sprints": [
    {
      "name": "Sprint 1: 機能名",
      "goal": "スプリントゴール",
      "taskIds": ["task-id-1", "task-id-2"],
      "estimatedHours": 12,
      "deployable": true
    }
  ]
}
\`\`\`

## 注意事項
- 最初のスプリントのみを計画してください（1スプリントのみ）
- 優先度が高いタスクを先に配置
- 依存関係を必ず考慮
- スプリントゴールは具体的に記述
`;
  let sprintPlanResult = "";
  for await (const message of provider.execute(sprintPlanningPrompt, {
    maxTurns: 10,
    cwd: config.baseRepoPath,
    allowedTools: ["Read", "Glob"],
    permissionMode: "acceptEdits"
  })) {
    if (message.type === "assistant" && message.content) {
      if (typeof message.content === "string") {
        sprintPlanResult += message.content;
      } else {
        sprintPlanResult += JSON.stringify(message.content);
      }
    }
  }
  console.log("✅ スプリント計画生成完了");
  const jsonMatch = sprintPlanResult.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    console.error("❌ スプリント計画のJSON抽出に失敗しました");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "sprint_planning",
          message: "スプリント計画の生成に失敗"
        }
      ]
    };
  }
  const sprintPlan = JSON.parse(jsonMatch[1]);
  const firstSprint = sprintPlan.sprints[0];
  const sprintId = `sprint-${randomUUID()}`;
  const newSprint = {
    id: sprintId,
    name: firstSprint.name,
    goal: firstSprint.goal,
    taskIds: firstSprint.taskIds,
    status: "planning",
    deployable: firstSprint.deployable,
    metadata: {
      estimatedHours: firstSprint.estimatedHours,
      blockers: [],
      completedTasksCount: 0,
      failedTasksCount: 0
    }
  };
  console.log(`📋 スプリント作成: ${newSprint.name}`);
  console.log(`🎯 ゴール: ${newSprint.goal}`);
  console.log(`⏱️  見積もり: ${newSprint.metadata.estimatedHours}時間`);
  console.log(`📦 タスク数: ${newSprint.taskIds.length}件`);
  const updatedGlobalTasks = globalTasks.map((task) => {
    if (newSprint.taskIds.includes(task.id)) {
      return {
        ...task,
        sprint: sprintId
      };
    }
    return task;
  });
  newSprint.status = "active";
  newSprint.startedAt = /* @__PURE__ */ new Date();
  await persistence.saveActiveSprint(newSprint);
  await persistence.saveGlobalQueue(updatedGlobalTasks);
  return {
    activeSprint: newSprint,
    sprints: [newSprint],
    globalTasks: updatedGlobalTasks,
    logs: [
      {
        timestamp: /* @__PURE__ */ new Date(),
        level: "info",
        source: "sprint_planning",
        message: `スプリント開始: ${newSprint.name}`,
        data: {
          sprintId,
          goal: newSprint.goal,
          taskCount: newSprint.taskIds.length,
          estimatedHours: newSprint.metadata.estimatedHours
        }
      }
    ]
  };
}
function sprintPlanningRouter(state) {
  if (state.activeSprint && state.activeSprint.status === "active") {
    console.log("➡️ ルーティング: engineer_dispatch (スプリント実行)");
    return "engineer_dispatch";
  } else {
    console.log("➡️ ルーティング: END (スプリント計画なし)");
    return "END";
  }
}
async function sprintReviewNode(state) {
  const { activeSprint, globalTasks, config } = state;
  console.log("🔍 SprintReview: スプリント完了確認中...");
  if (!activeSprint) {
    console.log("⚠️ アクティブなスプリントが存在しません");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "warn",
          source: "sprint_review",
          message: "アクティブなスプリントなし"
        }
      ]
    };
  }
  console.log(`📋 スプリント: ${activeSprint.name}`);
  console.log(`🎯 ゴール: ${activeSprint.goal}`);
  const persistence = new DataPersistence(config.baseRepoPath);
  await persistence.initialize();
  const sprintTasks = globalTasks.filter(
    (task) => activeSprint.taskIds.includes(task.id)
  );
  const completedTasks = sprintTasks.filter(
    (task) => task.status === "completed"
  );
  const failedTasks = sprintTasks.filter((task) => task.status === "failed");
  const incompleteTasks = sprintTasks.filter(
    (task) => task.status !== "completed" && task.status !== "failed"
  );
  console.log(`✅ 完了タスク: ${completedTasks.length}/${sprintTasks.length}`);
  console.log(`❌ 失敗タスク: ${failedTasks.length}/${sprintTasks.length}`);
  console.log(`⏳ 未完了タスク: ${incompleteTasks.length}/${sprintTasks.length}`);
  const updatedSprint = {
    ...activeSprint,
    metadata: {
      ...activeSprint.metadata,
      completedTasksCount: completedTasks.length,
      failedTasksCount: failedTasks.length
    }
  };
  if (incompleteTasks.length === 0) {
    console.log("✨ スプリント内の全タスクが完了しました");
    const providerConfig = {
      provider: config.provider || "claude",
      claude: {
        model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929"
      }
    };
    const provider = AIProviderFactory.create(providerConfig);
    const deployabilityCheckPrompt = `
# スプリントレビュー: デプロイ可能性判定

以下のスプリントがデプロイ可能かを判定してください。

## スプリント情報
- 名前: ${updatedSprint.name}
- ゴール: ${updatedSprint.goal}
- 完了タスク数: ${completedTasks.length}
- 失敗タスク数: ${failedTasks.length}

## 完了タスク一覧
${JSON.stringify(
      completedTasks.map((t) => ({
        title: t.title,
        description: t.description
      })),
      null,
      2
    )}

## 判定基準
- E2Eでテスト可能な機能単位か？
- デプロイ可能な状態か？
- ユーザーに価値を提供できるか？
- 残された技術的負債や未完了作業はないか？

## 出力形式
JSON形式で以下を出力してください：
\`\`\`json
{
  "deployable": true または false,
  "e2eTestable": true または false,
  "reasoning": "判定理由",
  "blockers": ["ブロッカー1", "ブロッカー2"] (デプロイ不可の場合)
}
\`\`\`
`;
    console.log("🤖 AI: デプロイ可能性判定中...");
    let aiResponseText = "";
    for await (const message of provider.execute(deployabilityCheckPrompt, {
      maxTurns: 5,
      cwd: config.baseRepoPath,
      allowedTools: ["Read", "Glob"],
      permissionMode: "acceptEdits"
    })) {
      if (message.type === "assistant" && message.content) {
        if (typeof message.content === "string") {
          aiResponseText += message.content;
        } else {
          aiResponseText += JSON.stringify(message.content);
        }
      }
    }
    const jsonMatch = aiResponseText.match(/```json\n([\s\S]*?)\n```/);
    let deployable = true;
    let e2eTestable = true;
    let reasoning = "";
    let blockers = [];
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[1]);
        deployable = result.deployable;
        e2eTestable = result.e2eTestable;
        reasoning = result.reasoning;
        blockers = result.blockers || [];
        console.log(`✅ AI判定: デプロイ ${deployable ? "可能" : "不可"}`);
        console.log(`💭 理由: ${reasoning}`);
        if (blockers.length > 0) {
          console.log(`🚫 ブロッカー: ${blockers.join(", ")}`);
        }
      } catch (error) {
        console.error("❌ AI応答のJSON解析に失敗しました:", error);
        deployable = true;
        e2eTestable = true;
        reasoning = "AI判定エラーのため、デフォルトでデプロイ可能とします";
      }
    } else {
      console.warn(
        "⚠️ AI応答からJSONを抽出できませんでした。デフォルトでデプロイ可能とします。"
      );
      deployable = true;
      e2eTestable = true;
      reasoning = "AI判定エラーのため、デフォルトでデプロイ可能とします";
    }
    const completedSprint = {
      ...updatedSprint,
      status: "completed",
      deployable: deployable && e2eTestable,
      completedAt: /* @__PURE__ */ new Date(),
      metadata: {
        ...updatedSprint.metadata,
        blockers
      }
    };
    await persistence.addToSprintHistory(completedSprint);
    console.log(`📚 スプリント履歴に記録: ${completedSprint.id}`);
    await persistence.saveActiveSprint(null);
    console.log("🗑️ アクティブスプリントをクリアしました");
    const remainingUnassignedTasks = globalTasks.filter(
      (task) => !task.sprint && task.status !== "completed" && task.status !== "failed"
    );
    console.log(
      `📊 残りの未割り当てタスク: ${remainingUnassignedTasks.length}件`
    );
    if (remainingUnassignedTasks.length > 0) {
      console.log("🔄 次のスプリント計画が必要です");
      return {
        activeSprint: null,
        sprints: [...state.sprints || [], completedSprint],
        logs: [
          {
            timestamp: /* @__PURE__ */ new Date(),
            level: "info",
            source: "sprint_review",
            message: `スプリント完了: ${completedSprint.name}。次スプリント計画へ`,
            data: {
              sprintId: completedSprint.id,
              completedTasks: completedTasks.length,
              failedTasks: failedTasks.length,
              deployable: completedSprint.deployable,
              remainingTasks: remainingUnassignedTasks.length
            }
          }
        ]
      };
    } else {
      console.log("🎉 すべてのタスクが完了しました！");
      return {
        activeSprint: null,
        sprints: [...state.sprints || [], completedSprint],
        metadata: {
          ...state.metadata,
          phase: "complete"
        },
        logs: [
          {
            timestamp: /* @__PURE__ */ new Date(),
            level: "info",
            source: "sprint_review",
            message: `全タスク完了: プロジェクト終了`,
            data: {
              sprintId: completedSprint.id,
              completedTasks: completedTasks.length,
              deployable: completedSprint.deployable
            }
          }
        ]
      };
    }
  } else {
    console.log("⚠️ スプリント内に未完了タスクがあります");
    console.log(`⏳ 未完了タスク: ${incompleteTasks.map((t) => t.title).join(", ")}`);
    return {
      activeSprint: updatedSprint,
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "warn",
          source: "sprint_review",
          message: `スプリント ${updatedSprint.name} は未完了タスクあり`,
          data: {
            sprintId: updatedSprint.id,
            completedTasks: completedTasks.length,
            failedTasks: failedTasks.length,
            incompleteTasks: incompleteTasks.length
          }
        }
      ]
    };
  }
}
function sprintReviewRouter(state) {
  const allTasksCompleted = state.globalTasks.every(
    (task) => task.status === "completed" || task.status === "failed"
  );
  if (allTasksCompleted) {
    console.log("➡️ ルーティング: END (全タスク完了)");
    return "END";
  }
  if (!state.activeSprint || state.activeSprint.status === "completed") {
    console.log("➡️ ルーティング: sprint_planning (次スプリント計画)");
    return "sprint_planning";
  }
  console.log("➡️ ルーティング: engineer_dispatch (スプリント継続)");
  return "engineer_dispatch";
}
const __dirname$1 = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(__dirname$1, "../../schema");
const loadSchema = (filename) => {
  const path2 = join(schemaDir, filename);
  return JSON.parse(readFileSync(path2, "utf-8"));
};
class SchemaValidator {
  ajv;
  validators;
  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
    this.validators = /* @__PURE__ */ new Map();
    this.registerSchema("story-mapping", "story-mapping.schema.json");
    this.registerSchema("task", "task.schema.json");
    this.registerSchema("dependency-graph", "dependency-graph.schema.json");
    this.registerSchema("kanban-state", "kanban-state.schema.json");
    this.registerSchema("review", "review.schema.json");
    this.registerSchema("design-docs", "design-docs.schema.json");
  }
  /**
   * スキーマを登録
   */
  registerSchema(name, filename) {
    try {
      const schema = loadSchema(filename);
      const validate = this.ajv.compile(schema);
      this.validators.set(name, validate);
    } catch (error) {
      console.error(`Failed to load schema: ${filename}`, error);
      throw new Error(`Failed to load schema: ${filename}`);
    }
  }
  /**
   * データをバリデーション
   */
  validate(schemaName, data) {
    const validate = this.validators.get(schemaName);
    if (!validate) {
      throw new Error(`Schema not found: ${schemaName}`);
    }
    const valid = validate(data);
    return {
      valid: !!valid,
      errors: validate.errors ? validate.errors.map((err) => ({
        instancePath: err.instancePath,
        schemaPath: err.schemaPath,
        keyword: err.keyword,
        params: err.params,
        message: err.message
      })) : void 0
    };
  }
  /**
   * ストーリーマッピングをバリデーション
   */
  validateStoryMapping(data) {
    return this.validate("story-mapping", data);
  }
  /**
   * タスクリストをバリデーション
   */
  validateTaskList(data) {
    return this.validate("task", data);
  }
  /**
   * 依存関係グラフをバリデーション
   */
  validateDependencyGraph(data) {
    return this.validate("dependency-graph", data);
  }
  /**
   * Kanbanステートをバリデーション
   */
  validateKanbanState(data) {
    return this.validate("kanban-state", data);
  }
  /**
   * レビュー履歴をバリデーション
   */
  validateReview(data) {
    return this.validate("review", data);
  }
  /**
   * 設計書をバリデーション
   */
  validateDesignDocs(data) {
    return this.validate("design-docs", data);
  }
  /**
   * バリデーションエラーを人間が読みやすい形式に変換
   */
  formatErrors(result) {
    if (result.valid || !result.errors) {
      return "";
    }
    return result.errors.map((err) => {
      const path2 = err.instancePath || "(root)";
      const message = err.message || "validation error";
      const params = JSON.stringify(err.params);
      return `  - ${path2}: ${message} ${params}`;
    }).join("\n");
  }
}
let instance = null;
function getSchemaValidator() {
  if (!instance) {
    instance = new SchemaValidator();
  }
  return instance;
}
async function directorNode(state) {
  console.log("📋 DirectorAI: ストーリーマッピング作成開始");
  try {
    const provider = state.config.provider ? AIProviderFactory.create({ provider: state.config.provider }) : AIProviderFactory.createFromEnv();
    const dataPersistence = new DataPersistence(state.config.baseRepoPath);
    const schemaValidator = getSchemaValidator();
    const prompt = `
あなたはプロジェクトディレクターとして、ユーザー要求を分析し、ストーリーマッピングを作成してください。

# ユーザー要求
${state.userRequest}

# タスク
以下の形式でストーリーマッピングを作成してください：

1. **ペルソナ**: プロジェクトのターゲットユーザー
2. **エピック**: 大きな機能グループ（3-5個）
3. **ユーザーストーリー**: 各エピックを構成する具体的なストーリー

# 出力形式（JSON）
\`\`\`json
{
  "persona": {
    "name": "ペルソナ名",
    "role": "役割",
    "goal": "目標",
    "painPoints": ["課題1", "課題2"]
  },
  "epics": [
    {
      "id": "epic-1",
      "title": "エピックタイトル",
      "description": "エピック説明",
      "priority": 1,
      "stories": [
        {
          "id": "story-1",
          "title": "ストーリータイトル",
          "asA": "〜として",
          "iWantTo": "〜したい",
          "soThat": "〜できるように",
          "acceptanceCriteria": ["受入基準1", "受入基準2"],
          "priority": 1,
          "estimatedPoints": 3
        }
      ]
    }
  ]
}
\`\`\`

# 重要な指示
- ペルソナは1つ
- エピックは3-5個
- 各エピックには2-5個のストーリー
- priorityは1（高）、2（中）、3（低）
- estimatedPointsは1（簡単）、3（普通）、5（難しい）、8（とても難しい）

JSON形式で出力してください。
`;
    console.log("🤖 AI: ストーリーマッピング生成中...");
    let storyMappingJson = "";
    for await (const message of provider.execute(prompt, {
      maxTurns: state.config.maxTurns || 10,
      cwd: state.config.baseRepoPath,
      permissionMode: "acceptEdits"
    })) {
      if (message.type === "assistant" && typeof message.content === "string") {
        storyMappingJson += message.content;
      }
    }
    const jsonMatch = storyMappingJson.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error("AIからのレスポンスにJSON形式のストーリーマッピングが含まれていません");
    }
    const storyMapping = JSON.parse(jsonMatch[1]);
    try {
      const validation = schemaValidator.validate(JSON.stringify(storyMapping), "storyMapping");
      if (!validation.valid) {
        console.warn("⚠️ ストーリーマッピングのスキーマ検証に失敗しました:", validation.errors);
      }
    } catch (err) {
      console.debug("スキーマ検証をスキップしました");
    }
    const markdown = generateStoryMappingMarkdown(storyMapping);
    const projectId = state.currentProjectId || "default-project";
    await dataPersistence.saveStoryMapping(projectId, { storyMapping, markdown });
    console.log("✅ ストーリーマッピング作成完了");
    return {
      storyMapping,
      currentProjectId: projectId,
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "success",
          source: "DirectorAI",
          message: "ストーリーマッピング作成完了",
          data: {
            epicCount: storyMapping.epics.length,
            storyCount: storyMapping.epics.reduce((sum, e) => sum + e.stories.length, 0)
          }
        }
      ]
    };
  } catch (error) {
    console.error("❌ DirectorAI: ストーリーマッピング作成エラー:", error);
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "DirectorAI",
          message: `ストーリーマッピング作成エラー: ${error.message}`,
          data: { error: String(error) }
        }
      ]
    };
  }
}
function generateStoryMappingMarkdown(storyMapping) {
  let markdown = "# ストーリーマッピング\n\n";
  markdown += "## ペルソナ\n\n";
  markdown += `**名前**: ${storyMapping.persona.name}

`;
  markdown += `**役割**: ${storyMapping.persona.role}

`;
  markdown += `**目標**: ${storyMapping.persona.goal}

`;
  if (storyMapping.persona.painPoints && storyMapping.persona.painPoints.length > 0) {
    markdown += "**課題**:\n";
    storyMapping.persona.painPoints.forEach((p) => {
      markdown += `- ${p}
`;
    });
    markdown += "\n";
  }
  markdown += "## エピックとユーザーストーリー\n\n";
  storyMapping.epics.sort((a, b) => a.priority - b.priority).forEach((epic) => {
    markdown += `### ${epic.title} (優先度: ${epic.priority})

`;
    if (epic.description) {
      markdown += `${epic.description}

`;
    }
    markdown += "#### ユーザーストーリー\n\n";
    epic.stories.sort((a, b) => a.priority - b.priority).forEach((story) => {
      markdown += `##### ${story.title}

`;
      markdown += `- **〜として**: ${story.asA}
`;
      markdown += `- **〜したい**: ${story.iWantTo}
`;
      markdown += `- **〜できるように**: ${story.soThat}
`;
      markdown += `- **優先度**: ${story.priority}
`;
      markdown += `- **見積もり**: ${story.estimatedPoints} ポイント

`;
      markdown += "**受入基準**:\n";
      story.acceptanceCriteria.forEach((criteria) => {
        markdown += `- ${criteria}
`;
      });
      markdown += "\n";
    });
  });
  return markdown;
}
async function reviewStoryMappingNode(state) {
  const { config, currentProjectId } = state;
  console.log("📖 StoryMappingReview: ストーリーマッピングレビュー開始");
  if (!currentProjectId) {
    console.log("⚠️ プロジェクトIDが指定されていません");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "warn",
          source: "story_mapping_review",
          message: "プロジェクトIDなし"
        }
      ]
    };
  }
  const persistence = new DataPersistence(config.baseRepoPath);
  await persistence.initialize();
  const storyMapping = await persistence.loadStoryMapping(currentProjectId);
  if (!storyMapping) {
    console.log("⚠️ ストーリーマッピングが見つかりません");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "warn",
          source: "story_mapping_review",
          message: "ストーリーマッピングなし"
        }
      ]
    };
  }
  console.log(`📊 Epic数: ${storyMapping.epics.length}`);
  const totalStories = storyMapping.epics.reduce(
    (sum, epic) => sum + epic.stories.length,
    0
  );
  console.log(`📝 ストーリー数: ${totalStories}`);
  const reviewHistory = await persistence.loadStoryMappingReviewHistory(
    currentProjectId
  );
  const iteration = (reviewHistory.reviews?.length || 0) + 1;
  console.log(`🔄 レビュー回数: ${iteration}回目`);
  const providerConfig = {
    provider: config.provider || "claude",
    claude: {
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929"
    }
  };
  const provider = AIProviderFactory.create(providerConfig);
  const reviewPrompt = buildReviewPrompt$1(storyMapping, iteration);
  console.log("🤖 AI: ストーリーマッピングレビュー実行中...");
  let aiResponseText = "";
  for await (const message of provider.execute(reviewPrompt, {
    maxTurns: 10,
    cwd: config.baseRepoPath,
    allowedTools: ["Read", "Glob"],
    permissionMode: "acceptEdits"
  })) {
    if (message.type === "assistant" && message.content) {
      if (typeof message.content === "string") {
        aiResponseText += message.content;
      } else {
        aiResponseText += JSON.stringify(message.content);
      }
    }
  }
  const reviewResult = extractReviewResult(aiResponseText);
  console.log(`📋 レビュー結果: ${reviewResult.approved ? "承認" : "修正必要"}`);
  console.log(`🔍 指摘事項: ${reviewResult.issues.length}件`);
  const newReview = {
    iteration,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    reviewer: "ProductOwnerAI",
    approved: reviewResult.approved,
    issues: reviewResult.issues,
    suggestions: reviewResult.suggestions,
    overallAssessment: reviewResult.overallAssessment
  };
  const updatedHistory = {
    reviews: [...reviewHistory.reviews || [], newReview]
  };
  await persistence.saveStoryMappingReviewHistory(
    currentProjectId,
    updatedHistory
  );
  console.log("💾 レビュー履歴を保存しました");
  if (reviewResult.approved) {
    console.log("✅ ストーリーマッピング承認 → 設計フェーズへ");
    return {
      storyMappingApproved: true,
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "success",
          source: "story_mapping_review",
          message: `ストーリーマッピング承認 (${totalStories}ストーリー)`
        }
      ]
    };
  } else {
    console.log("⚠️ 修正が必要です");
    console.log("📝 主な指摘事項:");
    reviewResult.issues.slice(0, 3).forEach((issue) => {
      console.log(`  - [${issue.severity}] ${issue.message}`);
    });
    return {
      storyMappingApproved: false,
      reviewFeedback: {
        issues: reviewResult.issues,
        suggestions: reviewResult.suggestions
      },
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "warn",
          source: "story_mapping_review",
          message: `修正必要: ${reviewResult.issues.length}件の指摘`
        }
      ]
    };
  }
}
function buildReviewPrompt$1(storyMapping, iteration) {
  return `
# ストーリーマッピングレビュー (レビュー回数: ${iteration}回目)

あなたはプロダクトオーナーとして、以下のストーリーマッピングをレビューしてください。

## ストーリーマッピング

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## レビュー観点

### 1. ペルソナの評価
- **具体性**: 実在する人物像が想像できるか
- **妥当性**: プロダクトのターゲットユーザーとして適切か
- **ゴールの明確さ**: 達成したいことが明確か

### 2. Epicの評価
- **粒度**: 大きすぎず小さすぎない適切な粒度か
- **優先度**: ビジネス価値に基づいた優先順位付けか
- **完全性**: 必要な機能が網羅されているか

### 3. ユーザーストーリーの評価
- **フォーマット**: "As a / I want to / So that" の形式が守られているか
- **独立性**: 各ストーリーが独立して価値を提供できるか
- **具体性**: 実装者が理解できる具体性があるか
- **受入基準**: 測定可能で具体的な基準か（最低2個）
- **見積ポイント**: フィボナッチ数列（1,2,3,5,8,13,21）か

### 4. 全体の一貫性
- **Epic間の関連**: Epicが論理的につながっているか
- **ストーリー間の関連**: 依存関係が適切に考慮されているか
- **優先度の一貫性**: Epic内のストーリー優先度が整合しているか

## 出力形式

JSON形式で以下を出力してください：

\`\`\`json
{
  "approved": true または false,
  "issues": [
    {
      "severity": "critical" | "major" | "minor" | "info",
      "category": "persona" | "epic" | "story" | "acceptance_criteria" | "priority" | "consistency",
      "message": "指摘内容の詳細",
      "storyId": "story-1-1" (該当する場合),
      "epicId": "epic-1" (該当する場合)
    }
  ],
  "suggestions": [
    "改善提案1",
    "改善提案2"
  ],
  "overallAssessment": "全体評価のコメント"
}
\`\`\`

## 判定基準

- **critical/major な問題が0件**: 承認 (approved: true)
- **critical/major な問題が1件以上**: 修正必要 (approved: false)

## 注意事項

- minor/info レベルの指摘は承認に影響しない
- 具体的で実行可能な改善提案を含める
- 指摘は建設的で分かりやすく
`.trim();
}
function extractReviewResult(response) {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  let parsedResult;
  if (jsonMatch) {
    try {
      parsedResult = JSON.parse(jsonMatch[1]);
    } catch (error) {
      console.error("JSONパースエラー:", error);
      parsedResult = {
        approved: false,
        issues: [
          {
            severity: "critical",
            category: "parse_error",
            message: "AIレスポンスのパースに失敗しました"
          }
        ],
        suggestions: [],
        overallAssessment: "レビュー結果の解析に失敗"
      };
    }
  } else {
    parsedResult = {
      approved: false,
      issues: [
        {
          severity: "critical",
          category: "format_error",
          message: "AIレスポンスが期待された形式ではありません"
        }
      ],
      suggestions: [],
      overallAssessment: "レビュー結果が不正な形式"
    };
  }
  return {
    approved: parsedResult.approved || false,
    issues: parsedResult.issues || [],
    suggestions: parsedResult.suggestions || [],
    overallAssessment: parsedResult.overallAssessment || ""
  };
}
async function techLeadDesignNode(state) {
  const { config, currentProjectId, storyMappingApproved } = state;
  console.log("🎨 TechLeadDesign: 設計書作成開始");
  if (!currentProjectId) {
    console.log("⚠️ プロジェクトIDが指定されていません");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "warn",
          source: "tech_lead_design",
          message: "プロジェクトIDなし"
        }
      ]
    };
  }
  if (!storyMappingApproved) {
    console.log("⚠️ ストーリーマッピングが承認されていません");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "warn",
          source: "tech_lead_design",
          message: "ストーリーマッピング未承認"
        }
      ]
    };
  }
  const persistence = new DataPersistence(config.baseRepoPath);
  await persistence.initialize();
  const storyMapping = await persistence.loadStoryMapping(currentProjectId);
  if (!storyMapping) {
    console.log("⚠️ ストーリーマッピングが見つかりません");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "warn",
          source: "tech_lead_design",
          message: "ストーリーマッピングなし"
        }
      ]
    };
  }
  console.log("📖 ストーリーマッピング読み込み完了");
  const providerConfig = {
    provider: config.provider || "claude",
    claude: {
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929"
    }
  };
  const provider = AIProviderFactory.create(providerConfig);
  console.log("🤖 AI: 全体設計書を生成中...");
  const designDocsPrompt = buildDesignDocsPrompt(storyMapping);
  const designDocsMarkdown = await executeAIPrompt(provider, designDocsPrompt, config.baseRepoPath);
  if (!designDocsMarkdown) {
    console.log("❌ 全体設計書の生成に失敗しました");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "tech_lead_design",
          message: "全体設計書生成失敗"
        }
      ]
    };
  }
  await persistence.saveDesignDocsMarkdown(currentProjectId, designDocsMarkdown);
  console.log("✅ 全体設計書を保存しました");
  console.log("🤖 AI: UI/UX設計を生成中...");
  const uiuxPrompt = buildUIUXDesignPrompt(storyMapping);
  const uiuxResult = await executeAIPrompt(provider, uiuxPrompt, config.baseRepoPath);
  if (!uiuxResult) {
    console.log("❌ UI/UX設計の生成に失敗しました");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "tech_lead_design",
          message: "UI/UX設計生成失敗"
        }
      ]
    };
  }
  const wireframesMarkdown = extractMarkdownSection(uiuxResult, "wireframes");
  const screensJSON = extractJSONSection(uiuxResult, "screens");
  if (wireframesMarkdown) {
    await persistence.saveUIUXWireframes(currentProjectId, wireframesMarkdown);
    console.log("✅ wireframes.mdを保存しました");
  }
  if (screensJSON) {
    await persistence.saveUIUXScreens(currentProjectId, screensJSON);
    console.log("✅ screens.jsonを保存しました");
  }
  console.log("🤖 AI: DB設計を生成中...");
  const dbPrompt = buildDatabaseDesignPrompt(storyMapping);
  const dbResult = await executeAIPrompt(provider, dbPrompt, config.baseRepoPath);
  if (!dbResult) {
    console.log("❌ DB設計の生成に失敗しました");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "tech_lead_design",
          message: "DB設計生成失敗"
        }
      ]
    };
  }
  const erDiagramMarkdown = extractMarkdownSection(dbResult, "er-diagram");
  const dbSchemaJSON = extractJSONSection(dbResult, "schema");
  if (erDiagramMarkdown) {
    await persistence.saveDatabaseERDiagram(currentProjectId, erDiagramMarkdown);
    console.log("✅ er-diagram.mdを保存しました");
  }
  if (dbSchemaJSON) {
    await persistence.saveDatabaseSchema(currentProjectId, dbSchemaJSON);
    console.log("✅ schema.jsonを保存しました");
  }
  console.log("🤖 AI: API設計を生成中...");
  const apiPrompt = buildAPIDesignPrompt(storyMapping, dbSchemaJSON);
  const apiResult = await executeAIPrompt(provider, apiPrompt, config.baseRepoPath);
  if (!apiResult) {
    console.log("❌ API設計の生成に失敗しました");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "tech_lead_design",
          message: "API設計生成失敗"
        }
      ]
    };
  }
  const apiSpecMarkdown = extractMarkdownSection(apiResult, "api-spec");
  const apiSpecJSON = extractJSONSection(apiResult, "api-spec");
  if (apiSpecMarkdown) {
    await persistence.saveAPISpecMarkdown(currentProjectId, apiSpecMarkdown);
    console.log("✅ api-spec.mdを保存しました");
  }
  if (apiSpecJSON) {
    await persistence.saveAPISpec(currentProjectId, apiSpecJSON);
    console.log("✅ api-spec.jsonを保存しました");
  }
  console.log("✅ 設計書作成完了");
  console.log("📝 repository/の変更をコミットしています...");
  const gitManager = new GitWorktreeManager(
    config.baseRepoPath,
    config.worktreeBasePath || "./worktrees",
    config.baseBranch || "main"
  );
  try {
    await gitManager.addAndCommit(
      ".kugutsu/repository/",
      "chore: Update repository specifications\n\n🤖 Generated with Kugutsu 2.0\n\nCo-Authored-By: Claude <noreply@anthropic.com>"
    );
  } catch (commitError) {
    console.warn("⚠️ repository/のコミットに失敗しました:", commitError);
  }
  return {
    logs: [
      {
        timestamp: /* @__PURE__ */ new Date(),
        level: "success",
        source: "tech_lead_design",
        message: "設計書作成完了（全体設計、UI/UX、DB、API）"
      }
    ]
  };
}
async function executeAIPrompt(provider, prompt, cwd) {
  let result = "";
  try {
    for await (const message of provider.execute(prompt, {
      maxTurns: 30,
      cwd,
      allowedTools: ["Read", "Glob", "Grep"],
      permissionMode: "acceptEdits"
    })) {
      if (message.type === "assistant" && message.content) {
        if (typeof message.content === "string") {
          result += message.content;
        } else {
          result += JSON.stringify(message.content);
        }
      }
    }
    return result || null;
  } catch (error) {
    console.error("❌ AI実行エラー:", error);
    return null;
  }
}
function buildDesignDocsPrompt(storyMapping) {
  return `
# 全体設計書の作成

あなたはTechLeadとして、以下のストーリーマッピングから全体設計書を作成してください。

## ストーリーマッピング

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## タスク

以下のMarkdown形式で全体設計書を作成してください：

### 必須セクション

1. **全体設計**
   - アーキテクチャ図（Mermaid graph）
   - 技術スタック（既存のコードベースを分析して決定）
   - レイヤー構成（Presentation, Application, Domain, Infrastructure）

2. **UI/UX設計サマリー**
   - 画面一覧表

3. **DB設計サマリー**
   - テーブル一覧表

4. **I/O設計サマリー**
   - API一覧表

5. **セキュリティ設計**
   - 認証・認可方式
   - データ保護

6. **パフォーマンス設計**
   - 目標値
   - 最適化戦略

7. **エラーハンドリング**
   - エラーコード体系

8. **デプロイメント**
   - 環境
   - CI/CD

## 重要な指針

- **既存システムを尊重**: コードベースを分析し、既存の技術スタックと整合性を保つ
- **リポジトリ全体の仕様を参照**: \`.kugutsu/repository/\` 配下に保存されているリポジトリ全体の仕様（アーキテクチャ、技術スタック、コーディング規約、既存DB/API設計）を必ず参照し、整合性を保つ
- **必要最小限**: 過剰設計を避け、ストーリーを実現する最小限の設計
- **明確性**: エンジニア間で実装がブレない明確さ

## リポジトリ全体の仕様

以下のファイルに、既存のリポジトリ全体の仕様が保存されています。設計時は必ず参照してください：

- \`.kugutsu/repository/metadata.json\`: リポジトリの基本情報
- \`.kugutsu/repository/architecture/overview.md\`: 全体アーキテクチャ
- \`.kugutsu/repository/architecture/tech-stack.json\`: 技術スタック
- \`.kugutsu/repository/standards/coding-standards.md\`: コーディング規約
- \`.kugutsu/repository/database/schema.json\`: 既存のDB設計
- \`.kugutsu/repository/api/api-spec.json\`: 既存のAPI仕様

**設計完了後**: プロジェクト固有の設計をリポジトリ全体の仕様に反映する必要がある場合は、該当ファイルを更新してください。

## 出力形式

Markdown形式で全文を出力してください。Mermaid図を活用してください。
`.trim();
}
function buildUIUXDesignPrompt(storyMapping) {
  return `
# UI/UX設計書の作成

あなたはTechLeadとして、以下のストーリーマッピングからUI/UX設計を作成してください。

## ストーリーマッピング

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## タスク

以下の2つのファイルを作成してください：

### 1. wireframes.md（Markdown + Mermaid）

必須セクション:
- 画面遷移図（Mermaid graph）
- 各画面のワイヤーフレーム（ASCII artまたはMermaid）
- コンポーネント構成
- 状態管理
- イベント定義

### 2. screens.json（JSON構造化データ）

フォーマット:
\`\`\`json
{
  "screens": [
    {
      "id": "SCR-001",
      "name": "画面名",
      "path": "/path",
      "description": "説明",
      "components": [
        {
          "name": "ComponentName",
          "props": ["prop1", "prop2"]
        }
      ],
      "state": {
        "stateVar": "type"
      },
      "events": [
        {
          "name": "onEvent",
          "params": ["param: type"],
          "action": "Action description"
        }
      ]
    }
  ]
}
\`\`\`

## 出力形式

以下の形式で2つのファイルを出力してください：

\`\`\`markdown:wireframes
# wireframes.mdの内容
...
\`\`\`

\`\`\`json:screens
{
  "screens": [...]
}
\`\`\`
`.trim();
}
function buildDatabaseDesignPrompt(storyMapping) {
  return `
# DB設計書の作成

あなたはTechLeadとして、以下のストーリーマッピングからDB設計を作成してください。

## ストーリーマッピング

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## タスク

以下の2つのファイルを作成してください：

### 1. er-diagram.md（Markdown + Mermaid）

必須セクション:
- ER図（Mermaid erDiagram）
- 各テーブルの詳細定義
- インデックス戦略
- マイグレーションSQL
- パフォーマンス最適化方針

### 2. schema.json（JSON構造化データ）

フォーマット:
\`\`\`json
{
  "version": "1.0.0",
  "database": "database_name",
  "tables": [
    {
      "name": "table_name",
      "comment": "説明",
      "columns": [
        {
          "name": "column_name",
          "type": "TYPE",
          "nullable": false,
          "primaryKey": false,
          "comment": "説明"
        }
      ],
      "indexes": [
        {
          "name": "index_name",
          "columns": ["col1", "col2"],
          "unique": false
        }
      ]
    }
  ],
  "relationships": [
    {
      "from": "table1",
      "to": "table2",
      "fromColumn": "col1",
      "toColumn": "col2",
      "type": "many-to-one"
    }
  ]
}
\`\`\`

## 重要な指針

- 既存のDB schemaを分析して統一性を保つ
- 正規化を適切に行う
- インデックスを適切に配置
- 外部キー制約を設定

## 出力形式

以下の形式で2つのファイルを出力してください：

\`\`\`markdown:er-diagram
# er-diagram.mdの内容
...
\`\`\`

\`\`\`json:schema
{
  "version": "1.0.0",
  ...
}
\`\`\`
`.trim();
}
function buildAPIDesignPrompt(storyMapping, dbSchema) {
  const dbSchemaStr = dbSchema ? JSON.stringify(dbSchema, null, 2) : "N/A";
  return `
# API設計書の作成

あなたはTechLeadとして、以下のストーリーマッピングとDB設計からAPI仕様を作成してください。

## ストーリーマッピング

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## DB Schema

\`\`\`json
${dbSchemaStr}
\`\`\`

## タスク

以下の2つのファイルを作成してください：

### 1. api-spec.md（Markdown）

必須セクション:
- API一覧表
- 各エンドポイントの詳細（リクエスト、レスポンス、エラー）
- データモデル
- エラーコード

### 2. api-spec.json（OpenAPI 3.0）

OpenAPI 3.0準拠のJSON schemaを作成してください。

## 重要な指針

- RESTful設計原則に従う
- 認証・認可を考慮
- エラーハンドリングを明確に
- バリデーションルールを定義

## 出力形式

以下の形式で2つのファイルを出力してください：

\`\`\`markdown:api-spec
# api-spec.mdの内容
...
\`\`\`

\`\`\`json:api-spec
{
  "openapi": "3.0.0",
  ...
}
\`\`\`
`.trim();
}
function extractMarkdownSection(response, sectionName) {
  const regex = new RegExp(`\`\`\`markdown:${sectionName}\\s*([\\s\\S]*?)\\s*\`\`\``, "m");
  const match = response.match(regex);
  return match ? match[1].trim() : null;
}
function extractJSONSection(response, sectionName) {
  const regex = new RegExp(`\`\`\`json:${sectionName}\\s*([\\s\\S]*?)\\s*\`\`\``, "m");
  const match = response.match(regex);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[1].trim());
  } catch (error) {
    console.error(`❌ ${sectionName} JSONパースエラー:`, error);
    return null;
  }
}
async function reviewDesignNode(state) {
  const { config, currentProjectId } = state;
  console.log("🔍 DesignReview: 設計書レビュー開始（3者協調）");
  if (!currentProjectId) {
    console.log("⚠️ プロジェクトIDが指定されていません");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "warn",
          source: "design_review",
          message: "プロジェクトIDなし"
        }
      ]
    };
  }
  const persistence = new DataPersistence(config.baseRepoPath);
  await persistence.initialize();
  const designDocsMarkdown = await loadDesignDocument(
    persistence,
    currentProjectId,
    "design-docs.md"
  );
  const wireframesMarkdown = await loadDesignDocument(
    persistence,
    currentProjectId,
    "wireframes.md"
  );
  const erDiagramMarkdown = await loadDesignDocument(
    persistence,
    currentProjectId,
    "er-diagram.md"
  );
  const apiSpecMarkdown = await loadDesignDocument(
    persistence,
    currentProjectId,
    "api-spec.md"
  );
  if (!designDocsMarkdown && !wireframesMarkdown && !erDiagramMarkdown && !apiSpecMarkdown) {
    console.log("⚠️ 設計書が見つかりません");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "warn",
          source: "design_review",
          message: "設計書なし"
        }
      ]
    };
  }
  console.log("📖 設計書読み込み完了");
  const reviewHistory = await persistence.loadDesignReviewHistory(currentProjectId);
  const iteration = (reviewHistory.reviews?.length || 0) + 1;
  console.log(`🔄 レビュー回数: ${iteration}回目`);
  const providerConfig = {
    provider: config.provider || "claude",
    claude: {
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929"
    }
  };
  const provider = AIProviderFactory.create(providerConfig);
  const storyMapping = await persistence.loadStoryMapping(currentProjectId);
  console.log("🤖 AI: DirectorAIレビュー実行中...");
  const directorReview = await executeReview(
    provider,
    "DirectorAI",
    {
      designDocsMarkdown,
      wireframesMarkdown,
      erDiagramMarkdown,
      apiSpecMarkdown
    },
    storyMapping,
    config.baseRepoPath
  );
  console.log("🤖 AI: ProductOwnerAIレビュー実行中...");
  const productOwnerReview = await executeReview(
    provider,
    "ProductOwnerAI",
    {
      designDocsMarkdown,
      wireframesMarkdown,
      erDiagramMarkdown,
      apiSpecMarkdown
    },
    storyMapping,
    config.baseRepoPath
  );
  console.log("🤖 AI: TechLeadAIレビュー実行中...");
  const techLeadReview = await executeReview(
    provider,
    "TechLeadAI",
    {
      designDocsMarkdown,
      wireframesMarkdown,
      erDiagramMarkdown,
      apiSpecMarkdown
    },
    storyMapping,
    config.baseRepoPath
  );
  const consolidatedResult = consolidateReviews(
    directorReview,
    productOwnerReview,
    techLeadReview
  );
  console.log(`📋 統合レビュー結果: ${consolidatedResult.approved ? "承認" : "修正必要"}`);
  console.log(`🔴 Critical: ${consolidatedResult.criticalIssues.length}件`);
  console.log(`🟠 Major: ${consolidatedResult.majorIssues.length}件`);
  const newReview = {
    iteration,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    approved: consolidatedResult.approved,
    reviewers: consolidatedResult.reviewerResults.map((r) => ({
      name: r.reviewer,
      approved: r.approved,
      issuesCount: r.issues.length
    })),
    criticalIssues: consolidatedResult.criticalIssues,
    majorIssues: consolidatedResult.majorIssues,
    suggestions: consolidatedResult.suggestions,
    overallAssessment: consolidatedResult.overallAssessment
  };
  const updatedHistory = {
    reviews: [...reviewHistory.reviews || [], newReview]
  };
  await persistence.saveDesignReviewHistory(currentProjectId, updatedHistory);
  console.log("💾 レビュー履歴を保存しました");
  if (consolidatedResult.approved) {
    console.log("✅ 設計書承認 → タスク分解フェーズへ");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "success",
          source: "design_review",
          message: "設計書承認（3者協調レビュー完了）"
        }
      ]
    };
  } else {
    console.log("⚠️ 修正が必要です");
    console.log("📝 主な指摘事項:");
    consolidatedResult.criticalIssues.slice(0, 3).forEach((issue) => {
      console.log(`  - [${issue.severity}] ${issue.message}`);
    });
    return {
      reviewFeedback: {
        issues: [
          ...consolidatedResult.criticalIssues,
          ...consolidatedResult.majorIssues
        ],
        suggestions: consolidatedResult.suggestions
      },
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "warn",
          source: "design_review",
          message: `修正必要: Critical ${consolidatedResult.criticalIssues.length}件、Major ${consolidatedResult.majorIssues.length}件`
        }
      ]
    };
  }
}
async function loadDesignDocument(persistence, projectId, documentName) {
  try {
    const fs2 = await import("fs/promises");
    const path2 = await import("path");
    const baseDir = persistence.projectsDir;
    let filePath;
    switch (documentName) {
      case "design-docs.md":
        filePath = path2.join(baseDir, projectId, "design", "design-docs.md");
        break;
      case "wireframes.md":
        filePath = path2.join(baseDir, projectId, "design", "uiux", "wireframes.md");
        break;
      case "er-diagram.md":
        filePath = path2.join(baseDir, projectId, "design", "database", "er-diagram.md");
        break;
      case "api-spec.md":
        filePath = path2.join(baseDir, projectId, "design", "interfaces", "api-spec.md");
        break;
      default:
        console.warn(`⚠️ 不明な設計書: ${documentName}`);
        return null;
    }
    const content = await fs2.readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    console.warn(`⚠️ ${documentName}の読み込みに失敗:`, error);
    return null;
  }
}
async function executeReview(provider, reviewer, designDocs, storyMapping, cwd) {
  const prompt = buildReviewPrompt(reviewer, designDocs, storyMapping);
  let aiResponseText = "";
  for await (const message of provider.execute(prompt, {
    maxTurns: 10,
    cwd,
    allowedTools: ["Read", "Glob"],
    permissionMode: "acceptEdits"
  })) {
    if (message.type === "assistant" && message.content) {
      if (typeof message.content === "string") {
        aiResponseText += message.content;
      } else {
        aiResponseText += JSON.stringify(message.content);
      }
    }
  }
  return extractReviewerResult(reviewer, aiResponseText);
}
function buildReviewPrompt(reviewer, designDocs, storyMapping) {
  const basePrompt = `
# 設計書レビュー（${reviewer}視点）

あなたは${reviewer}として、以下の設計書をレビューしてください。

## ストーリーマッピング（参照）

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## 設計書

### 全体設計

${designDocs.designDocsMarkdown || "なし"}

### UI/UX設計

${designDocs.wireframesMarkdown || "なし"}

### DB設計

${designDocs.erDiagramMarkdown || "なし"}

### API設計

${designDocs.apiSpecMarkdown || "なし"}
`;
  let specificGuidance = "";
  if (reviewer === "DirectorAI") {
    specificGuidance = `
## レビュー観点（DirectorAI）

1. **プロジェクト全体の整合性**
   - ストーリーマッピングのゴールを実現できるか
   - Epicとの整合性があるか

2. **ビジネス価値の実現**
   - ペルソナのペインポイントを解決できるか
   - ROIが高いか

3. **全体設計の妥当性**
   - アーキテクチャは適切か
   - 技術スタックの選定は妥当か
`;
  } else if (reviewer === "ProductOwnerAI") {
    specificGuidance = `
## レビュー観点（ProductOwnerAI）

1. **ユーザーストーリーとの整合性**
   - すべてのストーリーが実現可能か
   - 「As a / I want to / So that」が満たされるか

2. **受入基準の実現可能性**
   - 各ストーリーの受入基準が実装可能か
   - 測定可能か

3. **ユーザー体験**
   - UI/UX設計がユーザーフレンドリーか
   - 画面遷移が自然か
`;
  } else {
    specificGuidance = `
## レビュー観点（TechLeadAI）

1. **技術的実装可能性**
   - 設計が実装可能か
   - 技術的リスクはないか

2. **アーキテクチャの妥当性**
   - レイヤー分離が適切か
   - スケーラビリティがあるか

3. **設計の品質**
   - DB正規化は適切か
   - API設計はRESTfulか
   - セキュリティは考慮されているか
`;
  }
  return `
${basePrompt}
${specificGuidance}

## 出力形式

JSON形式で以下を出力してください：

\`\`\`json
{
  "approved": true または false,
  "issues": [
    {
      "severity": "critical" | "major" | "minor" | "info",
      "category": "カテゴリ名",
      "message": "指摘内容",
      "document": "design-docs" | "uiux" | "database" | "api"
    }
  ],
  "comments": [
    "コメント1",
    "コメント2"
  ]
}
\`\`\`

## 判定基準

- **critical な問題が0件**: 承認 (approved: true)
- **critical な問題が1件以上**: 修正必要 (approved: false)
`.trim();
}
function extractReviewerResult(reviewer, response) {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  let parsedResult;
  if (jsonMatch) {
    try {
      parsedResult = JSON.parse(jsonMatch[1]);
    } catch (error) {
      console.error(`❌ ${reviewer} レビュー結果のパースエラー:`, error);
      parsedResult = {
        approved: false,
        issues: [
          {
            severity: "critical",
            category: "parse_error",
            message: `${reviewer}のレスポンスパースに失敗`
          }
        ],
        comments: []
      };
    }
  } else {
    parsedResult = {
      approved: false,
      issues: [
        {
          severity: "critical",
          category: "format_error",
          message: `${reviewer}のレスポンスが不正な形式`
        }
      ],
      comments: []
    };
  }
  return {
    reviewer,
    approved: parsedResult.approved || false,
    issues: parsedResult.issues || [],
    comments: parsedResult.comments || []
  };
}
function consolidateReviews(directorReview, productOwnerReview, techLeadReview) {
  const allReviewers = [directorReview, productOwnerReview, techLeadReview];
  const allIssues = allReviewers.flatMap((r) => r.issues);
  const criticalIssues = allIssues.filter((issue) => issue.severity === "critical");
  const majorIssues = allIssues.filter((issue) => issue.severity === "major");
  const approved = allReviewers.every((r) => r.approved) && criticalIssues.length === 0;
  const suggestions = allReviewers.flatMap((r) => r.comments);
  const overallAssessment = buildOverallAssessment(
    allReviewers,
    criticalIssues,
    majorIssues
  );
  return {
    approved,
    reviewerResults: allReviewers,
    overallAssessment,
    criticalIssues,
    majorIssues,
    suggestions
  };
}
function buildOverallAssessment(reviewers, criticalIssues, majorIssues) {
  const approvedCount = reviewers.filter((r) => r.approved).length;
  const totalCount = reviewers.length;
  if (approvedCount === totalCount && criticalIssues.length === 0) {
    return `3者全員が承認。設計書は十分な品質です。`;
  } else {
    const criticalCount = criticalIssues.length;
    const majorCount = majorIssues.length;
    return `修正が必要です（承認: ${approvedCount}/${totalCount}、Critical: ${criticalCount}件、Major: ${majorCount}件）。指摘事項を確認し、設計書を修正してください。`;
  }
}
async function taskBreakdownNode(state) {
  const { config, currentProjectId } = state;
  console.log("📋 TaskBreakdown: タスク分解開始");
  if (!currentProjectId) {
    console.log("⚠️ プロジェクトIDが指定されていません");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "warn",
          source: "task_breakdown",
          message: "プロジェクトIDなし"
        }
      ]
    };
  }
  const persistence = new DataPersistence(config.baseRepoPath);
  await persistence.initialize();
  const storyMapping = await persistence.loadStoryMapping(currentProjectId);
  if (!storyMapping) {
    console.log("⚠️ ストーリーマッピングが見つかりません");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "warn",
          source: "task_breakdown",
          message: "ストーリーマッピングなし"
        }
      ]
    };
  }
  const dbSchema = await persistence.loadDatabaseSchema(currentProjectId);
  const apiSpec = await persistence.loadAPISpec(currentProjectId);
  const uiuxScreens = await persistence.loadUIUXScreens(currentProjectId);
  console.log("📖 設計書読み込み完了");
  const providerConfig = {
    provider: config.provider || "claude",
    claude: {
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929"
    }
  };
  const provider = AIProviderFactory.create(providerConfig);
  console.log("🤖 AI: タスク分解実行中...");
  const taskBreakdownPrompt = buildTaskBreakdownPrompt(
    storyMapping,
    dbSchema,
    apiSpec,
    uiuxScreens
  );
  let aiResponseText = "";
  for await (const message of provider.execute(taskBreakdownPrompt, {
    maxTurns: 30,
    cwd: config.baseRepoPath,
    allowedTools: ["Read", "Glob", "Grep"],
    permissionMode: "acceptEdits"
  })) {
    if (message.type === "assistant" && message.content) {
      if (typeof message.content === "string") {
        aiResponseText += message.content;
      } else {
        aiResponseText += JSON.stringify(message.content);
      }
    }
  }
  const taskList = extractTaskList(aiResponseText);
  if (!taskList || taskList.length === 0) {
    console.log("❌ タスク分解に失敗しました");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "error",
          source: "task_breakdown",
          message: "タスク分解失敗"
        }
      ]
    };
  }
  console.log(`✅ タスク分解完了: ${taskList.length}個のタスク`);
  const dependencyGraph = buildDependencyGraph(taskList);
  console.log(`📊 依存関係分析完了: ${dependencyGraph.edges.length}個の依存関係`);
  const kanbanState = buildInitialKanbanState(taskList);
  await persistence.saveTaskList(currentProjectId, taskList);
  await persistence.saveDependencyGraph(currentProjectId, dependencyGraph);
  await persistence.saveKanbanState(currentProjectId, kanbanState);
  console.log("💾 タスク情報を保存しました");
  console.log("\n📊 タスク分解サマリー:");
  console.log(`  - タスク総数: ${taskList.length}個`);
  console.log(`  - 依存関係: ${dependencyGraph.edges.length}個`);
  console.log(`  - 並列実行可能グループ: ${dependencyGraph.parallelGroups.length}個`);
  console.log(`  - クリティカルパス長: ${dependencyGraph.criticalPath.length}タスク`);
  const globalTasks = taskList.map((task) => {
    let globalTaskType;
    switch (task.type) {
      case "bug":
        globalTaskType = "bugfix";
        break;
      case "doc":
        globalTaskType = "docs";
        break;
      case "feature":
      case "refactor":
      case "test":
        globalTaskType = task.type;
        break;
      default:
        globalTaskType = "feature";
    }
    let globalTaskStatus;
    switch (task.status) {
      case "ready":
        globalTaskStatus = "pending";
        break;
      case "in_review":
        globalTaskStatus = "in_progress";
        break;
      case "pending":
      case "in_progress":
      case "completed":
      case "failed":
        globalTaskStatus = task.status;
        break;
      default:
        globalTaskStatus = "pending";
    }
    return {
      id: task.id,
      type: globalTaskType,
      title: task.title,
      description: task.description,
      priority: task.priority,
      dependencies: task.dependencies,
      status: globalTaskStatus,
      projectId: currentProjectId,
      requestTimestamp: /* @__PURE__ */ new Date(),
      dynamicPriority: task.priority * 10,
      // Convert 0-100 to 0-1000
      createdAt: new Date(task.createdAt),
      storyId: task.storyId
    };
  });
  return {
    globalTasks,
    dependencyGraph,
    logs: [
      {
        timestamp: /* @__PURE__ */ new Date(),
        level: "success",
        source: "task_breakdown",
        message: `タスク分解完了（${taskList.length}タスク、${dependencyGraph.edges.length}依存関係）`
      }
    ]
  };
}
function buildTaskBreakdownPrompt(storyMapping, dbSchema, apiSpec, uiuxScreens) {
  const dbSchemaStr = dbSchema ? JSON.stringify(dbSchema, null, 2) : "なし";
  const apiSpecStr = apiSpec ? JSON.stringify(apiSpec, null, 2) : "なし";
  const uiuxScreensStr = uiuxScreens ? JSON.stringify(uiuxScreens, null, 2) : "なし";
  return `
# タスク分解

あなたはTechLeadとして、以下の設計書から実装可能なタスクに分解してください。

## ストーリーマッピング

\`\`\`json
${JSON.stringify(storyMapping, null, 2)}
\`\`\`

## DB Schema

\`\`\`json
${dbSchemaStr}
\`\`\`

## API Specification

\`\`\`json
${apiSpecStr}
\`\`\`

## UI/UX Screens

\`\`\`json
${uiuxScreensStr}
\`\`\`

## タスク分解の原則

1. **マイクロ一気通関**: 1タスクでフロントエンド〜バックエンド〜DBまで完結
2. **適切な粒度**: 1タスクは4-8時間で完了可能
3. **独立価値提供**: 各タスクが独立したユーザー価値を提供
4. **真の依存関係**: 技術的に真に必要な依存関係のみ設定
5. **並列最大化**: 可能な限り並列実行できるよう設計

## タスク分解戦略

### フルスタックタスクの例

❌ **悪い例（レイヤー分割）**:
- Task 1: DB migration作成
- Task 2: Model実装
- Task 3: API実装
- Task 4: Frontend実装

✅ **良い例（機能単位のフルスタック）**:
- Task 1: ユーザー登録機能（DB migration + Model + API + Frontend）

### 依存関係の設定

**真の依存関係**（設定すべき）:
- 「管理者ログイン機能」→「管理者ダッシュボード」
- 「認証基盤」→「権限管理」

**偽の依存関係**（設定すべきでない）:
- 「ユーザー登録」→「商品一覧」（独立して実装可能）
- 「DB migration」→「API実装」（同一タスク内で完結すべき）

## 出力形式

JSON形式で以下の構造で出力してください：

\`\`\`json
{
  "tasks": [
    {
      "id": "task-{uuid}",
      "title": "タスク名",
      "description": "詳細な説明（何を実装するか、どのように実装するか）",
      "storyId": "story-1-1",
      "type": "feature",
      "priority": 90,
      "estimatedPoints": 5,
      "dependencies": ["task-{uuid}"],
      "acceptanceCriteria": [
        "基準1",
        "基準2"
      ],
      "technicalNotes": "技術的な注意点",
      "status": "pending"
    }
  ]
}
\`\`\`

## 重要事項

- 各タスクは必ず \`id\`, \`title\`, \`description\`, \`type\`, \`priority\`, \`estimatedPoints\`, \`dependencies\`, \`acceptanceCriteria\`, \`status\` を含むこと
- \`id\` は "task-" で始まる一意な識別子
- \`type\` は "feature", "bug", "refactor", "test", "doc" のいずれか
- \`priority\` は 0-100 の整数
- \`estimatedPoints\` は フィボナッチ数（1,2,3,5,8,13,21）
- \`dependencies\` は依存タスクIDの配列（依存なしの場合は空配列）
- \`status\` は "pending"
- \`storyId\` は対応するユーザーストーリーのID（該当する場合）

## タスク生成

ストーリーマッピングの各Epicとストーリーを参照し、実装に必要なタスクを生成してください。
`.trim();
}
function extractTaskList(response) {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    console.error("❌ JSONブロックが見つかりません");
    return [];
  }
  try {
    const parsed = JSON.parse(jsonMatch[1]);
    const tasks = parsed.tasks || [];
    return tasks.map((task) => ({
      id: task.id || `task-${randomUUID()}`,
      title: task.title || "無題タスク",
      description: task.description || "",
      storyId: task.storyId || void 0,
      type: task.type || "feature",
      priority: task.priority || 50,
      estimatedPoints: task.estimatedPoints || 5,
      dependencies: task.dependencies || [],
      acceptanceCriteria: task.acceptanceCriteria || [],
      technicalNotes: task.technicalNotes || void 0,
      assignedTo: task.assignedTo || void 0,
      status: task.status || "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }));
  } catch (error) {
    console.error("❌ JSONパースエラー:", error);
    return [];
  }
}
function buildDependencyGraph(tasks) {
  const nodes = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status
  }));
  const edges = [];
  tasks.forEach((task) => {
    task.dependencies.forEach((depId) => {
      edges.push({
        from: task.id,
        to: depId,
        type: "depends_on"
      });
    });
  });
  const criticalPath = calculateCriticalPath(tasks);
  const parallelGroups = calculateParallelGroups(tasks);
  return {
    nodes,
    edges,
    criticalPath,
    parallelGroups
  };
}
function calculateCriticalPath(tasks) {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const visited = /* @__PURE__ */ new Set();
  function dfs(taskId, currentPath) {
    if (visited.has(taskId)) {
      return currentPath;
    }
    visited.add(taskId);
    const task = taskMap.get(taskId);
    if (!task || task.dependencies.length === 0) {
      return [...currentPath, taskId];
    }
    let longestPath2 = currentPath;
    task.dependencies.forEach((depId) => {
      const depPath = dfs(depId, [...currentPath, taskId]);
      if (depPath.length > longestPath2.length) {
        longestPath2 = depPath;
      }
    });
    return longestPath2;
  }
  const dependedTasks = new Set(tasks.flatMap((t) => t.dependencies));
  const terminalTasks = tasks.filter((t) => !dependedTasks.has(t.id));
  let longestPath = [];
  terminalTasks.forEach((task) => {
    visited.clear();
    const path2 = dfs(task.id, []);
    if (path2.length > longestPath.length) {
      longestPath = path2;
    }
  });
  return longestPath.reverse();
}
function calculateParallelGroups(tasks) {
  new Map(tasks.map((t) => [t.id, t]));
  const groups = [];
  const processed = /* @__PURE__ */ new Set();
  while (processed.size < tasks.length) {
    const currentGroup = [];
    tasks.forEach((task) => {
      if (processed.has(task.id)) {
        return;
      }
      const allDepsProcessed = task.dependencies.every(
        (depId) => processed.has(depId)
      );
      if (allDepsProcessed) {
        currentGroup.push(task.id);
      }
    });
    if (currentGroup.length === 0) {
      const remaining = tasks.filter((t) => !processed.has(t.id));
      if (remaining.length > 0) {
        currentGroup.push(remaining[0].id);
      }
    }
    currentGroup.forEach((id) => processed.add(id));
    groups.push(currentGroup);
  }
  return groups;
}
function buildInitialKanbanState(tasks) {
  return {
    columns: [
      { id: "pending", name: "Pending", taskIds: tasks.map((t) => t.id) },
      { id: "ready", name: "Ready", taskIds: [] },
      { id: "in_progress", name: "In Progress", taskIds: [] },
      { id: "in_review", name: "In Review", taskIds: [] },
      { id: "completed", name: "Completed", taskIds: [] },
      { id: "failed", name: "Failed", taskIds: [] }
    ],
    tasks,
    metadata: {
      totalTasks: tasks.length,
      completedTasks: 0,
      inProgressTasks: 0,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    }
  };
}
function createParallelDevGraph() {
  const workflow = new StateGraph(ParallelDevState).addNode("product_owner", productOwnerNode).addNode("engineer_dispatch", engineerDispatchNode).addNode("engineer", async (state) => {
    const inProgressTasks = state.tasks.filter((t) => t.status === "in_progress");
    if (inProgressTasks.length === 0) {
      return {
        logs: [
          {
            timestamp: /* @__PURE__ */ new Date(),
            level: "info",
            source: "EngineerWrapper",
            message: "実行可能なタスクがありません"
          }
        ]
      };
    }
    console.log(`👷 ${inProgressTasks.length}個のタスクを並列実装中...`);
    const taskResults = await Promise.all(
      inProgressTasks.map((task) => engineerNode(state, task.id))
    );
    const results = {
      tasks: [],
      completedTasks: [],
      failedTasks: [],
      logs: [],
      metadata: {}
    };
    for (const result of taskResults) {
      if (result.tasks) results.tasks.push(...result.tasks);
      if (result.completedTasks) results.completedTasks.push(...result.completedTasks);
      if (result.failedTasks) results.failedTasks.push(...result.failedTasks);
      if (result.logs) results.logs.push(...result.logs);
      if (result.metadata) results.metadata = { ...results.metadata, ...result.metadata };
    }
    return results;
  }).addNode("review", async (state) => {
    const completedTasks = state.tasks.filter(
      (t) => t.status === "completed" && !state.reviews.some((r) => r.taskId === t.id)
    );
    if (completedTasks.length === 0) {
      return {
        logs: [
          {
            timestamp: /* @__PURE__ */ new Date(),
            level: "info",
            source: "ReviewWrapper",
            message: "レビュー対象のタスクがありません"
          }
        ]
      };
    }
    console.log(`🔍 ${completedTasks.length}個のタスクを並列レビュー中...`);
    const reviewResults = await Promise.all(
      completedTasks.map((task) => reviewNode(state, task.id))
    );
    const results = {
      reviews: [],
      logs: []
    };
    for (const result of reviewResults) {
      if (result.reviews) results.reviews.push(...result.reviews);
      if (result.logs) results.logs.push(...result.logs);
    }
    return results;
  }).addNode("merge_coordinator", mergeCoordinatorNode).addNode("conflict_resolver", conflictResolverNode).addNode("check_completion", (state) => {
    const allTasksSettled = state.tasks.every(
      (t) => t.status === "completed" || t.status === "failed"
    );
    const pendingTasks = state.tasks.filter((t) => t.status === "pending");
    const inProgressTasks = state.tasks.filter((t) => t.status === "in_progress");
    const completedTasks = state.tasks.filter((t) => t.status === "completed");
    const failedTasks = state.tasks.filter((t) => t.status === "failed");
    console.log("\n📊 ===== 進捗状況 =====");
    console.log(`   待機中: ${pendingTasks.length}`);
    console.log(`   実行中: ${inProgressTasks.length}`);
    console.log(`   完了: ${completedTasks.length}`);
    console.log(`   失敗: ${failedTasks.length}`);
    console.log("========================\n");
    return {
      logs: [
        {
          timestamp: /* @__PURE__ */ new Date(),
          level: "info",
          source: "check_completion",
          message: allTasksSettled ? "全タスク完了" : `進行中: 待機${pendingTasks.length}件、実行中${inProgressTasks.length}件、完了${completedTasks.length}件、失敗${failedTasks.length}件`,
          data: {
            pending: pendingTasks.length,
            inProgress: inProgressTasks.length,
            completed: completedTasks.length,
            failed: failedTasks.length
          }
        }
      ],
      metadata: {
        phase: allTasksSettled ? "complete" : state.metadata.phase,
        completedAt: allTasksSettled ? /* @__PURE__ */ new Date() : void 0
      }
    };
  });
  workflow.addEdge("__start__", "product_owner");
  workflow.addEdge("product_owner", "engineer_dispatch");
  workflow.addConditionalEdges(
    "engineer_dispatch",
    (state) => {
      const inProgressTasks = state.tasks.filter((t) => t.status === "in_progress");
      return inProgressTasks.length > 0 ? "has_tasks" : "no_tasks";
    },
    {
      has_tasks: "engineer",
      no_tasks: "check_completion"
    }
  );
  workflow.addEdge("engineer", "review");
  workflow.addEdge("review", "merge_coordinator");
  workflow.addConditionalEdges(
    "merge_coordinator",
    (state) => {
      const conflicts = state.mergeQueue.filter((m) => m.status === "conflict");
      if (conflicts.length > 0) {
        return "has_conflicts";
      }
      const pendingTasks = state.tasks.filter((t) => t.status === "pending");
      return pendingTasks.length > 0 ? "has_pending" : "no_pending";
    },
    {
      has_conflicts: "conflict_resolver",
      has_pending: "engineer_dispatch",
      no_pending: "check_completion"
    }
  );
  workflow.addEdge("conflict_resolver", "merge_coordinator");
  workflow.addConditionalEdges(
    "check_completion",
    (state) => {
      const allTasksSettled = state.tasks.every(
        (t) => t.status === "completed" || t.status === "failed"
      );
      return allTasksSettled ? "done" : "continue";
    },
    {
      done: "__end__",
      continue: "engineer_dispatch"
    }
  );
  return workflow;
}
function compileParallelDevGraph() {
  const workflow = createParallelDevGraph();
  return workflow.compile();
}
function createSprintDrivenGraph() {
  const workflow = new StateGraph(ParallelDevState).addNode("check_mode", checkModeNode).addNode("product_owner", productOwnerNode).addNode("sprint_planning", sprintPlanningNode).addNode("engineer_dispatch", engineerDispatchNode).addNode("engineer", async (state) => {
    const inProgressTasks = state.tasks.filter((t) => t.status === "in_progress");
    if (inProgressTasks.length === 0) {
      return {
        logs: [
          {
            timestamp: /* @__PURE__ */ new Date(),
            level: "info",
            source: "EngineerWrapper",
            message: "実行可能なタスクがありません"
          }
        ]
      };
    }
    console.log(`👷 ${inProgressTasks.length}個のタスクを並列実装中...`);
    const taskResults = await Promise.all(
      inProgressTasks.map((task) => engineerNode(state, task.id))
    );
    const results = {
      tasks: [],
      completedTasks: [],
      failedTasks: [],
      logs: [],
      metadata: {}
    };
    for (const result of taskResults) {
      if (result.tasks) results.tasks.push(...result.tasks);
      if (result.completedTasks) results.completedTasks.push(...result.completedTasks);
      if (result.failedTasks) results.failedTasks.push(...result.failedTasks);
      if (result.logs) results.logs.push(...result.logs);
      if (result.metadata) results.metadata = { ...results.metadata, ...result.metadata };
    }
    return results;
  }).addNode("review", async (state) => {
    const completedTasks = state.tasks.filter(
      (t) => t.status === "completed" && !state.reviews.some((r) => r.taskId === t.id)
    );
    if (completedTasks.length === 0) {
      return {
        logs: [
          {
            timestamp: /* @__PURE__ */ new Date(),
            level: "info",
            source: "ReviewWrapper",
            message: "レビュー対象のタスクがありません"
          }
        ]
      };
    }
    console.log(`🔍 ${completedTasks.length}個のタスクを並列レビュー中...`);
    const reviewResults = await Promise.all(
      completedTasks.map((task) => reviewNode(state, task.id))
    );
    const results = {
      reviews: [],
      logs: []
    };
    for (const result of reviewResults) {
      if (result.reviews) results.reviews.push(...result.reviews);
      if (result.logs) results.logs.push(...result.logs);
    }
    return results;
  }).addNode("merge_coordinator", mergeCoordinatorNode).addNode("conflict_resolver", conflictResolverNode).addNode("sprint_review", sprintReviewNode);
  workflow.addEdge("__start__", "check_mode");
  workflow.addConditionalEdges(
    "check_mode",
    checkModeRouter,
    {
      product_owner: "product_owner",
      sprint_planning: "sprint_planning"
    }
  );
  workflow.addEdge("product_owner", "sprint_planning");
  workflow.addConditionalEdges(
    "sprint_planning",
    sprintPlanningRouter,
    {
      engineer_dispatch: "engineer_dispatch",
      END: "__end__"
    }
  );
  workflow.addConditionalEdges(
    "engineer_dispatch",
    (state) => {
      const inProgressTasks = state.tasks.filter((t) => t.status === "in_progress");
      return inProgressTasks.length > 0 ? "has_tasks" : "no_tasks";
    },
    {
      has_tasks: "engineer",
      no_tasks: "sprint_review"
    }
  );
  workflow.addEdge("engineer", "review");
  workflow.addEdge("review", "merge_coordinator");
  workflow.addConditionalEdges(
    "merge_coordinator",
    (state) => {
      const conflicts = state.mergeQueue.filter((m) => m.status === "conflict");
      if (conflicts.length > 0) {
        return "has_conflicts";
      }
      const pendingTasks = state.tasks.filter((t) => t.status === "pending");
      return pendingTasks.length > 0 ? "has_pending" : "review_sprint";
    },
    {
      has_conflicts: "conflict_resolver",
      has_pending: "engineer_dispatch",
      review_sprint: "sprint_review"
    }
  );
  workflow.addEdge("conflict_resolver", "merge_coordinator");
  workflow.addConditionalEdges(
    "sprint_review",
    sprintReviewRouter,
    {
      sprint_planning: "sprint_planning",
      engineer_dispatch: "engineer_dispatch",
      END: "__end__"
    }
  );
  return workflow;
}
function compileSprintDrivenGraph() {
  const workflow = createSprintDrivenGraph();
  return workflow.compile();
}
function createScrumDevGraph() {
  const workflow = new StateGraph(ParallelDevState).addNode("director_ai", directorNode).addNode("review_story_mapping", reviewStoryMappingNode).addNode("tech_lead_design", techLeadDesignNode).addNode("review_design", reviewDesignNode).addNode("task_breakdown", taskBreakdownNode).addNode("engineer_dispatch", engineerDispatchNode).addNode("engineer", async (state) => {
    const inProgressTasks = state.tasks.filter((t) => t.status === "in_progress");
    if (inProgressTasks.length === 0) {
      return {
        logs: [
          {
            timestamp: /* @__PURE__ */ new Date(),
            level: "info",
            source: "EngineerWrapper",
            message: "実行可能なタスクがありません"
          }
        ]
      };
    }
    console.log(`👷 ${inProgressTasks.length}個のタスクを並列実装中...`);
    const taskResults = await Promise.all(
      inProgressTasks.map((task) => engineerNode(state, task.id))
    );
    const results = {
      tasks: [],
      completedTasks: [],
      failedTasks: [],
      logs: [],
      metadata: {}
    };
    for (const result of taskResults) {
      if (result.tasks) results.tasks.push(...result.tasks);
      if (result.completedTasks) results.completedTasks.push(...result.completedTasks);
      if (result.failedTasks) results.failedTasks.push(...result.failedTasks);
      if (result.logs) results.logs.push(...result.logs);
      if (result.metadata) results.metadata = { ...results.metadata, ...result.metadata };
    }
    return results;
  }).addNode("review", async (state) => {
    const completedTasks = state.tasks.filter(
      (t) => t.status === "completed" && !state.reviews.some((r) => r.taskId === t.id)
    );
    if (completedTasks.length === 0) {
      return {
        logs: [
          {
            timestamp: /* @__PURE__ */ new Date(),
            level: "info",
            source: "ReviewWrapper",
            message: "レビュー対象のタスクがありません"
          }
        ]
      };
    }
    console.log(`🔍 ${completedTasks.length}個のタスクを並列レビュー中...`);
    const reviewResults = await Promise.all(
      completedTasks.map((task) => reviewNode(state, task.id))
    );
    const results = {
      reviews: [],
      logs: []
    };
    for (const result of reviewResults) {
      if (result.reviews) results.reviews.push(...result.reviews);
      if (result.logs) results.logs.push(...result.logs);
    }
    return results;
  }).addNode("merge_coordinator", mergeCoordinatorNode).addNode("conflict_resolver", conflictResolverNode);
  workflow.addEdge("__start__", "director_ai");
  workflow.addEdge("director_ai", "review_story_mapping");
  workflow.addConditionalEdges(
    "review_story_mapping",
    (state) => {
      if (state.storyMappingApproved) {
        return "approved";
      } else {
        return "revision_needed";
      }
    },
    {
      approved: "tech_lead_design",
      revision_needed: "director_ai"
      // Loop back for revision
    }
  );
  workflow.addEdge("tech_lead_design", "review_design");
  workflow.addConditionalEdges(
    "review_design",
    (state) => {
      if (!state.reviewFeedback || state.reviewFeedback.issues.length === 0) {
        return "approved";
      } else {
        const hasCriticalOrMajor = state.reviewFeedback.issues.some(
          (issue) => issue.severity === "critical" || issue.severity === "major"
        );
        return hasCriticalOrMajor ? "revision_needed" : "approved";
      }
    },
    {
      approved: "task_breakdown",
      revision_needed: "tech_lead_design"
      // Loop back for revision
    }
  );
  workflow.addEdge("task_breakdown", "engineer_dispatch");
  workflow.addEdge("engineer_dispatch", "engineer");
  workflow.addConditionalEdges(
    "engineer",
    (state) => {
      const hasInProgress = state.tasks.some((t) => t.status === "in_progress");
      const hasCompleted = state.tasks.some(
        (t) => t.status === "completed" && !state.reviews.some((r) => r.taskId === t.id)
      );
      if (hasCompleted) return "review";
      if (hasInProgress) return "engineer_dispatch";
      const allComplete = state.tasks.every(
        (t) => t.status === "completed" || t.status === "failed"
      );
      return allComplete ? "END" : "engineer_dispatch";
    },
    {
      review: "review",
      engineer_dispatch: "engineer_dispatch",
      END: "__end__"
    }
  );
  workflow.addEdge("review", "merge_coordinator");
  workflow.addConditionalEdges(
    "merge_coordinator",
    (state) => {
      const hasPending = state.tasks.some((t) => t.status === "pending");
      const hasConflicts = state.tasks.some((t) => t.isConflictResolution);
      if (hasConflicts) return "conflict_resolver";
      if (hasPending) return "engineer_dispatch";
      const allComplete = state.tasks.every(
        (t) => t.status === "completed" || t.status === "failed"
      );
      return allComplete ? "END" : "engineer_dispatch";
    },
    {
      conflict_resolver: "conflict_resolver",
      engineer_dispatch: "engineer_dispatch",
      END: "__end__"
    }
  );
  workflow.addEdge("conflict_resolver", "merge_coordinator");
  return workflow;
}
function compileScrumDevGraph() {
  const workflow = createScrumDevGraph();
  return workflow.compile();
}
class ParallelDevOrchestrator {
  window = null;
  stateStreamManager = null;
  constructor() {
    this.stateStreamManager = new StateStreamManager({
      bufferInterval: 50,
      maxEventsPerSecond: 20,
      maxBufferSize: 100,
      maxLogBuffer: 1e3
    });
  }
  /**
   * Set the Electron window
   */
  setWindow(window) {
    this.window = window;
    if (this.stateStreamManager) {
      this.stateStreamManager.setWindow(window);
    }
  }
  /**
   * Execute the parallel development workflow
   */
  async execute(orchestratorConfig) {
    const { userRequest, config, window, useSprintDriven, workflowType: explicitWorkflowType } = orchestratorConfig;
    if (window) {
      this.setWindow(window);
    }
    const workflowType = explicitWorkflowType || (useSprintDriven === false ? "parallel" : "sprint");
    const workflowNames = {
      parallel: "標準並列開発",
      sprint: "スプリント駆動開発",
      scrum: "スクラム開発フロー"
    };
    console.log("🚀 Parallel Development Orchestrator 起動");
    console.log(`📝 ユーザー要求: ${userRequest}`);
    console.log(`🔄 ワークフロー: ${workflowNames[workflowType]}`);
    let currentState = null;
    try {
      const initialState = createInitialState(userRequest, config);
      currentState = initialState;
      console.log("📊 LangGraphワークフローをコンパイル中...");
      const graph = workflowType === "scrum" ? compileScrumDevGraph() : workflowType === "sprint" ? compileSprintDrivenGraph() : compileParallelDevGraph();
      if (this.stateStreamManager) {
        await this.stateStreamManager.processStateUpdate(initialState);
      }
      console.log("▶️ ワークフロー実行開始");
      let finalState = initialState;
      const stream = await graph.stream(initialState);
      for await (const event of stream) {
        console.log(`📦 イベント受信:`, Object.keys(event));
        const nodeNames = Object.keys(event);
        for (const nodeName of nodeNames) {
          const stateUpdate = event[nodeName];
          finalState = {
            ...finalState,
            ...stateUpdate,
            // Merge arrays properly
            tasks: stateUpdate.tasks ? this.mergeTasks(finalState.tasks, stateUpdate.tasks) : finalState.tasks,
            completedTasks: stateUpdate.completedTasks ? [...finalState.completedTasks, ...stateUpdate.completedTasks] : finalState.completedTasks,
            failedTasks: stateUpdate.failedTasks ? [...finalState.failedTasks, ...stateUpdate.failedTasks] : finalState.failedTasks,
            reviews: stateUpdate.reviews ? [...finalState.reviews, ...stateUpdate.reviews] : finalState.reviews,
            mergeQueue: stateUpdate.mergeQueue ? this.mergeMergeQueue(finalState.mergeQueue, stateUpdate.mergeQueue) : finalState.mergeQueue,
            logs: stateUpdate.logs ? [...finalState.logs, ...stateUpdate.logs] : finalState.logs,
            worktrees: stateUpdate.worktrees ? new Map([...finalState.worktrees, ...stateUpdate.worktrees]) : finalState.worktrees,
            metadata: stateUpdate.metadata ? { ...finalState.metadata, ...stateUpdate.metadata } : finalState.metadata
          };
          currentState = finalState;
          if (this.stateStreamManager) {
            await this.stateStreamManager.processStateUpdate(finalState);
          }
          console.log(`✅ ノード完了: ${nodeName}`);
        }
      }
      console.log("🎉 ワークフロー実行完了");
      const completionState = {
        ...finalState,
        metadata: {
          ...finalState.metadata,
          phase: "complete",
          completedAt: /* @__PURE__ */ new Date()
        }
      };
      if (this.stateStreamManager) {
        await this.stateStreamManager.processStateUpdate(completionState);
      }
      return completionState;
    } catch (error) {
      console.error("❌ Orchestrator エラー:", error);
      if (this.stateStreamManager && currentState) {
        const errorState = {
          ...currentState,
          metadata: {
            ...currentState.metadata,
            hasErrors: true,
            errors: [error instanceof Error ? error.message : String(error)]
          }
        };
        await this.stateStreamManager.processStateUpdate(errorState);
      }
      throw error;
    }
  }
  /**
   * Merge tasks by ID
   */
  mergeTasks(existing, updates) {
    const taskMap = new Map(existing.map((t) => [t.id, t]));
    updates.forEach((t) => taskMap.set(t.id, t));
    return Array.from(taskMap.values());
  }
  /**
   * Merge merge queue by task ID
   */
  mergeMergeQueue(existing, updates) {
    const mergeMap = new Map(existing.map((m) => [m.taskId, m]));
    updates.forEach((m) => mergeMap.set(m.taskId, m));
    return Array.from(mergeMap.values());
  }
  /**
   * Cleanup and destroy StateStreamManager
   */
  destroy() {
    if (this.stateStreamManager) {
      this.stateStreamManager.destroy();
      this.stateStreamManager = null;
    }
  }
}
new ParallelDevOrchestrator();
let mainWindow = null;
let currentProjectPath = null;
let stateStreamManager = null;
let currentGraphState = null;
let orchestrator = null;
process.argv.includes("--devtools");
let originalCwd;
const cwdIndex = process.argv.indexOf("--original-cwd");
if (cwdIndex !== -1 && process.argv[cwdIndex + 1]) {
  originalCwd = process.argv[cwdIndex + 1];
  console.log("[Electron Main] Original working directory:", originalCwd);
}
function createWindow() {
  const preloadPath = path.join(__dirname, "../preload/index.mjs");
  console.log("[Electron Main] Preload script path:", preloadPath);
  console.log("[Electron Main] Preload script exists:", existsSync(preloadPath));
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1e3,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      webSecurity: false
    },
    title: "Multi-Engineer Parallel Development"
  });
  const rendererPath = path.join(__dirname, "../renderer/index.html");
  console.log("[Electron Main] Loading renderer from:", rendererPath);
  console.log("[Electron Main] Renderer exists:", existsSync(rendererPath));
  if (existsSync(rendererPath)) {
    mainWindow.loadFile(rendererPath);
  } else {
    console.error("[Electron Main] Renderer file not found! Run `npm run electron:build` first.");
    mainWindow.loadURL("data:text/html,<h1>Error: Renderer not built. Run `npm run electron:build`</h1>");
  }
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] [${level}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.once("did-finish-load", () => {
    console.log("[Electron Main] Renderer loaded successfully");
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.openDevTools();
      console.log("[Electron Main] DevTools opened");
    }
    if (process.send) {
      process.send({ type: "ready" });
      console.log("[Electron Main] Sent ready message to parent process");
    }
    setTimeout(() => {
      console.log("[Electron Main] Sending test message to renderer");
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("log-data", {
          engineerId: "system",
          level: "info",
          message: "🎉 Electron UI接続テスト成功！",
          component: "System",
          timestamp: /* @__PURE__ */ new Date()
        });
      }
    }, 500);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (stateStreamManager) {
      stateStreamManager.destroy();
      stateStreamManager = null;
    }
  });
  stateStreamManager = new StateStreamManager({
    bufferInterval: 50,
    maxEventsPerSecond: 20,
    maxBufferSize: 100,
    maxLogBuffer: 1e3
  });
  stateStreamManager.setWindow(mainWindow);
  console.log("[Electron Main] StateStreamManager initialized");
  createMenu();
}
function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open Project...",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            await openProject();
          }
        },
        {
          label: "Close Project",
          accelerator: "CmdOrCtrl+W",
          enabled: currentProjectPath !== null,
          click: () => {
            closeProject();
          }
        },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: "CmdOrCtrl+Q",
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Learn More",
          click: async () => {
            const { shell } = require2("electron");
            await shell.openExternal("https://github.com/titabash/kugutsu");
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
async function openProject() {
  if (!mainWindow) return;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select Project Directory",
    message: "Choose a Git repository to work with"
  });
  if (typeof result !== "object" || !("canceled" in result)) {
    return;
  }
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return;
  }
  const selectedPath = result.filePaths[0];
  const gitDir = path.join(selectedPath, ".git");
  if (!existsSync(gitDir)) {
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Invalid Project",
      message: "The selected directory is not a Git repository.",
      detail: "Please select a directory that contains a .git folder."
    });
    return;
  }
  const gitDirStat = statSync(gitDir);
  if (gitDirStat.isFile()) {
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Invalid Project",
      message: "Cannot open Git worktree or submodule.",
      detail: "Please select the main repository root directory."
    });
    return;
  }
  currentProjectPath = selectedPath;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("project-opened", {
      projectPath: currentProjectPath
    });
  }
  createMenu();
  console.log("[Electron Main] Project opened:", currentProjectPath);
}
function closeProject() {
  currentProjectPath = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("project-closed");
  }
  createMenu();
  console.log("[Electron Main] Project closed");
}
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
ipcMain.handle("log-message", async (event, data) => {
  console.log("Log from renderer:", data);
});
ipcMain.handle("update-layout", async (event, engineerCount) => {
  return { success: true, engineerCount };
});
ipcMain.handle("get-tasks", async (event) => {
  if (process.send) {
    return new Promise((resolve) => {
      const messageHandler = (message) => {
        if (message.type === "tasks-response") {
          process.removeListener("message", messageHandler);
          resolve(message.data);
        }
      };
      process.on("message", messageHandler);
      process.send({ type: "get-tasks" });
      setTimeout(() => {
        process.removeListener("message", messageHandler);
        resolve([]);
      }, 5e3);
    });
  }
  return [];
});
ipcMain.handle("get-task-overview", async (event) => {
  if (process.send) {
    return new Promise((resolve) => {
      const messageHandler = (message) => {
        if (message.type === "task-overview-response") {
          process.removeListener("message", messageHandler);
          resolve(message.data);
        }
      };
      process.on("message", messageHandler);
      process.send({ type: "get-task-overview" });
      setTimeout(() => {
        process.removeListener("message", messageHandler);
        resolve("");
      }, 5e3);
    });
  }
  return "";
});
ipcMain.handle("get-task-instruction", async (event, taskId) => {
  if (process.send) {
    return new Promise((resolve) => {
      const messageHandler = (message) => {
        if (message.type === "task-instruction-response" && message.taskId === taskId) {
          process.removeListener("message", messageHandler);
          resolve(message.data);
        }
      };
      process.on("message", messageHandler);
      process.send({ type: "get-task-instruction", taskId });
      setTimeout(() => {
        process.removeListener("message", messageHandler);
        resolve("");
      }, 5e3);
    });
  }
  return "";
});
ipcMain.handle("get-working-directory", async (event) => {
  return originalCwd || process.cwd();
});
ipcMain.handle("get-current-project-path", async (event) => {
  return currentProjectPath;
});
ipcMain.handle("open-project-dialog", async (event) => {
  await openProject();
  return currentProjectPath;
});
ipcMain.handle("pause-execution", async (event) => {
  try {
    if (process.send) {
      process.send({ type: "pause-execution" });
      return { success: true };
    }
    return { success: false, message: "No parent process available" };
  } catch (error) {
    console.error("[Electron Main] Failed to pause execution:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
});
ipcMain.handle("resume-execution", async (event) => {
  try {
    if (process.send) {
      process.send({ type: "resume-execution" });
      return { success: true };
    }
    return { success: false, message: "No parent process available" };
  } catch (error) {
    console.error("[Electron Main] Failed to resume execution:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
});
ipcMain.handle("cancel-execution", async (event) => {
  try {
    if (process.send) {
      process.send({ type: "cancel-execution" });
      return { success: true, message: "Execution cancelled" };
    }
    return { success: false, message: "No parent process available" };
  } catch (error) {
    console.error("[Electron Main] Failed to cancel execution:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
});
ipcMain.handle("get-graph-state", async (event) => {
  try {
    return currentGraphState;
  } catch (error) {
    console.error("[Electron Main] Failed to get graph state:", error);
    throw error;
  }
});
ipcMain.handle("get-task-details", async (event, taskId) => {
  try {
    if (!currentGraphState) {
      return null;
    }
    const task = currentGraphState.tasks.find((t) => t.id === taskId);
    return task || null;
  } catch (error) {
    console.error("[Electron Main] Failed to get task details:", error);
    return null;
  }
});
ipcMain.handle("log-error", async (event, { message, details }) => {
  console.error("[Renderer Error]", message, details);
});
ipcMain.handle("execute-prompt", async (event, { prompt, options }) => {
  console.log("[Electron Main] execute-prompt called:", { prompt, options });
  if (!currentProjectPath) {
    throw new Error("No project is currently opened");
  }
  const provider = options.provider || "mock";
  const maxEngineers = options.maxEngineers || 3;
  const maxTurns = options.maxTurns || 30;
  console.log("[Electron Main] Prompt execution requested:", {
    prompt,
    projectPath: currentProjectPath,
    provider,
    maxEngineers,
    maxTurns
  });
  if (mainWindow) {
    mainWindow.webContents.send("prompt-execution-started", {
      prompt,
      provider,
      maxEngineers,
      maxTurns
    });
  }
  try {
    if (!orchestrator) {
      orchestrator = new ParallelDevOrchestrator();
      orchestrator.setWindow(mainWindow);
      console.log("[Electron Main] Orchestrator initialized");
    }
    const config = {
      maxEngineers,
      maxTurns,
      baseBranch: "main",
      baseRepoPath: currentProjectPath,
      worktreeBasePath: path.join(currentProjectPath, "worktrees"),
      cleanup: false,
      // Don't cleanup worktrees for debugging
      provider
    };
    console.log("[Electron Main] Starting workflow execution...");
    orchestrator.execute({
      userRequest: prompt,
      config,
      window: mainWindow,
      workflowType: "parallel"
      // Use standard parallel workflow
    }).then((finalState) => {
      console.log("[Electron Main] Workflow completed successfully");
      console.log(`[Electron Main] Tasks completed: ${finalState.completedTasks.length}/${finalState.tasks.length}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("prompt-execution-completed", {
          success: true,
          tasksCompleted: finalState.completedTasks.length,
          tasksTotal: finalState.tasks.length
        });
      }
    }).catch((error) => {
      console.error("[Electron Main] Workflow execution failed:", error);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("prompt-execution-failed", {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    return {
      success: true,
      message: `Workflow execution started with ${provider} provider`
    };
  } catch (error) {
    console.error("[Electron Main] Failed to start workflow:", error);
    throw error;
  }
});
if (process.send) {
  console.log("[Electron Main] IPC communication enabled");
  process.on("message", (message) => {
    if (!message || !message.type) return;
    switch (message.type) {
      case "graph-state-update":
        if (stateStreamManager && message.data) {
          currentGraphState = message.data;
          stateStreamManager.processStateUpdate(message.data).catch((error) => {
            console.error("[Electron Main] Failed to process state update:", error);
          });
        }
        break;
      case "log":
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("log-data", message.data);
        }
        break;
      case "structured-log":
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("structured-log-data", message.data);
        }
        break;
      case "update-engineer-count":
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("layout-update", message.data);
        }
        break;
      case "update-task-status":
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("task-status-update", message.data);
        }
        break;
      case "associate-techlead-engineer":
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("associate-techlead-engineer", message.data);
        }
        break;
      case "all-tasks-completed":
        console.log("[Electron Main] Received all-tasks-completed message:", message.data);
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log("[Electron Main] Sending all-tasks-completed to renderer...");
          mainWindow.webContents.send("all-tasks-completed", message.data);
          console.log("[Electron Main] all-tasks-completed sent to renderer successfully");
        } else {
          console.warn("[Electron Main] Cannot send to renderer - window not available");
        }
        break;
      case "tasks-updated":
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("tasks-updated", message.data);
        }
        break;
      case "task-overview-updated":
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("task-overview-updated", message.data);
        }
        break;
      case "set-current-project-id":
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("set-current-project-id", message.data);
        }
        break;
    }
  });
  app.whenReady().then(() => {
    setTimeout(() => {
      console.log("[Electron Main] Sending ready notification");
      if (process.send) {
        process.send({ type: "ready" });
      }
    }, 1e3);
  });
} else {
  console.log("[Electron Main] Running in standalone mode (no IPC)");
}
