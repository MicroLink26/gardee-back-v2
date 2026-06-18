import { connect } from 'mongoose';
import { Prestataire } from './src/models/Prestataire';

const testUserId = '6a0b26cd10e235814034ef61';

async function test() {
  try {
    await connect(process.env.MONGO_URL!);
    
    const prestDoc = await Prestataire.findOne({ userId: testUserId });
    if (prestDoc) {
      console.log('✓ Prestataire found!');
      console.log(`  _id: ${prestDoc._id}`);
      console.log(`  userId: ${prestDoc.userId}`);
      console.log(`  is_validated: ${prestDoc.is_validated}`);
    } else {
      console.log('✗ No Prestataire found for userId:', testUserId);
      console.log('\nAll prestataires in DB:');
      const prest = await Prestataire.find().select('userId is_validated').limit(10);
      prest.forEach(p => {
        console.log(`  userId: ${p.userId}, validated: ${p.is_validated}`);
      });
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

test();
