import express from 'express';
import * as wishlistController from '../controllers/wishlistController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
// The authentication middleware should already be set up to handle auth errors
router.use(authenticate);

// Define all routes
router.get('/auth-check', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Authentication successful',
    user: {
      id: req.user.id,
      role: req.user.role
    }
  });
});

// Wishlist routes
router.get('/', wishlistController.getCustomerWishlists);
router.get('/:id', wishlistController.getWishlistById);
router.post('/', wishlistController.createWishlist);
router.put('/:id', wishlistController.updateWishlist);
router.delete('/:id', wishlistController.deleteWishlist);

// Wishlist item routes
router.post('/:id/items', wishlistController.addProductToWishlist);
router.delete('/:id/items/:itemId', wishlistController.removeProductFromWishlist);
router.put('/:id/items/:itemId', wishlistController.updateWishlistItemNotes);
router.post('/:id/items/:itemId/move', wishlistController.moveProductToAnotherWishlist);

export default router;