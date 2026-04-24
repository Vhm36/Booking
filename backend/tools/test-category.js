const serviceModel = require('./src/models/serviceModel');

serviceModel.createCategory({category_name: 'Test Category'}, (err, result) => { 
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Success:', result);
  }
});
