"""WP8 acceptance criterion 3: does each beat's split Saskia narration
contain only its own line, and not a neighbour's?

    python scripts/saskia-split-check.py recordings/<session> [--model medium]

Independent of however the split was made (ElevenLabs timestamps or the
ffmpeg silence-gap fallback — app/api/voice's `splitMethod`): this
transcribes each beat's own <n>.mp3 with Whisper and checks it two ways,
using the same word-recall machinery as scripts/whisper-match.py:

  1. own-line recall: how much of this beat's `delivery` text (stripped of
     expression tags) Whisper actually heard in <n>.mp3.
  2. bleed: whether a run of 2+ consecutive words that belong to a
     neighbouring beat's line (and not this beat's) turns up in what
     Whisper heard — evidence the split cut fell inside the wrong beat.

Writes recordings/<session>/saskia-split-check.json (read by
scripts/report.mjs) and prints a table. Requires openai-whisper; uses the
ffmpeg binary from ffmpeg-static, nothing needed on PATH.
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
    dollars, whole, frac, pct = match.group(1), match.group(2), match.group(3), match.group(4)
    out = int_words(int(whole.replace(",", "")))
    if frac:
        out += " point " + " ".join(ONES[int(d)] for d in frac)
    if dollars:
        out += " dollars"
    if pct:
        out += " percent"
    return out


def normalise(text: str):
    """Lowercase words, with digits read out the way the narrator is told to say them."""
    text = text.lower().replace("’", "'")
    text = re.sub(r"\$(\d[\d,]*(?:\.\d+)?)\s+(million|billion|thousand)", r"\1 \2 dollars", text)
    text = re.sub(r"(\$)?(\d[\d,]*)(?:\.(\d+))?(%)?", number_words, text)
    text = re.sub(r"\[[^\]]*\]", " ", text)  # strip ElevenLabs expression tags
    text = text.replace("-", " ")
    text = re.sub(r"[^a-z' ]+", " ", text)
    return [w for w in text.split() if w]


def word_recall(expected, heard):
    a, b = normalise(expected), normalise(heard)
    if not a:
        return 0.0, 0, 0
    matcher = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    matched = sum(block.size for block in matcher.get_matching_blocks())
    return matched / len(a), matched, len(a)


def bleed_run(neighbour_only_words, heard_words, min_run=2):
    """True if a run of `min_run`+ consecutive neighbour-only words appears in heard, in order."""
    if len(neighbour_only_words) < min_run:
        return False
    heard_text = " " + " ".join(heard_words) + " "
    for size in (3, 2):
        for i in range(len(neighbour_only_words) - size + 1):
            phrase = " " + " ".join(neighbour_only_words[i : i + size]) + " "
            if phrase in heard_text:
                return True
    return False


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

    mp3s = sorted(
        (p for p in session_dir.iterdir() if re.fullmatch(r"\d+\.mp3", p.name)),
        key=lambda p: int(p.stem),
    )
    if not mp3s:
        print("no split narration (n.mp3) in", session)
        sys.exit(1)

    beats = {}
    for mp3 in mp3s:
        n = int(mp3.stem)
        meta_file = session_dir / f"{n}.json"
        line = ""
        if meta_file.exists():
            rec = json.loads(meta_file.read_text(encoding="utf8"))
            line = rec.get("beat", {}).get("delivery") or rec.get("beat", {}).get("line", "")
        beats[n] = line
    order = sorted(beats)

    print(f"loading whisper {model_name}…", flush=True)
    model = whisper.load_model(model_name)

    results = []
    bleeds = 0
    for idx, n in enumerate(order):
        mp3 = session_dir / f"{n}.mp3"
        own_line = beats[n]
        out = model.transcribe(str(mp3), language="en", fp16=False)
        heard = out.get("text", "").strip()
        recall, matched, total = word_recall(own_line, heard)

        own_words = set(normalise(own_line))
        heard_words = normalise(heard)
        neighbours_hit = []
        for offset in (-1, 1):
            j = idx + offset
            if 0 <= j < len(order):
                neighbour_n = order[j]
                neighbour_words_ordered = normalise(beats[neighbour_n])
                neighbour_only = [w for w in neighbour_words_ordered if w not in own_words]
                if bleed_run(neighbour_only, heard_words):
                    neighbours_hit.append(neighbour_n)
        if neighbours_hit:
            bleeds += 1

        results.append(
            {
                "n": n,
                "line": own_line,
                "heard": heard,
                "ownRecall": round(recall, 3),
                "matched": matched,
                "words": total,
                "bleedFromBeats": neighbours_hit,
            }
        )
        flag = f"  BLEED from {neighbours_hit}" if neighbours_hit else ""
        print(f"{n:>2}  own {recall*100:5.1f}%  {matched}/{total}{flag}  heard: {heard}", flush=True)

    summary = {
        "model": model_name,
        "beats": results,
        "meanOwnRecall": round(sum(r["ownRecall"] for r in results) / len(results), 3),
        "bleeds": bleeds,
    }
    (session_dir / "saskia-split-check.json").write_text(json.dumps(summary, indent=2), encoding="utf8")
    print(f"\nmean own-line recall {summary['meanOwnRecall']*100:.1f}%, {bleeds} beat(s) with a neighbour's words -> {session_dir / 'saskia-split-check.json'}")


if __name__ == "__main__":
    main()
