import { FormEvent, useMemo, useRef, useState } from "react";

type Tone = "polite" | "cool" | "funny";

type ResultResponse = {
  lines: string[];
};

type ApiResponse = ResultResponse & {
  error?: string;
};

const uiText = {
  title: "\uBA54\uC2E0\uC800 \uB2F5\uC7A5 \uD55C\uC904",
  subtitle: "\uB2F5\uC7A5\uC740 \uC774\uC81C \uACE0\uBBFC \uB9D0\uACE0 \uAC80\uC0C9\uD558\uC790!",
  inputPlaceholder:
    "\uC608: \uC18C\uAC1C\uD305 \uAC70\uC808 / \uB2A6\uC7A0 \uC0AC\uACFC / \uC77D\uC539 \uBCF5\uAD6C",
  loading: "\uBB38\uC7A5\uC744 \uB9CC\uB4DC\uB294 \uC911...",
  showLines: "\uBA58\uD2B8 3\uAC1C \uBCF4\uAE30",
  regenerate: "\uB2E4\uC2DC \uAC80\uC0C9",
  copy: "\uD83D\uDCCB \uBCF5\uC0AC",
  copied: "\uBCF5\uC0AC\uB428",
  copyFailed: "\uBCF5\uC0AC \uC2E4\uD328",
  footer: "\uC774\uACF3\uC740 \uAE30\uB85D\uC744 \uB0A8\uAE30\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
  invalidSituation: "\uC0C1\uD669\uC740 1~80\uC790\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.",
  generationFailed: "\uBB38\uC7A5 \uC0DD\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
  unknownError: "\uC54C \uC218 \uC5C6\uB294 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.",
  parseFailed:
    "\uC11C\uBC84 \uC751\uB2F5 \uD30C\uC2F1\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.",
  htmlStatusPrefix:
    "API\uAC00 HTML\uC744 \uBC18\uD658\uD588\uC2B5\uB2C8\uB2E4 (HTTP "
};

const toneOptions: Array<{ key: Tone; label: string }> = [
  { key: "polite", label: "\uACF5\uC190" },
  { key: "cool", label: "\uCFE8" },
  { key: "funny", label: "\uC6C3\uAE40" }
];

const popularChips = [
  "\uC18C\uAC1C\uD305 \uAC70\uC808",
  "\uC77D\uC539 \uBCF5\uAD6C",
  "\uC120 \uAE0B\uAE30",
  "\uB2A6\uC7A0 \uC0AC\uACFC"
];

const storageKey = "tellme_recent_searches";
const endpoint = "/api/generate";

function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => typeof v === "string").slice(0, 5);
  } catch {
    return [];
  }
}

function saveRecentSearches(items: string[]): void {
  localStorage.setItem(storageKey, JSON.stringify(items.slice(0, 5)));
}

function isHtmlResponse(contentType: string, body: string): boolean {
  return contentType.includes("text/html") || body.trimStart().startsWith("<!DOCTYPE");
}

function parseApiResponse(rawBody: string): ApiResponse | null {
  try {
    return JSON.parse(rawBody) as ApiResponse;
  } catch {
    return null;
  }
}

async function requestGeneratedLines(payload: { situation: string; tone: Tone }): Promise<string[]> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const contentType = response.headers.get("content-type") ?? "";
  const rawBody = await response.text();
  const data = parseApiResponse(rawBody);

  if (!data || typeof data !== "object") {
    if (isHtmlResponse(contentType, rawBody)) {
      throw new Error(`${uiText.htmlStatusPrefix}${response.status}).`);
    }
    throw new Error(uiText.parseFailed);
  }

  if (!response.ok) {
    throw new Error(data.error ?? uiText.generationFailed);
  }

  if (!Array.isArray(data.lines)) {
    throw new Error(uiText.parseFailed);
  }

  return data.lines;
}

function App() {
  const [situation, setSituation] = useState("");
  const [tone, setTone] = useState<Tone>("polite");
  const [lines, setLines] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches());
  const inputRef = useRef<HTMLInputElement>(null);
  const searchPanelRef = useRef<HTMLElement>(null);

  const canSubmit = useMemo(() => {
    const text = situation.trim();
    return text.length >= 1 && text.length <= 80 && !isLoading;
  }, [situation, isLoading]);

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = situation.trim();
    if (trimmed.length < 1 || trimmed.length > 80) {
      setError(uiText.invalidSituation);
      return;
    }

    setLines([]);
    setError(null);
    setIsLoading(true);

    try {
      const generatedLines = await requestGeneratedLines({ situation: trimmed, tone });
      setLines(generatedLines);

      const updated = [trimmed, ...recentSearches.filter((item) => item !== trimmed)].slice(0, 5);
      setRecentSearches(updated);
      saveRecentSearches(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : uiText.unknownError;
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetForResearch = () => {
    setLines([]);
    setError(null);
    searchPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    inputRef.current?.focus();
  };

  const handleSituationChange = (value: string) => {
    setSituation(value);
    setLines([]);
    setError(null);
  };

  const handleToneChange = (nextTone: Tone) => {
    setTone(nextTone);
    setLines([]);
    setError(null);
  };

  const handleCopy = async (line: string) => {
    try {
      await navigator.clipboard.writeText(line);
      setToast(uiText.copied);
      setTimeout(() => setToast(""), 1000);
    } catch {
      setToast(uiText.copyFailed);
      setTimeout(() => setToast(""), 1000);
    }
  };

  return (
    <div className="page">
      <main className="container">
        <header className="hero">
          <h1>{uiText.title}</h1>
          <p>{uiText.subtitle}</p>
        </header>

        <section className="panel" ref={searchPanelRef}>
          <form onSubmit={handleGenerate}>
            <label htmlFor="situation" className="input-wrap">
              <span className="icon" aria-hidden>
                {"\uD83D\uDCAC"}
              </span>
              <input
                ref={inputRef}
                id="situation"
                type="text"
                value={situation}
                onChange={(e) => handleSituationChange(e.target.value)}
                maxLength={80}
                placeholder={uiText.inputPlaceholder}
              />
            </label>

            <div className="tone-group" role="radiogroup" aria-label="\uD1A4 \uC120\uD0DD">
              {toneOptions.map((option) => (
                <button
                  type="button"
                  key={option.key}
                  className={tone === option.key ? "tone-btn selected" : "tone-btn"}
                  onClick={() => handleToneChange(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="chip-group" aria-label="\uC778\uAE30 \uC0C1\uD669">
              {popularChips.map((chip) => (
                <button type="button" key={chip} className="chip" onClick={() => handleSituationChange(chip)}>
                  {chip}
                </button>
              ))}
            </div>

            {recentSearches.length > 0 && (
              <div className="recent-group" aria-label="\uCD5C\uADFC \uAC80\uC0C9">
                {recentSearches.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className="chip recent"
                    onClick={() => handleSituationChange(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}

            {lines.length > 0 ? (
              <button type="button" className="submit-btn" onClick={handleResetForResearch}>
                {uiText.regenerate}
              </button>
            ) : (
              <button type="submit" className="submit-btn" disabled={!canSubmit}>
                {isLoading ? uiText.loading : uiText.showLines}
              </button>
            )}
          </form>
        </section>

        {isLoading && <p className="status-text">{uiText.loading}</p>}
        {!isLoading && error && <p className="error">{error}</p>}

        {!isLoading && !error && lines.length > 0 && (
          <section className="result-list" aria-live="polite">
            {lines.map((line, index) => (
              <article className="result-card" key={`line-${index}`}>
                <p className="result-line">{line}</p>
                <button type="button" className="copy-btn" onClick={() => handleCopy(line)}>
                  {uiText.copy}
                </button>
              </article>
            ))}
          </section>
        )}

        <footer className="footer-note">{uiText.footer}</footer>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
