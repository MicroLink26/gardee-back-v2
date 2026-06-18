import { connect } from 'mongoose';
import { User } from './src/models/User';
import { ObjectId } from 'mongodb';

const testId = '6a0b26cd10e235814034ef61';

async function test() {
  try {
    await connect(process.env.MONGO_URL!);
    console.log('✓ Connected to MongoDB');
    
    console.log('\n=== Testing with string ID ===');
    const result1 = await User.findOne({ _id: testId });
    console.log('String ID result:', result1 ? 'Found ✓' : 'Not found ✗');
    
    console.log('\n=== Testing with ObjectId ===');
    try {
      const objId = new ObjectId(testId);
      const result2 = await User.findOne({ _id: objId });
      console.log('ObjectId result:', result2 ? 'Found ✓' : 'Not found ✗');
      if (result2) {
        console.log('User details:');
        console.log(`  _id: ${result2._id}`);
        console.log(`  role: ${result2.role}`);
        console.log(`  is_validated: ${result2.is_validated}`);
        console.log(`  nom: ${result2.nom}`);
      }
    } catch (e: any) {
      console.log('Invalid ObjectId:', e.message);
    }
    
    console.log('\n=== Sample prestataires ===');
    const samples = await User.find({ role: 'prestataire', is_validated: true }).limit(5).select('_id nom role is_validated');
    console.log(`Found ${samples.length} validated prestataires`);
    
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

test();
