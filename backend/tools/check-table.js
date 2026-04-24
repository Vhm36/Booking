const db = require('./src/config/db');

db.query('SHOW CREATE TABLE service_category', (err, result) => { 
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Table structure:', result[0]['Create Table']);
  }
  db.end();
});
