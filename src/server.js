require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const Item = require('./models/Item');
const itemRoutes = require('./routes/itemRoutes');
const requestRoutes = require('./routes/requestRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});
app.get('/api/stats', async (req, res, next) => {
  try {
    const [availableItems, totalCategories] = await Promise.all([
      Item.countDocuments({ status: 'Available' }),
      Item.distinct('category', { status: 'Available' })
    ]);
    res.json({ availableItems, categories: totalCategories.length });
  } catch (error) {
    next(error);
  }
});
app.use('/api/items', itemRoutes);
app.use('/api/requests', requestRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((error, req, res, next) => {
  console.error(error);
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(error.errors).map((entry) => entry.message).join(' ') });
  }
  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID or data format.' });
  }
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campusloop');
    console.log('Connected to MongoDB');
    app.listen(PORT, '0.0.0.0', () => console.log(`CampusLoop running on port ${PORT}`));
  } catch (error) {
    console.error('Unable to connect to MongoDB:', error.message);
    process.exit(1);
  }
}

start();
