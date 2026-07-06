const { Schema, model } = require('mongoose');

const userSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    wallet: { type: Number, default: 0 },
    bank: { type: Number, default: 0 },
    stockWallet: { type: Number, default: 0 },
    stakeBalance: { type: Number, default: 0 },
    stakeTimestamp: { type: Date, default: null },
    portfolio: { type: Map, of: Number, default: {} },
    portfolioAvgPrice: { type: Map, of: Number, default: {} },
    lastWork: { type: Date, default: null },
    lastDaily: { type: Date, default: null },
    dailyStreak: { type: Number, default: 0 },
    language: { type: String, default: 'en' }
});

module.exports = model('User', userSchema);