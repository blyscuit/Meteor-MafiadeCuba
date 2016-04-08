Handlebars.registerHelper('toCapitalCase', function(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
});

function initUserLanguage() {
  var language = amplify.store("language");

  if (language){
    Session.set("language", language);
  }

  setUserLanguage(getUserLanguage());
}

function getUserLanguage() {
  var language = Session.get("language");

  if (language){
    return language;
  } else {
    return "en";
  }
};

function setUserLanguage(language) {
  TAPi18n.setLanguage(language).done(function () {
    Session.set("language", language);
    amplify.store("language", language);
  });
}

function getLanguageDirection() {
  var language = getUserLanguage()
  var rtlLanguages = ['he', 'ar'];

  if ($.inArray(language, rtlLanguages) !== -1) {
    return 'rtl';
  } else {
    return 'ltr';
  }
}

function getLanguageList() {
  var languages = TAPi18n.getLanguages();
  var languageList = _.map(languages, function(value, key) {
    var selected = "";

    if (key == getUserLanguage()){
      selected = "selected";
    }

    // Gujarati isn't handled automatically by tap-i18n,
    // so we need to set the language name manually
    if (value.name == "gu"){
      value.name = "ગુજરાતી";
    }

    return {
      code: key,
      selected: selected,
      languageDetails: value
    };
  });

  if (languageList.length <= 1){
    return null;
  }

  return languageList;
}

function getCurrentGame(){
  var gameID = Session.get("gameID");

  if (gameID) {
    return Games.findOne(gameID);
  }
}

function getAccessLink(){
  var game = getCurrentGame();

  if (!game){
    return;
  }

  return Meteor.settings.public.url + game.accessCode + "/";
}


function getCurrentPlayer(){
  var playerID = Session.get("playerID");

  if (playerID) {
    return Players.findOne(playerID);
  }
}

function generateAccessCode(){
  var code = "";
  var possible = "abcdefghijklmnopqrstuvwxyz";

  for(var i=0; i < 6; i++){
    code += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return code;
}

function generateNewGame(){
  var ar =[];
  var empty=[];
  ar.push("Welcome to the Den.");
  var game = {
    accessCode: generateAccessCode(),
    state: "waitingForPlayers",
    location: null,
    lengthInMinutes: 8,
    endTime: null,
    paused: false,
    pausedTime: null,
    loyal:0,
    cia:0,
    driver:0,
    joker:0,
    chats:ar,
    playerOrder:empty,
    bag:true,
    turnOrder:0,
    openPocket:false,
  };

  var gameID = Games.insert(game);
  game = Games.findOne(gameID);

  return game;
}

function generateNewPlayer(game, name){
  var player = {
    gameID: game._id,
    name: name,
    role: null,
    isSpy: false,
    isFirstPlayer: false,
    isActive:false,
    gem:0,
  };

  var playerID = Players.insert(player);

  return Players.findOne(playerID);
}

function resetUserState(){
  var player = getCurrentPlayer();

  if (player){
    Players.remove(player._id);
  }

  Session.set("gameID", null);
  Session.set("playerID", null);
}

function trackGameState () {
  var gameID = Session.get("gameID");
  var playerID = Session.get("playerID");

  if (!gameID || !playerID){
    return;
  }

  var game = Games.findOne(gameID);
  var player = Players.findOne(playerID);

  if (!game || !player){
    Session.set("gameID", null);
    Session.set("playerID", null);
    Session.set("currentView", "startMenu");
    return;
  }

  if(game.state === "inProgress"){
    Session.set("currentView", "gameView");
  } else if (game.state === "waitingForPlayers") {
    Session.set("currentView", "lobby");
  }
}

function leaveGame () {
  GAnalytics.event("game-actions", "gameleave");
  var player = getCurrentPlayer();

  Session.set("currentView", "startMenu");
  Players.remove(player._id);

  Session.set("playerID", null);
}

function takeRoleCoin(roleIn){
  var game = getCurrentGame();
  if(roleIn=='loyal'){
    if(game.loyal){
      var player = getCurrentPlayer();
      Players.update(player._id, {
        $set: { role: roleIn },
      });
      Games.update(game._id, {
        $set: { loyal: (game.loyal-1) },
      });
    }
  }
  if(roleIn=='cia'){
    if(game.cia){
      var player = getCurrentPlayer();
      Players.update(player._id, {
        $set: { role: roleIn },
      });
      Games.update(game._id, {
        $set: { cia: (game.cia-1) },
      });
    }
  }
  if(roleIn=='driver'){
    if(game.driver){
      var player = getCurrentPlayer();
      Players.update(player._id, {
        $set: { role: roleIn },
      });
      Games.update(game._id, {
        $set: { driver: (game.driver-1) },
      });
    }
  }

  gameGoNextPlayer(game);

}
function hideRoleCoin(roleIn){
  var game = getCurrentGame();
  if(roleIn=='loyal'){
    if(game.loyal){
      Games.update(game._id, {
        $set: { loyal: (game.loyal-1),bag:false },
      });
    }
  }
  if(roleIn=='cia'){
    if(game.cia){
      Games.update(game._id, {
        $set: { cia: (game.cia-1),bag:false },
      });
    }
  }
  if(roleIn=='driver'){
    if(game.driver){
      Games.update(game._id, {
        $set: { driver: (game.driver-1),bag:false },
      });
    }
  }


}
function takeGem(amount){
  var game = getCurrentGame();
  if(game.gem-amount>=0){
    var player = getCurrentPlayer();
    if(player.role!='boss'){
      Players.update(player._id, {
        $set: { gem: amount,role: 'thief'  },
      });
    }else{
      Players.update(player._id, {
        $set: { gem: amount },
      });
    }
    Games.update(game._id, {
      $set: { gem: (game.gem-amount) },
    });

    gameGoNextPlayer(game);
  }
}
function gameGoNextPlayer(inGame){
  var player = getCurrentPlayer();
  Players.update(player._id, {
    $set: { isActive: false },
  });
  addToChat(inGame,player.name+" took something.");

  if(inGame.turnOrder+1 >= inGame.playerOrder.length){
    Games.update(inGame._id, {
      $set: { showPocket: true },
    });
  }else{
    var pID = inGame.playerOrder[inGame.turnOrder+1];
    Games.update(inGame._id, {
      $set: { turnOrder: (inGame.turnOrder+1) },
    });
    Players.update(pID, {
      $set: { isActive: true },
    });
  }

}

function addToChat(inGame,text){
  var newAr = inGame.chats;
  newAr.push(text);
  Games.update(inGame._id, {
    $set: { chats: newAr },
  });
}

function hasHistoryApi () {
  return !!(window.history && window.history.pushState);
}

initUserLanguage();

Meteor.setInterval(function () {
  Session.set('time', new Date());
}, 1000);

if (hasHistoryApi()){
  function trackUrlState () {
    var accessCode = null;
    var game = getCurrentGame();
    if (game){
      accessCode = game.accessCode;
    } else {
      accessCode = Session.get('urlAccessCode');
    }

    var currentURL = '/';
    if (accessCode){
      currentURL += accessCode+'/';
    }
    window.history.pushState(null, null, currentURL);
  }
  Tracker.autorun(trackUrlState);
}
Tracker.autorun(trackGameState);

window.onbeforeunload = resetUserState;
window.onpagehide = resetUserState;

FlashMessages.configure({
  autoHide: true,
  autoScroll: false
});

Template.main.helpers({
  whichView: function() {
    return Session.get('currentView');
  },
  language: function() {
    return getUserLanguage();
  },
  textDirection: function() {
    return getLanguageDirection();
  }
});

Template.footer.helpers({
  languages: getLanguageList
})

Template.footer.events({
  'click .btn-set-language': function (event) {
    var language = $(event.target).data('language');
    setUserLanguage(language);
    GAnalytics.event("language-actions", "set-language-" + language);
  },
  'change .language-select': function (event) {
    var language = event.target.value;
    setUserLanguage(language);
    GAnalytics.event("language-actions", "set-language-" + language);
  }
})

Template.startMenu.events({
  'click #btn-new-game': function () {
    Session.set("currentView", "createGame");
  },
  'click #btn-join-game': function () {
    Session.set("currentView", "joinGame");
  }
});

Template.startMenu.helpers({
  announcement: function() {
    return Meteor.settings.public.announcement;
  },
  alternativeURL: function() {
    return Meteor.settings.public.alternative;
  }
});

Template.startMenu.rendered = function () {
  GAnalytics.pageview("/");

  resetUserState();
};

Template.createGame.events({
  'submit #create-game': function (event) {
    GAnalytics.event("game-actions", "newgame");

    var playerName = event.target.playerName.value;

    if (!playerName || Session.get('loading')) {
      return false;
    }

    var game = generateNewGame();
    var player = generateNewPlayer(game, playerName);

    Meteor.subscribe('games', game.accessCode);

    Session.set("loading", true);

    Meteor.subscribe('players', game._id, function onReady(){
      Session.set("loading", false);

      Session.set("gameID", game._id);
      Session.set("playerID", player._id);
      Session.set("currentView", "lobby");
    });

    return false;
  },
  'click .btn-back': function () {
    Session.set("currentView", "startMenu");
    return false;
  }
});

Template.createGame.helpers({
  isLoading: function() {
    return Session.get('loading');
  }
});

Template.createGame.rendered = function (event) {
  $("#player-name").focus();
};

Template.joinGame.events({
  'submit #join-game': function (event) {
    GAnalytics.event("game-actions", "gamejoin");

    var accessCode = event.target.accessCode.value;
    var playerName = event.target.playerName.value;

    if (!playerName || Session.get('loading')) {
      return false;
    }

    accessCode = accessCode.trim();
    accessCode = accessCode.toLowerCase();

    Session.set("loading", true);

    Meteor.subscribe('games', accessCode, function onReady(){
      Session.set("loading", false);

      var game = Games.findOne({
        accessCode: accessCode
      });

      if (game) {
        Meteor.subscribe('players', game._id);
        player = generateNewPlayer(game, playerName);

        if (game.state === "inProgress") {
          var default_role = game.location.roles[game.location.roles.length - 1];
          Players.update(player._id, {$set: {role: default_role}});
        }

        Session.set('urlAccessCode', null);
        Session.set("gameID", game._id);
        Session.set("playerID", player._id);
        Session.set("currentView", "lobby");
      } else {
        FlashMessages.sendError(TAPi18n.__("ui.invalid access code"));
        GAnalytics.event("game-actions", "invalidcode");
      }
    });

    return false;
  },
  'click .btn-back': function () {
    Session.set('urlAccessCode', null);
    Session.set("currentView", "startMenu");
    return false;
  }
});

Template.joinGame.helpers({
  isLoading: function() {
    return Session.get('loading');
  }
});


Template.joinGame.rendered = function (event) {
  resetUserState();

  var urlAccessCode = Session.get('urlAccessCode');

  if (urlAccessCode){
    $("#access-code").val(urlAccessCode);
    $("#access-code").hide();
    $("#player-name").focus();
  } else {
    $("#access-code").focus();
  }
};

Template.lobby.helpers({
  game: function () {
    return getCurrentGame();
  },
  accessLink: function () {
    return getAccessLink();
  },
  player: function () {
    return getCurrentPlayer();
  },
  players: function () {
    var game = getCurrentGame();
    var currentPlayer = getCurrentPlayer();

    if (!game) {
      return null;
    }

    // var players = Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();
    //
    // players.forEach(function(player){
    //   if (player._id === currentPlayer._id){
    //     player.isCurrent = true;
    //   }
    // });

    return players;
  },
  isLoading: function() {
    var game = getCurrentGame();
    return game.state === 'settingUp';
  }
});

Template.lobby.events({
  'click .btn-leave': leaveGame,
  'click .btn-start': function () {
    GAnalytics.event("game-actions", "gamestart");

    var game = getCurrentGame();
    Games.update(game._id, {$set: {state: 'settingUp'}});
  },
  'click .btn-toggle-qrcode': function () {
    $(".qrcode-container").toggle();
  },
  'click .btn-remove-player': function (event) {
    var playerID = $(event.currentTarget).data('player-id');
    Players.remove(playerID);
  },
  'click .btn-edit-player': function (event) {
    var game = getCurrentGame();
    resetUserState();
    Session.set('urlAccessCode', game.accessCode);
    Session.set('currentView', 'joinGame');
  }
});

Template.lobby.rendered = function (event) {
  var url = getAccessLink();
  var qrcodesvg = new Qrcodesvg(url, "qrcode", 250);
  qrcodesvg.draw();
};

function getTimeRemaining(){
  var game = getCurrentGame();
  var localEndTime = game.endTime - TimeSync.serverOffset();

  if (game.paused){
    var localPausedTime = game.pausedTime - TimeSync.serverOffset();
    var timeRemaining = localEndTime - localPausedTime;
  } else {
    var timeRemaining = localEndTime - Session.get('time');
  }

  if (timeRemaining < 0) {
    timeRemaining = 0;
  }

  return timeRemaining;
}

Template.gameView.helpers({
  gemWill:function(){
    var game = getCurrentGame();
    if(game.gem == 0){
       Session.set("gemLocal", gemT);
       return 0;
     }else {
      return Session.get("gemLocal");
    }
  },
  game: getCurrentGame,
  player: getCurrentPlayer,
  players: function () {
    var game = getCurrentGame();

    if (!game){
      return null;
    }

    var players = Players.find({
      'gameID': game._id
    });

    return players;
  },
  chats: function () {
    var currentGame = getCurrentGame();
    var ch = [];
    for (var i = currentGame.chats.length, len = 0; i > len; i--) {
      ch.push(currentGame.chats[i-1]);
    }
    return ch;
  },
  gameFinished: function () {
    var timeRemaining = getTimeRemaining();

    return timeRemaining === 0;
  },
  timeRemaining: function () {
    var timeRemaining = getTimeRemaining();

    return moment(timeRemaining).format('mm[<span>:</span>]ss');
  },
  isBoss: function(){
    var player = getCurrentPlayer();
    return player.role=='boss';
  },
  isThief: function(){
    var player = getCurrentPlayer();
    return player.role=='thief';
  },
  isLoyal: function(){
    var player = getCurrentPlayer();
    return player.role=='loyal';
  },
  isGemAvailable: function(){
    var game = getCurrentGame();
    if(game.gem == 0)return false;
    return true;
  }
  isBagEmpty: function(){
    var game = getCurrentGame();
    if(game.bag == true && game.turnOrder == 1)return true;
    return true;
  }
});


Session.setDefault("gemLocal", 1);

Template.gameView.events({
  'click .btn-leave': leaveGame,
  'click .btn-end': function () {
    GAnalytics.event("game-actions", "gameend");

    var game = getCurrentGame();
    Games.update(game._id, {$set: {state: 'waitingForPlayers'}});
  },
  'click .btn-toggle-status': function () {
    $(".status-container-content").toggle();
  },
  'click .game-countdown': function () {
    var game = getCurrentGame();
    var currentServerTime = TimeSync.serverTime(moment());

    if(game.paused){
      GAnalytics.event("game-actions", "unpause");
      var newEndTime = game.endTime - game.pausedTime + currentServerTime;
      Games.update(game._id, {$set: {paused: false, pausedTime: null, endTime: newEndTime}});
    } else {
      GAnalytics.event("game-actions", "pause");
      Games.update(game._id, {$set: {paused: true, pausedTime: currentServerTime}});
    }
  },
  'click .player-name': function (event) {
    event.target.className = 'player-name-striked';
  },
  'click .player-name-striked': function(event) {
    event.target.className = 'player-name';
  },
  'click .location-name': function (event) {
    event.target.className = 'location-name-striked';
  },
  'click .location-name-striked': function(event) {
    event.target.className = 'location-name';
  },
  'click .btn-loyal': function (event) {
    var game = getCurrentGame();
    takeRoleCoin('loyal');
  },
  'click .btn-cia': function (event) {
    var game = getCurrentGame();
    takeRoleCoin('cia');
  },
  'click .btn-driver': function (event) {
    var game = getCurrentGame();
    takeRoleCoin('driver');
  },
  'click .btn-hide-loyal': function (event) {
    var game = getCurrentGame();
    hideRoleCoin('loyal');
  },
  'click .btn-hide-cia': function (event) {
    var game = getCurrentGame();
    hideRoleCoin('cia');
  },
  'click .btn-hide-driver': function (event) {
    var game = getCurrentGame();
    hideRoleCoin('driver');
  },
  'click .btn-gem': function (event) {
    var game = getCurrentGame();
    takeGem(Session.get("gemLocal"));
  },
  'click .btn-up': function (event) {
    var game = getCurrentGame();
    var player = getCurrentPlayer();
    var gemT = Session.get("gemLocal");
    gemT = gemT + 1;
    if(gemT>game.gem)gemT=game.gem;
    if(player.role == 'boss'){
      if(gemT>5)gemT=5;
    }
     Session.set("gemLocal", gemT);
  },
  'click .btn-down': function (event) {
    var game = getCurrentGame();
    var gemT = Session.get("gemLocal");
    gemT = gemT - 1;
    if(game.turnOrder<(game.playerOrder.length-1)&&game.turnOrder>0&&game.gem>0){
      if(gemT<1)gemT=1;
    }else{
      if(gemT<0)gemT=0;
    }
     Session.set("gemLocal", gemT);
  },
  'click .btn-openPocket': function (event) {
    var game = getCurrentGame();
    var player = getCurrentPlayer();
    var text = player.name + " is "+ player.role.toUpperCase() + " with " + player.gem + ' gems';
    addToChat(game,text);
    if(player.role == 'loyal'){
      Games.update(game._id, {
        $set: { joker: (game.joker-1) },
      });
      if(game.joker<=0)addToChat(game,'Game Over');
    }else if(player.role == 'cia'){
      addToChat(game,'Game Over');
    }
    // gameGoNextPlayer(game);
  }
});
