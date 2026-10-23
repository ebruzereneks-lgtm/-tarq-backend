const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Tüm bildirim işlemleri JWT gerektirir
router.use(requireAuth);

// Kullanıcının kendi bildirimlerini listele
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         user_id,
         title,
         message,
         is_read,
         created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Notifications error:", error);

    return res.status(500).json({
      message: "Failed to fetch notifications"
    });
  }
});

// Bildirimi okundu olarak işaretle
router.patch("/:id/read", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1
         AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Notification not found"
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Notification update error:", error);

    return res.status(500).json({
      message: "Failed to update notification"
    });
  }
});

// Kullanıcının kendi bildirimini sil
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM notifications
       WHERE id = $1
         AND user_id = $2
       RETURNING id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Notification not found"
      });
    }

    return res.json({
      message: "Notification deleted successfully"
    });
  } catch (error) {
    console.error("Notification delete error:", error);

    return res.status(500).json({
      message: "Failed to delete notification"
    });
  }
});

module.exports = router;