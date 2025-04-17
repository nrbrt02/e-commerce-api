import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';
import config from '../config/env';
import { UploadedFile } from 'express-fileupload';
import models from '../models';

const { ProductImage, User, Customer, Review } = models;

// Allowed file types
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Base upload directory
const uploadDir = path.join(process.cwd(), 'uploads');

// Make sure upload directories exist
const ensureDirectoriesExist = () => {
  const dirs = [
    uploadDir,
    path.join(uploadDir, 'products'),
    path.join(uploadDir, 'avatars'),
    path.join(uploadDir, 'reviews'),
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureDirectoriesExist();

/**
 * Upload product images
 * @route POST /api/upload/product/:productId
 * @access Private (Admin, Supplier)
 */
export const uploadProductImages = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  
  if (!req.files || Object.keys(req.files).length === 0) {
    throw new AppError('No files were uploaded', 400);
  }
  
  // Get uploaded files with proper typing
  const filesData = req.files.images;
  const files: UploadedFile[] = Array.isArray(filesData) ? filesData : [filesData];
  
  // Validate file types
  files.forEach(file => {
    if (!allowedImageTypes.includes(file.mimetype)) {
      throw new AppError(`Invalid file type: ${file.name}. Allowed types: ${allowedImageTypes.join(', ')}`, 400);
    }
  });
  
  // Process each file
  // Add type annotation for uploadedImages array
  const uploadedImages: any[] = [];
  
  for (const file of files) {
    const fileName = `${uuidv4()}${path.extname(file.name)}`;
    const filePath = `/products/${fileName}`;
    const fullPath = path.join(uploadDir, 'products', fileName);
    
    // Save file
    await file.mv(fullPath);
    
    // Create product image record with explicit type annotation
    const image = await ProductImage.create({
      productId: parseInt(productId),
      url: filePath,
      alt: file.name.split('.')[0] || '',
      order: uploadedImages.length,
      isDefault: uploadedImages.length === 0, // First image is default
    });
    
    uploadedImages.push(image);
  }
  
  res.status(201).json({
    status: 'success',
    results: uploadedImages.length,
    data: {
      images: uploadedImages,
    },
  });
});

/**
 * Upload avatar
 * @route POST /api/upload/avatar
 * @access Private
 */
export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.files || !req.files.avatar) {
    throw new AppError('No avatar file uploaded', 400);
  }
  
  const avatarFile = req.files.avatar as UploadedFile;
  
  // Validate file type
  if (!allowedImageTypes.includes(avatarFile.mimetype)) {
    throw new AppError(`Invalid file type. Allowed types: ${allowedImageTypes.join(', ')}`, 400);
  }
  
  // Generate unique filename
  const fileName = `${uuidv4()}${path.extname(avatarFile.name)}`;
  const filePath = `/avatars/${fileName}`;
  const fullPath = path.join(uploadDir, 'avatars', fileName);
  
  // Save file
  await avatarFile.mv(fullPath);
  
  // Update user/customer avatar
  const user = req.user!;
  const isCustomer = 'addresses' in user;
  
  if (isCustomer) {
    await Customer.update(
      { avatar: filePath },
      { where: { id: user.id } }
    );
  } else {
    await User.update(
      { avatar: filePath },
      { where: { id: user.id } }
    );
  }
  
  // Return updated avatar URL
  res.status(200).json({
    status: 'success',
    data: {
      avatar: filePath,
    },
  });
});

/**
 * Upload review images
 * @route POST /api/upload/review/:reviewId
 * @access Private (Customer)
 */
export const uploadReviewImages = asyncHandler(async (req: Request, res: Response) => {
  const { reviewId } = req.params;
  
  if (!req.files || Object.keys(req.files).length === 0) {
    throw new AppError('No files were uploaded', 400);
  }
  
  // Get uploaded files with proper typing
  const filesData = req.files.images;
  const files: UploadedFile[] = Array.isArray(filesData) ? filesData : [filesData];
  
  // Validate file types
  files.forEach(file => {
    if (!allowedImageTypes.includes(file.mimetype)) {
      throw new AppError(`Invalid file type: ${file.name}. Allowed types: ${allowedImageTypes.join(', ')}`, 400);
    }
  });
  
  // Find review
  const review = await Review.findByPk(reviewId);
  
  if (!review) {
    throw new AppError('Review not found', 404);
  }
  
  // Ensure customer owns this review
  if (review.customerId !== req.user!.id) {
    throw new AppError('You do not have permission to upload images to this review', 403);
  }
  
  // Process each file
  const uploadedImages: string[] = [];
  
  for (const file of files) {
    const fileName = `${uuidv4()}-${review.id}${path.extname(file.name)}`;
    const filePath = `/reviews/${fileName}`;
    const fullPath = path.join(uploadDir, 'reviews', fileName);
    
    // Save file
    await file.mv(fullPath);
    uploadedImages.push(filePath);
  }
  
  // Update review with new images
  const media = [...(review.media || []), ...uploadedImages];
  await review.update({ media });
  
  res.status(201).json({
    status: 'success',
    results: uploadedImages.length,
    data: {
      images: uploadedImages,
      review: {
        id: review.id,
        media
      }
    },
  });
});

/**
 * Delete uploaded file
 * @route DELETE /api/upload/file
 * @access Private
 */
export const deleteUploadedFile = asyncHandler(async (req: Request, res: Response) => {
  const { filepath } = req.body;
  
  if (!filepath) {
    throw new AppError('File path is required', 400);
  }
  
  // Security check to make sure we're only deleting from uploads directory
  const normalizedPath = path.normalize(filepath);
  
  if (normalizedPath.includes('..') || !normalizedPath.startsWith('/')) {
    throw new AppError('Invalid file path', 400);
  }
  
  const fullPath = path.join(uploadDir, normalizedPath.replace(/^\//, ''));
  
  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    throw new AppError('File not found', 404);
  }
  
  // Delete file
  fs.unlinkSync(fullPath);
  
  res.status(200).json({
    status: 'success',
    message: 'File deleted successfully',
  });
});