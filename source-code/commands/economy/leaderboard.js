const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/User');
const { createVoidEmbed } = require('../../utils/ui');
const { t } = require('../../utils/i18n');
const emojis = require('../../utils/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the wealthiest users in Luna.'),
    async execute(interaction) {
        let executorData = await User.findOne({ userId: interaction.user.id });
        const lang = executorData ? executorData.language : 'en';

        const users = await User.find({}).exec();
        
        users.sort((a, b) => {
            const totalA = (a.wallet || 0) + (a.bank || 0) + (a.stockWallet || 0) + (a.stakeBalance || 0);
            const totalB = (b.wallet || 0) + (b.bank || 0) + (b.stockWallet || 0) + (b.stakeBalance || 0);
            return totalB - totalA;
        });

        const topUsers = [];
        for (const u of users) {
            if (topUsers.length >= 10) break;
            let isBot = false;
            try {
                let cached = interaction.client.users.cache.get(u.userId);
                if (!cached) cached = await interaction.client.users.fetch(u.userId);
                if (cached?.bot) isBot = true;
            } catch (err) {}
            
            if (!isBot) topUsers.push(u);
        }

        let desc = '';

        topUsers.forEach((u, index) => {
            const total = (u.wallet || 0) + (u.bank || 0) + (u.stockWallet || 0) + (u.stakeBalance || 0);
            let medal = '🏅';
            if (index === 0) medal = '🥇';
            else if (index === 1) medal = '🥈';
            else if (index === 2) medal = '🥉';
            desc += `${medal} **<@${u.userId}>**\n${emojis.total} **${emojis.currency} ${total.toLocaleString()}** | ${emojis.wallet} ${emojis.currency} ${(u.wallet || 0).toLocaleString()} | ${emojis.bank} ${emojis.currency} ${(u.bank || 0).toLocaleString()}\n\n`;
        });

        const lbEmbed = createVoidEmbed(
            interaction.user,
            `🏆 ${t(lang, 'leaderboardTitle')}`,
            desc || 'No data yet.',
            '#2b2d31'
        );

        await interaction.reply(lbEmbed.embeds ? lbEmbed : { embeds: [lbEmbed] });
    }
};
