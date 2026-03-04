import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { addFavorite, removeFavorite, getFavorites } from "../services/userRepository.js";

const router = Router();

router.use(requireAuth);

router.get("/", (req, res) => {
  try {
    const favorites = getFavorites(req.user!.userId);
    res.json({ favorites });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch favorites";
    console.error("Favorites error:", error);
    res.status(500).json({ error: msg });
  }
});

router.post("/:address", (req, res) => {
  try {
    addFavorite(req.user!.userId, req.params.address);
    res.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to add favorite";
    console.error("Add favorite error:", error);
    res.status(500).json({ error: msg });
  }
});

router.delete("/:address", (req, res) => {
  try {
    removeFavorite(req.user!.userId, req.params.address);
    res.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to remove favorite";
    console.error("Remove favorite error:", error);
    res.status(500).json({ error: msg });
  }
});

export default router;
