const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config();

/* GET home page. */
router.get('/', (req, res)=>{
  res.redirect("/admin/login");
});

module.exports = router;