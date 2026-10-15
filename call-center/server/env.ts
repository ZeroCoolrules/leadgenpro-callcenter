// Loads .env before any other module reads process.env. Must be the very
// first import in server.ts — modules like twilio.ts, llm.ts and
// leadgenpro.ts read their config from process.env at module load time, and
// ES module imports run before the rest of a file's own top-level code
// (including a dotenv.config() call placed after the imports), so without
// this those modules would see only variables already in the environment,
// never ones from .env.
import dotenv from 'dotenv';
dotenv.config();
