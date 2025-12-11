import mongoose from 'mongoose';

console.log('Connecting to MongoDB...');
mongoose.connect('mongodb://localhost:27017/vm-clinic')
  .then(() => {
    console.log('Connected!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
