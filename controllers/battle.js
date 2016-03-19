var uuid = require('node-uuid');
var Attack = require('../models/Attack')

var xp = {
  je: {
    infrastructure: 10,
    tourism: 10,
    military: 10,
    strikes: 0
  },
  
  gg: {
    infrastructure: 10,
    tourism: 10,
    military: 10,
    strikes: 0
  }
}

function to2dp(number) {
  var number = Math.round(number*10)/10;
  return (number < 0) ? 0 : number;
}

function getRandMultiplier(){
  var random = to2dp(Math.random()*2);
  
  return (Math.random() > 0.5) ? random : -random;
}

setInterval(function(){
  // Every 2 seconds start rebuilding infrastructure
  if (xp.je.infrastructure < 10) xp.je.infrastructure += xp.je.tourism/100 + getRandMultiplier();
  if (xp.je.infrastructure > 10) xp.je.infrastructure = 10;
  if (xp.gg.infrastructure < 10) xp.gg.infrastructure += xp.gg.tourism/100 + getRandMultiplier();
  if (xp.gg.infrastructure > 10) xp.gg.infrastructure = 10;
  
  // Add more miltary power based on infrastructure
  if (xp.je.military < 10) xp.je.military += xp.je.infrastructure*0.2 + getRandMultiplier();
  if (xp.je.military > 10) xp.je.military = 10;
  if (xp.gg.military < 10) xp.gg.military += xp.gg.infrastructure*0.2 + getRandMultiplier();
  if (xp.gg.military > 10) xp.gg.military = 10;
  
  // Base tourism on strike count
  if (xp.je.tourism > 0) xp.je.tourism -= xp.je.strikes/10; 
  if (xp.gg.tourism > 0) xp.gg.tourism -= xp.gg.strikes/10;
  
  if (xp.je.tourism < 10) xp.je.tourism += getRandMultiplier() * 2;
  if (xp.gg.tourism < 10) xp.gg.tourism += getRandMultiplier() * 2;
  
  if (xp.je.tourism < 0) xp.je.tourism = 0; 
  if (xp.gg.tourism < 0) xp.gg.tourism = 0;
  
  if (xp.je.tourism > 10) xp.je.tourism = 10; 
  if (xp.gg.tourism > 10) xp.gg.tourism = 10;
    
  // Round everything
  xp.je.infrastructure = to2dp(xp.je.infrastructure);
  xp.je.tourism = to2dp(xp.je.tourism);
  xp.je.military = to2dp(xp.je.military);
  xp.gg.infrastructure = to2dp(xp.gg.infrastructure);
  xp.gg.tourism = to2dp(xp.gg.tourism);
  xp.gg.military = to2dp(xp.gg.military);
  
  console.log('Updated stats: ' + JSON.stringify(xp));
}, 2000);

setInterval(function(){
  // Reset strike count every minute
  xp.je.strikes = 0;
  xp.gg.strikes = 0;
}, 60000)

/**
 * GET /battle
 * Live battle page
 */
exports.getLive = function(req, res) {
  res.render('battle', {
    title: 'Live Battle'
  });
};

exports.getLeaderboard = function(req, res) {
  Attack.find({}, function(err, attacks) {
    res.render('leaderboard', {
      title: 'Leaderboard',
      attacks
    })
  })
}

/**
 * Socket.IO handler for new attack
 */
exports.newAttack = function(country, user, accuracy) {
  var id = uuid.v4();
  var success = true;
  
  console.log('New attack launched on %s by %s with accuracy %s, identifier: %s', country, user, accuracy, id);
  if (accuracy > 2000) {
    // Fail 10% of the time
    if (Math.random() > 0.9) success = false;
  } else if (accuracy > 1000) {
    // Fail 25% of the time
    if (Math.random() > 0.75) success = false;
  } else if (accuracy > 500) {
    // Fail 50% of the time
    if (Math.random() > 0.5) success = false;
  } else {
    // Always fail
    success = false;
  }
  
  var attack = new Attack({ user, country, accuracy, id, success }).save();
  return { id, success };
}

/**
 * Defence against launched attack
 */
exports.defendAttack = function(id, timeleft, accuracy, user) {
  var rand = Math.random();
  console.log('Rand seed is %s * timeleft %s * (3000-%s)/3000 = %s', rand, timeleft, accuracy, rand * timeleft * (3000-accuracy)/3000)
  var status = (rand * timeleft * (3000-accuracy)/3000) > 10;
  console.log('Counter attack to %s launched by %s with %ss to spare', id, user, timeleft/10);
  console.log('Counter attack was ' + (status ? 'successful' : 'unsuccessful' ));
  
  return status;
}

/**
 * Attack not successfully defended, calculate damage
 */
exports.registerAttack = function(id, country, accuracy, user) {
  var attacker = (country == 'je' ? 'gg' : 'je');
  
  console.log('infrastructure hit: %s', to2dp((accuracy/3000)*2*xp[attacker].military/4));
  
  xp[country].strikes += 1;
  xp[country].infrastructure -= to2dp((accuracy/3000)*2*xp[attacker].military/4);
  xp[country].military -= to2dp((accuracy/3000)*10);
  
  if (xp[country].infrastructure < 0) xp[country].infrastructure = 0;
  if (xp[country].military < 0) xp[country].military = 0;
  
  xp[country].infrastructure = to2dp(xp[country].infrastructure);
  xp[country].military = to2dp(xp[country].military);
}

exports.getStats = function(){
  return xp;
}

/**
 * Update defence status
 */
exports.updateStatus = function(id, success, user) {
  Attack.findOne({ id }, function(err, attack) {
    attack.defence = {
      attemptBy: user,
      success: success
    }
    
    attack.save();
  })
}