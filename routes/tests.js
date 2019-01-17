/*jshint esversion: 6 */

const express = require('express'),
  router = express.Router(),
  test_chain_position = require('../controllers/test_chain_position.js'),
  chain_position = require('../controllers/chain_position.js'),
  _ = require('lodash');

router.get('/', test);

module.exports = router;


function randomData(maxChains, maxGenerations){
  /*Select a random generation to be the focal generation
   *Fill all previous generations with 'complete'
   *Fill a random subset of the focal generation with completes and another subset with incompletes
   */
   var focalGeneration = Math.round(Math.random()*(maxGenerations-1));
   var data = [];
   var completedCount;
   var incompleteCount;
   _.range(focalGeneration+1).forEach(function(generation){
     if (generation == focalGeneration){
       completedCount = Math.floor(Math.random()*maxChains);
       incompleteCount = Math.floor(Math.random()*(maxChains-completedCount));
     } else {
       completedCount = maxChains;
       incompleteCount = 0;
     }
     var chainsShuffled = _.shuffle(_.range(maxChains));
     _.range(completedCount).forEach(function(d){
       data.push({generation: generation,
                  completed: 'completed',
                  chain: chainsShuffled[d]});
     });
     _.range(completedCount, completedCount+incompleteCount).forEach(function(d){
       data.push({generation: generation,
                  completed: 'incomplete',
                  chain: chainsShuffled[d]});
     });
     return(data);
   });
   return data;
}

// generate new candiates until all slots full

// test any duplicates

function test(req, res){
  // var data = randomData(req.app.locals.maxChains, 0);
  var data = randomData(req.app.locals.maxChains, req.app.locals.maxGenerations);
  var aggregateData = chain_position.aggregateMap(data);
  // var aggregateData = {};
  res.render('chainPlot.ejs', {chainData: JSON.stringify(aggregateData),
                               test: 'true'});
}
