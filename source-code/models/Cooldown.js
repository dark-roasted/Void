const { Schema, model } = require('mongoose');

const cooldownSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    command: { type: String, required: true },
    expiresAt: { type: Date, required: true }
    // Cooldown time is a variable. We will set it when we create a cooldown entry.
});