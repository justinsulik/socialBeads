/*jshint esversion: 6 */

// --- LOADING MODULES
const express = require('express'),
  url = require('url'),
  body_parser = require('body-parser'),
  session = require('express-session'),
  ejs = require('ejs'),
  _ = require('lodash'),
  detect = require('browser-detect'),
  geoip = require('geoip-lite'),
  db = require(__dirname+'/controllers/db'),
  admin = require('./routes/admin.js'),
  tests = require('./routes/tests.js'),
  chain_position = require(__dirname+'/controllers/chain_position'),
  chain_decision = require(__dirname+'/controllers/chain_decision'),
  tasks = require(__dirname+'/controllers/tasks'),
  responses = require(__dirname+'/controllers/responses'),
  {makeCode} = require('./helper/codeString.js');

// --- INSTANTIATE THE APP
const studyName = 'demo';
const maxChains = 1;
const maxGenerations = 20;
const timeOut = 0;
const app = express();
const PORT = process.env.PORT || 5000;
app.use(
  session({
    secret: 'snatch water deep houses',
    resave: false,
    saveUninitialized: true,
  })
);

// --- SET LOCAL VARIABLES
app.locals.studyName = studyName;
app.locals.maxChains = maxChains;
app.locals.maxGenerations = maxGenerations;

// --- MONGOOSE SETUP
db.connect(process.env.MONGODB_URI);

// --- STATIC MIDDLEWARE
app.use(express.static(__dirname + '/public'));

// --- BODY PARSING MIDDLEWARE
app.use(body_parser.json()); // to support JSON-encoded bodies

// --- LIBRARIES FOR EXPERIMENT SCRIPT
app.use('/jspsych', express.static(__dirname + "/jspsych"));
app.use('/libraries', express.static(__dirname + "/libraries"));
app.use('/helper', express.static(__dirname + "/helper"));

// --- VIEW LOCATION, SET UP SERVING STATIC HTML
app.engine('ejs', ejs.renderFile);
app.set('view engine', 'ejs');
app.set('views', __dirname + '/public/views');

// --- ERROR HANDLER
function errorHandler(err){
  console.log("Error in trial "+err.trialId+" ("+err.stage+"): ", err);
  next();
}

// --- ROUTING
app.use('/admin', admin);

app.get('/', (req, res, next) => {
    // get trial info
    const sessId = req.session.id;
    const workerId = req.query.workerId || '';
    const assignmentId = req.query.assignmentId || '';
    const hitId = req.query.hitId || '';
    const trialId = makeCode(2)+'5'+makeCode(5)+'nMn'+makeCode(4)+'z'+makeCode(2);
    const browser = detect(req.headers['user-agent']);
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || (req.connection.socket ? req.connection.socket.remoteAddress : null);
    let geo = {};
    if(ip){
      geo = geoip.lookup(ip);
    }

    // save trial info
    tasks.save({
        "workerId": workerId,
        "hitId": hitId,
        "assignmentId": assignmentId,
        "trialId": trialId,
        "sessionId": sessId,
        "studyName": studyName,
        "browser": browser,
        "ip": ip,
        "geo": geo
    });

    // Check browser not IE, and device not mobile
    let browserOk = true;
    if (browser) {
      console.log(trialId, 'Detected browser...', browser);
      if (browser.name=='ie' || browser.mobile==true){
        browserOk = false;
      }
    }

    if(browserOk){

      // set all records older than const timeout to 'defunct'
      chain_position.clearOld(timeOut, trialId)
      // collect current assignment of participants to micro-societies/chains
      .then(cleared => chain_position.collectData(studyName, trialId),
        errorHandler)
      // select an open slot in an unfinished chain
      .then(aggregateData => chain_position.getSlot(aggregateData, maxChains, maxGenerations, trialId),
        errorHandler)
      // mark the chosen slot as temporarily occupied
      .then(currentSlot => chain_position.update(currentSlot, studyName, trialId),
        errorHandler)
      // collect the decisions of previous participants in that chain
      .then((currentSlot) => chain_decision.getBehavioralData(currentSlot, studyName, trialId),
        errorHandler)
      // validate the input
      .then((behavioralData) => chain_decision.validateInputs(behavioralData, trialId),
        errorHandler)
      // render the experiment
      .then(surveyInputs => {
          surveyInputs.sessId = sessId;
          surveyInputs.trialId = trialId;
          console.log(trialId, 'Sending data to experiment...', surveyInputs);
          res.render('experiment.ejs', {surveyInputs: JSON.stringify(surveyInputs)});
        },
        errorHandler
      )
      .catch((err) => {
        res.send('<p>There has been a server error and we are unable to load the experiment. Please return the HIT. Apologies for any inconvenience.</p>');
      });

    } else {
      res.send('You seem to be viewing this either on a mobile device or with Internet Explorer. The instructions explicitly forbade those. Please just return the HIT.');
    }

});

// --- DISPLAY DEBFRIEF

app.get('/x5JVJpXO2e', (req, res, next) => {
  const sessId = req.session.id;
  let code = req.query.gvmejG;
  if(code.length>=0){
    code = code +'5'+makeCode(3);
  } else {
    code = makeCode(10) + 'E3E';
  }
  res.render('finish.ejs', {completionCode: code});
});

// --- SAVE TRIAL DATA

app.post('/e3PlV5', (req, res, next) => {

  const data = req.body;
  const sessionId = req.session.id;
  const trialId = req.query.trialId || 'none';
  data.trialId = trialId;
  console.log(trialId, 'Preparing to save trial data...');

  // save all data
  // DISABLED FOR DEMO
  // responses.save({
  //     sessionId: sessionId,
  //     trialData: data,
  //     trialId: trialId,
  //     studyName: studyName,
  // });

  // extract the beads decision for later social presentation
  // DISABLED FOR DEMO
  // data.sessionID = sessionId;
  // chain_decision.findBeadTrial(data)
  // .then(beadData => chain_decision.validateData(beadData),
  //       errorHandler)
  // .then(beadData => chain_decision.save(beadData, studyName),
  //       errorHandler)
  // .then(beadData => chain_position.complete(beadData, studyName),
  //       errorHandler)
  // .then(res.status(200).end());
  res.status(200).end();
});

// --- VOID CHAIN POSITION IF WINDOW CLOSED
app.post('/k727Y', (req, res, next) => {

  const data = req.body;
  const sessionId = req.session.id;
  const trialId = data.trialId || 'none';
  console.log(trialId, 'Window closed, voiding chain position...');
  console.log(trialId, data);
  chain_position.clear_abandoned(data, studyName)
  .then(res.status(200).end());
});

// --- START THE SERVER
var server = app.listen(PORT, function(){
    console.log("Listening on port %d", server.address().port);
});
