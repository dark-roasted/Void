const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Athena network and database latency.'),
    async execute(interaction) {
        const sent = await interaction.reply({ content: 'Pinging global network...', fetchReply: true });
        
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'Athena Network Status', iconURL: interaction.client.user.displayAvatarURL() })
            .addFields(
                { name: '📡 Gateway Latency', value: `\`${latency}ms\``, inline: true },
                { name: '🔌 API Latency', value: `\`${apiLatency}ms\``, inline: true }
            )
            .setColor('#2b2d31')
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });
    }
};