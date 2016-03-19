/**
 * Module dependencies.
 */
var express = require('express');
var compress = require('compression');
var session = require('express-session');
var bodyParser = require('body-parser');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var lusca = require('lusca');
var methodOverride = require('method-override');
var dotenv = require('dotenv');
var MongoStore = require('connect-mongo/es5')(session);
var flash = require('express-flash');
var path = require('path');
var mongoose = require('mongoose');
var passport = require('passport');
var expressValidator = require('express-validator');
var sass = require('node-sass-middleware');
var multer = require('multer');
var upload = multer({ dest: path.join(__dirname, 'uploads') });

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.load({ path: '.env' });

/**
 * Controllers (route handlers).
 */
var homeController = require('./controllers/home');
var userController = require('./controllers/user');
var battleController = require('./controllers/battle');

/**
 * API keys and Passport configuration.
 */
var passportConfig = require('./config/passport');

/**
 * Create Express server.
 */
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var sessionMiddleware = session({
  resave: true,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET,
  store: new MongoStore({
    url: process.env.MONGODB || process.env.MONGOLAB_URI,
    autoReconnect: true
  })
});

/**
 * Connect to MongoDB.
 */
mongoose.connect(process.env.MONGODB || process.env.MONGOLAB_URI);
mongoose.connection.on('error', function() {
  console.log('MongoDB Connection Error. Please make sure that MongoDB is running.');
  process.exit(1);
});

/**
 * Express configuration.
 */
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(compress());
app.use(sass({
  src: path.join(__dirname, 'public'),
  dest: path.join(__dirname, 'public'),
  sourceMap: true
}));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());
app.use(methodOverride());
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(function(req, res, next) {
  if (req.path === '/api/upload') {
    next();
  } else {
    lusca.csrf()(req, res, next);
  }
});
app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(true));
app.use(function(req, res, next) {
  res.locals.user = req.user;
  next();
});
app.use(function(req, res, next) {
  // After successful login, redirect back to /api, /contact or /
  if (/(api)|(contact)|(^\/$)/i.test(req.path)) {
    req.session.returnTo = req.path;
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));

io.use(function(socket, next) {
  sessionMiddleware(socket.request, {}, next);
})

/**
 * Primary app routes.
 */
app.get('/', homeController.index);
app.get('/login', userController.getLogin);
app.post('/login', userController.postLogin);
app.get('/logout', userController.logout);
app.get('/forgot', userController.getForgot);
app.post('/forgot', userController.postForgot);
app.get('/reset/:token', userController.getReset);
app.post('/reset/:token', userController.postReset);
app.get('/signup', userController.getSignup);
app.post('/signup', userController.postSignup);
app.get('/account', passportConfig.isAuthenticated, userController.getAccount);
app.post('/account/profile', passportConfig.isAuthenticated, userController.postUpdateProfile);
app.post('/account/password', passportConfig.isAuthenticated, userController.postUpdatePassword);
app.post('/account/delete', passportConfig.isAuthenticated, userController.postDeleteAccount);
app.get('/account/unlink/:provider', passportConfig.isAuthenticated, userController.getOauthUnlink);

app.get('/battle', battleController.getLive);
app.get('/leaderboard', battleController.getLeaderboard);

/**
 * OAuth authentication routes. (Sign in)
 */
app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'user_location'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});

/**
 * OAuth authorization routes. (API examples)
 */
app.get('/auth/foursquare', passport.authorize('foursquare'));
app.get('/auth/foursquare/callback', passport.authorize('foursquare', { failureRedirect: '/api' }), function(req, res) {
  res.redirect('/api/foursquare');
});
app.get('/auth/tumblr', passport.authorize('tumblr'));
app.get('/auth/tumblr/callback', passport.authorize('tumblr', { failureRedirect: '/api' }), function(req, res) {
  res.redirect('/api/tumblr');
});
app.get('/auth/venmo', passport.authorize('venmo', { scope: 'make_payments access_profile access_balance access_email access_phone' }));
app.get('/auth/venmo/callback', passport.authorize('venmo', { failureRedirect: '/api' }), function(req, res) {
  res.redirect('/api/venmo');
});
app.get('/auth/steam', passport.authorize('openid', { state: 'SOME STATE' }));
app.get('/auth/steam/callback', passport.authorize('openid', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/pinterest', passport.authorize('pinterest', { scope: 'read_public write_public' }));
app.get('/auth/pinterest/callback', passport.authorize('pinterest', { failureRedirect: '/login' }), function(req, res) {
  res.redirect('/api/pinterest');
});

/**
 * Error Handler.
 */
app.use(errorHandler());

var countryMap = {
  'je': 'JSY',
  'gg': 'GGY'
}

var attackerMap = {
  'je': 'GGY',
  'gg': 'JSY'
}

var attackCodeMap = {
  'je': 'gg',
  'gg': 'je'
}

var attackNameMap = {
  'je': 'Guernsey',
  'gg': 'Jersey'
}

var countryNameMap = {
  'je': "Jersey",
  'gg': 'Guernsey'
}

var failMessage = [ 
  'counterstrike failed, air defences accidentally unplugged by cleaner',
  'air raid siren broken, heavy casulties',
  'heavy damage to vital infrastructure',
  'you\'re playing on easy mode',
  'military depo destroyed'
]

var successMessage = [
  'rocket knocked off course, hits Sark instead.. oops',
  'missile detonated in mid air, seagull hailed as national hero',
  'air defences successfully neutralised threat',
  'AA cannons terminated threat',
  'rocket fell short, expect radioactive fish for the next few weeks'
]

var koreaMessage = [
  'supreme leader turns {{country}} into sea of fire',
  'best korea mercilessly wipes out tratorious {{country}}',
  '{{country}} struck by retaliatory bolt of lightening',
]

var pendingAttacks = {};

io.on('connection', function(socket) {
  var user = socket.request.session.passport.user;
  
  socket.emit('greet');
  
  socket.on('attack', function(data) {
    var attack = battleController.newAttack(data.country, user, data.accuracy);
    
    pendingAttacks[attack.id] = { data: data, time: new Date() };
    
    if (attack.success) {
      io.emit('launch', { country: data.country, name: data.name, id: attack.id, accuracy: data.accuracy });
    } else {
      // Attack failed, selfnuked
      battleController.registerAttack(data.id, data.country, data.accuracy, user);
      io.emit('self', { country: attackCodeMap[data.country], countryCode: attackerMap[data.country], countryName: attackNameMap[data.country], id: attack.id });
    }
    
    // Every attack there is a 5% chance of an attack by Pyongyang
    if (Math.random() > 0.95) {
      var country = (Math.random() > 0.5) ? 'je' : 'gg';
      var index = Math.floor(Math.random() * koreaMessage.length);
      var message = koreaMessage[index].replace('{{country}}',countryNameMap[country]);
      io.emit('pyongyang', { country, countryName: countryNameMap[country], message });
    }
  });
  
  socket.on('defend', function(data) {
    delete pendingAttacks[data.id]; // Someone has responded so no longer pending
    
    var success = battleController.defendAttack(data.id, data.timeleft, data.accuracy, user);
    battleController.updateStatus(data.id, success, user);
    
    if (success) {
      var index = Math.floor(Math.random() * successMessage.length);
      io.emit('defencesuccess', { casulty: countryMap[data.country], attacker: attackerMap[data.country], message: successMessage[index] })
    } else {
      var index = Math.floor(Math.random() * failMessage.length);
      battleController.registerAttack(data.id, data.country, data.accuracy, user);
      io.emit('strike', { casulty: countryMap[data.country], attacker: attackerMap[data.country], message: failMessage[index], from: attackCodeMap[data.country], to: data.country });
    }
  })
  
  socket.on('disconnect', function() {
    // Do something?
  });
  
  setInterval(function(){
    var stats = battleController.getStats();
    io.emit('stats', stats);
    
    // Check if any pending attacks have expired
    Object.keys(pendingAttacks).forEach(function(id) {
      var now = new Date();
      var attack = pendingAttacks[id];
      
      if (now - attack.time > 5000) {
        // Attack has expired
        var index = Math.floor(Math.random() * failMessage.length);
        battleController.registerAttack(attack.data.id, attack.data.country, attack.data.accuracy, user);
        io.emit('strike', { casulty: countryMap[attack.data.country], attacker: attackerMap[attack.data.country], message: failMessage[index], from: attackCodeMap[attack.data.country], to: attack.data.country });
        
        delete pendingAttacks[id];
      }
    })
  }, 1000)
});

/**
 * Start Express server.
 */
server.listen(app.get('port'), function() {
  console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
});

module.exports = app;
