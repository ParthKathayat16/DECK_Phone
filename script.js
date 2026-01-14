// --- CONFIGURATION ---
//  PASTE YOUR NEW KEY INSIDE THE QUOTES BELOW
const API_KEY = "AIzaSyB1pulLX9S4vB8cajIWklIUoA9JcxLIv54"; 

const LAT = 23.02; 
const LON = 72.57; 

// --- GLOBAL STATE ---
let currentTemp = "--";
let currentCondition = "Unknown";

// --- 1. CLOCK ---
function updateClock() {
    const now = new Date();
    document.getElementById('time').innerText = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    document.getElementById('date').innerText = now.toLocaleDateString([], {weekday: 'long', month: 'short', day: 'numeric'});
}
setInterval(updateClock, 1000);
updateClock();

// --- 2. WEATHER ---
async function fetchWeather() {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current_weather=true`);
        const data = await res.json();
        currentTemp = `${Math.round(data.current_weather.temperature)}°C`;
        currentCondition = getWeatherDesc(data.current_weather.weathercode);
        document.getElementById('temperature').innerText = currentTemp;
        document.getElementById('condition').innerText = currentCondition;
    } catch (e) { console.error("Weather error"); }
}
function getWeatherDesc(code) {
    if(code === 0) return "Clear Sky";
    if(code >= 1 && code <= 3) return "Partly Cloudy";
    if(code >= 51) return "Rainy";
    return "Unknown";
}
fetchWeather();
setInterval(fetchWeather, 900000);

// --- 3. CALENDAR ---
function renderCalendar() {
    const now = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    document.getElementById('cal-month').innerText = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const grid = document.getElementById('cal-grid');
    grid.innerHTML = "";
    ["S","M","T","W","T","F","S"].forEach(d => {
        const div = document.createElement("div");
        div.innerText = d; div.style.fontWeight="bold"; grid.appendChild(div);
    });
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const today = now.getDate();
    for(let i=0; i<firstDay; i++) grid.appendChild(document.createElement("div"));
    for(let i=1; i<=daysInMonth; i++) {
        const div = document.createElement("div");
        div.className = "cal-day";
        div.innerText = i;
        if(i === today) div.classList.add("cal-today");
        grid.appendChild(div);
    }
}
renderCalendar();

// --- 4. VOICE ASSISTANT ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
const synth = window.speechSynthesis;
recognition.lang = 'en-US';

const micBtn = document.getElementById('mic-btn');
const statusText = document.getElementById('assistant-status');
const wave = document.getElementById('wave-container');

window.toggleAssistant = function() {
    try { recognition.start(); } catch (e) {}
};

recognition.onstart = () => {
    micBtn.classList.add("listening");
    wave.classList.add("active");
    statusText.innerText = "Listening...";
};
recognition.onend = () => {
    micBtn.classList.remove("listening");
    wave.classList.remove("active");
};
recognition.onresult = async (event) => {
    const userText = event.results[0][0].transcript;
    statusText.innerText = "Thinking...";
    await processWithCloudAI(userText);
};

// --- 5. THE BRAIN (GOOGLE CLOUD) ---
async function processWithCloudAI(userText) {
    const context = `Time: ${new Date().toLocaleTimeString()}, Weather: ${currentTemp}, ${currentCondition}`;
    const systemPrompt = `You are a deck assistant. Be concise (1 sentence). Context: ${context}. Hardware codes: [[SCREEN_OFF]], [[BRIGHT_MAX]].`;
    
    // We use a different URL structure to fix your 404 error
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `${systemPrompt}\nUser: ${userText}` }]
                }]
            })
        });

        const data = await response.json();
        
        // Safety check if API fails
        if (!data.candidates) {
            console.error(data);
            speak("My API key might be invalid.");
            return;
        }

        const reply = data.candidates[0].content.parts[0].text;
        executeAndSpeak(reply);

    } catch (error) {
        console.error(error);
        speak("I cannot reach the cloud.");
    }
}

function executeAndSpeak(reply) {
    let cleanText = reply;
    if (reply.includes("[[SCREEN_OFF]]")) { if (window.fully) window.fully.turnScreenOff(); cleanText = cleanText.replace("[[SCREEN_OFF]]", ""); }
    if (reply.includes("[[BRIGHT_MAX]]")) { if (window.fully) window.fully.setScreenBrightness(255); cleanText = cleanText.replace("[[BRIGHT_MAX]]", ""); }
    
    statusText.innerText = "Tap mic to speak";
    const u = new SpeechSynthesisUtterance(cleanText);
    synth.speak(u);
}
function speak(text) { synth.speak(new SpeechSynthesisUtterance(text)); }
