type AiBinding = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
};

interface Env {
  AI: AiBinding;
  WORKERS_AI_MODEL?: string;
}

type Tone = "polite" | "cool" | "funny";

type RequestBody = {
  situation?: string;
  tone?: Tone;
};

const toneGuide: Record<Tone, string> = {
  polite: "soft and respectful tone",
  cool: "short and calm tone",
  funny: "light and playful tone without being rude"
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function normalizeLines(lines: string[]): string[] {
  const stripped = lines
    .map((line) => line.trim().replace(/^[-*\d.)\s]+/, ""))
    .filter(Boolean);

  const strict = stripped.filter((line) => line.length >= 6 && line.length <= 80);
  const uniqueStrict = Array.from(new Set(strict)).slice(0, 3);
  if (uniqueStrict.length >= 3) return uniqueStrict;

  const loose = stripped.filter((line) => line.length >= 2 && line.length <= 120);
  return Array.from(new Set([...uniqueStrict, ...loose])).slice(0, 3);
}

function extractTextFromAiResult(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const payload = result as {
    response?: string;
    output_text?: string;
    result?: { response?: string };
  };
  return payload.response ?? payload.output_text ?? payload.result?.response ?? "";
}

async function requestWorkersAiLines(prompt: string, env: Env): Promise<string[]> {
  const model = env.WORKERS_AI_MODEL?.trim() || "@cf/meta/llama-3.1-8b-instruct";
  const result = await env.AI.run(model, {
    messages: [
      {
        role: "system",
        content:
          "You generate Korean messenger reply lines. Return only JSON in this format: {\"lines\":[\"...\",\"...\",\"...\"]}."
      },
      { role: "user", content: prompt }
    ],
    max_tokens: 220,
    temperature: 0.7
  });

  const text = extractTextFromAiResult(result).trim();
  if (!text) {
    throw new Error("workers_ai_empty_output");
  }

  try {
    const parsed = JSON.parse(text) as { lines?: string[] };
    if (Array.isArray(parsed.lines)) return parsed.lines;
  } catch {
    // Fallback to line split below.
  }

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    console.log("generate:start");
    const body = (await context.request.json()) as RequestBody;
    const situation = body.situation?.trim();
    const tone = body.tone;

    if (!situation || situation.length < 1 || situation.length > 80) {
      console.warn("generate:invalid_situation");
      return jsonResponse({ error: "situation must be 1 to 80 characters." }, 400);
    }

    if (!tone || !(tone in toneGuide)) {
      console.warn("generate:invalid_tone");
      return jsonResponse({ error: "invalid tone value." }, 400);
    }

    if (!context.env.AI) {
      console.error("generate:missing_ai_binding");
      return jsonResponse({ error: "server config error: Workers AI binding is missing." }, 500);
    }

    const prompt = [
      "Task: generate 3 Korean KakaoTalk one-line replies.",
      `Situation: ${situation}`,
      `Tone guide: ${toneGuide[tone]}`,
      "Rules:",
      "- Realistic Korean chat style for teens/20s",
      "- Avoid cringe",
      "- Avoid excessive emoji",
      "- Each line length: 10~60 chars preferred",
      "- Exactly 3 distinct lines",
      "- Output JSON only",
      'Required format: {"lines":["...","...","..."]}'
    ].join("\n");

    const lines = await requestWorkersAiLines(prompt, context.env);
    const normalized = normalizeLines(lines);

    if (normalized.length < 3) {
      console.warn("generate:insufficient_lines", { rawCount: lines.length, normalizedCount: normalized.length });
      return jsonResponse({ error: "failed to generate enough lines. please retry." }, 502);
    }

    console.log("generate:ok");
    return jsonResponse({ lines: normalized });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("generate:workers_ai_error", message);
    return jsonResponse({ error: "generation failed. please try again shortly." }, 502);
  }
};
