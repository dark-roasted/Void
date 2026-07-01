require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, Events } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('./models/User');
const { t } = require('./utils/i18n');
const { initMarket, handleMarketInteraction } = require('./utils/marketEngine');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.commands = new Collection();
const commands = [];
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    if (fs.lstatSync(commandsPath).isDirectory()) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(path.join(commandsPath, file));
            const commandJSON = command.data.toJSON();
            
            const exists = commands.find(c => c.name === commandJSON.name);
            if (!exists) {
                commands.push(commandJSON);
                client.commands.set(commandJSON.name, command);
            }
        }
    }
}

client.once(Events.ClientReady, async () => {
    try {
        console.log(`Bot aktif edildi: ${client.user.tag}`);
        
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Atlas baglantisi basarili!');

        if (!process.env.ATHENA_GUILD_ID) {
            console.error("ERROR: ATHENA_GUILD_ID environment variable is not set.");
            process.exit(1);
        }
        
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.ATHENA_GUILD_ID),
            { body: commands }
        );
        console.log('Slash komutlari yuklendi!');

        initMarket(client);

    } catch (error) {
        console.error('ERROR: while loading slash commands:', error);
        process.exit(1);
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith('m_')) {
        return handleMarketInteraction(interaction);
    }

    if (!interaction.isChatInputCommand()) return;

    let userData = await User.findOne({ userId: interaction.user.id });
    if (!userData) {
        userData = await User.create({ userId: interaction.user.id });
    }

    if (interaction.guildId !== process.env.ATHENA_GUILD_ID) {
        const errorMsg = t(userData.language, 'notInGuild');
        return interaction.reply({ content: errorMsg, flags: 64 });
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, userData);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Something Went Wrong.', flags: 64 });
    }
});

client.login(process.env.TOKEN).catch(error => {
    console.error('ERROR: Discord API giris hatasi:', error);
});
