const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createVoidEmbed(user, title, description, color = '#1e1f22', fields = [], thumbnail = null) {
    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp()
        .setFooter({ text: 'Void Economy System' }); 

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (fields.length > 0) embed.addFields(fields);
    if (thumbnail) embed.setThumbnail(thumbnail);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setEmoji('🌐')
            .setURL('https://dark-roasted.github.io/Void/')
            .setStyle(ButtonStyle.Link)
    );

    return { embeds: [embed], components: [row] };
}

module.exports = { createVoidEmbed };
