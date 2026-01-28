import { Router } from 'express';
import db from '../db/connection';
import { UserModel } from '../models/User';
import { validate } from '../middleware/validation';
import { createCampaignSchema } from '../utils/validation';

const router = Router();

// List campaigns with filters
router.get('/', async (req, res) => {
  try {
    const {
      advertiser_id,
      status,
      min_budget,
      max_budget,
      limit = 50,
      offset = 0,
    } = req.query;

    let query = 'SELECT * FROM campaigns WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (advertiser_id) {
      query += ` AND advertiser_id = $${paramCount++}`;
      params.push(parseInt(advertiser_id as string));
    }
    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }
    if (min_budget) {
      query += ` AND budget_ton >= $${paramCount++}`;
      params.push(parseFloat(min_budget as string));
    }
    if (max_budget) {
      query += ` AND budget_ton <= $${paramCount++}`;
      params.push(parseFloat(max_budget as string));
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get campaign details
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create campaign
router.post('/', validate(createCampaignSchema), async (req, res) => {
  try {
    const {
      telegram_id,
      title,
      description,
      budget_ton,
      target_subscribers_min,
      target_subscribers_max,
      target_views_min,
      target_languages,
      preferred_formats,
    } = req.body;

    // Find or create user
    const user = await UserModel.findOrCreate({
      telegram_id,
      username: req.body.username,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
    });

    await UserModel.updateRole(telegram_id, 'advertiser', true);

    const result = await db.query(
      `INSERT INTO campaigns (
        advertiser_id, title, description, budget_ton,
        target_subscribers_min, target_subscribers_max, target_views_min,
        target_languages, preferred_formats, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
      RETURNING *`,
      [
        user.id,
        title,
        description,
        budget_ton ? parseFloat(budget_ton) : null,
        target_subscribers_min ? parseInt(target_subscribers_min) : null,
        target_subscribers_max ? parseInt(target_subscribers_max) : null,
        target_views_min ? parseInt(target_views_min) : null,
        target_languages ? JSON.stringify(target_languages) : null,
        preferred_formats ? JSON.stringify(preferred_formats) : null,
      ]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update campaign
router.put('/:id', async (req, res) => {
  try {
    const {
      title,
      description,
      budget_ton,
      target_subscribers_min,
      target_subscribers_max,
      status,
    } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (title) {
      updates.push(`title = $${paramCount++}`);
      params.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      params.push(description);
    }
    if (budget_ton) {
      updates.push(`budget_ton = $${paramCount++}`);
      params.push(parseFloat(budget_ton));
    }
    if (target_subscribers_min) {
      updates.push(`target_subscribers_min = $${paramCount++}`);
      params.push(parseInt(target_subscribers_min));
    }
    if (target_subscribers_max) {
      updates.push(`target_subscribers_max = $${paramCount++}`);
      params.push(parseInt(target_subscribers_max));
    }
    if (status) {
      updates.push(`status = $${paramCount++}`);
      params.push(status);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(parseInt(req.params.id));

    const query = `UPDATE campaigns SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, params);

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
