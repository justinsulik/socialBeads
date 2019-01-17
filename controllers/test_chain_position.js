/*jshint esversion: 6 */

function findLatest(aggregateData){
  var latest = _.reduce(aggregateData, function(chainAcc, chainData){
    var chainLatest = _.reduce(chainData, function(generationAcc, generationData){
      var chain = +chainData.chain;
      var generation = +generationData.generation;
      if (generation > generationAcc.generation ||
          (generation == generationAcc.generation && generationData.completed == 'completed')){
        generationAcc.generation = generation;
        generationAcc.completed = generationData.completed;
      }
      generationAcc.chain = generationData.chain;
      return generationAcc;
    }, {generation: 0, completed: null, chain: null});
    chainAcc[chainLatest.chain] = chainLatest;
    return chainAcc;
  }, {});
  return latest;
}

function getCandidate(aggregateData, maxChains, maxGenerations){
  var latestSlots = findLatest(aggregateData);
  var candidateChains;
  var candidate;
  if (Object.keys(latestSlots).length < maxChains ){
    // If there are still chains that haven't been started, start one
    candidateChains = _.range(maxChains);
    _.map(latestSlots, function(slotData){
      var index = candidateChains.indexOf(+slotData.chain);
      if (index!=-1){
        candidateChains.splice(index, 1);
      }
    });
    candidate = _.sample(candidateChains);
    return {chain: candidate, generation: 0, branch: 0};

  } else {
    // Choose from among the latest slots
    candidateChains = _.reduce(latestSlots, function(accumulator, chainData){
      if (+chainData.generation < maxGenerations - 1 && chainData.completed == 'completed'){
        accumulator.push(chainData);
      }
      return accumulator;
    }, []);
    if (candidateChains.length>0){
      candidate = _.sample(candidateChains);
      candidate.generation = +candidate.generation + 1;
    } else {
      candidate = null;
    }
    return candidate;

  }
}
