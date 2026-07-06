const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/User');
const { createVoidEmbed } = require('../../utils/ui');
const emojis = require('../../utils/emojis');
const { t } = require('../../utils/i18n');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Attempt to steal from another user.')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to rob')
                .setRequired(true)
        ),
    async execute(interaction) {
        let attackerData = await User.findOne({ userId: interaction.user.id });
        if (!attackerData) attackerData = await User.create({ userId: interaction.user.id });
        
        const lang = attackerData.language || 'en';
        const targetUser = interaction.options.getUser('target');

        if (targetUser.bot) {
            return interaction.reply({ content: 'You cannot rob bots.', ephemeral: true });
        }

        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: t(lang, 'robSelf'), ephemeral: true });
        }

        let targetData = await User.findOne({ userId: targetUser.id });
        if (!targetData) targetData = await User.create({ userId: targetUser.id });

        const attackerTotal = (attackerData.wallet || 0) + (attackerData.bank || 0) + (attackerData.stakeBalance || 0);
        const targetTotal = (targetData.wallet || 0) + (targetData.bank || 0) + (targetData.stakeBalance || 0);

        const reqMin = (attackerTotal >= 200000) ? 125000 : 5000;

        if ((attackerData.wallet || 0) < reqMin) {
            const minStr = t(lang, 'robMinWallet', { reqMin: reqMin.toLocaleString() }).replace(/\$/g, `${emojis.currency} `);
            return interaction.reply({ content: minStr, ephemeral: true });
        }

        if ((targetData.wallet || 0) <= 0) {
            return interaction.reply({ content: t(lang, 'robTargetEmpty'), ephemeral: true });
        }

        if (attackerTotal > targetTotal * 5) {
            return interaction.reply({ content: t(lang, 'robTooPoor'), ephemeral: true });
        }

        const isSuccess = Math.random() < 0.45;

        if (isSuccess) {
            let stealPercent;
            if (attackerTotal < targetTotal / 5) {
                stealPercent = Math.random() * (0.25 - 0.15) + 0.15;
            } else if (attackerTotal > targetTotal * 2) {
                stealPercent = Math.random() * (0.05 - 0.01) + 0.01;
            } else {
                stealPercent = Math.random() * (0.12 - 0.06) + 0.06;
            }

            const stolenAmount = Math.floor((targetData.wallet || 0) * stealPercent);

            targetData.wallet = (targetData.wallet || 0) - stolenAmount;
            attackerData.wallet = (attackerData.wallet || 0) + stolenAmount;

            await targetData.save();
            await attackerData.save();

            const desc = t(lang, 'robSuccessDesc', { amount: stolenAmount.toLocaleString(), target: `<@${targetUser.id}>` }).replace(/\$/g, `${emojis.currency} `);
            const fields = [
                { name: interaction.user.username, value: `${emojis.wallet} ${emojis.currency} ${attackerData.wallet.toLocaleString()}`, inline: true },
                { name: targetUser.username, value: `${emojis.wallet} ${emojis.currency} ${targetData.wallet.toLocaleString()}`, inline: true }
            ];

            const ui = createVoidEmbed(interaction.user, t(lang, 'robSuccessTitle'), `${emojis.spy} **${desc}**`, '#57F287', fields);
            return interaction.reply(ui.embeds ? ui : { embeds: [ui] });

        } else {
            let penaltyPercent;
            if (attackerTotal > targetTotal * 2) {
                penaltyPercent = Math.random() * (0.40 - 0.25) + 0.25; 
            } else {
                penaltyPercent = Math.random() * (0.15 - 0.05) + 0.05;
            }

            const penaltyAmount = Math.floor((attackerData.wallet || 0) * penaltyPercent);

            attackerData.wallet = (attackerData.wallet || 0) - penaltyAmount;
            targetData.wallet = (targetData.wallet || 0) + penaltyAmount;

            await attackerData.save();
            await targetData.save();

            const desc = t(lang, 'robFailDesc', { amount: penaltyAmount.toLocaleString(), target: `<@${targetUser.id}>` }).replace(/\$/g, `${emojis.currency} `);
            const fields = [
                { name: interaction.user.username, value: `${emojis.wallet} ${emojis.currency} ${attackerData.wallet.toLocaleString()}`, inline: true }
            ];

            const ui = createVoidEmbed(interaction.user, t(lang, 'robFailTitle'), `🚨 **${desc}**`, '#ed4245', fields);
            return interaction.reply(ui.embeds ? ui : { embeds: [ui] });
        }
    }
};