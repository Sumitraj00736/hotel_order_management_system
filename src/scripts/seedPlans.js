require('dotenv').config({ path: __dirname + '/../../.env' });
const mongoose = require('mongoose');
const Plan = require('../models/platform/Plan');
const Subscription = require('../models/platform/Subscription');
const { PLAN_PRESETS } = require('../controllers/platform/planPresets');

async function seedPlans() {
  try {
    console.log('Connecting to MongoDB...');
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/hoteloms';
    await mongoose.connect(uri);
    console.log('Connected.');

    const plansToInsert = Object.values(PLAN_PRESETS).map(preset => ({
      name: preset.planName,
      price: preset.pricePerYear,
      billing_cycle: 'yearly',
      description: `The ${preset.planName} tier for restaurants.`,
      features: preset.features,
      trial_days: preset.tier === 'free' ? 14 : 0,
      is_active: true
    }));

    for (const planData of plansToInsert) {
      const existingPlan = await Plan.findOne({ name: planData.name });
      let planId;
      if (!existingPlan) {
        const newPlan = await Plan.create(planData);
        planId = newPlan._id;
        console.log(`Created plan: ${planData.name}`);
      } else {
        planId = existingPlan._id;
        console.log(`Plan already exists: ${planData.name}`);
      }

      // Link existing subscriptions to this plan
      const result = await Subscription.updateMany(
        { planName: planData.name, planId: { $exists: false } },
        { $set: { planId } }
      );
      console.log(`Updated ${result.modifiedCount} subscriptions for ${planData.name}.`);
    }

    console.log('Seeding complete.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedPlans();
