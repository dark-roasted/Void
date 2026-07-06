const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const emojis = require('../../utils/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your randomized daily reward with streak bonuses.'),
    async execute(interaction) {
        let userData = await User.findOne({ userId: interaction.user.id });
        if (!userData) userData = await User.create({ userId: interaction.user.id });

        const now = new Date();
        const lastDaily = userData.lastDaily || new Date(0);
        const diffHours = (now - lastDaily) / (1000 * 60 * 60);

        if (diffHours < 24) {
            const remainingHours = 24 - diffHours;
            const hours = Math.floor(remainingHours);
            const minutes = Math.floor((remainingHours - hours) * 60);
            
            return interaction.reply({ content: `❌ You already claimed your daily reward. Come back in \`${hours}h ${minutes}m\`.`, flags: MessageFlags.Ephemeral });
        }

        if (diffHours > 48) {
            userData.dailyStreak = 0;
        }

        userData.dailyStreak = (userData.dailyStreak || 0) + 1;

        let baseAmount = 21000;
        const streakBonus = Math.min(userData.dailyStreak, 10) * 1000; 
        
        const BOOSTER_ROLE_ID = '1506374920161198081';
        const isBooster = interaction.member.roles.cache.has(BOOSTER_ROLE_ID);
        if (isBooster) baseAmount *= 1.1; 

        const targetAmount = baseAmount + streakBonus;
        const variation = (Math.random() * 0.1) + 0.95;
        const finalAmount = Math.floor(targetAmount * variation);

        userData.wallet = (userData.wallet || 0) + finalAmount;
        userData.lastDaily = now;
        await userData.save();

        const successEmbed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTitle(`${emojis.gift} Daily Reward Claimed!`)
            .setDescription(`You claimed your daily reward of **${emojis.currency} ${finalAmount.toLocaleString()}**!\n🔥 **Current Streak:** ${userData.dailyStreak} Days`)
            .setColor('#2b2d31');

        await interaction.reply({ embeds: [successEmbed] });
    }
};