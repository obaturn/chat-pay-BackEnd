require('dotenv').config();
const mongoose = require('mongoose');

console.log("----------------------------------------");
console.log("🧪 MongoDB Connection Test Script");
console.log("----------------------------------------");

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error("❌ MONGODB_URI is not defined in .env");
    process.exit(1);
}

// Mask password for safe logging
const maskedUri = uri.replace(/:([^:@]+)@/, ':****@');
console.log(`📡 Attempting to connect to: ${maskedUri}`);

// Connection options
const options = {
    serverSelectionTimeoutMS: 5000, // Fail fast (5s) instead of 30s
    socketTimeoutMS: 45000,
    family: 4 // Force IPv4
};

async function testConnection() {
    try {
        console.log("⏳ Connecting...");
        const startTime = Date.now();

        await mongoose.connect(uri, options);

        const duration = Date.now() - startTime;
        console.log(`✅ SUCCESS! Connected in ${duration}ms`);
        console.log("🎉 The database connection works perfectly.");

        await mongoose.disconnect();
        console.log("👋 Disconnected.");
        process.exit(0);

    } catch (error) {
        console.error("❌ CONNECTION FAILED");
        console.error("----------------------------------------");
        console.error(`Name: ${error.name}`);
        console.error(`Message: ${error.message}`);

        if (error.name === 'MongoNetworkTimeoutError') {
            console.log("\n💡 DIAGNOSIS: NETWORK TIMEOUT");
            console.log("1. Check if your internet is stable.");
            console.log("2. Your ISP might be blocking Port 27017.");
            console.log("3. Try connecting to a mobile hotspot/different WiFi.");
        } else if (error.message.includes('bad auth')) {
            console.log("\n💡 DIAGNOSIS: AUTHENTICATION FAILED");
            console.log("1. Check your Username and Password.");
            console.log("2. Ensure special characters in password are URL encoded (%40 for @).");
        }

        process.exit(1);
    }
}

testConnection();
