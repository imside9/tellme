import { FormEvent, useMemo, useRef, useState } from "react";

type Tone = "polite" | "cool" | "funny";

type ResultResponse = {
  lines: string[];
};

const toneOptions: Array<{ key: Tone; label: string }> = [
  { key: "polite", label: "?? 공손" },
  { key: "cool", label: "?? 쿨" },
  { key: "funny", label: "?? 웃김" }
];

const popularChips = ["소개팅 거절", "읽씹 복구", "선 긋기", "늦잠 사과"];
const storageKey = "tellme_recent_searches";

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
      setError("상황은 1~80자로 입력해 주세요.");
      return;
    }

    setLines([]);
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation: trimmed, tone })
      });

      const data = (await response.json()) as ResultResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "문장 생성에 실패했습니다.");
      }

      setLines(data.lines);

      const updated = [trimmed, ...recentSearches.filter((item) => item !== trimmed)].slice(0, 5);
      setRecentSearches(updated);
      saveRecentSearches(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
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
      setToast("복사됨");
      setTimeout(() => setToast(""), 1000);
    } catch {
      setToast("복사 실패");
      setTimeout(() => setToast(""), 1000);
    }
  };

  return (
    <div className="page">
      <main className="container">
        <header className="hero">
          <h1>메신저 답장 한줄</h1>
          <p>답장은 이제 고민 말고 검색하자!</p>
        </header>

        <section className="panel" ref={searchPanelRef}>
          <form onSubmit={handleGenerate}>
            <label htmlFor="situation" className="input-wrap">
              <span className="icon" aria-hidden>
                ??
              </span>
              <input
                ref={inputRef}
                id="situation"
                type="text"
                value={situation}
                onChange={(e) => handleSituationChange(e.target.value)}
                maxLength={80}
                placeholder="예: 소개팅 거절 / 늦잠 사과 / 읽씹 복구"
              />
            </label>

            <div className="tone-group" role="radiogroup" aria-label="톤 선택">
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

            <div className="chip-group" aria-label="인기 상황">
              {popularChips.map((chip) => (
                <button type="button" key={chip} className="chip" onClick={() => handleSituationChange(chip)}>
                  {chip}
                </button>
              ))}
            </div>

            {recentSearches.length > 0 && (
              <div className="recent-group" aria-label="최근 검색">
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
                다시 검색
              </button>
            ) : (
              <button type="submit" className="submit-btn" disabled={!canSubmit}>
                {isLoading ? "생성 중..." : "멘트 3개 보기"}
              </button>
            )}
          </form>
        </section>

        {isLoading && <p className="status-text">문장을 만드는 중...</p>}
        {!isLoading && error && <p className="error">{error}</p>}

        {!isLoading && !error && lines.length > 0 && (
          <section className="result-list" aria-live="polite">
            {lines.map((line, index) => (
              <article className="result-card" key={`line-${index}`}>
                <p className="result-line">{line}</p>
                <button type="button" className="copy-btn" onClick={() => handleCopy(line)}>
                  ?? 복사
                </button>
              </article>
            ))}
          </section>
        )}

        <footer className="footer-note">이곳은 기록을 남기지 않습니다.</footer>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
