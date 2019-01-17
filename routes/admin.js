
/*jshint esversion: 6 */

const express = require('express'),
  router = express.Router(),
  chain_position = require('../controllers/chain_position.js');

router.get('/', plotChain);

module.exports = router;
// Render an overview of what chains are being filled up
function plotChain(req, res){
  const studyName = req.query.studyName || 'none';
  chain_position.collectData(studyName, null)
  .then(data => res.render('chainPlot.ejs', {chainData: JSON.stringify(data),
                                             test: 'false'}));

}
