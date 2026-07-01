const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/User');
const { t } = require('../../utils/i18n');
const { createVoidEmbed } = require('../../utils/ui');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('language')
        .setDescription('Set your preferred language / قم بتعيين لغتك المفضلة')
        .addStringOption(option => 
            option.setName('choice')
                .setDescription('Select English or Arabic')
                .setRequired(true)
                .addChoices(
                    { name: 'English', value: 'en' },
                    { name: 'العربية (Arabic)', value: 'ar' }
                )
        ),
    async execute(interaction) {
        const choice = interaction.options.getString('choice');
        let userData = await User.findOne({ userId: interaction.user.id });

        if (!userData) {
            userData = await User.create({ userId: interaction.user.id, language: choice });
        } else {
            userData.language = choice;
            await userData.save();
        }

        const msg = t(choice, 'langUpdated');
        const ui = createVoidEmbed(interaction.user, null, `🌐 **${msg}**`, '#2f3136');
        await interaction.reply(ui);
    }
};
