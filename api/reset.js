const mongoose = require("mongoose");

let isConnected = false;
async function connectToDatabase() {
    if (isConnected) return;
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
}

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

    // Simple secret key guard — set RESET_SECRET in Vercel env vars
    const { secret } = req.body || {};
    if (!process.env.RESET_SECRET || secret !== process.env.RESET_SECRET) {
        return res.status(401).json({ success: false, message: "Unauthorized. Wrong or missing secret." });
    }

    try {
        await connectToDatabase();

        // Drop Users collection
        const userResult = await mongoose.connection.collection("users").deleteMany({});

        // Reset FMUID counter to 0
        const counterResult = await mongoose.connection.collection("counters").updateOne(
            { _id: "fmuid" },
            { $set: { seq: 0 } },
            { upsert: true }
        );

        return res.status(200).json({
            success: true,
            message: "Database cleared successfully.",
            usersDeleted: userResult.deletedCount,
            counterReset: counterResult.acknowledged
        });

    } catch (error) {
        console.error("Reset Error:", error);
        return res.status(500).json({ success: false, message: "Error: " + error.message });
    }
};
