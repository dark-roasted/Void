const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Server = require('../../models/Server');
const { buildMarketEmbed, buildMarketComponents, getRealMarketData } = require('../../utils/marketEngine');
const emojis = require('../../utils/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-market')
        .setDescription('Sets up the live Luna Stock Market terminal.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const stocksData = await getRealMarketData();
        
        if (!stocksData || stocksData.length === 0) {
            return interaction.editReply({ content: `Failed to connect to the API. Please wait and try again.` });
        }

        const embed = buildMarketEmbed(stocksData);
        const components = buildMarketComponents();

        const marketMsg = await interaction.channel.send({ embeds: [embed], components: components });

        let serverData = await Server.findOne({ guildId: interaction.guild.id });
        if (!serverData) serverData = new Server({ guildId: interaction.guild.id });

        serverData.marketChannelId = interaction.channel.id;
        serverData.marketMessageId = marketMsg.id;
        serverData.marketCategory = 'welcome';
        await serverData.save();

        await interaction.editReply({ content: `Market Setup accomplished successfully ${emojis.check}` });
    }
};
