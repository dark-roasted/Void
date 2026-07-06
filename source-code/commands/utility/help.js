const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('View all available Athena systems.'),
    async execute(interaction) {
        let userData = await User.findOne({ userId: interaction.user.id });
        if (!userData) userData = await User.create({ userId: interaction.user.id });

        const helpEmbed = new EmbedBuilder()
            .setAuthor({ name: 'Athena OS', iconURL: interaction.client.user.displayAvatarURL() })
            .setTitle('Void System')
            .setDescription(`There's. commands and its categories so you could execute them when you wish!`)
            .addFields(
                { name: '💳 Economy', value: '`/profile` `/daily` `/work` `/give` `/leaderboard` `/coinflip`', inline: false },
                { name: '📈 Market', value: '`/setup-market`', inline: false },
                { name: '⚙️ Tools', value: '`/help`', inline: false }
            )
            .setColor('#F5F5F7')
            .setFooter({ text: 'Designed by Athena' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('nav_eco')
                .setLabel('Economy')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('nav_market')
                .setLabel('Market')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [helpEmbed], components: [row] });
    }
};