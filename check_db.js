require('dotenv').config();
const mongoose = require('mongoose');
const Organization = require('./src/models/core/Organization');
const Branch = require('./src/models/core/Branch');
const User = require('./src/models/users/User');
const UserBranchRole = require('./src/models/users/UserBranchRole');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');
  
  const orgs = await Organization.find();
  console.log('Organizations:', orgs.length);
  
  const branches = await Branch.find();
  console.log('Branches:', branches.length);
  
  const users = await User.find();
  console.log('Users:', users.length);
  
  const memberships = await UserBranchRole.find();
  console.log('Memberships:', memberships.length);
  
  if (orgs.length > 0) {
    console.log('Sample Org:', orgs[0]);
  }
  
  process.exit(0);
}

check();
