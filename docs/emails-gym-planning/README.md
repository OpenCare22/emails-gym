# Email's Gym — Claude Code implementation package

**Start here:** `CLAUDE_CODE_MASTER_PLAN.md`.

This package contains the original research-stage program data and science notes, the prior audit, approved visual direction, and a comprehensive implementation roadmap for three creation routes: curated templates, questionnaire personalization, and unrestricted manual authoring.

**Important:** `data/program-library-UNREVIEWED.json` contains seven proposed eight-week programs but has documented prescription issues. It is NOT approved production content. See `research/EMAILS_GYM_PROGRAM_AUDIT.md`.

## Using it
1. Unzip into your existing application repository, ideally under `docs/emails-gym-planning/` (do not overwrite source files by matching names).
2. Open Claude Code in the existing repo root.
3. Give Claude Code the "First message to Claude Code" in section 10 of `CLAUDE_CODE_MASTER_PLAN.md`.
4. Begin with repository inspection (Phase 0), then implement in small testable phases. Do not have Claude blindly rewrite the fork or publish the source plans.
5. Optional structural inspection: `python docs/emails-gym-planning/tools/inspect_source_library.py` (adjust path to actual installation location).

## Files
- `CLAUDE_CODE_MASTER_PLAN.md`: primary product requirements, domain model, flows, phase gates, tests, instructions.
- `research/A-exercise-science-report.md` through `E-claude-code-spec.md`: supplied research deliverables.
- `research/EMAILS_GYM_PROGRAM_AUDIT.md`: previously identified blocking and important issues.
- `data/program-library-UNREVIEWED.json`: source exercise catalogue and proposed workout prescriptions, deliberately unchanged.
- `design/EMAILS_GYM_CLAUDE_CODE_HANDOFF.md`: brand/UI design rules.
- `design/*.png` and `design/emails_gym_icon.svg`: screen and icon references.
- `tools/inspect_source_library.py`: basic diagnostic utility; does not certify program quality.

**What is not included:** the actual app source code or its schema. The repository integration and migration steps must be tailored by Claude Code after inspection. No medically qualified reviewer has approved these programs in this package.
