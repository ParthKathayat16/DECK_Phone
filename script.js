// --- CONFIGURATION ---
const LAT = 23.02; // Location for Weather
const LON = 72.57; 

// --- IMPORTS (The magic that brings AI to the browser) ---
import * as webllm from "https://esm.run/@mlc-ai/web-llm";

// --- GLOBAL STATE ---
let currentTemp = "--";
let currentCondition = "Unknown";
let engine = null; // This will hold our AI Brain
let isBrainLoaded = false;

// --- 1. CLOCK & DATE ---
function updateClock() {
    const now = new Date();
    document.getElementById('time').innerText = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    document.getElementById('date').innerText = now.toLocaleDateString([], {weekday: 'long', month: 'short', day: 'numeric'});
}
setInterval(updateClock, 1000);
updateClock();

// --- 2. WEATHER (Open-Meteo) ---
async function fetchWeather() {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current_weather=true`);
        const data = await res.json();
        const temp = Math.round(data.current_weather.temperature);
        currentTemp = `${temp}°C`;
        currentCondition = getWeatherDesc(data.current_weather.weathercode);
        document.getElementById('temperature').innerText = currentTemp;
        document.getElementById('condition').innerText = currentCondition;
    } catch (e) { console.error("Weather error", e); }
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
        div.innerText = d; 
        div.style.fontWeight="bold"; 
        grid.appendChild(div);
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

// --- 4. LOAD THE BRAIN (Runs on Phone GPU) ---
async function loadBrain() {
    document.getElementById('assistant-status').innerText = "Downloading Brain (0%)...";
    
    // We use Llama-3.2-1B (Tiny but smart enough for commands)
    const selectedModel = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
    
    try {
        const initProgressCallback = (report) => {
            console.log(report.text);
            document.getElementById('assistant-status').innerText = report.text;
        };

        // Create the engine
        engine = await webllm.CreateMLCEngine(selectedModel, { 
            initProgressCallback: initProgressCallback 
        });

        isBrainLoaded = true;
        document.getElementById('assistant-status').innerText = "Brain Ready. Tap Mic.";
        speak("System online. Neural engine loaded.");

    } catch (err) {
        console.error(err);
        document.getElementById('assistant-status').innerText = "Brain Failed (Phone too old?)";
        speak("I could not load the neural engine. Your phone might not support WebGPU.");
    }
}
// Start loading immediately
loadBrain();

// --- 5. VOICE ASSISTANT ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
const synth = window.speechSynthesis;
recognition.lang = 'en-US';

const micBtn = document.getElementById('mic-btn');
const statusText = document.getElementById('assistant-status');
const wave = document.getElementById('wave-container');

// Toggle Mic
window.toggleAssistant = function() { // Made global so HTML can see it
    if (!isBrainLoaded) {
        speak("Please wait, I am still waking up.");
        return;
    }
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
    await processWithLocalBrain(userText);
};

// --- 6. PROCESS WITH PHONE BRAIN ---
async function processWithLocalBrain(userText) {
    // 1. Context
    const context = `
    Time: ${new Date().toLocaleTimeString()}
    Weather: ${currentTemp}, ${currentCondition}
    Battery: ${window.fully ? window.fully.getBatteryLevel() + '%' : 'Unknown'}
    `;

    const systemPrompt = `
    You are a deck assistant. Be concise (1 sentence).
    Hardware codes: [[SCREEN_OFF]], [[BRIGHT_MAX]], [[BRIGHT_LOW]], [[RELOAD]].
    Context: ${context}
    `;

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
    ];

    try {
        const reply = await engine.chat.completions.create({ messages });
        const answer = reply.choices[0].message.content;
        executeAndSpeak(answer);
    } catch (e) {
        console.error(e);
        speak("I got confused.");
    }
}

function executeAndSpeak(reply) {
    let cleanText = reply;
    if (reply.includes("[[SCREEN_OFF]]")) { if (window.fully) window.fully.turnScreenOff(); cleanText = cleanText.replace("[[SCREEN_OFF]]", ""); }
    if (reply.includes("[[BRIGHT_MAX]]")) { if (window.fully) window.fully.setScreenBrightness(255); cleanText = cleanText.replace("[[BRIGHT_MAX]]", ""); }
    if (reply.includes("[[BRIGHT_LOW]]")) { if (window.fully) window.fully.setScreenBrightness(10); cleanText = cleanText.replace("[[BRIGHT_LOW]]", ""); }
    
    statusText.innerText = "Tap mic to speak";
    const utterance = new SpeechSynthesisUtterance(cleanText);
    synth.speak(utterance);
}

// Speak Helper
function speak(text) {
    const u = new SpeechSynthesisUtterance(text);
    synth.speak(u);
}