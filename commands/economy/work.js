const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const { t } = require('../../utils/i18n');
const emojis = require('../../utils/emojis');

const jobs = [
    { id: 'software', thumb: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=256&q=80' },
    { id: 'doctor', thumb: 'https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?auto=format&fit=crop&w=256&q=80' },
    { id: 'designer', thumb: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=256&q=80' },
    { id: 'pilot', thumb: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=256&q=80' },
    { id: 'engineer', thumb: 'https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?auto=format&fit=crop&w=256&q=80' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work to earn money.'),
    async execute(interaction) {
        let userData = await User.findOne({ userId: interaction.user.id });
        if (!userData) userData = await User.create({ userId: interaction.user.id });
        const lang = userData.language || 'en';

        const now = new Date();
        const lastWork = userData.lastWork || new Date(0);
        const diffTime = Math.abs(now - lastWork);
        const diffMinutes = diffTime / (1000 * 60);

        if (diffMinutes < 30) {
            const remainingMinutes = 30 - diffMinutes;
            const minutes = Math.floor(remainingMinutes);
            const seconds = Math.floor((remainingMinutes - minutes) * 60);
            
            const errorEmbed = new EmbedBuilder()
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
                .setTitle(`${emojis.alert} ${t(lang, 'cooldownTitle')}`)
                .setDescription(t(lang, 'cooldownDesc', { minutes: minutes, seconds: seconds }))
                .setColor('#ED4245');
                
            return interaction.reply({ embeds: [errorEmbed] });
        }

        const baseAmount = 2200;
        const variation = (Math.random() * 0.2) + 0.9;
        const finalAmount = Math.floor(baseAmount * variation);

        const randomJob = jobs[Math.floor(Math.random() * jobs.length)];
        const jobName = t(lang, `job_${randomJob.id}`);

        userData.wallet = (userData.wallet || 0) + finalAmount;
        userData.lastWork = now;
        await userData.save();

        const successEmbed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTitle(`${emojis.work} ${t(lang, 'workSuccessTitle')}`)
            .setDescription(t(lang, 'workSuccessDesc', { job: jobName, amount: finalAmount.toLocaleString() }))
            .setThumbnail(randomJob.thumb)
            .addFields({ name: t(lang, 'wallet'), value: `${emojis.wallet} **$${userData.wallet.toLocaleString()}**`, inline: false })
            .setColor('#2b2d31');

        await interaction.reply({ embeds: [successEmbed] });
    }
};
