const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8']);

const MONGODB_URI = "mongodb+srv://tempmail:elXED1eYb8UQGvRj@cluster0.4ahw9qu.mongodb.net/tempmail?appName=Cluster0";

// Define schemas to match our app
const UserSchema = new mongoose.Schema({}, { strict: false });
const InboxSchema = new mongoose.Schema({}, { strict: false });
const EmailSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.models.User || mongoose.model('User', UserSchema, 'users');
const Inbox = mongoose.models.Inbox || mongoose.model('Inbox', InboxSchema, 'inboxes');
const Email = mongoose.models.Email || mongoose.model('Email', EmailSchema, 'emails');

async function debug() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    // Get counts
    const usersCount = await User.countDocuments();
    const inboxesCount = await Inbox.countDocuments();
    const emailsCount = await Email.countDocuments();

    console.log(`\n--- DB Counts ---`);
    console.log(`Users: ${usersCount}`);
    console.log(`Inboxes: ${inboxesCount}`);
    console.log(`Emails: ${emailsCount}`);

    // List all inboxes
    const inboxesList = await Inbox.find({}).lean();
    console.log(`\n--- Active Inboxes ---`);
    inboxesList.forEach(ib => {
      console.log(`Address: "${ib.address}" | UserId: ${ib.userId}`);
    });

    // List recent emails
    const emailsList = await Email.find({}).sort({ createdAt: -1 }).limit(5).lean();
    console.log(`\n--- Recent Emails (Last 5) ---`);
    emailsList.forEach(em => {
      console.log(`To: "${em.to}" | From: "${em.from}" | Subject: "${em.subject}" | Date: ${em.createdAt}`);
    });

  } catch (err) {
    console.error('Error debugging database:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from DB.');
  }
}

debug();
