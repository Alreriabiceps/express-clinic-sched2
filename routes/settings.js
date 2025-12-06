import express from 'express';
import Settings from '../models/Settings.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get clinic settings (public endpoint for patient booking)
router.get('/clinic', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get clinic settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving clinic settings'
    });
  }
});

// Update clinic settings (admin only)
router.put('/clinic', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update clinic settings'
      });
    }

    const settings = await Settings.updateSettings(req.body);
    
    res.json({
      success: true,
      message: 'Clinic settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Update clinic settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating clinic settings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export default router;

