export type AiEngine="none"|"ollama"|"openai"|"claude"|"gemini";
export type AiMessage={role:"system"|"user"|"assistant";content:string};
export interface AiProvider{id:AiEngine;chat(messages:AiMessage[]):Promise<string>;health():Promise<boolean>}
