import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useReducer, useRef } from "react";
import { Github, GraduationCap, RotateCcw, Trophy } from "lucide-react";
import { GRADE_BANDS, bandAllowsNegative, type GradeBand } from "@/lib/math";
import {
  canChangeGrade,
  createInitialState,
  gameReducer,
  type GameAction,
  type Side,
} from "@/lib/game";
import { SHAKE_MS } from "@/lib/constants";
import { km } from "@/lib/copy-km";
import { fetchPlayableUser } from "@/lib/auth";
import { signInHref } from "@/lib/host-urls";
import { useHostRoom } from "@/lib/use-game-room";
import { AccountMenu } from "@/components/game/AccountMenu";
import { HoverTip } from "@/components/game/HoverTip";
import { PlayerPanel } from "@/components/game/PlayerPanel";
import { Rope } from "@/components/game/Rope";
import { SchoolBackground } from "@/components/game/SchoolBackground";

const GITHUB_REPO_URL = "https://github.com/sokna492-km/krumath-tugofwar";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const user = await fetchPlayableUser();
    if (!import.meta.env.DEV && !user) {
      throw redirect({ href: signInHref() });
    }
    return { user };
  },
  head: () => ({
    meta: [
      { title: km.metaTitleFull },
      {
        name: "description",
        content: km.metaDescription,
      },
      {
        property: "og:title",
        content: km.metaTitleFull,
      },
      {
        property: "og:description",
        content: km.metaDescription,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const CONFETTI = Array.from({ length: 24 }, (_, i) => i);

function Index() {
  const { user } = Route.useRouteContext();
  const [localState, localDispatch] = useReducer(gameReducer, undefined, () =>
    createInitialState("4-5"),
  );
  const shakeTimers = useRef<Partial<Record<Side, number>>>({});
  const hostRoom = useHostRoom();

  const roomConnected = hostRoom.connected && hostRoom.remoteState !== null;
  const state = roomConnected ? hostRoom.remoteState! : localState;

  const { band, blue, red, position, pullKey, lastPuller, winner } = state;

  const gradeEditable = canChangeGrade(state);

  useEffect(() => {
    const timers = shakeTimers.current;
    return () => {
      if (timers.blue !== undefined) window.clearTimeout(timers.blue);
      if (timers.red !== undefined) window.clearTimeout(timers.red);
    };
  }, []);

  const dispatchAction = (action: GameAction) => {
    if (roomConnected) {
      hostRoom.sendAction(action);
      return;
    }
    localDispatch(action);
  };

  const handleSubmit = (side: Side) => {
    const before = side === "blue" ? blue : red;
    if (winner || before.shaking || before.input === "") return;

    dispatchAction({ type: "submit", side });

    // Local fallback only — DO owns shake clear when room-connected.
    if (roomConnected) return;

    const value = parseInt(before.input, 10);
    const wrong = !Number.isNaN(value) && value !== before.question.answer;
    if (wrong) {
      const existing = shakeTimers.current[side];
      if (existing) window.clearTimeout(existing);
      shakeTimers.current[side] = window.setTimeout(() => {
        localDispatch({ type: "clearShake", side });
        delete shakeTimers.current[side];
      }, SHAKE_MS);
    }
  };

  const handleGradeChange = (next: GradeBand) => {
    dispatchAction({ type: "grade", band: next });
  };

  const blueLocked = hostRoom.claims.blue.claimed;
  const redLocked = hostRoom.claims.red.claimed;
  const faviconSrc = `${import.meta.env.BASE_URL}favicon.svg`.replace(/\/{2,}/g, "/");

  return (
    <main className="relative flex min-h-screen flex-col items-center gap-4 overflow-hidden bg-background px-3 py-4 sm:gap-6 sm:px-6 sm:py-8">
      <SchoolBackground />
      <div className="relative z-10 flex w-full flex-col items-center gap-4 sm:gap-6">
        <header className="flex w-full max-w-7xl items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-foreground sm:gap-3 sm:text-2xl">
            <img
              src={faviconSrc}
              alt=""
              className="size-7 shrink-0 sm:size-8"
              width={32}
              height={32}
            />
            <span>{km.metaTitle}</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => dispatchAction({ type: "resetAll" })}
              className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground transition-transform hover:scale-105"
            >
              <RotateCcw className="size-4" />
              {km.newMatch}
            </button>
            <HoverTip label="GitHub" side="bottom">
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View source on GitHub"
                className="inline-flex size-[38px] items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-transform hover:scale-105"
              >
                <Github className="size-4" strokeWidth={2.25} />
              </a>
            </HoverTip>
            <AccountMenu user={user} />
          </div>
        </header>

        <div
          role="group"
          aria-label={km.gradeLevel}
          className="flex flex-wrap items-center justify-center gap-1.5 rounded-full bg-card px-3 py-2 shadow-md ring-1 ring-border"
        >
          <GraduationCap className="mr-1 size-5 text-muted-foreground" />
          <span className="mr-1 text-sm font-bold text-muted-foreground">{km.grade}</span>
          {GRADE_BANDS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => handleGradeChange(g.id)}
              aria-pressed={band === g.id}
              disabled={!gradeEditable && band !== g.id}
              title={gradeEditable ? undefined : km.gradeLocked}
              className={`rounded-full px-3.5 py-1.5 text-sm font-extrabold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                band === g.id
                  ? "bg-primary text-primary-foreground shadow-[0_2px_0_var(--color-team-blue-deep)]"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex w-full flex-col items-center gap-4 sm:gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-x-4">
          <div className="relative z-20 w-80 sm:w-[22rem] justify-self-center lg:justify-self-start">
            <PlayerPanel
              name={km.blue}
              accent="blue"
              question={blue.question}
              input={blue.input}
              score={blue.score}
              shaking={blue.shaking}
              disabled={!!winner || blue.shaking || blueLocked}
              allowNegative={bandAllowsNegative(band)}
              claimUrl={hostRoom.claimUrls?.blue ?? null}
              claimed={blueLocked}
              onDigit={(d) => dispatchAction({ type: "digit", side: "blue", digit: d })}
              onClear={() => dispatchAction({ type: "backspace", side: "blue" })}
              onSubmit={() => handleSubmit("blue")}
              onToggleSign={() => dispatchAction({ type: "toggleSign", side: "blue" })}
            />
          </div>

          <div className="relative z-0 flex w-full min-w-0 max-w-md flex-col items-center lg:w-96 xl:w-[30rem]">
            <Rope position={position} pullKey={pullKey} lastPuller={lastPuller} />
          </div>

          <div className="relative z-20 w-80 sm:w-[22rem] justify-self-center lg:justify-self-end">
            <PlayerPanel
              name={km.red}
              accent="red"
              question={red.question}
              input={red.input}
              score={red.score}
              shaking={red.shaking}
              disabled={!!winner || red.shaking || redLocked}
              allowNegative={bandAllowsNegative(band)}
              claimUrl={hostRoom.claimUrls?.red ?? null}
              claimed={redLocked}
              onDigit={(d) => dispatchAction({ type: "digit", side: "red", digit: d })}
              onClear={() => dispatchAction({ type: "backspace", side: "red" })}
              onSubmit={() => handleSubmit("red")}
              onToggleSign={() => dispatchAction({ type: "toggleSign", side: "red" })}
            />
          </div>
        </div>

        {winner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
            {CONFETTI.map((i) => (
              <span
                key={i}
                className="animate-confetti pointer-events-none absolute top-0 block size-3 rounded-sm"
                style={{
                  left: `${(i * 41) % 100}%`,
                  backgroundColor:
                    i % 3 === 0
                      ? "var(--color-team-blue)"
                      : i % 3 === 1
                        ? "var(--color-team-red)"
                        : "var(--color-sun)",
                  animationDuration: `${2.2 + (i % 5) * 0.5}s`,
                  animationDelay: `${(i % 7) * 0.3}s`,
                }}
              />
            ))}
            <div className="animate-pop-in w-full max-w-sm rounded-3xl bg-card p-8 text-center shadow-2xl">
              <div
                className={`mx-auto mb-4 flex size-20 items-center justify-center rounded-full ${
                  winner === "blue" ? "bg-team-blue" : "bg-team-red"
                }`}
              >
                <Trophy className="size-10 text-primary-foreground" />
              </div>
              <h2 className="text-3xl font-extrabold text-foreground">
                {winner === "blue" ? km.blueWins : km.redWins}
              </h2>
              <p className="mt-2 text-lg font-semibold text-muted-foreground">
                ★ {blue.score} — {red.score} ★
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => dispatchAction({ type: "playAgain" })}
                  className={`w-full rounded-2xl py-4 text-xl font-extrabold text-primary-foreground transition-transform hover:scale-105 active:translate-y-0.5 ${
                    winner === "blue"
                      ? "bg-team-blue shadow-[0_4px_0_var(--color-team-blue-deep)]"
                      : "bg-team-red shadow-[0_4px_0_var(--color-team-red-deep)]"
                  }`}
                >
                  {km.playAgain}
                </button>
                <button
                  type="button"
                  onClick={() => dispatchAction({ type: "resetAll" })}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-3 text-base font-bold text-secondary-foreground transition-transform hover:scale-105"
                >
                  <RotateCcw className="size-4" />
                  {km.newMatch}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
