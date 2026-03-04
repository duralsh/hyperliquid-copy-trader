import { Router } from "express";
import { fetchMyFeed, createPost, deletePost } from "../services/arenaService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.get("/feed", asyncHandler("Arena feed", async (req, res) => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
  const data = await fetchMyFeed(page, pageSize, req.userContext?.arenaApiKey);
  res.json(data);
}));

router.post("/post", asyncHandler("Arena post", async (req, res) => {
  const { content } = req.body as { content?: string };
  if (!content || !content.trim()) {
    res.status(400).json({ error: "Content is required" });
    return;
  }
  const post = await createPost(content.trim(), req.userContext?.arenaApiKey);
  res.json(post);
}));

router.delete("/post/:threadId", asyncHandler("Arena delete", async (req, res) => {
  const threadId = req.params.threadId as string;
  if (!threadId) {
    res.status(400).json({ error: "Thread ID is required" });
    return;
  }
  await deletePost(threadId, req.userContext?.arenaApiKey);
  res.json({ success: true });
}));

export default router;
