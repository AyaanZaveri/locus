#!/usr/bin/env python3
"""Rebuild benchmark statistics, tables and charts from the captured raw JSON.

Run: python3 benchmarks/generate.py
Matplotlib styling starts from the publication-grade beautiful_charts.py skill.
"""

from __future__ import annotations

import csv
import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CHART_HELPER = Path.home() / ".codex/skills/publication-grade-matplotlib/scripts"
if not (CHART_HELPER / "beautiful_charts.py").exists():
    CHART_HELPER = Path.home() / ".agents/skills/publication-grade-matplotlib/scripts"
sys.path.insert(0, str(CHART_HELPER))

import matplotlib.pyplot as plt
from beautiful_charts import TAILWIND, create_beautiful_chart, save_chart
from matplotlib.ticker import MaxNLocator


def load_json(name: str):
    return json.loads((ROOT / name).read_text())


def data_by_case():
    about = load_json("raw/about-initial.json")
    # The original Qwen request failed due to incorrect benchmark-adapter auth.
    # Preserve it in raw/about-initial.json; grade its corrected-auth rerun.
    retry = load_json("raw/qwen3.8-flash-about-auth-retry.json")
    about = [retry if item["model"] == retry["model"] else item for item in about]
    other = load_json("raw/compliance-and-jobs.json")
    rows = {case: {} for case in ("about", "compliance", "jobs")}
    for row in about:
        rows["about"][row["model"]] = row
    for row in other:
        rows[row["key"]][row["model"]] = row
    return rows


def calculate():
    cases = data_by_case()
    grades = load_json("grades.json")["models"]
    models = sorted(grades)
    assert all(set(cases[case]) == set(models) for case in cases), "Incomplete runs"
    summary = []
    for model in models:
        runs = {case: cases[case][model] for case in cases}
        assert all(run.get("text") and not run.get("error") for run in runs.values()), model
        times = [run["durationMs"] / 1000 for run in runs.values()]
        score = sum(grades[model][case]["score"] for case in cases)
        summary.append({
            "model": model,
            "scores": {case: grades[model][case]["score"] for case in cases},
            "gradeNotes": {case: grades[model][case]["note"] for case in cases},
            "scoreTotal": score,
            "latencySeconds": {case: round(runs[case]["durationMs"] / 1000, 3) for case in cases},
            "meanSeconds": round(statistics.mean(times), 3),
            "medianSeconds": round(statistics.median(times), 3),
            "minSeconds": round(min(times), 3),
            "maxSeconds": round(max(times), 3),
            "steps": {case: runs[case]["stepCount"] for case in cases},
            "stepsTotal": sum(run["stepCount"] for run in runs.values()),
            "toolCalls": {case: len(runs[case]["toolCalls"]) for case in cases},
            "toolCallsTotal": sum(len(run["toolCalls"]) for run in runs.values()),
        })
    return sorted(summary, key=lambda row: (-row["scoreTotal"], row["meanSeconds"]))


def write_stats(rows):
    (ROOT / "stats.json").write_text(json.dumps({
        "date": "2026-10-01",
        "nModels": len(rows),
        "nPromptsPerModel": 3,
        "nSuccessfulBenchmarkedRequests": len(rows) * 3,
        "notes": "One run per distinct prompt; scores are manually graded against the recorded database facts. Initial Qwen auth failure is archived separately, not scored.",
        "models": rows,
    }, indent=2) + "\n")
    with (ROOT / "summary.csv").open("w", newline="") as file:
        writer = csv.writer(file, lineterminator="\n")
        writer.writerow(["model", "score_of_3", "mean_seconds", "median_seconds", "about_seconds", "compliance_seconds", "jobs_seconds", "steps_total", "tool_calls_total"])
        for row in rows:
            writer.writerow([
                row["model"], row["scoreTotal"], row["meanSeconds"], row["medianSeconds"],
                *[row["latencySeconds"][case] for case in ("about", "compliance", "jobs")],
                row["stepsTotal"], row["toolCallsTotal"],
            ])


def write_charts(rows):
    labels = [row["model"].replace("-preview-free", " preview").replace("-contributor", "") for row in rows]
    chart_specs = (
        ("latency-by-prompt", [
            {"label": "About + employees", "x": labels, "y": [row["latencySeconds"]["about"] for row in rows], "color": TAILWIND["blue-400"]},
            {"label": "SOC 2 evidence", "x": labels, "y": [row["latencySeconds"]["compliance"] for row in rows], "color": TAILWIND["blue-600"]},
            {"label": "Full-stack job", "x": labels, "y": [row["latencySeconds"]["jobs"] for row in rows], "color": TAILWIND["indigo-600"]},
        ], "End-to-end latency by prompt", "Seconds; lower is better. One run per case.", "Seconds"),
        ("answer-quality", [
            {"x": labels, "y": [row["scoreTotal"] for row in rows], "color": TAILWIND["blue-600"]},
        ], "Answer quality against recorded facts", "Manual rubric: correct = 1, overconfident = 0.75, partial = 0.5, failed = 0.", "Score / 3"),
        ("tool-calls", [
            {"x": labels, "y": [row["toolCallsTotal"] for row in rows], "color": TAILWIND["blue-500"]},
        ], "Tool calls across three prompts", "Fewer is efficient only when the answers are correct.", "Calls"),
    )
    for filename, data, title, subtitle, ylabel in chart_specs:
        fig, ax = create_beautiful_chart(data, type="bar", title=title, subtitle=subtitle,
                                         ylabel=ylabel, figsize=(12.8, 6.4), legend=len(data) > 1)
        ax.tick_params(axis="x", labelrotation=28, labelsize=8)
        for label in ax.get_xticklabels():
            label.set_horizontalalignment("right")
        if filename == "answer-quality":
            ax.set_ylim(0, 3.35)
            ax.set_yticks([0, 1, 2, 3])
        elif filename == "tool-calls":
            ax.yaxis.set_major_locator(MaxNLocator(integer=True))
        fig.subplots_adjust(bottom=0.21)
        save_chart(fig, ROOT / "graphs" / filename, formats=("png", "svg"), dpi=300)
        svg_path = ROOT / "graphs" / f"{filename}.svg"
        svg_path.write_text("\n".join(line.rstrip() for line in svg_path.read_text().splitlines()) + "\n")
        plt.close(fig)


def write_markdown(rows):
    table = [
        "| Model | About | SOC 2 | Job | Mean | Median | Steps | Calls | Score |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in rows:
        grade = row["scoreTotal"]
        table.append(
            f'| `{row["model"]}` | '
            + " | ".join(f'{row["latencySeconds"][case]:.2f}s' for case in ("about", "compliance", "jobs"))
            + f' | {row["meanSeconds"]:.2f}s | {row["medianSeconds"]:.2f}s | {row["stepsTotal"]} | {row["toolCallsTotal"]} | {grade:g}/3 |'
        )
    findings = [
        "# Locus Focus model benchmark",
        "",
        "**October 1, 2026 · 8 models · 3 prompts each · 24 scored requests.** One run per prompt; this is a directional benchmark, not a statistical performance guarantee. GPT 6 Luna is now the production model; the test itself did not change that setting.",
        "",
        "## Method",
        "",
        "Each request used the production Locus Focus system prompt, database-verified current-page context, the same read-only tools, and AI SDK `streamText` with a seven-step cap. Providers used the OpenCode Go endpoints: Responses for GPT 6 Luna and Muse, Messages for Qwen, Chat Completions for the rest. Timings include database context loading, tool execution, model calls, and response generation, but not client rendering. Two requests were run concurrently in the local Next.js development server. Steps are model-generation steps; calls count tool invocations. An initial Qwen Messages authentication configuration failure is kept in raw data, but the correctly authenticated rerun is scored.",
        "",
        "| Case | Page | Prompt | Ground truth |",
        "| --- | --- | --- | --- |",
        '| About | `/company/autumn-ai` | “What does this company do and how many employees does it have?” | Source-backed people/company research; **2 employees**. |',
        '| SOC 2 | `/companies` | “Which companies mention SOC 2 Type 1 certification in their about text or activity? Name one and distinguish whether Type 2 is already certified.” | **Context.dev** claims Type 1; May 18, 2026 activity says Type 2 entered an observation period. Current Type 2 status is not established. |',
        '| Job | `/company/anthropic` | “Recommend one job here related to full-stack engineering. Give the exact title and location.” | **Senior Software Engineer, Full-stack**, San Francisco / New York / Seattle is one correct open role. |',
        "",
        "## Results",
        "",
        "Seconds are end-to-end. Scores follow the [manual grading rubric](grades.json); 0.75 means a correct core answer with an unsupported present-day Type 2 assertion.",
        "",
        *table,
        "",
        "![Latency by prompt](graphs/latency-by-prompt.png)",
        "",
        "![Answer quality](graphs/answer-quality.png)",
        "",
        "![Tool calls](graphs/tool-calls.png)",
        "",
        "## Findings",
        "",
        "- **GPT 6 Luna:** 3/3 unqualified correct, shortest average total latency (6.29s), and only three tool calls. Its Type 2 wording was properly limited to what the database showed.",
        "- **GLM-5.3-Flash:** fast, accurate on the core facts, but overclaimed that Type 2 was *still* uncertified based on a dated observation-period announcement.",
        "- **DeepSeek V4.1 Flash:** correct core facts but six `searchKnowledge` calls for one compliance question; more calls and longer latency than GPT 6 Luna.",
        "- **LongCat 2.5 and MiMo V2.6 Flash:** correct core facts, but the same Type 2 overclaim; MiMo's job case took 46.05 seconds.",
        "- **Muse Spark 1.3:** qualified Type 2 appropriately, but the two complex cases each took about 40 seconds and used extra tools.",
        "- **Space Bunny Free:** quick on About and jobs. In compliance it retrieved Context.dev but its final answer only said “No other company” without naming the requested match.",
        "- **Qwen3.8 Flash:** its compliance task took 89.69 seconds and detoured through SOC 1; it failed the job task by asking the user what they wanted rather than recommending a role.",
        "",
        "**Decision:** switch the production Locus model to `gpt-6-luna` using the Responses API. Keep `glm-5.3-flash` as a potential fast fallback, subject to stricter qualification of dated compliance claims.",
        "",
        "## Data and limitations",
        "",
        "- [Raw initial About responses](raw/about-initial.json), [raw SOC 2 and job responses](raw/compliance-and-jobs.json), and [corrected Qwen About response](raw/qwen3.8-flash-about-auth-retry.json) preserve inputs, timings, tool calls/results, final text, and errors where captured. Qwen's original auth error remains in the initial raw file.",
        "- [Machine-readable stats](stats.json), [CSV summary](summary.csv), and [grading rationales](grades.json) can be regenerated with `python3 benchmarks/generate.py` (matplotlib and the local publication-grade chart helper required). Each graph is also exported as SVG in [`graphs/`](graphs/).",
        "- These were single runs on different tasks, **not three repeats of the same prompt**. Mean and median describe this workload only; they are not confidence intervals or throughput limits. Provider load, prompt caching, local dev overhead, and concurrency may affect latency.",
        "- The benchmark tested the server-side research path, not the browser's navigation/highlighting UI. The compliance ground truth is what Locus recorded, not independent verification of a live audit report.",
        "",
    ]
    (ROOT / "README.md").write_text("\n".join(findings))


if __name__ == "__main__":
    rows = calculate()
    write_stats(rows)
    write_charts(rows)
    write_markdown(rows)
    print("Wrote benchmark tables, stats, and three PNG/SVG chart pairs.")
