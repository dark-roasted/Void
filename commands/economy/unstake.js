const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const User = require('../../models/User');
const emojis = require('../../utils/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unstake')
        .setDescription('Withdraw your funds and accumulated interest from the Void Bank.')
        .addNumberOption(option => 
            option.setName('amount')
                .setDescription('The amount to withdraw')
                .setRequired(true)
        ),
    async execute(interaction) {
        let userData = await User.findOne({ userId: interaction.user.id });
        if (!userData) userData = await User.create({ userId: interaction.user.id });

        const amount = interaction.options.getNumber('amount');

        if (amount <= 0) {
            return interaction.reply({ content: '❌ Invalid amount.', flags: MessageFlags.Ephemeral });
        }

        if (!userData.stakeBalance || userData.stakeBalance < amount) {
            return interaction.reply({ content: '❌ Insufficient Funds in Void Bank.', flags: MessageFlags.Ephemeral });
        }

        let interestEarned = 0;
        if (userData.stakeTimestamp) {
            const hoursPassed = (Date.now() - userData.stakeTimestamp.getTime()) / (1000 * 60 * 60);
            if (hoursPassed > 1) {
                const interestRate = 0.005; 
                interestEarned = Math.floor(amount * (interestRate * hoursPassed));
            }
        }

        const totalReturn = amount + interestEarned;

        userData.stakeBalance -= amount;
        userData.wallet += totalReturn;

        if (userData.stakeBalance <= 0) {
            userData.stakeTimestamp = null;
        }

        await userData.save();

        const successEmbed = new EmbedBuilder()
            .setTitle(`${emojis.check} Withdrawal Complete`)
            .setDescription(`Successfully withdrew **${emojis.currency} ${amount.toLocaleString()}** from the Void Bank.\n\n> 📈 **Interest Earned:** ${emojis.currency} ${interestEarned.toLocaleString()}\n> 💰 **Total Received:** ${emojis.currency} ${totalReturn.toLocaleString()}`)
            .setColor('#2ECC71');

        await interaction.reply({ embeds: [successEmbed] });
    }
};
