import express from 'express';
import * as wishlistController from '../controllers/wishlistController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Get public wishlist
router.get('/:id', wishlistController.getWishlistById);

// Protected routes
router.use(authenticate);

// Wishlist routes
router.get('/', wishlistController.getCustomerWishlists);
router.post('/', wishlistController.createWishlist);
router.put('/:id', wishlistController.updateWishlist);
router.delete('/:id', wishlistController.deleteWishlist);

// Wishlist item routes
router.post('/:id/items', wishlistController.addProductToWishlist);
router.delete('/:id/items/:itemId', wishlistController.removeProductFromWishlist);
router.put('/:id/items/:itemId', wishlistController.updateWishlistItemNotes);
router.post('/:id/items/:itemId/move', wishlistController.moveProductToAnotherWishlist);

export default router;