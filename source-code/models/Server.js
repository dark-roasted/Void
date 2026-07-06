const { Schema, model } = require('mongoose');

const serverSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    marketChannelId: { type: String, default: null },
    marketMessageId: { type: String, default: null },
    marketCategory: { type: String, default: 'welcome' },
    stocks: { type: Array, default: [] }
});

module.exports = model('Server', serverSchema);