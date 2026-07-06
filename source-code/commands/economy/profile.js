const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const emojis = require('../../utils/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View your or someone else\'s economy profile.')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user whose profile you want to view')
                .setRequired(false)
        ),
    async execute(interaction) {
        let executorData = await User.findOne({ userId: interaction.user.id });
        if (!executorData) executorData = await User.create({ userId: interaction.user.id });
        const lang = executorData.language || 'en';

        const targetUser = interaction.options.getUser('target') || interaction.user;
        const isSelf = targetUser.id === interaction.user.id;
        
        if (targetUser.bot) {
            return interaction.reply({ content: `❌ ${lang === 'ar' ? 'لا يمكنك عرض ملف البوت.' : 'You cannot view a bot\'s profile.'}`, ephemeral: true });
        }

        let targetData = await User.findOne({ userId: targetUser.id });
        if (!targetData) targetData = await User.create({ userId: targetUser.id });

        let w = targetData.wallet || 0;
        let b = targetData.bank || 0;
        const s = targetData.stakeBalance || 0;
        const sw = targetData.stockWallet || 0;
        let total = w + b + s + sw;

        const embed = new EmbedBuilder()
            .setColor('#121212')
            .setAuthor({ name: targetUser.username, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
            .setTitle('Economy Profile')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: 'Void Economy System' })
            .setTimestamp();

        let desc = `${emojis.wallet} **Wallet**\n${emojis.currency} ${w.toLocaleString()}\n\n${emojis.bank} **Bank**\n${emojis.currency} ${b.toLocaleString()}\n\n`;
        
        if (s > 0) desc += `${emojis.save} **Void Bank (Staked)**\n${emojis.currency} ${s.toLocaleString()}\n\n`;
        if (sw > 0) desc += `${emojis.market} **Stock Wallet**\n${emojis.currency} ${sw.toLocaleString()}\n\n`;
        
        desc += `${emojis.total} **Total Net Worth**\n${emojis.currency} ${total.toLocaleString()}`;

        embed.setDescription(desc);
        
        const components = [];
        
        if (isSelf) {
            const depositBtn = new ButtonBuilder().setCustomId('btn_deposit').setLabel('Deposit').setEmoji(emojis.deposit).setStyle(ButtonStyle.Secondary);
            const withdrawBtn = new ButtonBuilder().setCustomId('btn_withdraw').setLabel('Withdraw').setEmoji(emojis.withdraw).setStyle(ButtonStyle.Secondary);
            const webBtn = new ButtonBuilder().setURL('https://dark-roasted.github.io/Void/').setEmoji('🌐').setStyle(ButtonStyle.Link);
            components.push(new ActionRowBuilder().addComponents(depositBtn, withdrawBtn, webBtn));
        }

        const responseMessage = await interaction.reply({ embeds: [embed], components: components, fetchReply: true });

        if (!isSelf) return;

        const collector = responseMessage.createMessageComponentCollector({ time: 300000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: `❌`, ephemeral: true });
            }

            const isDeposit = i.customId === 'btn_deposit';
            const modalId = `modal_trans_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            
            const modal = new ModalBuilder()
                .setCustomId(modalId)
                .setTitle(isDeposit ? 'Deposit Funds' : 'Withdraw Funds');

            const maxBal = isDeposit ? w : b;

            const amountInput = new TextInputBuilder()
                .setCustomId('input_amount')
                .setLabel('Amount')
                .setPlaceholder(`${maxBal.toLocaleString()} (Type ALL)`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
            
            await i.showModal(modal);

            try {
                const modalSubmit = await i.awaitModalSubmit({ filter: mi => mi.user.id === interaction.user.id && mi.customId === modalId, time: 60000 });
                const inputVal = modalSubmit.fields.getTextInputValue('input_amount').trim().toLowerCase();
                
                let freshData = await User.findOne({ userId: interaction.user.id });
                
                let amount = 0;
                if (inputVal === 'all') {
                    amount = isDeposit ? (freshData.wallet || 0) : (freshData.bank || 0);
                } else {
                    amount = parseFloat(inputVal.replace(/,/g, ''));
                }

                if (isNaN(amount) || amount <= 0) {
                    return modalSubmit.reply({ content: '❌ Invalid amount.', ephemeral: true });
                }

                amount = Number(amount.toFixed(2));

                if (isDeposit) {
                    if ((freshData.wallet || 0) < amount) return modalSubmit.reply({ content: '❌ Insufficient Funds.', ephemeral: true });
                    freshData.wallet = Number(((freshData.wallet || 0) - amount).toFixed(2));
                    freshData.bank = Number(((freshData.bank || 0) + amount).toFixed(2));
                } else {
                    if ((freshData.bank || 0) < amount) return modalSubmit.reply({ content: '❌ Insufficient Funds.', ephemeral: true });
                    freshData.bank = Number(((freshData.bank || 0) - amount).toFixed(2));
                    freshData.wallet = Number(((freshData.wallet || 0) + amount).toFixed(2));
                }

                await freshData.save();

                w = freshData.wallet || 0;
                b = freshData.bank || 0;
                const ns = freshData.stakeBalance || 0;
                const nsw = freshData.stockWallet || 0;
                total = w + b + ns + nsw;

                let updatedDesc = `${emojis.wallet} **Wallet**\n${emojis.currency} ${w.toLocaleString()}\n\n${emojis.bank} **Bank**\n${emojis.currency} ${b.toLocaleString()}\n\n`;
                if (ns > 0) updatedDesc += `${emojis.save} **Void Bank (Staked)**\n${emojis.currency} ${ns.toLocaleString()}\n\n`;
                if (nsw > 0) updatedDesc += `${emojis.market} **Stock Wallet**\n${emojis.currency} ${nsw.toLocaleString()}\n\n`;
                updatedDesc += `${emojis.total} **Total Net Worth**\n${emojis.currency} ${total.toLocaleString()}`;

                const updatedEmbed = EmbedBuilder.from(embed).setDescription(updatedDesc);
                
                await modalSubmit.update({ embeds: [updatedEmbed], components: components });
                await modalSubmit.followUp({ content: `✅ Transfer Complete!`, ephemeral: true });
            } catch (error) {
                console.error(error);
            }
        });
    }
};