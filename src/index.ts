import { z } from "zod/mini";

export interface FaisceauClientOptions {
  apiKey: string;
  apiUrl?: string;
}

export const faisceauMetadata = z.object({
  promptLength: z.number(),
  normalizedLength: z.number(),
  latencyMs: z.number(),
  hasObfuscation: z.boolean(),
});

export const faisceauCategory = z.enum([
  "instruction_override",
  "obfuscation",
  "system_prompt_extraction",
]);

export const faisceauFinding = z.object({
  ruleId: z.string(),
  category: faisceauCategory,
  severity: z.enum(["low", "medium", "critical"]),
  score: z.number(),
  snippet: z.string(),
  description: z.string(),
});

export const faisceauFindings = z.array(faisceauFinding);

export const faisceauGuardResult = z.object({
  action: z.enum(["block", "allow"]),
  isJailbreak: z.boolean(),
  score: z.number(),
  categories: z.array(faisceauCategory),
  findings: faisceauFindings,
  metadata: faisceauMetadata,
});

export const faisceauGuardRequest = z.object({
  version: z.string(),
  projectId: z.uuid(),
  result: faisceauGuardResult,
});

export type FaisceauMetadata = z.infer<typeof faisceauMetadata>;
export type FaisceauCategory = z.infer<typeof faisceauCategory>;
export type FaisceauFinding = z.infer<typeof faisceauFinding>;
export type FaisceauFindings = z.infer<typeof faisceauFindings>;
export type FaisceauGuardResult = z.infer<typeof faisceauGuardResult>;
export type FaisceauGuardRequest = z.infer<typeof faisceauGuardRequest>;

export type Json = number | string | boolean | null | Json[] | { [key: string]: Json };

export type FaisceauResult<T, E> = { success: false; error: E } | { success: true; data: T };

export type ParseError<T, S> = { error: T; metadata?: z.core.$ZodError<S> };

export class FaisceauClient {
  private apiUrl: string = "https://api.faisceau.dev";
  private apiKey: string;

  constructor(options: FaisceauClientOptions) {
    this.apiUrl = options.apiUrl ?? this.apiUrl;
    this.apiKey = options.apiKey;
  }

  private async request(
    endpoint: string,
    options?: RequestInit,
  ): Promise<FaisceauResult<Json, string>> {
    const url = new URL(endpoint, this.apiUrl);
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP error! status: ${response.status}`,
      };
    }

    const json = await response.json();

    return {
      success: true,
      data: json as Json,
    };
  }

  public async guard(
    prompt: string,
  ): Promise<
    FaisceauResult<FaisceauGuardRequest, ParseError<string, FaisceauGuardRequest>>
  > {
    const response = await this.request("v1/guard", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });

    if (!response.success) {
      return {
        success: false,
        error: {
          error: response.error,
        }
      };
    }

    const data = faisceauGuardRequest.safeParse(response.data);

    if (data.success) {
      return {
        data: data.data,
        success: true,
      };
    }

    return {
      success: false,
      error: {
        error: "Parse error during guard request",
        metadata: data.error,
      },
    };
  }
}
