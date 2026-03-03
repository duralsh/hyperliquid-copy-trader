import { Router } from "express";
import { getLogBuffer } from "../services/dockerLogService.js";

const router = Router();

router.get("/logs", (_req, res) => {
  const tail = parseInt(String(_req.query.tail ?? "500"), 10);
  const logs = getLogBuffer();
  res.json(logs.slice(-tail));
});

export default router;
