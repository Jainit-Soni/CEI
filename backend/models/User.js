const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
    {
        firebaseUid: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        displayName: {
            type: String,
            default: "Anonymous User",
        },
        avatarUrl: {
            type: String,
            default: "",
        },
        favoriteColleges: [
            {
                type: String, // Storing college IDs
            },
        ],
        favoriteExams: [
            {
                type: String, // Storing exam IDs
            },
        ],
        deadlines: [
            {
                id: String,
                title: String,
                date: Date,
                type: {
                    type: String,
                    enum: ["exam", "application", "other"],
                    default: "application",
                },
                notes: String
            }
        ]
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
