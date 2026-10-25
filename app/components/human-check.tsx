"use client";

import { useState } from "react";
import "./human-check.css";

/**
 * A lightweight "I'm not a robot" check that keeps automated sign-ups out.
 * No third-party script is loaded: the visitor proves there is a person on the
 * other side by tapping the matching picture, and the result is reported to the
 * form that owns it.
 */
const PUZZLES = [
  { target: "🥕", prompt: "Tap the carrot" },
  { target: "🍅", prompt: "Tap the tomato" },
  { target: "🌽", prompt: "Tap the corn" },
  { target: "🧄", prompt: "Tap the garlic" },
  { target: "🥔", prompt: "Tap the potato" },
  { target: "🥬", prompt: "Tap the cabbage" },
] as const;

const DISTRACTORS = ["🍎", "🍌", "🍇", "🥑", "🍋", "🌶", "🫑", "🍠", "🥦", "🍐"];

type Challenge = { target: string; prompt: string; tiles: string[] };

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function newChallenge(): Challenge {
  const puzzle = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
  const tiles = shuffled([puzzle.target, ...shuffled(DISTRACTORS).slice(0, 5)]);
  return { target: puzzle.target, prompt: puzzle.prompt, tiles };
}

export function HumanCheck({
  verified,
  onChange,
  disabled = false,
}: {
  verified: boolean;
  onChange: (verified: boolean) => void;
  disabled?: boolean;
}) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [wrong, setWrong] = useState(false);

  function start() {
    if (disabled || verified) return;
    setWrong(false);
    setChallenge(newChallenge());
  }

  function choose(tile: string) {
    if (!challenge) return;
    if (tile === challenge.target) {
      onChange(true);
      setChallenge(null);
      setWrong(false);
      return;
    }
    setWrong(true);
    onChange(false);
    setChallenge(newChallenge());
  }

  return (
    <div className={verified ? "human-check is-verified" : "human-check"} aria-live="polite">
      <button
        type="button"
        className="human-check-head"
        onClick={verified ? () => { onChange(false); setChallenge(null); } : start}
        disabled={disabled}
        aria-pressed={verified}
      >
        <span className="human-check-box" aria-hidden="true">{verified ? "✓" : ""}</span>
        <span className="human-check-copy">
          <strong>{verified ? "You are verified" : "I'm not a robot"}</strong>
          <small>
            {verified
              ? "Thanks — you can continue. Tap to reset."
              : challenge
                ? challenge.prompt
                : "A quick human check before we send your code."}
          </small>
        </span>
        <span className="human-check-badge" aria-hidden="true">{verified ? "🔒" : "🛡"}</span>
      </button>

      {challenge && (
        <div className="human-check-tiles" role="group" aria-label={challenge.prompt}>
          {challenge.tiles.map((tile) => (
            <button
              key={tile}
              type="button"
              className="human-check-tile"
              onClick={() => choose(tile)}
              aria-label={`Choose ${tile}`}
            >
              <span aria-hidden="true">{tile}</span>
            </button>
          ))}
        </div>
      )}

      {wrong && !verified && <p className="human-check-error" role="alert">That was not the right picture. One more try — {challenge?.prompt.toLowerCase()}.</p>}
    </div>
  );
}
