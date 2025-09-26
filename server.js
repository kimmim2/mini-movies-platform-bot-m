require('dotenv').config();
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Video storage (in production, use a database)
let videos = [
    {
        id: 1,
        title: "Big Buck Bunny",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
        description: "A large and lovable rabbit deals with three tiny bullies, led by a flying squirrel, who are determined to squelch his happiness.",
        views: 150,
        category: "movie",
        addedAt: new Date().toISOString()
    },
    {
        id: 2,
        title: "Elephant's Dream",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg",
        description: "A short computer-animated film produced by the Blender Institute.",
        views: 89,
        category: "drama",
        addedAt: new Date().toISOString()
    },
    {
        id: 3,
        title: "For Bigger Blazes",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg",
        description: "A spectacular fire show in stunning 4K quality.",
        views: 234,
        category: "series",
        addedAt: new Date().toISOString()
    }
];

// Telegram Bot Setup - Only initialize if token is provided
let bot = null;
const adminChatIds = process.env.ADMIN_CHAT_IDS ? process.env.ADMIN_CHAT_IDS.split(',').map(id => id.trim()) : [];

if (process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
} else {
    console.log('⚠️ Telegram Bot disabled: TELEGRAM_BOT_TOKEN not provided');
}

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoints
app.get('/api/videos', (req, res) => {
    res.json({ videos });
});

app.post('/api/videos', (req, res) => {
    const { title, url, thumbnail, description } = req.body;
    const video = {
        id: Date.now(),
        title,
        url,
        thumbnail: thumbnail || '/assets/default-thumb.jpg',
        description: description || '',
        views: 0,
        addedAt: new Date().toISOString()
    };
    videos.push(video);
    res.json({ success: true, video });
});

app.delete('/api/videos/:id', (req, res) => {
    const videoId = parseInt(req.params.id);
    videos = videos.filter(v => v.id !== videoId);
    res.json({ success: true });
});

app.post('/api/videos/:id/view', (req, res) => {
    const videoId = parseInt(req.params.id);
    const video = videos.find(v => v.id === videoId);
    if (video) {
        video.views = (video.views || 0) + 1;
        res.json({ success: true, views: video.views });
    } else {
        res.status(404).json({ success: false, error: 'Video not found' });
    }
});

// Telegram Bot Commands (only if bot is initialized)
if (bot) {
    // Admin only commands
    function isAdmin(chatId) {
        return adminChatIds.includes(chatId.toString());
    }

    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const welcomeMsg = `🎬 Mini Movies Bot এ স্বাগতম!

Admin Commands (শুধু Admin দের জন্য):
/addvideo - নতুন ভিডিও যোগ করুন
/removevideo - ভিডিও মুছুন
/listvideo - সব ভিডিও দেখুন
/stats - Statistics দেখুন

সাধারণ Commands:
/help - সাহায্য
/website - Website লিংক`;
        
        bot.sendMessage(chatId, welcomeMsg);
    });

    bot.onText(/\/help/, (msg) => {
        const chatId = msg.chat.id;
        const helpMsg = `🆘 সাহায্য:

এই বট দিয়ে আপনি Mini Movies Platform ম্যানেজ করতে পারবেন।

Admin রা নতুন ভিডিও add করতে পারবেন, ভিডিও remove করতে পারবেন এবং statistics দেখতে পারবেন।

Website: ${process.env.REPLIT_DOMAINS || 'http://localhost:5000'}`;
        
        bot.sendMessage(chatId, helpMsg);
    });

    bot.onText(/\/website/, (msg) => {
        const chatId = msg.chat.id;
        const websiteUrl = process.env.REPLIT_DOMAINS || 'http://localhost:5000';
        bot.sendMessage(chatId, `🌐 Mini Movies Website: ${websiteUrl}`);
    });

    bot.onText(/\/addvideo/, (msg) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) {
            bot.sendMessage(chatId, '❌ এই কমান্ড শুধু Admin রা ব্যবহার করতে পারবেন।');
            return;
        }
        
        bot.sendMessage(chatId, `📹 নতুন ভিডিও যোগ করতে এই ফরম্যাটে পাঠান:

Title: ভিডিও টাইটেল
URL: ভিডিও URL/File ID
Thumb: Thumbnail URL (optional)
Desc: বিবরণ (optional)

উদাহরণ:
Title: Amazing Movie
URL: https://example.com/video.mp4
Thumb: https://example.com/thumb.jpg
Desc: This is an amazing movie`);
    });

    bot.onText(/Title: (.+)\nURL: (.+)(?:\nThumb: (.+))?(?:\nDesc: (.+))?/s, (msg, match) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) return;
        
        const title = match[1];
        const url = match[2];
        const thumbnail = match[3] || null;
        const description = match[4] || '';
        
        const video = {
            id: Date.now(),
            title,
            url,
            thumbnail,
            description,
            views: 0,
            addedAt: new Date().toISOString()
        };
        
        videos.push(video);
        bot.sendMessage(chatId, `✅ ভিডিও সফলভাবে যোগ করা হয়েছে!\n\n🎬 Title: ${title}\n🔗 URL: ${url}`);
    });

    bot.onText(/\/listvideo/, (msg) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) {
            bot.sendMessage(chatId, '❌ এই কমান্ড শুধু Admin রা ব্যবহার করতে পারবেন।');
            return;
        }
        
        if (videos.length === 0) {
            bot.sendMessage(chatId, '📭 কোন ভিডিও নেই।');
            return;
        }
        
        let videoList = '📹 সব ভিডিও:\n\n';
        videos.forEach((video, index) => {
            videoList += `${index + 1}. ${video.title}\n   ID: ${video.id}\n   Views: ${video.views}\n\n`;
        });
        
        bot.sendMessage(chatId, videoList);
    });

    bot.onText(/\/removevideo (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) {
            bot.sendMessage(chatId, '❌ এই কমান্ড শুধু Admin রা ব্যবহার করতে পারবেন।');
            return;
        }
        
        const videoId = parseInt(match[1]);
        const videoIndex = videos.findIndex(v => v.id === videoId);
        
        if (videoIndex === -1) {
            bot.sendMessage(chatId, '❌ ভিডিও পাওয়া যায়নি।');
            return;
        }
        
        const removedVideo = videos.splice(videoIndex, 1)[0];
        bot.sendMessage(chatId, `✅ ভিডিও মুছে দেওয়া হয়েছে: ${removedVideo.title}`);
    });

    bot.onText(/\/stats/, (msg) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) {
            bot.sendMessage(chatId, '❌ এই কমান্ড শুধু Admin রা ব্যবহার করতে পারবেন।');
            return;
        }
        
        const totalVideos = videos.length;
        const totalViews = videos.reduce((sum, video) => sum + video.views, 0);
        const mostViewed = videos.length > 0 ? videos.reduce((max, video) => video.views > max.views ? video : max) : null;
        
        let statsMsg = `📊 Platform Statistics:\n\n`;
        statsMsg += `📹 মোট ভিডিও: ${totalVideos}\n`;
        statsMsg += `👀 মোট Views: ${totalViews}\n`;
        if (mostViewed) {
            statsMsg += `🔥 সবচেয়ে জনপ্রিয়: ${mostViewed.title} (${mostViewed.views} views)`;
        }
        
        bot.sendMessage(chatId, statsMsg);
    });

    // Error handling for bot
    bot.on('error', (error) => {
        console.log('Telegram Bot Error:', error.code, error.message);
    });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Mini Movies Platform running on port ${PORT}`);
    if (process.env.TELEGRAM_BOT_TOKEN) {
        console.log('🤖 Telegram Bot is active');
    } else {
        console.log('⚠️ Telegram Bot token not found. Add TELEGRAM_BOT_TOKEN to environment variables.');
    }
});