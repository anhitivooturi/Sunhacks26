// Standalone: node dev-server.js  (Vite proxies /api to :3001)
import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import routes from './routes.js'

const app = Fastify({ logger: { level: 'warn' } })
await app.register(cors, { origin: true })
await app.register(routes)
const port = Number(process.env.API_PORT || 3001)
await app.listen({ port, host: process.env.HOST || '0.0.0.0' })
console.log(`[atlas] student routes on :${port}  (health: http://localhost:${port}/api/student/health)`)
