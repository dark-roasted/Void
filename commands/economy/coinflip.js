const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const { t } = require('../../utils/i18n');
const emojis = require('../../utils/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Gamble your money on a coinflip.')
        .addStringOption(option =>
            option.setName('side')
                .setDescription('Heads or Tails')
                .setRequired(true)
                .addChoices(
                    { name: 'Heads', value: 'heads' },
                    { name: 'Tails', value: 'tails' }
                ))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to gamble')
                .setRequired(true)
                .setMinValue(1)),
    async execute(interaction) {
        const side = interaction.options.getString('side');
        const amount = interaction.options.getInteger('amount');

        let userData = await User.findOne({ userId: interaction.user.id });
        if (!userData) userData = await User.create({ userId: interaction.user.id });
        const lang = userData.language || 'en';

        if (userData.wallet < amount) {
            return interaction.reply({ content: t(lang, 'insufficientFunds'), ephemeral: true });
        }

        const spinEmbed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setDescription(`🪙 **${t(lang, 'coinflipSpin')}**\n\nBet: **${emojis.currency} ${amount.toLocaleString()}** on **${side.toUpperCase()}**`)
            .setColor('#2b2d31');

        await interaction.reply({ embeds: [spinEmbed] });

        const isHeads = Math.random() < 0.5;
        const resultSide = isHeads ? 'heads' : 'tails';
        const won = side === resultSide;

        if (won) {
            userData.wallet += amount;
        } else {
            userData.wallet -= amount;
        }

        await userData.save();

        setTimeout(async () => {
            const finalDesc = won 
                ? t(lang, 'coinflipWin', { side: resultSide.toUpperCase(), amount: amount.toLocaleString() })
                : t(lang, 'coinflipLoss', { side: resultSide.toUpperCase(), amount: amount.toLocaleString() });

            const finalEmbed = new EmbedBuilder()
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
                .setTitle(won ? t(lang, 'coinflipWinTitle') : t(lang, 'coinflipLossTitle'))
                .setDescription(finalDesc.replace(/\$/g, `${emojis.currency} `))
                .addFields({ name: t(lang, 'wallet'), value: `${emojis.wallet} **${emojis.currency} ${userData.wallet.toLocaleString()}**`, inline: true })
                .setColor(won ? '#57F287' : '#ED4245');

            await interaction.editReply({ embeds: [finalEmbed] });
        }, 2500);
    }
};
