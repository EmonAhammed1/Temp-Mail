const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8']);
} catch (e) {}

const MONGODB_URI = "mongodb+srv://tempmail:elXED1eYb8UQGvRj@cluster0.4ahw9qu.mongodb.net/tempmail?appName=Cluster0";

const UserSchema = new mongoose.Schema({
  email: String,
  createdAt: Date
}, { collection: 'users' });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function check() {
  try {
    await mongoose.connect(MONGODB_URI);
    const list = await User.find({}).lean();
    console.log(JSON.stringify(list, null, 2));
  } catch (err) {
    console.error(err.message);
  } finally {
    await mongoose.disconnect();
  }
}

check();
