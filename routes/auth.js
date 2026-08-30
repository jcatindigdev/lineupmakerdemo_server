const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const auth = require("../middleware/auth");
const isAdmin = require("../middleware/admin");

const router = express.Router();


router.post("/admin/create-user", auth, isAdmin, async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      isAdmin: newUserIsAdmin
    } = req.body;

    const trimmedUsername = username ? username.trim() : "";
    const trimmedEmail = email ? email.trim().toLowerCase() : "";

    if (!password || (!trimmedUsername && !trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Password is required, along with a username and/or an email."
      });
    }

    const orConditions = [];
    if (trimmedUsername) orConditions.push({ username: trimmedUsername });
    if (trimmedEmail) orConditions.push({ email: trimmedEmail });

    const existingUser = await User.findOne({ $or: orConditions });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username or email already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      ...(trimmedUsername && { username: trimmedUsername }),
      ...(trimmedEmail && { email: trimmedEmail }),
      password: hashedPassword,
      isAdmin: Boolean(newUserIsAdmin)
    });

    res.status(201).json({
      success: true,
      message: `${user.isAdmin ? "Admin" : "User"} account created successfully`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });

  } catch (error) {
    console.error("Create User Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


router.post("/login", async (req, res) => {
  try {
    const identifier = (req.body.identifier || req.body.email || "").trim();
    const { password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Username/email and password are required"
      });
    }

    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier }
      ]
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        isAdmin: user.isAdmin
      },
      process.env.JWT_SECRET || "YOUR_JWT_SECRET",
      {
        expiresIn: "1d"
      }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });

  } catch (error) {
    console.error("Login Server Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


router.put("/profile", auth, async (req, res) => {
  try {
    const { username, email } = req.body;
    const trimmedUsername = (username || "").trim();
    const trimmedEmail = (email || "").trim().toLowerCase();

    if (!trimmedUsername && !trimmedEmail) {
      return res.status(400).json({
        success: false,
        message: "Provide a username and/or an email to update."
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (trimmedUsername && trimmedUsername !== user.username) {
      const clash = await User.findOne({ username: trimmedUsername, _id: { $ne: user._id } });
      if (clash) {
        return res.status(400).json({ success: false, message: "That username is already taken." });
      }
      user.username = trimmedUsername;
    }

    if (trimmedEmail && trimmedEmail !== user.email) {
      const clash = await User.findOne({ email: trimmedEmail, _id: { $ne: user._id } });
      if (clash) {
        return res.status(400).json({ success: false, message: "That email is already in use." });
      }
      user.email = trimmedEmail;
    }

    await user.save();

    res.json({
      success: true,
      message: "Profile updated.",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });

  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current and new password are required."
      });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters."
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Current password is incorrect." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: "Password changed successfully." });

  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


router.get("/me", auth, async (req, res) => {
  try {

    const user = await User
      .findById(req.user.id)
      .select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
});

module.exports = router;