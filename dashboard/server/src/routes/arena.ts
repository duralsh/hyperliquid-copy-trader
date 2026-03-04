import { Router } from "express";
import { fetchMyFeed, createPost, deletePost } from "../services/arenaService.js";

const router = Router();

router.get("/feed", async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
    const data = await fetchMyFeed(page, pageSize, req.userContext?.arenaApiKey);
    res.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch arena feed";
    console.error("Arena feed error:", error);
    res.status(500).json({ error: msg });
  }
});

router.post("/post", async (req, res) => {
  try {
    const { content } = req.body as { content?: string };
    if (!content || !content.trim()) {
      res.status(400).json({ error: "Content is required" });
      return;
    }
    const post = await createPost(content.trim(), req.userContext?.arenaApiKey);
    res.json(post);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create post";
    console.error("Arena post error:", error);
    res.status(500).json({ error: msg });
  }
});

router.delete("/post/:threadId", async (req, res) => {
  try {
    const { threadId } = req.params;
    if (!threadId) {
      res.status(400).json({ error: "Thread ID is required" });
      return;
    }
    await deletePost(threadId, req.userContext?.arenaApiKey);
    res.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete post";
    console.error("Arena delete error:", error);
    res.status(500).json({ error: msg });
  }
});

export default router;
