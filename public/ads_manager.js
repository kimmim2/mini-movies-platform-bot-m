let adPlaying = false;
let midRollsTimes = [600, 900]; // 10 min, 15 min in seconds
let skipTime = 25;
let currentVideo = null;

function playVideoWithAds(videoUrl) {
    if (!videoUrl) return;
    
    const video = document.getElementById("myVideo");
    const loading = document.getElementById("loading");
    
    // Show loading
    loading.classList.remove("hidden");
    
    // Reset midrolls for new video
    midRollsTimes = [600, 900];
    adPlaying = false;
    currentVideo = videoUrl;
    
    // Show pre-roll ad first
    showPreRollAd(() => {
        // After pre-roll, load the actual video
        video.src = videoUrl;
        video.load();
        
        // Use addEventListener to avoid overwriting existing onloadeddata handler
        const handleVideoLoaded = () => {
            loading.classList.add("hidden");
            
            // Apply saved resume position if exists
            const videoId = window.currentVideoId;
            if (videoId) {
                const savedTime = localStorage.getItem(`video_position_${videoId}`);
                if (savedTime && parseFloat(savedTime) > 0) {
                    video.currentTime = parseFloat(savedTime);
                    console.log(`Resuming video at ${savedTime} seconds`);
                }
            }
            
            video.play();
            setupMidRollTracking(video);
            
            // Remove this specific listener after use
            video.removeEventListener('loadeddata', handleVideoLoaded);
        };
        
        video.addEventListener('loadeddata', handleVideoLoaded);
        
        video.onerror = () => {
            loading.classList.add("hidden");
            alert("Video could not be loaded. Please try again.");
        };
    });
}

function setupMidRollTracking(video) {
    // Clear any existing event listeners to avoid duplicates
    video.removeEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("timeupdate", handleTimeUpdate);
}

function handleTimeUpdate() {
    const video = document.getElementById("myVideo");
    
    if (adPlaying || !video) return;
    
    // Check for mid-roll ads
    midRollsTimes.forEach((time, index) => {
        if (video.currentTime >= time && video.currentTime <= time + 1) {
            adPlaying = true;
            video.pause();
            
            showMidRollAd(() => {
                adPlaying = false;
                video.play();
                // Remove this midroll time so it doesn't trigger again
                midRollsTimes.splice(index, 1);
            });
        }
    });
}

function showPreRollAd(callback) {
    const adContainer = document.getElementById("ad-overlay");
    adPlaying = true;
    adContainer.style.display = "flex";
    
    adContainer.innerHTML = `
        <div class="text-center">
            <div class="mb-4">
                <div class="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    📺
                </div>
                <h3 class="text-xl font-bold">Pre-roll Advertisement</h3>
                <p class="text-sm opacity-75">Your video will start after this ad</p>
            </div>
            <div class="bg-gray-800 p-4 rounded mb-4">
                <p class="text-lg">🎬 Sponsored Content</p>
                <p class="text-sm mt-2">Supporting quality content...</p>
            </div>
        </div>
    `;
    
    // Create skip button with 25 second timer (matching template requirement)
    let skipBtn = document.createElement("button");
    skipBtn.className = "bg-gray-500 text-white px-6 py-2 rounded-full font-bold transition-all duration-300";
    skipBtn.innerText = `Skip Ad in ${skipTime} sec`;
    skipBtn.disabled = true;
    skipBtn.style.opacity = "0.5";
    adContainer.appendChild(skipBtn);
    
    let countdown = skipTime; // 25 seconds as per template
    let interval = setInterval(() => {
        countdown--;
        skipBtn.innerText = countdown > 0 ? `Skip Ad in ${countdown} sec` : "Skip Ad ▶️";
        
        if (countdown <= 0) {
            skipBtn.disabled = false;
            skipBtn.style.opacity = "1";
            skipBtn.className = "bg-green-500 text-white px-6 py-2 rounded-full font-bold hover:bg-green-600 transition-all duration-300 animate-pulse";
        }
    }, 1000);
    
    skipBtn.onclick = () => {
        clearInterval(interval);
        adContainer.style.display = "none";
        adPlaying = false;
        callback();
    };
    
    // Auto-skip after 30 seconds (give 5 extra seconds after skip becomes available)
    setTimeout(() => {
        clearInterval(interval);
        adContainer.style.display = "none";
        adPlaying = false;
        callback();
    }, 30000);
}

function showMidRollAd(callback) {
    const adContainer = document.getElementById("ad-overlay");
    adContainer.style.display = "flex";
    
    adContainer.innerHTML = `
        <div class="text-center">
            <div class="mb-4">
                <div class="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    ⏸️
                </div>
                <h3 class="text-xl font-bold">Advertisement Break</h3>
                <p class="text-sm opacity-75">We'll be right back</p>
            </div>
            <div class="bg-gray-800 p-4 rounded mb-4">
                <p class="text-lg">📱 Premium Ad Space</p>
                <p class="text-sm mt-2">Thank you for watching!</p>
            </div>
        </div>
    `;
    
    // Create skip button
    let skipBtn = document.createElement("button");
    skipBtn.className = "bg-blue-500 text-white px-6 py-2 rounded-full font-bold transition-all duration-300";
    skipBtn.innerText = `Skip Ad in ${skipTime} sec`;
    skipBtn.disabled = true;
    skipBtn.style.opacity = "0.5";
    adContainer.appendChild(skipBtn);
    
    let countdown = skipTime;
    let interval = setInterval(() => {
        countdown--;
        skipBtn.innerText = countdown > 0 ? `Skip Ad in ${countdown} sec` : "Skip Ad ▶️";
        
        if (countdown <= 0) {
            skipBtn.disabled = false;
            skipBtn.style.opacity = "1";
            skipBtn.className = "bg-green-500 text-white px-6 py-2 rounded-full font-bold hover:bg-green-600 transition-all duration-300 animate-pulse";
        }
    }, 1000);
    
    skipBtn.onclick = () => {
        clearInterval(interval);
        adContainer.style.display = "none";
        callback();
    };
    
    // Auto-skip after 30 seconds
    setTimeout(() => {
        clearInterval(interval);
        adContainer.style.display = "none";
        callback();
    }, 30000);
}

function loadBannerAd() {
    const bannerDiv = document.getElementById("ad-banner");
    if (!bannerDiv) return;
    
    // Try to load real ad network banner using createElement (from template)
    try {
        // Method 1: Create script element for ad network
        const adScript = document.createElement('script');
        adScript.type = 'text/javascript';
        adScript.src = '//www.profitablecpmrate.com/show_banner.js?width=728&height=90&site_id=your_site_id';
        adScript.async = true;
        
        adScript.onerror = () => {
            console.log('Ad network script failed, showing fallback banner');
            showFallbackBannerAd(bannerDiv);
        };
        
        // Clear banner div and append script
        bannerDiv.innerHTML = '';
        bannerDiv.appendChild(adScript);
        
        // Fallback timeout: If ad doesn't load in 5 seconds, show fallback
        setTimeout(() => {
            if (bannerDiv.children.length <= 1 || !bannerDiv.querySelector('*:not(script)')) {
                showFallbackBannerAd(bannerDiv);
            }
        }, 5000);
        
    } catch (error) {
        console.log('Banner ad creation failed, showing fallback banner');
        showFallbackBannerAd(bannerDiv);
    }
}

function showFallbackBannerAd(bannerDiv) {
    bannerDiv.innerHTML = `
        <div class="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg shadow-lg">
            <div class="flex items-center justify-between">
                <div>
                    <h4 class="font-bold">📱 Banner Advertisement</h4>
                    <p class="text-sm opacity-90">Support our platform</p>
                </div>
                <button onclick="this.parentElement.parentElement.style.display='none'" class="text-white hover:text-gray-200">
                    ✕
                </button>
            </div>
        </div>
    `;
}

function showPropellerPopunder() {
    // Only show once per session
    if (window.popunderShown) return;
    
    // Try to load real popunder network (from template)
    try {
        // Method 1: Load popunder script from ad network
        let popScript = document.createElement("script");
        popScript.async = true;
        popScript.type = "text/javascript";
        popScript.src = "//www.profitablecpmrate.com/popunder.js";
        popScript.onerror = () => {
            console.log('Popunder ad network failed, using fallback');
            showFallbackPopunder();
        };
        document.head.appendChild(popScript);
        
        window.popunderShown = true;
        
    } catch (error) {
        console.log('Popunder script failed, showing fallback');
        showFallbackPopunder();
    }
}

function showFallbackPopunder() {
    // Fallback popunder using native browser popup
    setTimeout(() => {
        if (confirm("🎬 Enjoy our content? Click OK to support us with ads!")) {
            // Open support page instead of actual ad
            const supportMsg = "Thank you for supporting our platform! Ad revenue helps us provide free content.";
            alert(supportMsg);
        }
        window.popunderShown = true;
    }, 30000); // Show after 30 seconds
}

// Enhanced ad tracking
function trackAdInteraction(adType, action) {
    console.log(`Ad Interaction: ${adType} - ${action}`);
    // You can send this data to analytics
    /* 
    fetch('/api/ad-analytics', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({type: adType, action: action, timestamp: new Date()})
    });
    */
}

// Detect ad blockers
function detectAdBlocker() {
    const adTest = document.createElement('div');
    adTest.innerHTML = '&nbsp;';
    adTest.className = 'adsbox';
    document.body.appendChild(adTest);
    
    setTimeout(() => {
        if (adTest.offsetHeight === 0) {
            console.log('AdBlocker detected');
            // Show message to disable adblocker
            showAdBlockerMessage();
        }
        adTest.remove();
    }, 100);
}

function showAdBlockerMessage() {
    const message = document.createElement('div');
    message.className = 'fixed top-0 left-0 w-full bg-yellow-500 text-black p-3 text-center z-50';
    message.innerHTML = `
        <p><strong>⚠️ AdBlocker Detected!</strong> Please disable your adblocker to support our free content.</p>
        <button onclick="this.parentElement.remove()" class="ml-2 bg-black text-yellow-500 px-2 py-1 rounded">OK</button>
    `;
    document.body.appendChild(message);
}

// Initialize ad system
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(detectAdBlocker, 2000);
});
