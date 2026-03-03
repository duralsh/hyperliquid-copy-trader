---
name: optimize
description: Optimize code without breaking features. Removes redundancy, deduplicates code, improves performance, cleans dead code, and strengthens type safety. Run with /optimize or /optimize src/path/to/file.ts for targeted optimization.
tools: Read, Glob, Grep, Edit, Write, Bash, Agent
---

# Code Optimizer

Systematically optimize code in the current project without breaking any existing functionality. This skill is surgical — it improves code quality while preserving behavior exactly.

## Scope

When invoked with a path argument (e.g., `/optimize src/copytrading/`), optimize only that directory or file.
When invoked without arguments (e.g., `/optimize`), optimize the entire codebase.

## Optimization Passes

Execute these passes IN ORDER. Each pass should be completed fully before moving to the next. Use subagents to parallelize independent work within each pass.

### Pass 1: Dead Code Removal

Find and remove code that is never used:
- Unused imports (imported but never referenced)
- Unused variables, functions, classes, types, interfaces
- Commented-out code blocks (not documentation comments — actual dead code)
- Unreachable code after return/throw/break/continue
- Empty catch blocks, no-op functions, placeholder stubs that do nothing
- Unused dependencies in package.json

**How to verify:** Run `npx tsc --noEmit` (TypeScript) or the project's lint command after removals. If something breaks, revert that specific removal.

### Pass 2: Code Deduplication

Find repeated patterns and consolidate them:
- Identical or near-identical functions across files → extract to a shared utility
- Repeated API call patterns → create a generic helper
- Duplicated type definitions → single source of truth
- Repeated error handling blocks → extract to a shared handler
- Copy-pasted configuration objects → centralize
- Identical fetch/request patterns → create a reusable wrapper

**Rules:**
- Only deduplicate when 3+ instances exist (2 is acceptable repetition)
- The shared utility must be in a logical location (e.g., `utils/`, `shared/`, or a relevant module)
- Do NOT create premature abstractions for things that happen to look similar but serve different purposes

### Pass 3: Type Safety & Correctness

Strengthen types without changing runtime behavior:
- Replace `any` with proper types where inferable
- Add missing return types to exported functions
- Replace type assertions (`as Type`) with type guards where safer
- Fix potential null/undefined issues (add null checks where a value could be null)
- Replace `== null` with `=== null || === undefined` for clarity (or vice versa for consistency)
- Ensure error handling catches produce typed errors, not `unknown`

**Do NOT:**
- Add types to every internal/private function (only exported APIs)
- Change working `any` on 3rd-party library interop where the type is genuinely unknown

### Pass 4: Performance

Identify and fix low-hanging performance issues:
- Replace sequential awaits with `Promise.all` where operations are independent
- Add missing caching for expensive repeated computations
- Replace `array.find()` in loops with `Map`/`Set` lookups for O(1) access
- Remove unnecessary re-renders in React (missing `useCallback`/`useMemo` for expensive ops passed as props)
- Fix N+1 query patterns (fetching in a loop instead of batch)
- Remove redundant API calls (same data fetched multiple times)

**Do NOT:**
- Prematurely optimize hot paths that aren't actually hot
- Add memoization everywhere — only where profiling or clear analysis shows benefit
- Change data structures just for theoretical Big-O improvement on small datasets

### Pass 5: Code Clarity

Improve readability without changing behavior:
- Simplify nested conditionals (early returns, guard clauses)
- Replace magic numbers/strings with named constants
- Consolidate related imports
- Fix inconsistent naming conventions within a file
- Simplify overly complex expressions (ternary chains, nested boolean logic)
- Remove unnecessary intermediate variables that obscure data flow

**Do NOT:**
- Rewrite working code in a "preferred" style
- Add comments explaining obvious code
- Rename variables that are already clear from context
- Restructure files or move code between files (that's refactoring, not optimization)

### Pass 6: Dependency & Bundle Cleanup

- Identify unused npm dependencies (`depcheck` or manual analysis)
- Flag dependencies that could be replaced with smaller alternatives
- Check for duplicate dependencies (different versions of same package)
- Ensure dev dependencies aren't in production dependencies

## Execution Rules

1. **ALWAYS delegate work to subagents** per the project's workflow rule
2. **Read before edit** — never modify code you haven't read
3. **One logical change per edit** — don't combine unrelated optimizations in a single edit
4. **Verify after each pass** — run the TypeScript compiler and/or tests after each pass to ensure nothing broke
5. **Track what you changed** — output a summary table at the end:

```
| Pass | File | Change | Lines Removed | Lines Added |
|------|------|--------|---------------|-------------|
| 1    | src/foo.ts | Removed unused import `bar` | 1 | 0 |
| 2    | src/utils.ts | Extracted shared `fetchWithRetry` from 3 files | 0 | 15 |
```

6. **If unsure, skip it** — when in doubt about whether a change is safe, leave it alone
7. **Never change tests** — tests validate behavior; changing them defeats the purpose
8. **Rebuild after all passes** — run the full build to confirm everything works

## Output

After all passes, provide:
1. Summary table of all changes
2. Total lines removed vs added (net reduction is the goal)
3. List of any issues found but intentionally NOT fixed (with reasoning)
4. Build/compile verification result
