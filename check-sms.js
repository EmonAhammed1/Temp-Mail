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
}, { collection: 'sms' }); // specify collection name 'sms'

const Sms = mongoose.models.Sms || mongoose.model('Sms', SmsSchema);

async function check() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    const count = await Sms.countDocuments();
    console.log(`Total SMS in DB: ${count}`);

    const list = await Sms.find({}).sort({ createdAt: -1 }).limit(5).lean();
    console.log('Recent 5 SMS:');
    console.log(JSON.stringify(list, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

check();
