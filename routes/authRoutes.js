const express = require("express");
const router = express.Router();
const { register, login } = require("../controller/authController");

// Health/ping endpoint under auth to validate that routing is correct
router.get("/ping", (req, res) => {
	res.json({ ok: true, message: "Auth routes alive" });
});

router.post("/register", register);
router.post("/login", login);

module.exports = router;
