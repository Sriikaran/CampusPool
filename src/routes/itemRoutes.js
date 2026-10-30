const express = require('express');
const mongoose = require('mongoose');
const Item = require('../models/Item');
const ExchangeRequest = require('../models/ExchangeRequest');

const router = express.Router();

// GET /api/items?search=&category=&type=
router.get('/', async (req, res, next) => {
  try {
    const { search, category, type } = req.query;
    const filter = { status: 'Available' };

    if (category && category !== 'All') filter.category = category;
    if (type && type !== 'All') filter.listingType = type;
    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const items = await Item.find(filter).select('-ownerPhone').sort({ createdAt: -1 }).limit(100);
    res.json({ count: items.length, items });
  } catch (error) {
    next(error);
  }
});

// GET /api/items/:id
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid item ID.' });
    }
    const item = await Item.findById(req.params.id).select('-ownerPhone');
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    res.json({ item });
  } catch (error) {
    next(error);
  }
});

// POST /api/items
router.post('/', async (req, res, next) => {
  try {
    const { title, description, category, listingType, condition, price, ownerName, ownerEmail, ownerPhone } = req.body;
    const required = { title, description, category, listingType, ownerName, ownerEmail, ownerPhone };
    const missing = Object.entries(required).filter(([, value]) => !String(value || '').trim()).map(([key]) => key);
    if (missing.length) {
      return res.status(400).json({ message: `Please provide: ${missing.join(', ')}.` });
    }
    if (!/^\S+@\S+\.\S+$/.test(ownerEmail)) {
      return res.status(400).json({ message: 'Please enter a valid owner email.' });
    }
    if (String(ownerPhone).trim().length < 7) {
      return res.status(400).json({ message: 'Please provide a valid owner phone number.' });
    }
    if (price !== undefined && (Number.isNaN(Number(price)) || Number(price) < 0)) {
      return res.status(400).json({ message: 'Price must be zero or greater.' });
    }

    const item = await Item.create({
      title, description, category, listingType, condition,
      price: price === '' || price === undefined ? 0 : Number(price),
      ownerName, ownerEmail, ownerPhone: ownerPhone.trim()
    });
    res.status(201).json({ message: 'Your item has been listed.', item });
  } catch (error) {
    next(error);
  }
});

// PUT /api/items/:id
router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid item ID.' });
    }
    const { title, description, category, listingType, condition, price, ownerName, ownerEmail, ownerPhone, status } = req.body;

    if (ownerEmail && !/^\S+@\S+\.\S+$/.test(ownerEmail)) {
      return res.status(400).json({ message: 'Please enter a valid owner email.' });
    }
    if (ownerPhone && String(ownerPhone).trim().length < 7) {
      return res.status(400).json({ message: 'Please provide a valid owner phone number.' });
    }
    if (price !== undefined && (Number.isNaN(Number(price)) || Number(price) < 0)) {
      return res.status(400).json({ message: 'Price must be zero or greater.' });
    }

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (category !== undefined) updates.category = category;
    if (listingType !== undefined) updates.listingType = listingType;
    if (condition !== undefined) updates.condition = condition;
    if (price !== undefined) updates.price = Number(price);
    if (ownerName !== undefined) updates.ownerName = ownerName.trim();
    if (ownerEmail !== undefined) updates.ownerEmail = ownerEmail.trim().toLowerCase();
    if (ownerPhone !== undefined) updates.ownerPhone = ownerPhone.trim();
    if (status !== undefined) updates.status = status;

    const item = await Item.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: 'Item not found.' });

    res.json({ message: 'Item updated successfully.', item });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/items/:id
router.patch('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid item ID.' });
    }
    const { title, description, category, listingType, condition, price, ownerName, ownerEmail, ownerPhone, status } = req.body;

    if (ownerEmail && !/^\S+@\S+\.\S+$/.test(ownerEmail)) {
      return res.status(400).json({ message: 'Please enter a valid owner email.' });
    }
    if (ownerPhone && String(ownerPhone).trim().length < 7) {
      return res.status(400).json({ message: 'Please provide a valid owner phone number.' });
    }
    if (price !== undefined && (Number.isNaN(Number(price)) || Number(price) < 0)) {
      return res.status(400).json({ message: 'Price must be zero or greater.' });
    }

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (category !== undefined) updates.category = category;
    if (listingType !== undefined) updates.listingType = listingType;
    if (condition !== undefined) updates.condition = condition;
    if (price !== undefined) updates.price = Number(price);
    if (ownerName !== undefined) updates.ownerName = ownerName.trim();
    if (ownerEmail !== undefined) updates.ownerEmail = ownerEmail.trim().toLowerCase();
    if (ownerPhone !== undefined) updates.ownerPhone = ownerPhone.trim();
    if (status !== undefined) updates.status = status;

    const item = await Item.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: 'Item not found.' });

    res.json({ message: 'Item updated successfully.', item });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/items/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid item ID.' });
    }
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found.' });

    await ExchangeRequest.deleteMany({ item: req.params.id });

    res.json({ message: 'Item deleted successfully.', id: req.params.id });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
