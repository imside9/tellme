interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
}

type Tone = "polite" | "cool" | "funny";

type RequestBody = {
  situation?: string;
  tone?: Tone;
};

const toneGuide: Record<Tone, string> = {
  polite: "부드럽고 예의 있게",
  cool: "담백하고 거리감 적당히",
  funny: "가볍게 웃기되 무례/혐오 금지"
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as RequestBody;
    const situation = body.situation?.trim();
    const tone = body.tone;

    if (!situation || situation.length < 1 || situation.length > 80) {
      return jsonResponse({ error: "situation은 1~80자여야 합니다." }, 400);
    }

    if (!tone || !(tone in toneGuide)) {
      return jsonResponse({ error: "tone 값이 올바르지 않습니다." }, 400);
    }

    if (!context.env.OPENAI_API_KEY) {
      return jsonResponse({ error: "서버 설정 오류: OPENAI_API_KEY 누락" }, 500);
    }

    const prompt = [
      "너는 한국어 카카오톡 한 줄 멘트 생성기다.",
      `상황: ${situation}`,
      `톤 가이드: ${toneGuide[tone]}`,
      "규칙:",
      "- 10~20대가 실제로 보낼 법한 카톡 말투",
      "- 오글거림 최소화",
      "- 과도한 이모지 금지",
      "- 길이 10~60자",
      "- 실사용 가능한 문장만",
      "- 서로 중복 없는 문장 3개",
      "- JSON 형식만 출력",
      '반드시 다음 형식으로만 답변: {"lines":["...","...","..."]}'
    ].join("\n");

    const model = context.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${context.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        input: prompt,
        max_output_tokens: 220
      })
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      return jsonResponse({ error: `OpenAI 호출 실패(${aiResponse.status}): ${detail}` }, 502);
    }

    const payload = (await aiResponse.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };

    const fallbackText =
      payload.output
        ?.flatMap((item) => item.content ?? [])
        .filter((item) => item.type === "output_text" || typeof item.text === "string")
        .map((item) => item.text ?? "")
        .join("\n") ?? "";

    const text = payload.output_text ?? fallbackText;

    let lines: string[] = [];
    try {
      const parsed = JSON.parse(text) as { lines?: string[] };
      lines = Array.isArray(parsed.lines) ? parsed.lines : [];
    } catch {
      lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }

    const normalized = normalizeLines(lines);

    if (normalized.length < 3) {
      return jsonResponse({ error: "문장 생성에 실패했습니다. 다시 시도해 주세요." }, 502);
    }

    return jsonResponse({ lines: normalized });
  } catch {
    return jsonResponse({ error: "요청 처리 중 오류가 발생했습니다." }, 500);
  }
};
