import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { addFavorite, removeFavorite, getFavorites } from "../services/userRepository.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler("Fetch favorites", async (req, res) => {
  const favorites = getFavorites(req.user!.userId);
  res.json({ favorites });
}));

router.post("/:address", asyncHandler("Add favorite", async (req, res) => {
  addFavorite(req.user!.userId, req.params.address as string);
  res.json({ success: true });
}));

router.delete("/:address", asyncHandler("Remove favorite", async (req, res) => {
  removeFavorite(req.user!.userId, req.params.address as string);
  res.json({ success: true });
}));

export default router;
