/*jshint esversion: 6 */

const express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose'),
    _ = require('lodash'),
    Chain_decision = require('./../models/chain_decision'),
    chain_position = require('./../controllers/chain_position');


var filterData = function(items){
  // From the previous data, filter out the data necessary for social transmission
  var data = _.map(items, (item) => {
    var generation = {
      generation: item.generation,
      drawsToDecision: item.drawsToDecision,
      choice: item.choice
    };
    return generation;
  });
  return data;
};

exports.save = function(data, studyName){
    // Save trial data
    return new Promise((resolve, reject) => {
      data.studyName = studyName;
      var stage = 'Saving data';
      console.log(stage);

        Chain_decision.create(data, (err, result) => {
          if (err){
            err.trialId = data.trialId;
            reject(err);
          } else {
            console.log('    dtd', result.drawsToDecision, 'choice', result.choice);
            resolve(data);
          }
        });
    });
};

exports.getBehavioralData = function(currentSlot, studyName, trialId){
  // Collect the responses from previous participants in a particular chain
  var stage = 'Retrieving decisions from previous generations';
  return new Promise((resolve, reject) => {
    console.log(stage);
    console.log('    current slot', currentSlot);
    Chain_decision.find({
      chain: currentSlot.chain,
      generation: {$lt: currentSlot.generation},
      studyName: studyName
    }, (err, items) => {
      if(err){
        err.stage = stage;
        err.trialId = trialId;
        err.name = 'Failed to retrieve data from previous generations';
        reject(err);
      } else {
        console.log('    Data retrieved: ' + items.length + ' items.');
        if (items.length == 0){
          console.log('        length 0!');
          currentSlot.data = [];
        } else {
          currentSlot.data = filterData(items);
        }
        resolve(currentSlot);
      }
    });
  });
};

exports.findBeadTrial = function(data){
  // From the full list of trials, identify the bead trial
  var stage = 'Finding beadTrial data';
  return new Promise((resolve, reject) => {
    console.log(stage);
    var beadTrial = _.reduce(data, (accumulator,entry)=>{
      // find the last trial in data that has type 'socialbeads'
      if(entry.trial_type == "socialbeads"){
        accumulator = entry;
      }
      return accumulator;
    }, {});
    if(beadTrial=={}){
      var err = {
        error: "Couldn't find beadTrial data",
        stage: stage,
        data: data,
        trialId: data.trialId
      };
      reject(err);
    } else {
      beadTrial.sessionId = data.sessionId;
      beadTrial.trialId = data.trialId;
      resolve(beadTrial);
    }
  });
};

exports.validateInputs = function(inputs, trialId){
  // Validate bead data
  var stage = 'Validating input data';

  return new Promise((resolve, reject) => {
    console.log(stage);

    if(inputs.generation>0){

      // check they have all the right data, and only one input per generation
      var validated = _.reduce(inputs.data, (acc, d)=>{
        //check if data ok
        if((d.generation>=0) && (d.drawsToDecision>=0) && (d.choice>=0)){

          //check if any duplicates
          if(d.generation in acc.generations){
            acc.duplicates.push(d);
          } else {
            acc.ok.push(d);
            acc.generations.push(d.generation);
          }
        } else {
          acc.wrongData.push(d);
        }
        return acc;
      }, {ok: [], generations: [], wrongData: [], duplicates: []});

      // warning if there's incorrect data or duplicates:
      var errorString;
      if( validated.wrongData.length > 0 ) {
        errorString = 'Warning in trial '+ trialId + ' ('+stage+')' + ': incorrect data! ';
        console.log(errorString, '\ninputs=', inputs, '\nvalidated=', validated);
      }
      if( validated.duplicates.length > 0 ) {
        errorString = 'Warning in trial '+ trialId + '('+stage+')' + ': duplicates found! ';
        console.log(errorString, '\ninputs=', inputs, '\nvalidated=', validated);
      }

      // check that there's the right amound of data for the current generation
      if(validated.ok.length == inputs.generation){
        inputs.data = validated.ok;
        resolve(inputs);
      } else {
        var err = {
          name: 'Failed to validate inputs',
          stage: stage,
          trialId: trialId,
          data: JSON.stringify({inputs: inputs, validated: validated})
        };
        reject(err);
      }
    } else {
      resolve(inputs);
    }
  });
};

exports.validateData = function(data){
  // After the trial, check that the right data has been collected
  var stage = 'Validating data';
  console.log(stage);
  return new Promise((resolve, reject) => {
    if((data.branch >= 0) && (data.chain >= 0) && (data.generation >= 0) && (data.drawsToDecision >= 0) && (data.choice >= 0)){
      resolve(data);
    } else {
      var err = {data: data,
                stage: stage,
                error:  'Validation failed',
                trialId: data.trialId};
      reject(err);
    }
  });
};
