require('dotenv').config();
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fetch = require('node-fetch'); // <-- নতুন লাইব্রেরি যুক্ত

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Video storage (url field is replaced by telegram_file_id)
// NOTE: For live streaming to work, you MUST use the /video/:id route
let videos = [
    {
        id: 1,
        title: "Private Video Demo 1",
        // এখানে Telegram File ID ব্যবহার করা হয়েছে (Dummy ID)
        telegram_file_id: "BAACAgIAAxkDAAICrWZc0_9e5n4E-4pQG9QYx0D0a_eD0", 
        size: 50000000, // ফাইলের আকার বাইটে (স্ট্রিমিং এর জন্য জরুরি)
        thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
        description: "This is a private video streamed through the bot proxy.",
        views: 150,
        category: "movie",
        addedAt: new Date().toISOString()
    },
    {
        id: 2,
        title: "Private Video Demo 2",
        telegram_file_id: "BAACAgIAAxkDAAICrWZc0_9e5n4E-4pQG9QYx0D0a_eD1", 
        size: 25000000, 
        thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg",
        description: "A short computer-animated film produced by the Blender Institute.",
        views: 89,
        category: "drama",
        addedAt: new Date().toISOString()
    }
    // আপনি আপনার সব ভিডিওর File ID এবং Size এখানে যুক্ত করবেন
];

// Telegram Bot Setup - Only initialize if token is provided
let bot = null;
const adminChatIds = process.env.ADMIN_CHAT_IDS ? process.env.ADMIN_CHAT_IDS.split(',').map(id => id.trim()) : [];
const PRIVATE_CHANNEL_ID = process.env.PRIVATE_CHANNEL_ID; // আপনার চ্যানেলের আইডি

if (process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
} else {
    console.log('⚠️ Telegram Bot disabled: TELEGRAM_BOT_TOKEN not provided');
}

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ======================================================================
// নতুন API: Private Channel Video Streaming Proxy
// ======================================================================

app.get('/video/:videoId', async (req, res) => {
    const videoId = parseInt(req.params.videoId);
    const videoData = videos.find(v => v.id === videoId);

    if (!videoData || !videoData.telegram_file_id || !bot) {
        return res.status(404).send('Video not found or Bot is not initialized.');
    }

    // ১. Telegram API থেকে ফাইল লিঙ্ক নিন
    let telegramFileUrl;
    try {
        const fileLinkResponse = await bot.getFileLink(videoData.telegram_file_id);
        telegramFileUrl = fileLinkResponse.href;
    } catch (error) {
        console.error('Error getting Telegram File Link:', error.message);
        return res.status(500).send('Could not get file link from Telegram. Check if bot is admin in channel.');
    }

    // ২. Range Header তৈরি করে Proxy Request পাঠান
    try {
        const headers = {};
        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }

        const fileResponse = await fetch(telegramFileUrl, { headers });

        if (!fileResponse.ok) {
            console.error(`Error fetching video from Telegram: ${fileResponse.statusText}`);
            return res.status(500).send('Could not fetch video content from Telegram.');
        }

        // ৩. স্ট্রিমিং Header সেটআপ
        const contentRange = fileResponse.headers.get('Content-Range');
        const contentLength = fileResponse.headers.get('Content-Length');
        const acceptRanges = fileResponse.headers.get('Accept-Ranges') || 'bytes';
        const statusCode = fileResponse.status;
        
        // সমস্ত প্রয়োজনীয় header ক্লায়েন্টের কাছে ফেরত পাঠান
        res.writeHead(statusCode, {
            'Content-Type': 'video/mp4',
            'Content-Length': contentLength,
            'Accept-Ranges': acceptRanges,
            ...(contentRange && {'Content-Range': contentRange})
        });

        // ৪. Stream শুরু করুন
        fileResponse.body.pipe(res);

    } catch (error) {
        console.error('Video Streaming Proxy Error:', error);
        res.status(500).send('Internal server error during streaming proxy.');
    }
});

// ======================================================================
// API endpoints
// ======================================================================

// /api/videos রুট আপডেট: এটি ভিডিওর আসল URL এর বদলে নতুন প্রক্সি লিঙ্ক পাঠাবে
app.get('/api/videos', (req, res) => {
    const updatedVideos = videos.map(v => ({
        ...v,
        // Frontend এ প্লে করার জন্য নতুন প্রক্সি URL: /video/:id
        url: `${req.protocol}://${req.get('host')}/video/${v.id}`, 
        telegram_file_id: undefined, // নিরাপত্তার জন্য ফাইল আইডি লুকিয়ে রাখা
        size: undefined
    }));
    res.json({ videos: updatedVideos });
});


// /api/videos (POST) রুট আপডেট: এখন URL এর বদলে File ID এবং Size নেবে
app.post('/api/videos', (req, res) => {
    const { title, telegram_file_id, thumbnail, description, size } = req.body;
    const video = {
        id: Date.now(),
        title,
        telegram_file_id, // File ID সেভ করা হলো
        size: size || 0, // Size সেভ করা হলো
        thumbnail: thumbnail || '/assets/default-thumb.jpg',
        description: description || '',
        views: 0,
        category: 'movie', // Default
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

// ======================================================================
// Telegram Bot Commands (only if bot is initialized)
// ======================================================================
if (bot) {
    // Admin only commands
    function isAdmin(chatId) {
        return adminChatIds.includes(chatId.toString());
    }

    bot.onText(/\/start/, (msg) => {
        // ... (existing /start logic) ...
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

    // ... (existing /help, /website logic) ...
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

    // /addvideo কমান্ড আপডেট: এখন File ID এবং Size চাওয়া হবে
    bot.onText(/\/addvideo/, (msg) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) {
            bot.sendMessage(chatId, '❌ এই কমান্ড শুধু Admin রা ব্যবহার করতে পারবেন।');
            return;
        }
        
        bot.sendMessage(chatId, `📹 নতুন ভিডিও যোগ করতে এই ফরম্যাটে পাঠান:

Title: ভিডিও টাইটেল
File ID: Telegram File ID (আপনার বটকে Channel-এ অ্যাডমিন করার পর ভিডিও আপলোড করলে পাবেন)
Size: ফাইলের সাইজ বাইটে (স্ট্রিমিং এর জন্য জরুরি, প্রায় 50000000)
Thumb: Thumbnail URL (optional)
Desc: বিবরণ (optional)

উদাহরণ:
Title: Amazing Private Movie
File ID: BAACAgIAAxkDAAI...
Size: 50000000
Desc: This is an amazing movie`);
    });

    // বট Regex আপডেট: File ID এবং Size ফিল্ড যোগ করা হলো
    bot.onText(/Title: (.+)\nFile ID: (.+)\nSize: (.+)(?:\nThumb: (.+))?(?:\nDesc: (.+))?/s, (msg, match) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) return;
        
        const title = match[1];
        const telegram_file_id = match[2];
        const size = parseInt(match[3]) || 0; // Size কে integer হিসেবে সেভ করা
        const thumbnail = match[4] || null;
        const description = match[5] || '';
        
        const video = {
            id: Date.now(),
            title,
            telegram_file_id, // File ID হিসেবে সেভ
            size,
            thumbnail,
            description,
            views: 0,
            category: 'movie',
            addedAt: new Date().toISOString()
        };
        
        videos.push(video);
        bot.sendMessage(chatId, `✅ ভিডিও সফলভাবে যোগ করা হয়েছে!\n\n🎬 Title: ${title}\n🔗 File ID: ${telegram_file_id}\n📐 Size: ${size} bytes`);
    });

    // ... (existing /listvideo, /removevideo, /stats logic) ...
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
