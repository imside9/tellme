interface Env {
  GEMINI_API_KEY: string;
  GOOGLE_API_KEY?: string;
  GEMINI_KEY?: string;
  GEMINI_MODEL?: string;
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

function extractGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  return (
    data.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

async function requestGeminiLines(prompt: string, env: Env): Promise<string[]> {
  const model = (env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  const apiKey = resolveGeminiApiKey(env);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 220,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`gemini_failed(${response.status}): ${detail.slice(0, 400)}`);
  }

  const payload = (await response.json()) as unknown;
  const text = extractGeminiText(payload);
  if (!text) throw new Error("gemini_empty_output");

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

function resolveGeminiApiKey(env: Env): string {
  return (env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GEMINI_KEY || "").trim();
}

function buildFallbackLines(situation: string, tone: Tone): string[] {
  if (tone === "polite") {
    return [
      `${situation} 관련해서 천천히 정리해서 다시 연락드릴게요.`,
      `말해줘서 고마워요. ${situation}는 이렇게 진행하면 좋을 것 같아요.`,
      `${situation} 건은 제가 먼저 확인해보고 편하게 다시 답장할게요.`
    ];
  }
  if (tone === "cool") {
    return [
      `${situation} 건은 내가 확인하고 다시 말해줄게.`,
      `${situation}은 이렇게 정리하면 될 듯.`,
      `오케이, ${situation}는 내가 맞춰볼게.`
    ];
  }
  return [
    `${situation}? 오케이, 일단 살려는 볼게.`,
    `${situation} 모드 on, 오늘은 내가 캐리한다.`,
    `${situation} 접수 완료, 드라마 없이 깔끔하게 가자.`
  ];
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    console.log("generate:start");
    const body = (await context.request.json()) as RequestBody;
    const situation = body.situation?.trim();
    const tone = body.tone;

    if (!situation || situation.length < 1 || situation.length > 80) {
      return jsonResponse({ error: "situation must be 1 to 80 characters." }, 400);
    }

    if (!tone || !(tone in toneGuide)) {
      return jsonResponse({ error: "invalid tone value." }, 400);
    }

    const apiKey = resolveGeminiApiKey(context.env);
    if (!apiKey) {
      return jsonResponse(
        { error: "server config error: GEMINI_API_KEY (or GOOGLE_API_KEY/GEMINI_KEY) is missing." },
        500
      );
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
      "- Give 5 distinct lines so we can pick best 3",
      "- Output JSON only",
      'Required format: {"lines":["...","...","...","...","..."]}'
    ].join("\n");

    const lines = await requestGeminiLines(prompt, context.env);
    const normalized = normalizeLines(lines);

    if (normalized.length < 3) {
      const fallback = buildFallbackLines(situation, tone);
      return jsonResponse({ lines: normalizeLines([...normalized, ...fallback]).slice(0, 3) });
    }

    console.log("generate:ok");
    return jsonResponse({ lines: normalized });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("generate:gemini_error", message);
    return jsonResponse({ error: "generation failed. please try again shortly." }, 502);
  }
};
