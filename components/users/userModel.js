var mongoose = require('mongoose');
var GitHub = require('github');
var OAuth2 = require('oauth').OAuth2;

var users = {
  'hunter@hunterloftis.com': 'password',
  'test@dummy.com': 'bacon'
};

module.exports = function(config) {

  var oauth = new OAuth2(config.github_client, config.github_secret, "https://github.com/", "login/oauth/authorize", "login/oauth/access_token");
  var github = new GitHub({ version: '3.0.0' });

  var schema = mongoose.Schema({
    email:        { type: String },
    name:         { type: String },
    githubLogin:  { type: String }
  });

  schema.statics.create = create;
  schema.statics.authEmail = authEmail;
  schema.statics.authGitHub = authGitHub;

  var User = mongoose.model('User', schema);
  return User;

  // Statics

  function create(props, done) {
    if (!(props.email || props.githubLogin)) return done(new Error('Either email or github login is required'));
    var newUser = new User(props);
    newUser.save(done);
  }

  function authEmail(creds, done) {
    if (!(creds.email && creds.password)) {
      return done(new Error('Email and password required'));
    }
    User.findOne({ email: creds.email, password: creds.password }, function(err, match) {
      if (err) return done(new Error("Database error"));
      if (match) return done(undefined, match);
      return done(new Error("Username or password not found"));
    });
  }

  function authGitHub(code, done) {
    oauth.getOAuthAccessToken(code, {}, onToken);

    function onToken(err, token) {
      console.log('onToken');
      if (err) return done(err);
      github.authenticate({
        type: 'oauth',
        token: token
      });
      var user = {};
      github.user.get({}, onInfo);
    }

    function onInfo(err, info) {
      console.log('onInfo');
      User.findOne({ githubLogin: info.login }, function(err, match) {
        console.log('user match:', match);
        if (err) return done(new Error('Database error'));
        // User already exists in the db:
        // TODO: update from github to follow changes in name etc
        if (match) return done(undefined, match);
        // User doesn't exist yet and should be saved to the db:
        return User.create({
          email: info.email,
          name: info.name || info.login,
          githubLogin: info.login
        }, onCreate);
      });
    }

    function onCreate(err, newUser) {
      console.log('onCreate');
      if (err || !newUser) return done(new Error('Database error'));
      return done(undefined, newUser);
    }
  }

};
