const Plan = require('../../models/platform/Plan');
const Subscription = require('../../models/platform/Subscription');

// List Plans (supports ?status=active|all)
const listPlans = async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const filter = { is_deleted: false };
    if (status === 'active') filter.is_active = true;

    // We can also aggregate subscribers per plan
    const plans = await Plan.find(filter).sort({ price: 1 }).lean();
    
    // Aggregate subscriptions to get subscriber count
    const subscriberCounts = await Subscription.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$planId', count: { $sum: 1 } } }
    ]);
    const countMap = new Map(subscriberCounts.map(item => [String(item._id), item.count]));

    const response = plans.map(plan => ({
      ...plan,
      id: String(plan._id),
      subscribers: countMap.get(String(plan._id)) || 0
    }));

    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch plans', error: error.message });
  }
};

// Get single Plan
const getPlan = async (req, res) => {
  try {
    const plan = await Plan.findOne({ _id: req.params.id, is_deleted: false }).lean();
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch plan', error: error.message });
  }
};

// Create new Plan
const createPlan = async (req, res) => {
  try {
    const { name, price, billing_cycle, description, features, is_active, trial_days } = req.body;
    
    if (!name || price === undefined || !billing_cycle) {
      return res.status(400).json({ message: 'Name, price, and billing cycle are required' });
    }

    const newPlan = await Plan.create({
      name,
      price: Number(price),
      billing_cycle,
      description,
      features: features || {},
      is_active: is_active !== undefined ? is_active : true,
      trial_days: Number(trial_days) || 0,
      created_by: req.user._id
    });

    res.status(201).json(newPlan);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create plan', error: error.message });
  }
};

// Update Plan (PATCH)
const updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findOne({ _id: req.params.id, is_deleted: false });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    // Store old state for audit
    const oldState = plan.toObject();

    const allowedUpdates = ['name', 'price', 'billing_cycle', 'description', 'features', 'is_active', 'trial_days'];
    let changed = false;

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        plan[field] = req.body[field];
        changed = true;
      }
    });

    if (changed) {
      await plan.save();
    }

    // Attach to res.locals so AuditLogger can capture it
    res.locals.old_value = oldState;

    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update plan', error: error.message });
  }
};

// Soft Delete Plan
const deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findOne({ _id: req.params.id, is_deleted: false });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    // Block if there are active subscribers
    const activeSubscribers = await Subscription.countDocuments({ planId: plan._id, status: 'active' });
    if (activeSubscribers > 0) {
      return res.status(400).json({ 
        code: 'ERR_PLAN_HAS_SUBSCRIBERS', 
        message: `Cannot delete plan with ${activeSubscribers} active subscribers. Please migrate them first.` 
      });
    }

    plan.is_deleted = true;
    plan.is_active = false;
    await plan.save();

    res.json({ message: 'Plan deleted successfully', id: plan._id });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete plan', error: error.message });
  }
};

module.exports = {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan
};
