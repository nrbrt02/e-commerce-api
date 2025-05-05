import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import db from '../models';
import logger from '../config/logger';

const { Address, Customer } = db;

interface AddressData {
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
  label?: string;
  customerId: number;
}

/**
 * Get all addresses for the current customer
 */
export const getCustomerAddresses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.user.id;

    const addresses = await Address.findAll({
      where: { customerId },
      order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: addresses.length,
      data: addresses
    });
  } catch (error) {
    logger.error('Error getting addresses:', error);
    next(new AppError('Failed to get addresses', 500));
  }
};

/**
 * Get a single address by ID
 */
export const getAddressById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const customerId = req.user.id;

    const address = await Address.findOne({
      where: { id, customerId }
    });

    if (!address) {
      return next(new AppError('Address not found', 404));
    }

    res.status(200).json({
      success: true,
      data: address
    });
  } catch (error) {
    logger.error('Error getting address:', error);
    next(new AppError('Failed to get address', 500));
  }
};

/**
 * Create a new address
 */
export const createAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.user.id;
    const addressData: AddressData = {
      ...req.body,
      customerId
    };

    // Check if this is the first address or if it's marked as default
    const addressCount = await Address.count({ where: { customerId } });
    
    if (addressCount === 0 || addressData.isDefault) {
      addressData.isDefault = true;
      
      // If setting this as default, unset any existing default
      if (addressCount > 0) {
        await Address.update(
          { isDefault: false },
          { where: { customerId, isDefault: true } }
        );
      }
    }

    const address = await Address.create(addressData);

    res.status(201).json({
      success: true,
      data: address
    });
  } catch (error) {
    logger.error('Error creating address:', error);
    next(new AppError('Failed to create address', 500));
  }
};

/**
 * Update an address
 */
export const updateAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const customerId = req.user.id;
    const addressData = req.body;

    // Check if address exists and belongs to this customer
    const address = await Address.findOne({
      where: { id, customerId }
    });

    if (!address) {
      return next(new AppError('Address not found', 404));
    }

    // If setting this as default, unset any existing default
    if (addressData.isDefault) {
      await Address.update(
        { isDefault: false },
        { where: { customerId, isDefault: true } }
      );
    }

    // Update the address
    await address.update(addressData);

    // Get the updated address
    const updatedAddress = await Address.findByPk(id);

    res.status(200).json({
      success: true,
      data: updatedAddress
    });
  } catch (error) {
    logger.error('Error updating address:', error);
    next(new AppError('Failed to update address', 500));
  }
};

/**
 * Delete an address
 */
export const deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const customerId = req.user.id;

    // Check if address exists and belongs to this customer
    const address = await Address.findOne({
      where: { id, customerId }
    });

    if (!address) {
      return next(new AppError('Address not found', 404));
    }

    // Check if this is the default address
    const isDefault = address.isDefault;

    // Delete the address
    await address.destroy();

    // If the deleted address was the default, set a new default if any addresses remain
    if (isDefault) {
      const remainingAddresses = await Address.findAll({
        where: { customerId },
        order: [['createdAt', 'DESC']],
        limit: 1
      });

      if (remainingAddresses.length > 0) {
        await remainingAddresses[0].update({ isDefault: true });
      }
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    logger.error('Error deleting address:', error);
    next(new AppError('Failed to delete address', 500));
  }
};

/**
 * Set an address as default
 */
export const setAddressAsDefault = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const customerId = req.user.id;

    // Check if address exists and belongs to this customer
    const address = await Address.findOne({
      where: { id, customerId }
    });

    if (!address) {
      return next(new AppError('Address not found', 404));
    }

    // Remove default status from all addresses
    await Address.update(
      { isDefault: false },
      { where: { customerId } }
    );

    // Set this address as default
    await address.update({ isDefault: true });

    // Get the updated address
    const updatedAddress = await Address.findByPk(id);

    res.status(200).json({
      success: true,
      data: updatedAddress
    });
  } catch (error) {
    logger.error('Error setting default address:', error);
    next(new AppError('Failed to set default address', 500));
  }
};