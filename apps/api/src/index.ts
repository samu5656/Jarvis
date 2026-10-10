import Fastify from 'fastify';
import dotenv from 'dotenv';
import { z } from 'zod';
import fastifyJwt from '@fastify/jwt';
import { prisma } from './prisma';

dotenv.config({ path: '../../.env' });

// Config validation
const envSchema = z.object({
  API_PORT: z.string().transform(Number).default('3000'),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string(),
});

const env = envSchema.parse(process.env);

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
    
    const token = server.jwt.sign({ id: user.id, name: user.name });
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
