const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config();

/* GET home page. */
router.get('/', (req, res)=>{
  res.redirect("/account/login");
});

router.get('/privacy-policy', (req, res)=>{
  res.send("Privacy Policy Coming Soon");
});

router.get('/terms', (req, res)=>{
  res.send("Terms and Conditions Coming Soon");
});

module.exports = router;