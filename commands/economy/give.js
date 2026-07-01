const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/User');
const { createVoidEmbed } = require('../../utils/ui');
const emojis = require('../../utils/emojis');
const { t } = require('../../utils/i18n');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription('Transfer funds from your wallet to another user.')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user you want to send money to')
                .setRequired(true)
        )
        .addNumberOption(option =>
            option.setName('amount')
                .setDescription('The amount of money to send')
                .setRequired(true)
                .setMinValue(0.01)
        ),
    async execute(interaction) {
        let executorData = await User.findOne({ userId: interaction.user.id });
        if (!executorData) executorData = await User.create({ userId: interaction.user.id });
        const lang = executorData.language || 'en';

        const targetUser = interaction.options.getUser('target');
        const amount = Number(interaction.options.getNumber('amount').toFixed(2));

        if (targetUser.bot) {
            const errorEmbed = createVoidEmbed(interaction.user, `${emojis.alert} Error`, 'You cannot send funds to bots.', '#ED4245');
            return interaction.reply({ embeds: errorEmbed.embeds ? errorEmbed.embeds : [errorEmbed], ephemeral: true });
        }

        if (targetUser.id === interaction.user.id) {
            const errorEmbed = createVoidEmbed(interaction.user, `${emojis.alert} Error`, t(lang, 'giveSelf'), '#ED4245');
            return interaction.reply({ embeds: errorEmbed.embeds ? errorEmbed.embeds : [errorEmbed], ephemeral: true });
        }

        if ((executorData.wallet || 0) < amount) {
            const errorEmbed = createVoidEmbed(interaction.user, `${emojis.alert} Error`, t(lang, 'insufficientFunds'), '#ED4245');
            return interaction.reply({ embeds: errorEmbed.embeds ? errorEmbed.embeds : [errorEmbed], ephemeral: true });
        }

        let targetData = await User.findOne({ userId: targetUser.id });
        if (!targetData) targetData = await User.create({ userId: targetUser.id });

        executorData.wallet = Number((executorData.wallet - amount).toFixed(2));
        targetData.wallet = Number(((targetData.wallet || 0) + amount).toFixed(2));

        await executorData.save();
        await targetData.save();

        const fields = [
            { name: interaction.user.username, value: `${emojis.wallet} ${emojis.currency} ${executorData.wallet.toLocaleString()}`, inline: true },
            { name: targetUser.username, value: `${emojis.wallet} ${emojis.currency} ${targetData.wallet.toLocaleString()}`, inline: true }
        ];

        const successDesc = t(lang, 'giveSuccessDesc', { amount: amount.toLocaleString(), target: `<@${targetUser.id}>` }).replace(/\$/g, `${emojis.currency} `);

        const successEmbed = createVoidEmbed(
            interaction.user,
            `${emojis.check} ${t(lang, 'giveTitle')}`,
            successDesc,
            '#2b2d31',
            fields
        );

        await interaction.reply(successEmbed.embeds ? successEmbed : { embeds: [successEmbed] });
    }
};
