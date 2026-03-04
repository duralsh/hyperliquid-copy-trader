# Code Quality Rules

- **Use typed error classes and `ErrorHandler.formatError()` for all error handling.** Never throw raw `Error` or use bare `console.error` in business logic. Use the domain-specific error classes from `src/copytrading/utils/errors.ts` (`TradingError`, `NetworkError`, `ValidationError`, etc.) and always log errors via `logger` with a structured context object (e.g., `logger.error("msg", { ...ErrorHandler.formatError(error), coin })`). Use `retryWithBackoff` for retryable operations like API/WebSocket calls.

- **Dashboard UI (`dashboard/client/`) must follow a polished terminal/hacker aesthetic.** Use a dark background (`#0a0e14`), monospace font (JetBrains Mono), and accent colors green (`#00ff41`) and amber (`#ffb000`). Apply subtle scanline overlay effects, blinking cursor accents, and ASCII-art section headers — but keep the overall look professional and clean, never toy-like. Every data table or list component MUST support column sorting and filtering. Numbers must use `font-variant-numeric: tabular-nums` for fixed-width alignment. Color-code values semantically: green for profit/positive values, red (`#ff0040`) for loss/negative values, amber for labels/identifiers, and dim/muted (`#4a5568`) for secondary information.

## Testing Rules

- **All tests must pass before confirming any change.** Run `npm test` and verify zero failures before declaring a task complete. Never merge, commit, or present work as done with failing tests.
- **Every new feature or bug fix must include tests.** Extend the existing test suites (`src/copytrading/utils/__tests__/risk.test.ts`, `src/copytrading/__tests__/copyTrader.test.ts`) or create new `*.test.ts` files as appropriate. No feature is complete without corresponding test coverage.

## Workflow Rule

Always delegate every task to a subagent. Never execute tasks directly in the main conversation context. Use the appropriate specialized subagent if one exists, otherwise use a general-purpose subagent via the Task tool.
