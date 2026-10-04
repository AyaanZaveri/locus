"""Summarize database oracle and production responses; flags need human review."""
import collections
import argparse
import json
import pathlib
import statistics

ROOT = pathlib.Path("reports/focus-model-evaluation")


def expected_answer(case):
    e = case["expected"]
    lines = []
    if "jobs" in e:
        for j in e["jobs"]:
            salary = j.get("salary", {})
            pay = f"; {salary.get('minimum'):,.0f}–{salary.get('maximum'):,.0f} {salary.get('currency')}/{salary.get('period')}" if salary.get("minimum") is not None and salary.get("maximum") is not None else ""
            lines.append(f"- **{j['companyName']} — {j['title']}**; status: {j['status']}{pay}; location: {j['location']}. [Source]({j['url']})")
        if not e["jobs"]:
            lines.append("- **No matching recorded jobs. Do not relax filters or infer real-world hiring status.**")
        if "retrieval" in e:
            r = e["retrieval"]
            lines.append(f"- Complete current-text coverage: {r['embeddedRecords']}/{r['eligibleRecords']} eligible records. These are candidates, not proven relevance matches.")
        if case["id"] == "salary-ranking":
            lines.append(f"- {e['totalMatches']} qualifying jobs across {e['totalCompanies']} companies; only the top three are requested. Preserve remote-friendly travel restrictions.")
            lines.append("- These are recorded salary fields, not independently verified current compensation offers. The third result is not a software role; don't silently replace it with a lower-paying engineering role.")
        if case["id"] == "cursor-semantic":
            lines.append("- Storage is the strongest direct fit: its description covers owning databases/caches, a resilient partitioned multi-database topology, and scaling the data layer. The other neighbors require responsibility-level explanation rather than a blanket storage claim.")
        if case["id"] in ["cross-company", "exa-unconfirmed"]:
            lines.append("- Exa's Distributed Data Systems description covers lakehouse architectures, hundreds-of-petabytes data systems, and pipelines spanning web crawling, training and real-time search. Exa and Cohere statuses in these results are unknown/unconfirmed, not confirmed open.")
    if "companies" in e:
        for c in e["companies"]:
            lines.append(f"- **{c['name']}**: {c.get('descriptionExcerpt','')} [Source]({c.get('sourceUrl')})")
        r = e.get("retrieval", {})
        lines.append(f"- Complete current-text About coverage: {r.get('embeddedRecords')}/{r.get('eligibleRecords')} companies. Product evidence, not scores alone, determines fit.")
    if "people" in e:
        for p in e["people"]:
            lines.append(f"- **{p['name']} — {p['role']}** at {p['companyName']}. [Source]({p.get('sourceUrl') or p.get('url')})")
    if "rounds" in e:
        for r in e["rounds"]:
            lines.append(f"- **{r['name']} — {r['stage']}**, announced **{r['announcedAt']}**, round amount **{r['amount']['display']} {r['amount']['currency']}**. [Source]({r['sourceUrl']})")
        lines.append(f"- {e['totalMatches']} matching recorded round(s); the round amount is not total funding.")
    return lines


def flags(case, result):
    issues = []
    if result["httpStatus"] != "200" or result["curlExitCode"] != 0 or not result["streamFinished"] or result["errors"]:
        issues.append("Transport/stream/tool error")
    if not result["answer"].strip():
        issues.append("No final answer text")
    main = [t for t in result["tools"] if t["name"] == case["tool"] and isinstance(t["output"], dict)]
    if not main:
        issues.append("Expected query tool not used; inspect alternative retrieval")
        return issues
    expected = case["expected"]
    actual = main[-1]["output"]
    for key in ["jobs", "companies", "people", "rounds"]:
        if key not in expected:
            continue
        want = expected[key]
        got = actual.get(key, [])
        identity = {"jobs": "url", "companies": "slug", "people": "name", "rounds": "sourceUrl"}[key]
        if [r.get(identity) for r in want] != [r.get(identity) for r in got]:
            issues.append("Returned " + key + " differ from deterministic oracle (review relevance/order/alternative tools)")
        if key == "jobs":
            lookup = {r.get("url"): r for r in want}
            for j in got:
                baseline = lookup.get(j.get("url"))
                if baseline and baseline.get("status") != j.get("status"):
                    issues.append("Hiring-status data mismatch")
    for k, v in case["input"].items():
        # Preview limits are not user constraints for count/no-result questions.
        if k == "limit" and case["id"] in ["exa-confirmed", "impossible-filters", "founders", "funding-window"]:
            continue
        if k in ["limit", "sortBy", "companySlugs", "status", "minimumSalary", "workplaceType", "location", "industry", "announcedAfter", "announcedBefore", "isFounder"]:
            got = main[-1]["input"].get(k)
            same = set(got or []) == set(v) if k == "companySlugs" else got == v
            if not same:
                issues.append(f"Requested input differs: {k} expected {v!r}, got {got!r}")
    if case["input"].get("semanticQuery"):
        r = actual.get("retrieval", {})
        if r.get("mode") != "semantic":
            issues.append("Semantic intent did not use semantic retrieval")
        if not r.get("completeCoverage"):
            issues.append("Unexpected incomplete coverage")
        if not r.get("queryCacheHit"):
            issues.append("Query cache miss; inspect exact query text")
    return list(dict.fromkeys(issues))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--remaining", action="store_true")
    args = parser.parse_args()
    input_name = "results-remaining.json" if args.remaining else "results.json"
    report_name = "results-remaining.md" if args.remaining else "results.md"
    checks_name = "automated-checks-remaining.json" if args.remaining else "automated-checks.json"
    review_name = "review-all-models.md" if args.remaining else "review.md"
    suite = json.loads((ROOT / "questions-and-expected.json").read_text())
    baseline = ["# Focus test questions and expected answers", "", f"Database snapshot: {suite['preparedAt']}. Expected answers use direct database tools, not model inference.", "", "Semantic ordering below is the deterministic vector baseline for the exact quoted query, not a declaration that all returned neighbors are equally relevant. A supported evidence-based choice may differ. Unknown status must not be described as confirmed open.", ""]
    for i, case in enumerate(suite["tests"], 1):
        baseline += [f"## {i}. {case['category']} (`{case['id']}`)", "", "**Question:** " + case["question"], "", "**Expected answer:**", ""] + expected_answer(case) + [""]
    (ROOT / "questions-and-answers.md").write_text("\n".join(baseline))
    if not (ROOT / input_name).exists():
        return
    data = json.loads((ROOT / input_name).read_text())
    cases = {t["id"]: t for t in suite["tests"]}
    summary = ["# Focus three-model production evaluation", "", "Endpoint: `https://locusaz.vercel.app/api/chat`. Nine fresh-session questions per model, 27 requests total. The API serves the site's Focus chat, including inline-card data; browser rendering was not tested.", "", "Expected answers: [questions-and-answers.md](questions-and-answers.md). Full machine-readable evidence: [results.json](results.json). Raw SSE and request payloads are retained locally in `.cache/focus-model-evaluation/`.", "", "## Automated checks (not a final quality score)", "", "These compare transport, tool inputs, returned records and cache/coverage to the deterministic oracle. Flags may be legitimate alternative retrieval or evidence-based ordering, so they require review. A clean check alone does not prove narrative accuracy.", "", "| Model | Clean checks | Flagged | Median seconds | Max seconds |", "| --- | ---: | ---: | ---: | ---: |"]
    summary[0] = f"# Focus production evaluation: {len(data['models'])} models"
    summary[2] = f"Endpoint: `https://locusaz.vercel.app/api/chat`. Nine fresh-session questions per model, {len(data['results'])} requests total. At most three concurrent lanes, one request per model at a time. The API serves the site's Focus chat, including inline-card data; browser rendering was not tested."
    summary[4] = f"Expected answers: [questions-and-answers.md](questions-and-answers.md). Full machine-readable evidence: [{input_name}]({input_name}). Raw SSE and requests are retained locally in `.cache/focus-model-evaluation/`."
    summary.insert(2, f"**Reviewed scores and findings:** [{review_name}]({review_name}).")
    for model in data["models"]:
        rows = [r for r in data["results"] if r["model"] == model]
        clean = sum(not flags(cases[r["caseId"]], r) for r in rows)
        summary.append(f"| {model} | {clean}/{len(rows)} | {len(rows)-clean} | {statistics.median(r['elapsedSeconds'] for r in rows):.1f} | {max(r['elapsedSeconds'] for r in rows):.1f} |")
    for case in suite["tests"]:
        summary += ["", f"## {case['category']} (`{case['id']}`)", "", "**Question:** " + case["question"], "", "**Expected answer:**", ""] + expected_answer(case)
        for result in [r for r in data["results"] if r["caseId"] == case["id"]]:
            issues = flags(case, result)
            summary += ["", "### " + result["model"], "", f"Time: {result['elapsedSeconds']:.1f}s. HTTP {result['httpStatus']}. Automated check: " + ("FLAGGED" if issues else "CLEAN") + ".", "", "**Actual final answer:**", "", result["answer"] or "*(No final text)*", "", "**Tool calls:**"]
            for tool in result["tools"]:
                summary.append("- `" + str(tool["name"]) + "` " + "`" + json.dumps(tool["input"], ensure_ascii=False) + "`")
            for issue in issues:
                summary.append("- **Review flag:** " + issue)
    (ROOT / report_name).write_text("\n".join(summary) + "\n")
    (ROOT / checks_name).write_text(json.dumps([{"model": r["model"], "caseId": r["caseId"], "flags": flags(cases[r["caseId"]], r)} for r in data["results"]], indent=2))


if __name__ == "__main__":
    main()
