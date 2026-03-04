import type { Request, Response, NextFunction } from "express";

export function asyncHandler(
  label: string,
  fn: (req: Request, res: Response) => Promise<void>
) {
  return async (req: Request, res: Response, _next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error) {
      const msg = error instanceof Error ? error.message : `Failed: ${label}`;
      console.error(`${label} error:`, error);
      res.status(500).json({ error: msg });
    }
  };
}
