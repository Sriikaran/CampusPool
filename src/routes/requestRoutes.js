const express = require('express');
const mongoose = require('mongoose');
const Item = require('../models/Item');
const ExchangeRequest = require('../models/ExchangeRequest');

const router = express.Router();

// Helper to sanitize requester contact info when request is not accepted
function sanitizeRequesterContact(request) {
  const obj = request.toObject ? request.toObject() : { ...request };
  if (!['Accepted', 'Completed'].includes(obj.status)) {
    obj.requesterEmail = 'Protected until accepted';
    obj.requesterPhone = null;
  }
  return obj;
}

// Helper to sanitize owner contact info when request is not accepted
function sanitizeOwnerContact(request) {
  const obj = request.toObject ? request.toObject() : { ...request };
  if (!['Accepted', 'Completed'].includes(obj.status)) {
    if (obj.item) {
      delete obj.item.ownerPhone;
    }
  }
  return obj;
}

// POST /api/requests - Send a request for an item
router.post('/', async (req, res, next) => {
  try {
    const { itemId, requesterName, requesterEmail, requesterPhone, message } = req.body;
    if (!itemId || !requesterName?.trim() || !requesterEmail?.trim() || !requesterPhone?.trim()) {
      return res.status(400).json({ message: 'Item ID, your name, college email, and phone number are required.' });
    }
    if (!mongoose.isValidObjectId(itemId)) {
      return res.status(400).json({ message: 'Invalid item ID.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(requesterEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }
    if (String(requesterPhone).trim().length < 7) {
      return res.status(400).json({ message: 'Please provide a valid phone number.' });
    }

    const item = await Item.findById(itemId);
    if (!item || item.status !== 'Available') {
      return res.status(400).json({ message: 'This item is currently not available for requests.' });
    }
    if (item.ownerEmail === requesterEmail.trim().toLowerCase()) {
      return res.status(400).json({ message: 'You cannot request your own listing.' });
    }

    const existing = await ExchangeRequest.findOne({
      item: itemId,
      requesterEmail: requesterEmail.trim().toLowerCase(),
      status: 'Pending'
    });
    if (existing) {
      return res.status(409).json({ message: 'You already have a pending request for this item.' });
    }

    const request = await ExchangeRequest.create({
      item: itemId,
      requesterName: requesterName.trim(),
      requesterEmail: requesterEmail.trim().toLowerCase(),
      requesterPhone: requesterPhone.trim(),
      message: message ? message.trim() : ''
    });

    res.status(201).json({ message: 'Request sent to the item owner.', request });
  } catch (error) {
    next(error);
  }
});

// GET /api/requests/received?email=owner@example.com - Requests received by listing owner
router.get('/received', async (req, res, next) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: 'Provide an email query parameter for the listing owner.' });
    }

    const myItems = await Item.find({ ownerEmail: email }).sort({ createdAt: -1 });
    const itemIds = myItems.map((item) => item._id);

    const rawRequests = await ExchangeRequest.find({ item: { $in: itemIds } })
      .populate('item', 'title category listingType price condition status ownerName ownerEmail ownerPhone')
      .sort({ createdAt: -1 });

    const requests = rawRequests.map(sanitizeRequesterContact);

    // Group incoming requests by item
    const grouped = myItems.map((item) => {
      const itemRequests = requests.filter(
        (r) => r.item && r.item._id.toString() === item._id.toString()
      );
      return {
        item: {
          _id: item._id,
          title: item.title,
          category: item.category,
          listingType: item.listingType,
          price: item.price,
          status: item.status
        },
        requests: itemRequests
      };
    }).filter((group) => group.requests.length > 0);

    res.json({ count: requests.length, requests, grouped });
  } catch (error) {
    next(error);
  }
});

// GET /api/requests?email=student@example.com - Requests submitted by student ("My Requests")
router.get('/', async (req, res, next) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    const itemId = req.query.itemId;
    const filter = {};
    if (email) filter.requesterEmail = email;
    if (itemId && mongoose.isValidObjectId(itemId)) filter.item = itemId;

    const rawRequests = await ExchangeRequest.find(filter)
      .populate('item', 'title category listingType price condition status ownerName ownerEmail ownerPhone')
      .sort({ createdAt: -1 });

    const requests = rawRequests.map(sanitizeOwnerContact);

    res.json({ count: requests.length, requests });
  } catch (error) {
    next(error);
  }
});

// GET /api/requests/:id - View single request
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID.' });
    }
    const raw = await ExchangeRequest.findById(req.params.id)
      .populate('item', 'title category listingType price condition status ownerName ownerEmail ownerPhone');
    if (!raw) return res.status(404).json({ message: 'Request not found.' });

    let request = sanitizeRequesterContact(raw);
    request = sanitizeOwnerContact(request);

    res.json({ request });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/requests/:id/accept - Owner accepts request
router.patch('/:id/accept', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID.' });
    }

    const request = await ExchangeRequest.findById(req.params.id).populate('item');
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    if (request.status !== 'Pending') {
      return res.status(400).json({ message: `Cannot accept a request with status '${request.status}'.` });
    }

    const ownerEmail = String(req.body.ownerEmail || '').trim().toLowerCase();
    if (ownerEmail && request.item.ownerEmail !== ownerEmail) {
      return res.status(403).json({ message: 'Only the item owner can accept this request.' });
    }

    // Atomic update on Item to prevent concurrent acceptance
    const item = await Item.findOneAndUpdate(
      { _id: request.item._id, status: 'Available' },
      { status: 'Reserved' },
      { new: true }
    );

    if (!item) {
      return res.status(409).json({ message: 'This item is no longer available or is already reserved.' });
    }

    request.status = 'Accepted';
    await request.save();

    const populated = await ExchangeRequest.findById(request._id)
      .populate('item', 'title category listingType price condition status ownerName ownerEmail ownerPhone');

    res.json({
      message: 'Request accepted! Contact details are now exchanged.',
      request: populated
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/requests/:id/decline - Owner declines request
router.patch('/:id/decline', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID.' });
    }

    const request = await ExchangeRequest.findById(req.params.id).populate('item');
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    const ownerEmail = String(req.body.ownerEmail || '').trim().toLowerCase();
    if (ownerEmail && request.item.ownerEmail !== ownerEmail) {
      return res.status(403).json({ message: 'Only the item owner can decline this request.' });
    }

    const previousStatus = request.status;
    request.status = 'Declined';
    await request.save();

    // If previously accepted, return item to Available if no other accepted request exists
    if (previousStatus === 'Accepted') {
      const otherAccepted = await ExchangeRequest.findOne({ item: request.item._id, status: 'Accepted' });
      if (!otherAccepted) {
        await Item.findByIdAndUpdate(request.item._id, { status: 'Available' });
      }
    }

    res.json({ message: 'Request declined.', request: sanitizeRequesterContact(request) });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/requests/:id/complete - Owner marks exchange as completed
router.patch('/:id/complete', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID.' });
    }

    const request = await ExchangeRequest.findById(req.params.id).populate('item');
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    if (request.status !== 'Accepted') {
      return res.status(400).json({ message: 'Only accepted requests can be marked as completed.' });
    }

    const ownerEmail = String(req.body.ownerEmail || '').trim().toLowerCase();
    if (ownerEmail && request.item.ownerEmail !== ownerEmail) {
      return res.status(403).json({ message: 'Only the item owner can complete this request.' });
    }

    request.status = 'Completed';
    await request.save();

    // Close the listing
    await Item.findByIdAndUpdate(request.item._id, { status: 'Completed' });

    const populated = await ExchangeRequest.findById(request._id)
      .populate('item', 'title category listingType price condition status ownerName ownerEmail ownerPhone');

    res.json({ message: 'Exchange completed successfully. Listing closed.', request: populated });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/requests/:id/return - Owner marks borrowed item as returned
router.patch('/:id/return', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID.' });
    }

    const request = await ExchangeRequest.findById(req.params.id).populate('item');
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    if (!['Accepted', 'Completed'].includes(request.status)) {
      return res.status(400).json({ message: 'Request must be accepted or completed to mark as returned.' });
    }

    const ownerEmail = String(req.body.ownerEmail || '').trim().toLowerCase();
    if (ownerEmail && request.item.ownerEmail !== ownerEmail) {
      return res.status(403).json({ message: 'Only the item owner can mark this item as returned.' });
    }

    request.status = 'Returned';
    await request.save();

    // For borrow items, make item Available again
    await Item.findByIdAndUpdate(request.item._id, { status: 'Available' });

    const populated = await ExchangeRequest.findById(request._id)
      .populate('item', 'title category listingType price condition status ownerName ownerEmail ownerPhone');

    res.json({ message: 'Item marked as returned and is now available again for students.', request: populated });
  } catch (error) {
    next(error);
  }
});

// Generic PATCH /api/requests/:id & PUT /api/requests/:id for backwards compatibility
router.patch('/:id', async (req, res, next) => {
  const { status, action } = req.body;
  if (status === 'Accepted' || action === 'accept') {
    return router.handle({ ...req, url: `/${req.params.id}/accept` }, res, next);
  }
  if (status === 'Declined' || action === 'decline') {
    return router.handle({ ...req, url: `/${req.params.id}/decline` }, res, next);
  }
  if (status === 'Completed' || action === 'complete') {
    return router.handle({ ...req, url: `/${req.params.id}/complete` }, res, next);
  }
  if (status === 'Returned' || action === 'return') {
    return router.handle({ ...req, url: `/${req.params.id}/return` }, res, next);
  }

  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID.' });
    }
    const updates = {};
    if (req.body.message !== undefined) updates.message = req.body.message;
    const request = await ExchangeRequest.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    res.json({ message: 'Request updated.', request });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', (req, res, next) => router.handle({ ...req, method: 'PATCH' }, res, next));

// DELETE /api/requests/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID.' });
    }
    const request = await ExchangeRequest.findByIdAndDelete(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    res.json({ message: 'Request deleted successfully.', id: req.params.id });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
