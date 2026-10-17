import Fastify from 'fastify';
import dotenv from 'dotenv';
import { z } from 'zod';
import fastifyJwt from '@fastify/jwt';
import { prisma } from './prisma';

import { createLLMProvider, LLMProvider } from '@jarvis/llm';
import { JarvisOrchestrator } from '@jarvis/core';
import { TaskService, ScheduledReminderQueue, CreateTaskInputSchema, UpdateTaskInputSchema, CreateReminderInputSchema } from '@jarvis/tasks';
import { MemoryService, CreateMemoryInputSchema } from '@jarvis/memory';
import {
  DraftEmailInputSchema,
  SendEmailInputSchema,
  ReadCalendarInputSchema,
  SearchFilesInputSchema,
  ExtractDocumentInputSchema,
  SummarizeDocumentInputSchema,
  WebSearchInputSchema,
  BrowserActionInputSchema,
} from '@jarvis/tools';
import { VoiceCommandLoop, WindowsNativeTTSProvider, VoiceSessionInputSchema } from '@jarvis/voice';
import { AutomationEngine, AutomationQueueWorker, WorkflowDefinitionSchema } from '@jarvis/automation';
import { ProactiveService, UpdatePreferencesInputSchema } from '@jarvis/proactive';

import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Config validation
const envSchema = z.object({
  API_PORT: z.string().transform(Number).default('3000'),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string(),
  LLM_PROVIDER: z.enum(['mock', 'ollama', 'openai-compatible']).default('mock'),
  LLM_BASE_URL: z.string().optional(),
  LLM_MODEL: z.string().default('llama3'),
  LLM_API_KEY: z.string().optional(),
});

const env = envSchema.parse(process.env);

// Initialize Swappable LLM Provider
const llmProvider: LLMProvider = createLLMProvider({
  provider: env.LLM_PROVIDER,
  baseUrl: env.LLM_BASE_URL,
  model: env.LLM_MODEL,
  apiKey: env.LLM_API_KEY,
});

// Initialize Jarvis Orchestrator (M4)
const orchestrator = new JarvisOrchestrator(llmProvider);

// Initialize Task & Reminder Services (M7)
const taskService = new TaskService();
const reminderScheduler = new ScheduledReminderQueue(taskService.getStorage());
reminderScheduler.restoreFromStorage().catch(console.error);

// Initialize Memory Service (M8)
const memoryService = new MemoryService();

// Initialize Voice Command Loop (M12)
const voiceLoop = new VoiceCommandLoop({
  tts: new WindowsNativeTTSProvider(process.env.VOICE_AUDIO_OUTPUT === 'true'),
  commandHandler: async (command: string, sessionId: string) => {
    const chatRes = await orchestrator.processMessage(command, { sessionId });
    return chatRes.response;
  },
});

// Initialize Automation Engine & Worker (M13)
const automationEngine = new AutomationEngine(async (toolName, input, context) => {
  const result = await orchestrator.getRuntime().executeTool(toolName, input, {
    userId: context?.userId || 'automation-user',
    confirmed: true, // Automation actions are pre-approved within defined workflows
  });
  return {
    success: result.success,
    data: result.data,
    error: result.error,
  };
});
const automationWorker = new AutomationQueueWorker(automationEngine);

// Initialize Proactive Jarvis (M14)
const proactiveService = new ProactiveService({
  taskProvider: {
    getPendingTasks: async (userId: string) => {
      const tasks = await taskService.getTasks(userId);
      return tasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: 'MEDIUM',
        dueDate: t.dueAt,
      }));
    },
  },
  calendarProvider: {
    getUpcomingEvents: async (userId: string) => {
      const calRes = await orchestrator.getRuntime().executeTool('read_calendar', {}, { userId });
      return (calRes.data || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime,
      }));
    },
  },
});

const server = Fastify({
  logger: true,
});

server.register(fastifyJwt, {
  secret: env.JWT_SECRET
});

// Decorate request with auth
server.decorate("authenticate", async function(request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// Health check endpoint
server.get('/api/v1/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// LLM provider health check
server.get('/api/v1/llm/health', async (request, reply) => {
  const healthy = await llmProvider.healthCheck();
  return {
    provider: llmProvider.name,
    model: llmProvider.model,
    healthy,
    timestamp: new Date().toISOString(),
  };
});

// LLM provider test prompt completion
server.post('/api/v1/llm/test', async (request, reply) => {
  const bodySchema = z.object({
    prompt: z.string().min(1),
  });

  try {
    const { prompt } = bodySchema.parse(request.body);
    const result = await llmProvider.generate(prompt);
    return {
      provider: llmProvider.name,
      result,
    };
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid request body' });
  }
});

// Orchestrated Chat Endpoint (M4 - Section 9 Specification)
server.post('/api/v1/chat', async (request, reply) => {
  const chatSchema = z.object({
    message: z.string().min(1),
    sessionId: z.string().optional(),
  });

  try {
    const { message, sessionId } = chatSchema.parse(request.body);
    const result = await orchestrator.processMessage(message, {
      sessionId: sessionId || 'default-session',
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid chat request' });
  }
});

// Tools Registry Endpoint (M5 - Section 9 Specification)
server.get('/api/v1/tools', async (_request, _reply) => {
  const tools = orchestrator.getRuntime().getRegistry().getMetadataList();
  return {
    tools,
    total: tools.length,
    killSwitchActive: orchestrator.getRuntime().isKillSwitchActive(),
  };
});

// Audit Log & Tool Executions Endpoint (M5 - Section 9 Specification)
server.get('/api/v1/executions', async (request: any, _reply) => {
  const { tool, status } = request.query || {};
  const logs = orchestrator.getAuditLogger().getLogs({
    toolName: tool,
    status,
  });
  return {
    executions: logs,
    total: logs.length,
  };
});

// Global Kill Switch Endpoint (M5 - Section 5 Security Model)
server.post('/api/v1/killswitch', async (request, reply) => {
  const killSwitchSchema = z.object({
    active: z.boolean(),
  });

  try {
    const { active } = killSwitchSchema.parse(request.body);
    orchestrator.getRuntime().setKillSwitch(active);
    return {
      success: true,
      killSwitchActive: active,
      message: active ? 'Kill switch ACTIVATED. All tool execution blocked.' : 'Kill switch DEACTIVATED.',
    };
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid kill switch request' });
  }
});

// Tasks Endpoints (M7 - Section 9 Specification)
server.get('/api/v1/tasks', async (request: any, _reply) => {
  const userId = request.query?.userId || 'default-user';
  const tasks = await taskService.getTasks(userId, request.query?.status);
  return { tasks, total: tasks.length };
});

server.post('/api/v1/tasks', async (request: any, reply) => {
  try {
    const input = CreateTaskInputSchema.parse(request.body);
    const userId = request.body?.userId || 'default-user';
    const task = await taskService.createTask(userId, input);
    reply.status(201).send({ success: true, task });
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid task input' });
  }
});

server.patch('/api/v1/tasks/:id', async (request: any, reply) => {
  try {
    const { id } = request.params as { id: string };
    const input = UpdateTaskInputSchema.parse(request.body);
    const updated = await taskService.updateTask(id, input);
    if (!updated) {
      return reply.status(404).send({ error: 'Task not found' });
    }
    return { success: true, task: updated };
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid update input' });
  }
});

server.delete('/api/v1/tasks/:id', async (request: any, reply) => {
  const { id } = request.params as { id: string };
  const deleted = await taskService.deleteTask(id);
  if (!deleted) {
    return reply.status(404).send({ error: 'Task not found' });
  }
  return { success: true, deleted: true };
});

// Reminders Endpoints (M7 - Section 9 Specification)
server.get('/api/v1/reminders', async (request: any, _reply) => {
  const userId = request.query?.userId;
  const reminders = await taskService.getReminders(userId);
  return { reminders, total: reminders.length };
});

server.post('/api/v1/reminders', async (request: any, reply) => {
  try {
    const input = CreateReminderInputSchema.parse(request.body);
    const userId = request.body?.userId || 'default-user';
    const reminder = await taskService.createReminder(userId, input);
    await reminderScheduler.schedule(reminder);
    reply.status(201).send({ success: true, reminder });
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid reminder input' });
  }
});

server.delete('/api/v1/reminders/:id', async (request: any, reply) => {
  const { id } = request.params as { id: string };
  reminderScheduler.cancel(id);
  const cancelled = await taskService.cancelReminder(id);
  if (!cancelled) {
    return reply.status(404).send({ error: 'Reminder not found' });
  }
  return { success: true, cancelled: true };
});

// Memory Endpoints (M8 - Section 8 Specification)
server.get('/api/v1/memories', async (request: any, _reply) => {
  const userId = request.query?.userId || 'default-user';
  const query = request.query?.query;
  const type = request.query?.type;
  const memories = await memoryService.recall(userId, query, { type });
  return { memories, total: memories.length };
});

server.post('/api/v1/memories', async (request: any, reply) => {
  try {
    const input = CreateMemoryInputSchema.parse(request.body);
    const userId = request.body?.userId || 'default-user';
    const memory = await memoryService.remember(userId, input);
    reply.status(201).send({ success: true, memory });
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid memory input' });
  }
});

// Calendar & Email Endpoints (M9 - Section 9 & 10 Specification)
server.get('/api/v1/calendar', async (request: any, reply) => {
  try {
    const queryParams = ReadCalendarInputSchema.parse(request.query || {});
    const result = await orchestrator.getRuntime().executeTool('read_calendar', queryParams, {
      userId: request.query?.userId || 'default-user',
    });
    return result;
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid calendar query' });
  }
});

server.post('/api/v1/email/draft', async (request: any, reply) => {
  try {
    const input = DraftEmailInputSchema.parse(request.body);
    const result = await orchestrator.getRuntime().executeTool('draft_email', input, {
      userId: request.body?.userId || 'default-user',
    });
    reply.status(201).send(result);
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid email draft input' });
  }
});

server.post('/api/v1/email/send', async (request: any, reply) => {
  try {
    const input = SendEmailInputSchema.parse(request.body);
    const confirmed = Boolean(request.body?.confirmed);
    const result = await orchestrator.getRuntime().executeTool('send_email', input, {
      userId: request.body?.userId || 'default-user',
      confirmed,
    });
    if (!result.success && result.confirmationRequired) {
      return reply.status(403).send({
        error: 'Confirmation required: External email send requires explicit user approval.',
        confirmationRequired: true,
        auditEntry: result.auditEntry,
      });
    }
    return result;
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid send email request' });
  }
});

// File Assistant Endpoints (M10 - Section 10 Specification)
server.get('/api/v1/files/search', async (request: any, reply) => {
  try {
    const input = SearchFilesInputSchema.parse(request.query);
    const result = await orchestrator.getRuntime().executeTool('search_files', input, {
      userId: request.query?.userId || 'default-user',
    });
    if (!result.success) {
      return reply.status(403).send({ error: result.error });
    }
    return result;
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid search parameters' });
  }
});

server.post('/api/v1/files/extract', async (request: any, reply) => {
  try {
    const input = ExtractDocumentInputSchema.parse(request.body);
    const result = await orchestrator.getRuntime().executeTool('extract_document', input, {
      userId: request.body?.userId || 'default-user',
    });
    if (!result.success) {
      return reply.status(403).send({ error: result.error });
    }
    return result;
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid file extraction request' });
  }
});

server.post('/api/v1/files/summarize', async (request: any, reply) => {
  try {
    const input = SummarizeDocumentInputSchema.parse(request.body);
    const result = await orchestrator.getRuntime().executeTool('summarize_document', input, {
      userId: request.body?.userId || 'default-user',
    });
    if (!result.success) {
      return reply.status(403).send({ error: result.error });
    }
    return result;
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid summarization request' });
  }
});

// Browser & Web Endpoints (M11 - Section 11 Specification)
server.get('/api/v1/web/search', async (request: any, reply) => {
  try {
    const input = WebSearchInputSchema.parse(request.query);
    const result = await orchestrator.getRuntime().executeTool('web_search', input, {
      userId: request.query?.userId || 'default-user',
    });
    return result;
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid web search query' });
  }
});

server.post('/api/v1/browser/action', async (request: any, reply) => {
  try {
    const input = BrowserActionInputSchema.parse(request.body);
    const confirmed = Boolean(request.body?.confirmed);
    const result = await orchestrator.getRuntime().executeTool('browser_action', input, {
      userId: request.body?.userId || 'default-user',
      confirmed,
    });
    if (!result.success && result.confirmationRequired) {
      return reply.status(403).send({
        error: 'Confirmation required: Browser action requires explicit user approval.',
        confirmationRequired: true,
        auditEntry: result.auditEntry,
      });
    }
    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }
    return result;
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid browser action request' });
  }
});

// Voice Endpoints (M12 - Section 2 & 12 Specification)
server.post('/api/v1/voice/listen', async (request: any, reply) => {
  try {
    const input = VoiceSessionInputSchema.parse(request.body || {});
    const result = await voiceLoop.processVoiceInput(input);
    return result;
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid voice session input' });
  }
});

// Automation Engine Endpoints (M13 - Section 3 & 10 Specification)
server.get('/api/v1/workflows', async (_request, _reply) => {
  const workflows = automationEngine.listWorkflows();
  return { workflows, total: workflows.length };
});

server.post('/api/v1/workflows', async (request: any, reply) => {
  try {
    const input = WorkflowDefinitionSchema.parse(request.body);
    const workflow = automationEngine.createWorkflow(input);
    reply.status(201).send({ success: true, workflow });
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid workflow specification' });
  }
});

server.post('/api/v1/workflows/:id/trigger', async (request: any, reply) => {
  try {
    const { id } = request.params as { id: string };
    const idempotencyKey = request.headers['x-idempotency-key'] || request.body?.idempotencyKey;
    const payload = request.body?.payload || {};

    const log = await automationEngine.triggerWorkflow(id, payload, {
      idempotencyKey: idempotencyKey as string | undefined,
    });
    return { success: true, log };
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Workflow execution error' });
  }
});

server.get('/api/v1/workflows/history', async (request: any, _reply) => {
  const workflowId = request.query?.workflowId;
  const history = automationEngine.getExecutionHistory(workflowId);
  return { history, total: history.length };
});

// Proactive Jarvis Endpoints (M14 - Section 10 Specification)
server.get('/api/v1/proactive/briefing', async (request: any, _reply) => {
  const userId = request.query?.userId || 'default-user';
  const briefing = await proactiveService.generateDailyBriefing(userId);
  return { briefing };
});

server.get('/api/v1/proactive/preferences', async (request: any, _reply) => {
  const userId = request.query?.userId || 'default-user';
  const preferences = proactiveService.getPreferences(userId);
  return { preferences };
});

server.patch('/api/v1/proactive/preferences', async (request: any, reply) => {
  try {
    const userId = request.body?.userId || 'default-user';
    const input = UpdatePreferencesInputSchema.parse(request.body);
    const updated = proactiveService.updatePreferences(userId, input);
    return { success: true, preferences: updated };
  } catch (error: any) {
    reply.status(400).send({ error: error.message || 'Invalid preferences payload' });
  }
});

server.get('/api/v1/proactive/notifications', async (request: any, _reply) => {
  const userId = request.query?.userId || 'default-user';
  const unreadOnly = request.query?.unread === 'true';
  const notifications = proactiveService.getNotifications(userId, unreadOnly);
  return { notifications, total: notifications.length };
});

server.patch('/api/v1/proactive/notifications/:id/read', async (request: any, reply) => {
  const { id } = request.params as { id: string };
  const marked = proactiveService.markAsRead(id);
  if (!marked) {
    return reply.status(404).send({ error: 'Notification not found' });
  }
  return { success: true, marked: true };
});

// Authentication endpoint (simplified for MVP - creates/gets a user)
server.post('/api/v1/auth/login', async (request, reply) => {
  const loginSchema = z.object({
    name: z.string().min(2)
  });
  
  try {
    const { name } = loginSchema.parse(request.body);
    let user = await prisma.user.findFirst({ where: { name } });
    if (!user) {
      user = await prisma.user.create({ data: { name } });
    }
    
    const token = (server as any).jwt.sign({ id: user.id, name: user.name });
    return { token, user };
  } catch (error) {
    reply.status(400).send({ error: "Invalid request" });
  }
});

// Protected route: User profile
server.get('/api/v1/users/me', { preValidation: [(server as any).authenticate] }, async (request: any, reply) => {
  const user = await prisma.user.findUnique({ where: { id: request.user.id } });
  return { user };
});

// Protected route: Get tools permissions
server.get('/api/v1/permissions', { preValidation: [(server as any).authenticate] }, async (request: any, reply) => {
  const permissions = await prisma.permission.findMany({ where: { userId: request.user.id } });
  return { permissions };
});

// Protected route: Update specific tool permission
server.patch('/api/v1/permissions/:tool', { preValidation: [(server as any).authenticate] }, async (request: any, reply) => {
  const { tool } = request.params as { tool: string };
  const updateSchema = z.object({
    policy: z.string().optional(),
    enabled: z.boolean().optional(),
  });
  
  try {
    const data = updateSchema.parse(request.body);
    
    // Upsert the permission
    const permission = await prisma.permission.findFirst({
      where: { userId: request.user.id, toolName: tool }
    });

    if (permission) {
      return await prisma.permission.update({
        where: { id: permission.id },
        data
      });
    } else {
      return await prisma.permission.create({
        data: {
          userId: request.user.id,
          toolName: tool,
          policy: data.policy ?? "default",
          enabled: data.enabled ?? true
        }
      });
    }
  } catch (error) {
    reply.status(400).send({ error: "Invalid request data" });
  }
});

const start = async () => {
  try {
    await server.listen({ port: env.API_PORT, host: env.API_HOST });
    server.log.info(`Server listening on ${env.API_HOST}:${env.API_PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
