const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8']);
} catch (e) {}

const MONGODB_URI = "mongodb+srv://tempmail:elXED1eYb8UQGvRj@cluster0.4ahw9qu.mongodb.net/tempmail?appName=Cluster0";

const SmsSchema = new mongoose.Schema({
  from: String,
  to: String,
  body: String,
  createdAt: { type: Date, default: Date.now }
}); // NO EXPLICIT COLLECTION NAME

const Sms = mongoose.models.Sms || mongoose.model('Sms', SmsSchema);

async function check() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    // Check what collection Mongoose maps it to
    console.log('Mongoose collection name:', Sms.collection.name);
    
    // Fetch counts from this collection
    const count = await Sms.countDocuments();
    console.log(`Count in Mongoose collection: ${count}`);

    // List all collections in the DB
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Existing collections in database:');
    collections.forEach(col => console.log(`- ${col.name}`));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

check();
