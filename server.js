require('dotenv').config();
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Video storage (url field is replaced by telegram_file_id)
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
        addedAt: new Date().toISOString(),
        addedBy: "System"
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
        addedAt: new Date().toISOString(),
        addedBy: "System"
    }
    // আপনি আপনার সব ভিডিওর File ID এবং Size এখানে যুক্ত করবেন
];

// Telegram Bot Setup - Only initialize if token is provided
let bot = null;
const adminChatIds = process.env.ADMIN_CHAT_IDS ? process.env.ADMIN_CHAT_IDS.split(',').map(id => id.trim()) : [];
const PRIVATE_CHANNEL_ID = process.env.PRIVATE_CHANNEL_ID; 

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
// সংশোধিত API: Private Channel Video Streaming Proxy
// ----------------------------------------------------------------------
// এই রুটে Range Header হ্যান্ডলিং যুক্ত করা হয়েছে, যা ভিডিও প্লেব্যাক সমস্যার সমাধান করবে।
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
        return res.status(500).send('Could not get file link from Telegram. Check if bot token is valid and bot is admin in channel.');
    }

    // ২. Range Header হ্যান্ডলিং (ভিডিও স্ট্রিমিং এর জন্য অপরিহার্য)
    const range = req.headers.range;
    if (!range) {
        // যদি ক্লায়েন্ট Range হেডার না পাঠায়, তাহলে Full Content Header পাঠান (HTTP 200)
        const headers = {
            'Content-Type': 'video/mp4',
            'Content-Length': videoData.size, // মোট ফাইলের সাইজ
            'Accept-Ranges': 'bytes',
        };
        res.writeHead(200, headers);
        
        // সমস্ত ফাইলটি Fetch করে স্ট্রিম করুন
        const fileResponse = await fetch(telegramFileUrl);
        if (!fileResponse.ok) {
             return res.status(500).send('Failed to fetch full video content from Telegram.');
        }
        fileResponse.body.pipe(res);
        return;
    }

    // ৩. Range Header বিশ্লেষণ (যদি ক্লায়েন্ট আংশিক ডেটা চায় - HTTP 206)
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoData.size - 1;
    
    const chunksize = (end - start) + 1;
    
    // ৪. Telegram Fetch করার জন্য Range Header সেট করুন
    const fetchHeaders = {
        'Range': `bytes=${start}-${end}`
    };

    // ৫. Range সহ Telegram থেকে ডেটা Fetch করুন
    const fileResponse = await fetch(telegramFileUrl, { headers: fetchHeaders });

    if (!fileResponse.ok) {
        console.error(`Error fetching video chunk from Telegram: ${fileResponse.statusText}`);
        // Telegram 416 (Range Not Satisfiable) পাঠালে 416 ফেরত দিন
        if (fileResponse.status === 416) {
             return res.status(416).send('Range Not Satisfiable');
        }
        return res.status(500).send('Could not fetch video chunk from Telegram.');
    }
    
    // ৬. ক্লায়েন্টের কাছে আংশিক কন্টেন্ট Header সেট করুন (HTTP 206)
    const headers = {
        'Content-Range': `bytes ${start}-${end}/${videoData.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize, // এই রেঞ্জের জন্য কন্টেন্টের সাইজ
        'Content-Type': 'video/mp4',
        // নিরাপত্তা: কন্টেন্ট ডাউনলোড না হয়ে প্লে হয় তা নিশ্চিত করে
        'Content-Disposition': 'inline', 
    };

    // 206 Partial Content স্ট্যাটাস কোড সেট করুন
    res.writeHead(206, headers);

    // ৭. Stream শুরু করুন
    fileResponse.body.pipe(res);

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
    const { title, telegram_file_id, thumbnail, description, size, addedBy } = req.body;
    const video = {
        id: Date.now(),
        title,
        telegram_file_id, // File ID সেভ করা হলো
        size: size || 0, // Size সেভ করা হলো
        thumbnail: thumbnail || '/assets/default-thumb.jpg',
        description: description || '',
        views: 0,
        category: 'movie', // Default
        addedAt: new Date().toISOString(),
        addedBy: addedBy || "API"
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

    // /addvideo কমান্ড আপডেট: এখন File ID এবং Size চাওয়া হবে (MB বা Bytes-এ)
    bot.onText(/\/addvideo/, (msg) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) {
            bot.sendMessage(chatId, '❌ এই কমান্ড শুধু Admin রা ব্যবহার করতে পারবেন।');
            return;
        }
        
        bot.sendMessage(chatId, `📹 নতুন ভিডিও যোগ করতে এই ফরম্যাটে পাঠান:

Title: ভিডিও টাইটেল
File ID: Telegram File ID (উপরে ভিডিও পাঠিয়ে আইডি ও সাইজ পেয়ে যাবেন)
Size: ফাইলের সাইজ **MB বা Bytes-এ** (স্ট্রিমিং এর জন্য জরুরি, উদাহরণ: 50MB, অথবা শুধু 87120150)
Thumb: Thumbnail URL (optional)
Desc: বিবরণ (optional)

উদাহরণ:
Title: Amazing Private Movie
File ID: BAACAgIAAxkDAAI...
Size: 50MB
Desc: This is an amazing movie`);
    });

    // বট Regex আপডেট: File ID এবং Size ফিল্ড যোগ করা হলো এবং Admin ID সেভ করা হলো
    bot.onText(/Title: (.+)\nFile ID: (.+)\nSize: (.+)(?:\nThumb: (.+))?(?:\nDesc: (.+))?/s, (msg, match) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) return;
        
        // কনসোলে লগ করুন যে কোন অ্যাডমিন ভিডিও যোগ করছেন
        console.log(`🎬 ADMIN ACTION: Video added by Chat ID: ${chatId}`); 
        
        const title = match[1];
        const telegram_file_id = match[2];
        const sizeInput = match[3]; // ইউজার যে ইনপুটটি দিয়েছে
        const thumbnail = match[4] || null;
        const description = match[5] || '';
        
        let sizeInBytes = 0;
        
        // ======================================================================
        // ✅ সংশোধিত Size Conversion Logic (যাতে ভুল না হয়)
        // ======================================================================
        const sizeString = sizeInput.toLowerCase().trim();
        
        if (sizeString.includes('mb')) {
            // যদি ইউজার "MB" ব্যবহার করে, তবে এটিকে MB হিসেবে গণ্য করুন
            const sizeInMB = parseFloat(sizeString.replace(/mb/i, '').trim());
            if (!isNaN(sizeInMB)) {
                sizeInBytes = Math.round(sizeInMB * 1024 * 1024);
            }
        } else if (sizeString.includes('bytes')) {
             // যদি ইউজার "bytes" ব্যবহার করে, তবে এটিকে Bytes হিসেবে গণ্য করুন
            const bytesMatch = sizeString.match(/(\d+)/);
            if (bytesMatch && bytesMatch[1]) {
                sizeInBytes = parseInt(bytesMatch[1]);
            }
        } 
        else {
            // যদি "MB" বা "bytes" কোনোটিই না থাকে, তবে ধরে নেওয়া হবে এটি সরাসরি Bytes সংখ্যা
            sizeInBytes = parseInt(sizeInput) || 0;
        }
        // ======================================================================
        // ✅ সংশোধিত Size Conversion Logic শেষ
        // ======================================================================


        // নতুন ফিল্ড: অ্যাডমিনের আইডি সেভ করার জন্য
        const addedBy = chatId.toString(); 

        const video = {
            id: Date.now(),
            title,
            telegram_file_id, 
            size: sizeInBytes, // <-- কনভার্ট করা সাইজটি সেভ করা হলো
            thumbnail,
            description,
            views: 0,
            category: 'movie',
            addedAt: new Date().toISOString(),
            addedBy: addedBy // <-- অ্যাডমিনের আইডি সেভ করা হলো
        };
        
        videos.push(video);
        
        // বট রিপ্লাই মেসেজে অ্যাডমিনের আইডি এবং কনভার্ট করা সাইজ যুক্ত করা হলো
        const displaySize = (sizeInBytes / 1024 / 1024).toFixed(2);
        bot.sendMessage(chatId, `✅ ভিডিও সফলভাবে যোগ করা হয়েছে!\n\n🎬 Title: ${title}\n👤 Added By: ${addedBy}\n📐 Converted Size: ${displaySize} MB (${sizeInBytes} bytes)`);
    });

    // ======================================================================
    // নতুন ফিচার: ভিডিও পেলে ফাইল আইডি স্বয়ংক্রিয়ভাবে অ্যাডমিনকে জানানো 
    // ======================================================================
    bot.on('video', (msg) => {
        const chatId = msg.chat.id;
        
        // শুধু অ্যাডমিনদের জন্য
        if (isAdmin(chatId)) { 
            const video = msg.video;
            
            // ফাইল আইডি, সাইজ এবং চ্যানেল আইডি অ্যাডমিন চ্যাটে রিপ্লাই করুন
            const message = `📹 ভিডিও ডেটা পেলাম:\n\n` + 
                            `**Title:** (ভিডিওর ক্যাপশন ব্যবহার করুন)\n` +
                            `**File ID:** \n\`${video.file_id}\`\n` +
                            `**Size:** ${video.file_size} bytes (প্রায় ${(video.file_size / 1024 / 1024).toFixed(2)} MB)\n\n` +
                            `➡️ এই ডেটা কপি করে /addvideo কমান্ডে ব্যবহার করুন।`;
            
            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            
            // কনসোল লগেও সেভ করুন (ডিবাগিং এর জন্য)
            console.log(`[FILE DATA LOG] ID: ${video.file_id}, Size: ${video.file_size}`);
        }
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
            // লিস্টে কে যোগ করেছে সেই তথ্য দেখানো
            const displaySize = (video.size / 1024 / 1024).toFixed(2);
            videoList += `${index + 1}. ${video.title}\n   **ID:** ${video.id}\n   Views: ${video.views}\n   Added By: ${video.addedBy || 'N/A'}\n   Size: ${displaySize} MB\n\n`;
        });
        
        bot.sendMessage(chatId, videoList, { parse_mode: 'Markdown' });
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
