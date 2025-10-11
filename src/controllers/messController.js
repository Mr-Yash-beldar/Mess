// src/controllers/messController.js
const Mess = require("../models/Mess");
const User = require("../models/User");

// @desc    Get all messes
// @route   GET /api/mess
// @access  Admin
exports.getAllMesses = async (req, res) => {
  try {
    const messes = await Mess.find().populate("ownerId", "name contact").lean();

    const formatted = messes.map((m) => {
      const owner = m.ownerId || null;
      const contact =
        m.contact && m.contact.trim()
          ? m.contact
          : owner && owner.contact
          ? owner.contact
          : "Not Provided";
      return {
        id: m._id,
        name: m.name,
        address: m.address || "",
        contact,
        capacity: m.capacity || 0,
        totalstudent: m.totalStudents || 0,
        ownerName: owner ? owner.name : null,
        totalRevenue: m.revenue || 0,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching messes:", error);
    res.status(500).json({ error: "Failed to fetch messes" });
  }
};

// @desc    Get messes without owners
// @route   GET /api/mess/unassigned
// @access  Admin
exports.getUnassignedMesses = async (req, res) => {
  try {
    const messes = await Mess.find({ ownerId: null });

    const formatted = messes.map((m) => {
      return {
        id: m._id,
        name: m.name,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching unassigned messes:", error);
    res.status(500).json({ error: "Failed to fetch unassigned messes" });
  }
};

// @desc    Get mess by ID
// @route   GET /api/mess/:id
// @access  Admin / Owner
exports.getMessById = async (req, res) => {
  try {
    const mess = await Mess.findById(req.params.id)
      .populate("ownerId", "name contact")
      .lean();
    if (!mess) return res.status(404).json({ error: "Mess not found" });

    const owner = mess.ownerId || null;
    const contact =
      mess.contact && mess.contact.trim()
        ? mess.contact
        : owner && owner.contact
        ? owner.contact
        : "Not Provided";

    const formatted = {
      id: mess._id,
      name: mess.name,
      address: mess.address || "",
      contact,
      capacity: mess.capacity || 0,
      totalstudent: mess.totalStudents || 0,
      ownerName: owner ? owner.name : null,
      totalRevenue: mess.revenue || 0,
    };

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching mess:", error);
    res.status(500).json({ error: "Failed to fetch mess" });
  }
};

// @desc    Create a new mess
// @route   POST /api/mess
// @access  Admin
exports.createMess = async (req, res) => {
  try {
    const { name, capacity, address, contact, ownerId } = req.body;
    if (!name || !capacity)
      return res.status(400).json({ error: "Name and capacity are required" });

    let owner = null;
    if (ownerId) {
      owner = await User.findById(ownerId);
      if (!owner || owner.role !== "owner")
        return res.status(400).json({ error: "Invalid owner selected" });

      // Ensure owner is not already assigned to another mess
      const existingMess = await Mess.findOne({ ownerId });
      if (existingMess)
        return res
          .status(400)
          .json({ error: "This owner is already assigned to a mess" });
    }

    const mess = await Mess.create({
      name,
      capacity,
      address,
      contact,
      ownerId: ownerId || null,
    });

    // Link mess to the owner if provided
    if (owner) {
      owner.messId = mess._id;
      await owner.save();
    }

    res.status(201).json({ message: "Mess created successfully", mess });
  } catch (error) {
    console.error("Error creating mess:", error);
    res.status(500).json({ error: "Failed to create mess" });
  }
};

// @desc Assign an owner to an existing mess
// @route POST /api/mess/:id/assign-owner
// @access Admin
exports.assignOwner = async (req, res) => {
  try {
    const { id } = req.params;
    const { ownerId } = req.body;

    const mess = await Mess.findById(id);
    if (!mess) return res.status(404).json({ error: "Mess not found" });

    if (!ownerId) return res.status(400).json({ error: "ownerId is required" });

    const owner = await User.findById(ownerId);
    if (!owner || owner.role !== "owner")
      return res.status(400).json({ error: "Invalid owner" });

    // Ensure owner is not already assigned to another mess
    const existing = await Mess.findOne({ ownerId });
    if (existing)
      return res.status(400).json({ error: "Owner already has a mess" });

    // If mess already had an owner, unlink previous owner
    if (mess.ownerId) {
      await User.findByIdAndUpdate(mess.ownerId, { messId: null });
    }

    mess.ownerId = owner._id;
    await mess.save();

    owner.messId = mess._id;
    await owner.save();

    res.json({ message: "Owner assigned to mess", mess });
  } catch (err) {
    console.error("Error assigning owner:", err);
    res.status(500).json({ error: "Failed to assign owner" });
  }
};

// @desc    Update mess details
// @route   PUT /api/mess/:id
// @access  Admin
exports.updateMess = async (req, res) => {
  try {
    const { name, capacity, address } = req.body;
    const mess = await Mess.findByIdAndUpdate(
      req.params.id,
      { name, capacity, address },
      { new: true }
    );

    if (!mess) return res.status(404).json({ error: "Mess not found" });
    res.json({ message: "Mess updated successfully", mess });
  } catch (error) {
    console.error("Error updating mess:", error);
    res.status(500).json({ error: "Failed to update mess" });
  }
};

// @desc    Delete mess
// @route   DELETE /api/mess/:id
// @access  Admin
exports.deleteMess = async (req, res) => {
  try {
    const mess = await Mess.findById(req.params.id);
    if (!mess) return res.status(404).json({ error: "Mess not found" });

    // Unlink owner’s messId
    await User.findByIdAndUpdate(mess.ownerId, { messId: null });

    await mess.deleteOne();
    res.json({ message: "Mess deleted successfully" });
  } catch (error) {
    console.error("Error deleting mess:", error);
    res.status(500).json({ error: "Failed to delete mess" });
  }
};
