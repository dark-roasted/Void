const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    MessageFlags,
    StringSelectMenuBuilder,
    ChannelType
} = require('discord.js');

const Server = require('../models/Server');
const User = require('../models/User');
const emojis = require('./emojis');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

const SYMBOLS = [
    'AAPL', 'TSLA', 'SONY', 'GOOG', 'MSFT', 'NVDA', 'AMZN', 'META', 'NFLX', 'AMD', 'INTC', 'DIS', 'SBUX', 'NKE',
    'JPY=X', 'EURUSD=X', 'GBPUSD=X', 'BZ=F', 'GC=F', 'SI=F',
    'BTC-USD', 'ETH-USD', 'SOL-USD'
];

const ICONS = {
    'AAPL': emojis.apple,
    'TSLA': emojis.tesla,
    'SONY': emojis.sony,
    'GOOG': emojis.google,
    'MSFT': emojis.microsoft,
    'NVDA': emojis.nvidia,
    'AMZN': emojis.amazon,
    'META': emojis.meta,
    'NFLX': emojis.nflx,
    'AMD': emojis.amd,
    'INTC': emojis.intel,
    'DIS': emojis.disney,
    'SBUX': emojis.sbux,
    'NKE': emojis.nike,
    'JPY=X': emojis.jpy,
    'EURUSD=X': emojis.eur,
    'GBPUSD=X': emojis.gbp,
    'BZ=F': emojis.oil,
    'GC=F': emojis.gold,
    'SI=F': emojis.silver,
    'BTC-USD': emojis.btc,
    'ETH-USD': emojis.eth,
    'SOL-USD': emojis.sol
};

const DISPLAY_TICKERS = {
    'SOL-USD': 'SOL/USD',
    'BTC-USD': 'BTC/USD',
    'ETH-USD': 'ETH/USD',
    'JPY=X': 'USD/JPY',
    'EURUSD=X': 'EUR/USD',
    'GBPUSD=X': 'GBP/USD',
    'GC=F': 'XAU/USD',
    'SI=F': 'XAG/USD',
    'BZ=F': 'BRN'
};

const DISPLAY_NAMES = {
    'GC=F': 'Gold',
    'SI=F': 'Silver',
    'BZ=F': 'Brent Crude Oil',
    'BTC-USD': 'Bitcoin',
    'ETH-USD': 'Ethereum',
    'SOL-USD': 'Solana',
    'JPY=X': 'USD/JPY',
    'EURUSD=X': 'EUR/USD',
    'GBPUSD=X': 'GBP/USD'
};

let globalMarketCache = {
    lastUpdate: 0,
    data: [],
    activeThreads: []
};

const formatMoney = (amount) => amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatNumber = (num) => num.toLocaleString('en-US');
const compactNumber = (num) => {
    if (!num || num === 0) return 'N/A';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    return num.toLocaleString('en-US');
};

function parseEmoji(emojiStr) {
    if (!emojiStr) return null;
    const match = emojiStr.match(/<a?:([a-zA-Z0-9_]+):(\d+)>/);
    if (match) return { name: match[1], id: match[2] };
    return emojiStr;
}

async function getRealMarketData() {
    if (Date.now() - globalMarketCache.lastUpdate < 45000 && globalMarketCache.data.length > 0) {
        return globalMarketCache.data;
    }

    try {
        const fetchPromise = yahooFinance.quote(SYMBOLS);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('API Timeout')), 10000));
        
        const quotes = await Promise.race([fetchPromise, timeoutPromise]);
        
        globalMarketCache.data = quotes.map(q => {
            const dispTicker = DISPLAY_TICKERS[q.symbol] || q.symbol;
            const dispName = DISPLAY_NAMES[q.symbol] || q.shortName || q.longName || q.symbol;
            
            return {
                symbol: q.symbol,
                displayTicker: dispTicker,
                name: dispName,
                price: q.regularMarketPrice || 0,
                change: q.regularMarketChange || 0,
                changePercent: q.regularMarketChangePercent || 0,
                volume: q.regularMarketVolume || null,
                marketCap: q.marketCap || null,
                icon: ICONS[q.symbol],
                trend: (q.regularMarketChange >= 0) ? 1 : -1
            };
        });
        globalMarketCache.lastUpdate = Date.now();
        return globalMarketCache.data;
    } catch (error) {
        return globalMarketCache.data;
    }
}

async function initMarket(client) {
    setInterval(async () => {
        const stocksData = await getRealMarketData();
        if (!stocksData || stocksData.length === 0) return;

        const servers = await Server.find({ marketChannelId: { $ne: null }, marketMessageId: { $ne: null } });
        
        for (const serverData of servers) {
            try {
                const guild = client.guilds.cache.get(serverData.guildId);
                if (!guild) continue;
                
                const channel = guild.channels.cache.get(serverData.marketChannelId);
                if (!channel) continue;
                
                const message = await channel.messages.fetch(serverData.marketMessageId).catch(() => null);
                if (!message) continue;

                const embed = buildMarketEmbed(stocksData, 'welcome', false);
                const components = buildMarketComponents(false);
                await message.edit({ embeds: [embed], components: components }).catch(()=>{});
            } catch (error) {}
        }

        for (let i = globalMarketCache.activeThreads.length - 1; i >= 0; i--) {
            const tInfo = globalMarketCache.activeThreads[i];
            try {
                const channel = client.channels.cache.get(tInfo.channelId);
                if (!channel) continue;
                const msg = await channel.messages.fetch(tInfo.messageId).catch(() => null);
                if (!msg) {
                    globalMarketCache.activeThreads.splice(i, 1);
                    continue;
                }
                const embed = buildMarketEmbed(stocksData, tInfo.category, true);
                await msg.edit({ embeds: [embed] }).catch(()=>{});
            } catch(e) {}
        }
    }, 60000);
}

function buildMarketEmbed(stocks, category = 'welcome', isThread = false) {
    const embed = new EmbedBuilder()
        .setColor('#121212')
        .setTimestamp()
        .setFooter({ text: 'Powered by Live Market Data', iconURL: 'https://cdn.discordapp.com/emojis/1518864687616364695.webp' });

    if (!isThread) {
        embed.setAuthor({ name: 'Luna GLOBAL EXCHANGE', iconURL: 'https://cdn.discordapp.com/emojis/1519183839866523718.webp' })
        embed.setDescription(`> Welcome to the official Luna Exchange.\n> Real-time global market data connected. Select a category below to open your secure trading terminal.`);
        return embed;
    }

    let titleStr = '';
    if (category === 'tech') titleStr = `TECH & STOCKS`;
    else if (category === 'forex') titleStr = `FOREX & COMMODITIES`;
    else if (category === 'crypto') titleStr = `CRYPTOCURRENCY`;

    embed.setAuthor({ name: `${titleStr} TERMINAL`, iconURL: 'https://cdn.discordapp.com/emojis/1519183839866523718.webp' })
    embed.setDescription(`> Prices update automatically upon interactions and at consistent intervals.`);

    if (!stocks || stocks.length === 0) {
        embed.addFields({ name: '⚠️ API Error', value: 'Market data is temporarily unavailable.' });
        return embed;
    }

    let symbolsToShow = [];
    if (category === 'tech') symbolsToShow = ['AAPL', 'TSLA', 'SONY', 'GOOG', 'MSFT', 'NVDA', 'AMZN', 'META', 'NFLX', 'AMD', 'INTC', 'DIS', 'SBUX', 'NKE'];
    else if (category === 'forex') symbolsToShow = ['JPY=X', 'EURUSD=X', 'GBPUSD=X', 'BZ=F', 'GC=F', 'SI=F'];
    else if (category === 'crypto') symbolsToShow = ['BTC-USD', 'ETH-USD', 'SOL-USD'];

    stocks.filter(s => symbolsToShow.includes(s.symbol)).forEach(stock => {
        let trendIcon = emojis.check || '➖';
        if (stock.trend > 0) trendIcon = emojis.up || '📈';
        if (stock.trend < 0) trendIcon = emojis.down || '📉';

        const sign = stock.change > 0 ? '+' : '';
        const safeChangePercent = stock.changePercent || 0;
        const safePrice = stock.price || 0;
        const safeChange = stock.change || 0;
        const icon = stock.icon || '🏷️';

        embed.addFields({
            name: `${icon} ${stock.name}`,
            value: `> Ticker: \`${stock.displayTicker}\`\n> Price: **${sign}${emojis.currency} ${formatMoney(safePrice)}**\n> Change: ${trendIcon} **${sign}${emojis.currency} ${formatMoney(Math.abs(safeChange))}** (${sign}${Number(safeChangePercent).toFixed(2)}%)\n> Vol: \`${compactNumber(stock.volume)}\`\n> M. Cap: \`${compactNumber(stock.marketCap)}\``,
            inline: true
        });
    });

    return embed;
}

function buildMarketComponents(isThread = false) {
    const components = [];

    if (!isThread) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('m_select_category')
            .setPlaceholder('Select a Market Category')
            .addOptions([
                { label: 'Tech & Stocks', description: 'View equities like Apple, Tesla, Nvidia.', value: 'tech', emoji: parseEmoji(emojis.apple) },
                { label: 'Forex & Commodities', description: 'View Gold, Oil, EUR/USD, JPY.', value: 'forex', emoji: parseEmoji(emojis.gold) },
                { label: 'Cryptocurrency', description: 'View Bitcoin, Ethereum, Solana.', value: 'crypto', emoji: parseEmoji(emojis.btc) }
            ]);

        components.push(new ActionRowBuilder().addComponents(selectMenu));
        
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('m_port').setLabel('View Portfolio').setStyle(ButtonStyle.Primary).setEmoji(parseEmoji(emojis.wallet)),
            new ButtonBuilder().setCustomId('m_in').setLabel('Deposit to Broker').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji(emojis.deposit)),
            new ButtonBuilder().setCustomId('m_out').setLabel('Withdraw to Bank').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji(emojis.withdraw))
        );
        components.push(row1);

    } else {
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('m_buy').setLabel('Execute Buy').setStyle(ButtonStyle.Success).setEmoji(parseEmoji(emojis.up)),
            new ButtonBuilder().setCustomId('m_sell').setLabel('Execute Sell').setStyle(ButtonStyle.Danger).setEmoji(parseEmoji(emojis.down)),
            new ButtonBuilder().setCustomId('m_port').setLabel('View Portfolio').setStyle(ButtonStyle.Primary).setEmoji(parseEmoji(emojis.wallet))
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('m_in').setLabel('Deposit to Broker').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji(emojis.deposit)),
            new ButtonBuilder().setCustomId('m_out').setLabel('Withdraw to Bank').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji(emojis.withdraw))
        );

        components.push(row1, row2);
    }

    return components;
}

function createReceipt(title, desc, color) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor(color)
        .setTimestamp();
}

async function handleMarketInteraction(interaction) {
    if (interaction.customId === 'm_select_category') {
        const selectedCategory = interaction.values[0];

        if (!interaction.member.roles.cache.has('1520607353076973621')) {
            await interaction.member.roles.add('1520607353076973621').catch(() => {});
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const threadName = `terminal-${interaction.user.username.toLowerCase()}-${selectedCategory}`;
        const thread = await interaction.channel.threads.create({
            name: threadName,
            type: ChannelType.PrivateThread,
            invitable: false,
            autoArchiveDuration: 60
        }).catch(() => null);

        if (thread) {
            await thread.members.add(interaction.user.id).catch(() => {});
            const stocksData = await getRealMarketData();
            const newEmbed = buildMarketEmbed(stocksData, selectedCategory, true);
            const msg = await thread.send({ content: `<@${interaction.user.id}>`, embeds: [newEmbed], components: buildMarketComponents(true) });
            
            globalMarketCache.activeThreads.push({ channelId: thread.id, messageId: msg.id, category: selectedCategory });

            await interaction.editReply({ content: `${emojis.check} **Terminal Connected:** <#${thread.id}>` });
        } else {
            await interaction.editReply({ content: '❌ Thread creation failed. Check permissions.' });
        }
        return;
    }

    if (!interaction.customId.startsWith('m_')) return;

    let userData = await User.findOne({ userId: interaction.user.id });
    if (!userData) userData = await User.create({ userId: interaction.user.id });

    if (!userData.portfolioAvgPrice) {
        userData.portfolioAvgPrice = new Map();
        await userData.save();
    }

    if (interaction.customId === 'm_port') {
        const stocksData = await getRealMarketData();
        const portfolio = userData.portfolio || new Map();
        const avgPrices = userData.portfolioAvgPrice || new Map();
        
        let desc = '';
        let totalAssetValue = 0;

        if (portfolio.size === 0) {
            desc = '> *Your stock portfolio is currently empty.*';
        } else {
            for (const [symbol, amount] of portfolio.entries()) {
                if (amount > 0) {
                    const currentStock = stocksData.find(s => s.symbol === symbol);
                    const currentPrice = currentStock ? currentStock.price : 0;
                    const holdingValue = currentPrice * amount;
                    totalAssetValue += holdingValue;
                    
                    const avgPrice = avgPrices.get(symbol) || currentPrice;
                    const profitTotal = (currentPrice - avgPrice) * amount;
                    const profitPercent = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
                    
                    const sign = profitTotal >= 0 ? '+' : '';
                    const trendEmoji = profitTotal >= 0 ? emojis.up : emojis.down;
                    const icon = currentStock ? currentStock.icon : '🏷️';
                    const dispTicker = currentStock ? currentStock.displayTicker : symbol;
                    
                    desc += `${icon} **${dispTicker}**\n> Shares: \`${formatNumber(amount)}\`\n> Avg Price: ${emojis.currency} ${formatMoney(avgPrice)}\n> Value: **${emojis.currency} ${formatMoney(holdingValue)}**\n> P/L: ${trendEmoji} ${sign}${emojis.currency} ${formatMoney(profitTotal)} (${sign}${profitPercent.toFixed(2)}%)\n\n`;
                }
            }
            if (desc === '') desc = '> *Your stock portfolio is currently empty.*';
        }

        const totalNetWorth = userData.wallet + userData.bank + userData.stockWallet + (userData.stakeBalance || 0) + totalAssetValue;

        const pEmbed = new EmbedBuilder()
            .setAuthor({ name: `${interaction.user.username}'s Brokerage Account`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .addFields(
                { name: '💼 Cash Balance', value: `> Brokerage: **${emojis.currency} ${formatMoney(userData.stockWallet)}**\n> Checking: **${emojis.currency} ${formatMoney(userData.wallet)}**`, inline: true },
                { name: '📊 Account Value', value: `> Stock Assets: **${emojis.currency} ${formatMoney(totalAssetValue)}**\n> Total Net Worth: **${emojis.currency} ${formatMoney(totalNetWorth)}**`, inline: true },
                { name: '📂 Open Positions', value: desc, inline: false }
            )
            .setColor('#121212')
            .setFooter({ text: 'Luna Global Exchange' });

        return interaction.reply({ embeds: [pEmbed], flags: MessageFlags.Ephemeral });
    }

    const isBuy = interaction.customId === 'm_buy';
    const isSell = interaction.customId === 'm_sell';
    const isIn = interaction.customId === 'm_in';
    const isOut = interaction.customId === 'm_out';

    const modalId = `modal_${interaction.customId}_${Date.now()}`;
    const modal = new ModalBuilder().setCustomId(modalId);

    if (isBuy || isSell) {
        modal.setTitle(isBuy ? 'TERMINAL: Execute Buy' : 'TERMINAL: Execute Sell');
        
        const symInput = new TextInputBuilder()
            .setCustomId('sym')
            .setLabel('STOCK SYMBOL (e.g., AAPL, BTC/USD, BRN)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the exact ticker symbol.')
            .setRequired(true);
            
        const amtInput = new TextInputBuilder()
            .setCustomId('amt')
            .setLabel('NUMBER OF SHARES')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter a valid numerical amount.')
            .setRequired(true);
            
        modal.addComponents(new ActionRowBuilder().addComponents(symInput), new ActionRowBuilder().addComponents(amtInput));
    } else {
        modal.setTitle(isIn ? 'TERMINAL: Deposit Funds' : 'TERMINAL: Withdraw Funds');
        
        const maxAvail = isIn ? userData.wallet : userData.stockWallet;
        const amtInput = new TextInputBuilder()
            .setCustomId('amt')
            .setLabel('TRANSFER AMOUNT')
            .setPlaceholder(`${formatNumber(maxAvail)} (Type ALL for max)`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
            
        modal.addComponents(new ActionRowBuilder().addComponents(amtInput));
    }

    await interaction.showModal(modal);

    try {
        const filter = i => i.user.id === interaction.user.id && i.customId === modalId;
        const mSubmit = await interaction.awaitModalSubmit({ filter, time: 300000 });
        
        let latestData = await User.findOne({ userId: interaction.user.id });

        if (isIn || isOut) {
            const rawAmt = mSubmit.fields.getTextInputValue('amt').toLowerCase().trim();
            const maxVal = isIn ? latestData.wallet : latestData.stockWallet;
            
            let amt = 0;
            if (rawAmt === 'all' || rawAmt === 'max') {
                amt = maxVal;
            } else {
                amt = parseInt(rawAmt.replace(/,/g, ''), 10);
            }

            if (isNaN(amt) || amt <= 0) {
                return mSubmit.reply({ embeds: [createReceipt(`${emojis.alert} Transaction Failed`, 'The amount provided is mathematically invalid.', '#E74C3C')], flags: MessageFlags.Ephemeral });
            }

            if (isIn) {
                if (latestData.wallet < amt) return mSubmit.reply({ embeds: [createReceipt(`${emojis.alert} Insufficient Funds`, `Your checking wallet only has **${emojis.currency} ${formatMoney(latestData.wallet)}**.`, '#E74C3C')], flags: MessageFlags.Ephemeral });
                latestData.wallet -= amt;
                latestData.stockWallet += amt;
            } else {
                if (latestData.stockWallet < amt) return mSubmit.reply({ embeds: [createReceipt(`${emojis.alert} Insufficient Funds`, `Your brokerage account only has **${emojis.currency} ${formatMoney(latestData.stockWallet)}**.`, '#E74C3C')], flags: MessageFlags.Ephemeral });
                latestData.stockWallet -= amt;
                latestData.wallet += amt;
            }
            
            await latestData.save();
            const actionStr = isIn ? 'Deposited to Brokerage' : 'Withdrawn to Checking';
            const successDesc = `> **Action:** ${actionStr}\n> **Amount:** ${emojis.currency} ${formatMoney(amt)}\n> **New Brokerage Balance:** ${emojis.currency} ${formatMoney(latestData.stockWallet)}`;
            
            return mSubmit.reply({ embeds: [createReceipt(`${emojis.check} Transfer Complete`, successDesc, '#2ECC71')], flags: MessageFlags.Ephemeral });
        }

        if (isBuy || isSell) {
            const symInputRaw = mSubmit.fields.getTextInputValue('sym').toUpperCase().trim();
            const rawAmt = mSubmit.fields.getTextInputValue('amt').toLowerCase().trim();
            
            const stocksData = await getRealMarketData();
            const stock = stocksData.find(s => s.symbol === symInputRaw || s.displayTicker.toUpperCase() === symInputRaw);
            
            if (!stock) {
                return mSubmit.reply({ embeds: [createReceipt(`${emojis.alert} Invalid Symbol`, `The ticker \`${symInputRaw}\` does not exist on the Luna Exchange.`, '#E74C3C')], flags: MessageFlags.Ephemeral });
            }

            if (!['BTC-USD', 'ETH-USD', 'SOL-USD'].includes(stock.symbol)) {
                const now = new Date();
                const nyTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
                const day = nyTime.getDay();
                const hours = nyTime.getHours();
                const minutes = nyTime.getMinutes();
                const currentDecimalTime = hours + (minutes / 60);
                const isWeekend = day === 0 || day === 6;

                let isClosed = false;
                let scheduleText = '';

                if (['JPY=X', 'EURUSD=X', 'GBPUSD=X', 'BZ=F', 'GC=F', 'SI=F'].includes(stock.symbol)) {
                    if (isWeekend) {
                        isClosed = true;
                        scheduleText = '> **Trading Hours:** Sunday 5 PM - Friday 5 PM (EST)\n> **Status:** Weekend Close';
                    }
                } else {
                    if (isWeekend || currentDecimalTime < 9.5 || currentDecimalTime >= 16) {
                        isClosed = true;
                        scheduleText = '> **Trading Hours:** Monday - Friday\n> **Time:** 09:30 AM - 04:00 PM (EST)';
                    }
                }

                if (isClosed) {
                    return mSubmit.reply({ 
                        embeds: [createReceipt(`${emojis.alert} Market Closed`, `The real-world exchange for **${stock.displayTicker}** is currently closed.\n${scheduleText}`, '#E74C3C')], 
                        flags: MessageFlags.Ephemeral 
                    });
                }
            }

            const sym = stock.symbol;
            let amt = 0;
            const currentShares = latestData.portfolio.get(sym) || 0;
            const currentAvgPrice = latestData.portfolioAvgPrice.get(sym) || 0;

            if (rawAmt === 'all' || rawAmt === 'max') {
                if (isBuy) {
                    amt = Math.floor(latestData.stockWallet / stock.price);
                } else {
                    amt = currentShares;
                }
            } else {
                amt = parseInt(rawAmt.replace(/,/g, ''), 10);
            }

            if (isNaN(amt) || amt <= 0) {
                return mSubmit.reply({ embeds: [createReceipt(`${emojis.alert} Invalid Order`, 'The number of shares specified is invalid or zero.', '#E74C3C')], flags: MessageFlags.Ephemeral });
            }

            const totalCost = stock.price * amt;

            if (isBuy) {
                if (latestData.stockWallet < totalCost) {
                    return mSubmit.reply({ embeds: [createReceipt(`${emojis.alert} Purchasing Power Exceeded`, `You need **${emojis.currency} ${formatMoney(totalCost)}** in your Brokerage Wallet to execute this trade.\n> Your Balance: ${emojis.currency} ${formatMoney(latestData.stockWallet)}`, '#E74C3C')], flags: MessageFlags.Ephemeral });
                }
                
                const newTotalShares = currentShares + amt;
                const newAvgPrice = ((currentShares * currentAvgPrice) + (amt * stock.price)) / newTotalShares;
                
                latestData.stockWallet -= totalCost;
                latestData.portfolio.set(sym, newTotalShares);
                latestData.portfolioAvgPrice.set(sym, newAvgPrice);
                
            } else {
                if (currentShares < amt) {
                    return mSubmit.reply({ embeds: [createReceipt(`${emojis.alert} Insufficient Shares`, `You are attempting to short or sell more shares than you own.\n> You currently own: \`${formatNumber(currentShares)}\` shares of ${stock.displayTicker}.`, '#E74C3C')], flags: MessageFlags.Ephemeral });
                }
                
                const newTotalShares = currentShares - amt;
                latestData.portfolio.set(sym, newTotalShares);
                latestData.stockWallet += totalCost;
                
                if (newTotalShares === 0) {
                    latestData.portfolioAvgPrice.set(sym, 0);
                }sss
            }

            await latestData.save();

            const actionType = isBuy ? 'BUY' : 'SELL';
            const finalReceipt = new EmbedBuilder()
                .setTitle(`${emojis.check} Order Filled: ${actionType} ${stock.displayTicker}`)
                .setDescription(`Your market order has been processed by the exchange.`)
                .addFields(
                    { name: 'Order Details', value: `> **Symbol:** \`${stock.displayTicker}\`\n> **Quantity:** \`${formatNumber(amt)}\` shares\n> **Execution Price:** ${emojis.currency} ${formatMoney(stock.price)}\n> **Total Value:** **${emojis.currency} ${formatMoney(totalCost)}**`, inline: false },
                    { name: 'Account Post-Trade', value: `> **Remaining Balance:** ${emojis.currency} ${formatMoney(latestData.stockWallet)}\n> **Current Position:** \`${formatNumber(latestData.portfolio.get(sym) || 0)}\` shares`, inline: false }
                )
                .setColor(isBuy ? '#3498DB' : '#E67E22')
                .setTimestamp()
                .setFooter({ text: 'Luna Global Exchange • Transaction ID: ' + Math.random().toString(36).substring(2, 10).toUpperCase() });

            await mSubmit.reply({ embeds: [finalReceipt], flags: MessageFlags.Ephemeral });

            if (interaction.channel.isThread()) {
                const threadNameParts = interaction.channel.name.split('-');
                const currentCat = threadNameParts.length >= 3 ? threadNameParts[2] : 'tech';
                interaction.message.edit({ embeds: [buildMarketEmbed(stocksData, currentCat, true)] }).catch(()=>{});
            }
        }
    } catch (e) {
    }
}

module.exports = { 
    initMarket, 
    buildMarketEmbed, 
    buildMarketComponents, 
    handleMarketInteraction,
    getRealMarketData
};
