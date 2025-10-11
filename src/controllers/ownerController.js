const User = require("../models/User");
const mongoose = require("mongoose");
const { me } = require("./authController");

// List all owners (admin only)
exports.listOwners = async (req, res) => {
  try {
    const owners = await User.find({ role: "owner" })
      .select("-password")
      .populate("messId", "name");

    const formatted = owners.map((o) => ({
      id: o._id,
      username: o.username,
      name: o.name,
      contact: o.contact || "",
      email: o.email || "",
      isActive: o.isActive,
      subscriptionExpiry: o.subscriptionExpiry,
      messId: o.messId ? o.messId._id : null,
      messName: o.messId ? o.messId.name : null,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Error listing owners:", err);
    res.status(500).json({ error: "Failed to list owners" });
  }
};

// Get owner by id
exports.getOwner = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: "Invalid owner id" });
    const owner = await User.findById(id).select("-password");
    if (!owner || owner.role !== "owner")
      return res.status(404).json({ error: "Owner not found" });
    res.json(owner);
  } catch (err) {
    console.error("Error getting owner:", err);
    res.status(500).json({ error: "Failed to get owner" });
  }
};

// Create owner
exports.createOwner = async (req, res) => {
  try {
    const {
      username,
      password,
      name,
      contact,
      email,
      messId,
      subscriptionExpiry,
    } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: "username and password required" });

    const existing = await User.findOne({ username });
    if (existing)
      return res.status(400).json({ error: "Username already exists" });
    // If messId provided, validate mess exists and is not already owned
    let mess = null;
    if (messId) {
      if (!mongoose.isValidObjectId(messId))
        return res.status(400).json({ error: "Invalid messId" });

      const Mess = require("../models/Mess");
      mess = await Mess.findById(messId);
      if (!mess) return res.status(400).json({ error: "Mess not found" });
      if (mess.ownerId)
        return res.status(400).json({ error: "Mess already has an owner" });
    }

    const owner = new User({
      username,
      password,
      role: "owner",
      name: name || "",
      contact: contact || "",
      email: email || "",
      messId: messId || null,
      subscriptionExpiry: subscriptionExpiry
        ? new Date(subscriptionExpiry)
        : null,
    });

    await owner.save();

    if (mess) {
      try {
        mess.ownerId = owner._id;
        await mess.save();
      } catch (errAttach) {
        // rollback: remove created owner
        await owner.deleteOne();
        console.error(
          "Failed to attach owner to mess, rolled back owner creation",
          errAttach
        );
        return res
          .status(500)
          .json({ error: "Failed to assign owner to mess" });
      }
    }

    const out = owner.toObject();
    if (out.password) out.password = "<redacted>";
    console.log(out);
    res.status(201).json(out);
  } catch (err) {
    console.error("Error creating owner:", err);
    res.status(500).json({ error: "Failed to create owner" });
  }
};

// Update owner details (admin only)
exports.updateOwner = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: "Invalid owner id" });

    const allowed = [
      "name",
      "contact",
      "email",
      "messId",
      "subscriptionExpiry",
      "password",
    ];

    // load owner to ensure role and to trigger pre-save hooks when saving
    const owner = await User.findById(id);
    if (!owner || owner.role !== "owner")
      return res.status(404).json({ error: "Owner not found" });

    // apply allowed updates
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === "subscriptionExpiry") {
          owner.subscriptionExpiry = req.body.subscriptionExpiry
            ? new Date(req.body.subscriptionExpiry)
            : null;
        } else if (key === "password") {
          owner.password = req.body.password; // will be hashed by pre-save
        } else {
          owner[key] = req.body[key];
        }
      }
    }

    // handle mess reassignment if messId changed
    if (req.body.messId !== undefined) {
      const Mess = require("../models/Mess");
      const newMessId = req.body.messId || null;

      // if unassigning
      if (!newMessId) {
        if (owner.messId) {
          await Mess.findByIdAndUpdate(owner.messId, { ownerId: null });
          owner.messId = null;
        }
      } else {
        if (!mongoose.isValidObjectId(newMessId)) {
          return res.status(400).json({ error: "Invalid messId" });
        }
        const mess = await Mess.findById(newMessId);
        if (!mess) return res.status(400).json({ error: "Mess not found" });
        if (mess.ownerId && mess.ownerId.toString() !== owner._id.toString()) {
          return res.status(400).json({ error: "Mess already has an owner" });
        }

        // unlink previous mess if different
        if (owner.messId && owner.messId.toString() !== newMessId) {
          await Mess.findByIdAndUpdate(owner.messId, { ownerId: null });
        }

        // assign new mess
        mess.ownerId = owner._id;
        await mess.save();
        owner.messId = mess._id;
      }
    }

    await owner.save();
    const out = owner.toObject();
    if (out.password) out.password = "<redacted>";
    res.json({ message: "Owner updated", owner: out });
  } catch (err) {
    console.log(err);
    console.error("Error updating owner:", err);
    res.status(500).json({ error: "Failed to update owner", err: err });
  }
};

// Toggle isActive and optionally adjust subscriptionExpiry
exports.toggleActive = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: "Invalid owner id" });

    const owner = await User.findById(id);
    if (!owner || owner.role !== "owner")
      return res.status(404).json({ error: "Owner not found" });

    owner.isActive = !owner.isActive;

    // If toggled active, optionally extend subscription by provided days or set expiry
    const { extendDays, subscriptionExpiry } = req.body;
    if (subscriptionExpiry) {
      owner.subscriptionExpiry = new Date(subscriptionExpiry);
    } else if (extendDays && Number(extendDays) > 0) {
      const base =
        owner.subscriptionExpiry && owner.subscriptionExpiry > new Date()
          ? owner.subscriptionExpiry
          : new Date();
      base.setDate(base.getDate() + Number(extendDays));
      owner.subscriptionExpiry = base;
    }

    await owner.save();
    const out = owner.toObject();
    if (out.password) out.password = "<redacted>";
    res.json({ message: "Owner active toggled", owner: out });
  } catch (err) {
    console.error("Error toggling owner active:", err);
    res.status(500).json({ error: "Failed to toggle active" });
  }
};
