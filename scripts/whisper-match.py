"""Whisper word-match per clip for native-voice sessions.

    python scripts/whisper-match.py recordings/<session> [--model medium]

Transcribes each n.mp4's audio with openai-whisper and scores how much of
the beat's spoken line the model actually said (word recall via a longest
common subsequence alignment). Writes recordings/<session>/whisper.json and
prints a table. Uses the ffmpeg binary from ffmpeg-static; nothing on PATH.
"""

import difflib
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FFMPEG_DIR = ROOT / "node_modules" / "ffmpeg-static"
os.environ["PATH"] = str(FFMPEG_DIR) + os.pathsep + os.environ.get("PATH", "")

import whisper  # noqa: E402  (after PATH so whisper.load_audio finds ffmpeg)


ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
        "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]


def int_words(n: int) -> str:
    """0..9999 as a presenter says it ("two hundred and ninety-three")."""
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 1000:
        rest = n % 100
        return ONES[n // 100] + " hundred" + ("" if rest == 0 else " and " + int_words(rest))
    rest = n % 1000
    return int_words(n // 1000) + " thousand" + ("" if rest == 0 else " " + int_words(rest))


def number_words(match: re.Match) -> str:
    """'$1.85' → 'one point eight five dollars'; '293%' → 'two hundred and ninety-three percent'."""
    dollars, whole, frac, pct = match.group(1), match.group(2), match.group(3), match.group(4)
    words = int_words(int(whole.replace(",", "")))
    if frac:
        words += " point " + " ".join(ONES[int(d)] for d in frac)
    if dollars:
        words += " dollars"
    if pct:
        words += " percent"
    return words


def normalise(text: str):
    """Lowercase words, with digits read out the way the narrator is told to say them."""
    text = text.lower().replace("’", "'")
    # "$1.85 million" → "1.85 million dollars" so the unit lands after the number.
    text = re.sub(r"\$(\d[\d,]*(?:\.\d+)?)\s+(million|billion|thousand)", r"\1 \2 dollars", text)
    text = re.sub(r"(\$)?(\d[\d,]*)(?:\.(\d+))?(%)?", number_words, text)
    text = text.replace("-", " ")
    text = re.sub(r"[^a-z' ]+", " ", text)
    return [w for w in text.split() if w]


def word_recall(expected: str, heard: str):
    a, b = normalise(expected), normalise(heard)
    if not a:
        return 0.0, 0, 0
    matcher = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    matched = sum(block.size for block in matcher.get_matching_blocks())
    return matched / len(a), matched, len(a)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    session = next((a for a in args if not a.startswith("--")), None)
    model_name = args[args.index("--model") + 1] if "--model" in args else "medium"
    if not session or not Path(session).is_dir():
        print(__doc__)
        sys.exit(1)
    session_dir = Path(session)
    clips = sorted(
        (p for p in session_dir.iterdir() if re.fullmatch(r"\d+\.mp4", p.name)),
        key=lambda p: int(p.stem),
    )
    if not clips:
        print("no clips in", session)
        sys.exit(1)

    print(f"loading whisper {model_name}…", flush=True)
    model = whisper.load_model(model_name)
    results = []
    for clip in clips:
        n = int(clip.stem)
        meta_file = session_dir / f"{n}.json"
        line = ""
        if meta_file.exists():
            line = json.loads(meta_file.read_text(encoding="utf8")).get("beat", {}).get("line", "")
        out = model.transcribe(str(clip), language="en", fp16=False)
        heard = out.get("text", "").strip()
        recall, matched, total = word_recall(line, heard)
        results.append(
            {
                "n": n,
                "line": line,
                "heard": heard,
                "wordRecall": round(recall, 3),
                "matched": matched,
                "words": total,
            }
        )
        print(f"{n:>2}  {recall*100:5.1f}%  {matched}/{total}  heard: {heard}", flush=True)

    summary = {
        "model": model_name,
        "clips": results,
        "meanWordRecall": round(sum(r["wordRecall"] for r in results) / len(results), 3),
    }
    (session_dir / "whisper.json").write_text(json.dumps(summary, indent=2), encoding="utf8")
    print(f"\nmean word recall {summary['meanWordRecall']*100:.1f}% -> {session_dir / 'whisper.json'}")


if __name__ == "__main__":
    main()
