const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const User = require('../../models/User');
const emojis = require('../../utils/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stake')
        .setDescription('Lock your funds in the Void Bank to earn interest.')
        .addNumberOption(option => 
            option.setName('amount')
                .setDescription('The amount to lock')
                .setRequired(true)
        ),
    async execute(interaction) {
        let userData = await User.findOne({ userId: interaction.user.id });
        if (!userData) userData = await User.create({ userId: interaction.user.id });

        const amount = interaction.options.getNumber('amount');

        if (amount <= 0) {
            return interaction.reply({ content: '❌ Invalid amount.', flags: MessageFlags.Ephemeral });
        }

        if (userData.wallet < amount) {
            return interaction.reply({ content: '❌ Insufficient Funds.', flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${emojis.bank} Void Bank Deposit`)
            .setDescription(`Are you sure you want to lock **${emojis.currency} ${amount.toLocaleString()}** into the Void Bank to earn interest over time?`)
            .setColor('#121212');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_stake').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel_stake').setLabel('Cancel').setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        try {
            const confirmation = await response.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 60000 });

            if (confirmation.customId === 'confirm_stake') {
                let freshData = await User.findOne({ userId: interaction.user.id });
                if (freshData.wallet < amount) {
                    return confirmation.update({ content: '❌ Insufficient Funds.', embeds: [], components: [] });
                }

                freshData.wallet -= amount;
                freshData.stakeBalance = (freshData.stakeBalance || 0) + amount;
                
                if (!freshData.stakeTimestamp) {
                    freshData.stakeTimestamp = new Date();
                }
                
                await freshData.save();

                const successEmbed = new EmbedBuilder()
                    .setDescription(`${emojis.check} Successfully deposited **${emojis.currency} ${amount.toLocaleString()}** into the Void Bank.`)
                    .setColor('#2ECC71');

                await confirmation.update({ embeds: [successEmbed], components: [] });
            } else {
                await confirmation.update({ content: '❌ Transaction cancelled.', embeds: [], components: [] });
            }
        } catch (e) {
            await interaction.editReply({ content: '❌ Transaction cancelled.', embeds: [], components: [] });
        }
    }
};