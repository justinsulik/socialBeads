/*jshint esversion: 6 */

const express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose'),
    _ = require('lodash'),
    moment = require('moment'),
    Chain_position = require('./../models/chain_position');

function aggregateMap(items){
    // Return an oject with extant chains as keys. The values are further objects with generations as keys
    // Each generation is marked 'completed' if there is one completed entry, and the highest extant branch number is recorded
    console.log('    Aggregating chain data...');
    var aggregateData = {};
    items.forEach((entry) => {
        (entry.chain in aggregateData) || (aggregateData[entry.chain]={});
        ([entry.generation] in aggregateData[entry.chain]) || (aggregateData[entry.chain][entry.generation] = {completed: 'incomplete', branch: 0});
        if (entry.completed == 'completed') {
          aggregateData[entry.chain][entry.generation].completed = 'completed';
        }
        if (entry.branch > aggregateData[entry.chain][entry.generation].branch) {
          aggregateData[entry.chain][entry.generation].branch = entry.branch;
        }
     });
    return aggregateData;
}

function findLatest(aggregateData){
  // Find the latest (i.e. available) slots for each chain
  var latest = _.reduce(aggregateData, function(chainAcc, chainData, chain){
    chain = +chain; //ensure numeric
    var chainLatest = _.reduce(chainData, function(generationAcc, generationData, generation){
      generation = +generation; //ensure numeric
      if (generation > generationAcc.generation ||
          (generation == generationAcc.generation && generationData.completed == 'completed')){
        generationAcc.generation = generation;
        generationAcc.completed = generationData.completed;
      }
      return generationAcc;
    }, {generation: 0, completed: null, chain: chain});
    chainAcc[chainLatest.chain] = chainLatest;
    return chainAcc;
  }, {});
  return latest;
}

exports.aggregateMap = aggregateMap;

exports.update = function (newPosition, studyName, trialId) {
  // After identifying a candidate open slot, mark that it is temporarily being used
  var stage = 'Saving new slot';
  newPosition.studyName = studyName;

  return new Promise((resolve, reject) => {
    console.log(stage);

      Chain_position.create(newPosition, (err, result) => {
        if (err){
          err.name = 'Failed to update position';
          err.trialId = trialId;
          err.stage = stage;
          err.data = newPosition;
          reject(err);
        }
        console.log('    generation', result.generation, 'chain', result.chain);
        resolve(newPosition);
      });
  });
};

exports.complete = function(data, studyName) {
  // After the trial is completed, mark that the slot has been completed
  var stage = 'Marking slot complete';
  return new Promise((resolve, reject) => {
    console.log(stage);
    console.log('   chain', data.chain, 'generation', data.generation, ' branch', data.branch);
    Chain_position.update(
      { chain: data.chain,
        generation: data.generation,
        branch: data.branch,
        studyName: studyName},
      { $set:
        {completed: 'completed'}},
      (err, result) => {
        if (err) {
          console.log('    Error: ', err);
          err.name = 'Failed to mark slot complete';
          err.trialId = data.trialId;
          err.stage = stage;
          reject(err);
        } else {
          console.log('    # Records retrieved/modified: ', result.n, '/', result.nModified);
          if ( result.n == 0){
            console.log('    No records found!');
          }
          resolve(data);
        }
      });
  });
};

exports.clear_abandoned = function(data, studyName){
  // If the window is closed, free up the temporarily occupied slot
  var stage = 'Clearing abandoned slot';
  return new Promise((resolve, reject) => {
    console.log(stage);
    console.log('   chain', data.chain, 'generation', data.generation, ' branch', data.branch);
    Chain_position.update(
      {chain: data.chain,
       generation: data.generation,
       branch: data.branch,
       studyName: studyName},
      { $set:
        {completed: 'abandoned'}},
      (err, result)=>{
        if (err) {
          console.log('    Error: ', err);
        }
        console.log('    # Records retrieved/modified: ', result.n, '/', result.nModified);
        if ( result.n == 0){
          console.log('    No records found!');
        }
        resolve(data);
      });
  });
};

exports.clearOld = function (age, trialId) {
  // Clear all slots older than given age
  var stage = 'Clearing all unfinished slots';
  return new Promise((resolve, reject) => {
    console.log(stage);
    var timeDiff = new Date(moment().subtract(age, 'minutes').toISOString());
    Chain_position.update(
      { startedDate: {$lte: timeDiff},
        completed: 'incomplete'},
      { $set:
        {completed: 'defunct'}},
      {multi: true},
      (err, result) => {
        if (err) {
          console.log('    Error: ', err);
          err.name = 'Failed to clear unfinished slots';
          err.trialId = trialId;
          err.stage = stage;
          reject(err);
        } else {
          console.log('    # Records retrieved/modified: ', result.n, '/', result.nModified);
          resolve('resolving with updates');
        }
      });
  });
};

exports.collectData = function(studyName, trialId) {
  // Collect and aggregate data about what chain positions are currently filled
  var stage = 'Retrieving slot data';
  return new Promise((resolve, reject) => {
    console.log(stage);
    var queryList = ['incomplete', 'completed'];
    Chain_position.find(
      {completed: {$in: queryList},
       studyName: studyName},
      (err, items) => {
        if (err) {
          err.stage = stage;
          err.trialId = trialId;
          err.name = 'Error in collecting data';
          reject(err);
        }
        if (items.length > 0){
          console.log('    Chain data retrieved...');
          var aggregateData = aggregateMap(items);
          resolve(aggregateData);
        } else {
          console.log('    Chain data empty...');
          resolve ({});
        }
    });
  });
};

exports.getSlot = function (aggregateData, maxChains, maxGenerations, trialId) {
  // From the range of currently open slots, pick one
  var stage = 'Getting current slot';
  return new Promise((resolve, reject) => {
      console.log(trialId, stage);
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
        resolve({chain: candidate, generation: 0, branch: 0});
      } else {
        // Choose from among the latest slots
        candidateChains = _.reduce(latestSlots, function(accumulator, chainData){
          if (+chainData.generation < maxGenerations - 1 && chainData.completed == 'completed'){
            accumulator.push(chainData);
          }
          return accumulator;
        }, []);
        if (candidateChains.length>0){
          var temp = _.sample(candidateChains);
          candidate = {generation: +temp.generation+1,
                       chain: temp.chain,
                       branch: 0};
          resolve(candidate);
        } else {
          err = {trialId: trialId,
                 stage: stage,
                 data: aggregateData};
          reject(err);
        }
      }
  });
};
