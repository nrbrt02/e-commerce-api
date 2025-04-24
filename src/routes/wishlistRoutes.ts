import express from 'express';
import * as wishlistController from '../controllers/wishlistController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Auth check route
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

// Default wishlist routes
router.get('/default', wishlistController.getDefaultWishlist);
router.post('/default/items', wishlistController.addProductToWishlist);
router.delete('/default/items/:itemId', wishlistController.removeProductFromWishlist);
router.put('/default/items/:itemId', wishlistController.updateWishlistItemNotes);

// Specific wishlist routes
router.get('/', wishlistController.getCustomerWishlists);
router.post('/', wishlistController.createWishlist);
router.get('/:id', wishlistController.getWishlistById);
router.put('/:id', wishlistController.updateWishlist);
router.delete('/:id', wishlistController.deleteWishlist);

// Specific wishlist item routes
router.post('/:id/items', wishlistController.addProductToWishlist);
router.delete('/:id/items/:itemId', wishlistController.removeProductFromWishlist);
router.put('/:id/items/:itemId', wishlistController.updateWishlistItemNotes);
router.post('/:id/items/:itemId/move', wishlistController.moveProductToAnotherWishlist);

// Set default wishlist
router.post('/:id/set-default', wishlistController.setDefaultWishlist);

export default router;