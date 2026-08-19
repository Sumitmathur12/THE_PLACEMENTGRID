import mongoose from 'mongoose';

export const connectDB = async () => {
  const connUri = process.env.MONGODB_URI;
  if (!connUri) {
    console.warn('MongoDB URI is not configured in .env. Operating in offline mock mode.');
    return;
  }

  try {
    console.log(`Attempting connection to MongoDB at: ${connUri}`);
    const conn = await mongoose.connect(connUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Drop legacy unique index on domain field in roadmaps collection if exists
    try {
      await mongoose.connection.collection('roadmaps').dropIndex('domain_1');
      console.log('Database index migration: Dropped unique domain index on roadmaps.');
    } catch (err) {
      // Ignored: index not present
    }
  } catch (error) {
    console.error(`CRITICAL DATABASE STARTUP ERROR: MongoDB Connection Failed!\nDetails: ${error.message}`);
    
    // Strict-error policy: exit the process to bubble up errors if URI is set
    console.error('Database connection failed. Exiting server process.');
    process.exit(1);
  }
};
