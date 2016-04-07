function cleanUpGamesAndPlayers(){
  // var cutOff = moment(new Date()).subtract(2, 'hours').toDate().getTime();
  //
  // var numGamesRemoved = Games.remove({
  //   createdAt: {$lt: cutOff}
  // });
  //
  // var numPlayersRemoved = Players.remove({
  //   createdAt: {$lt: cutOff}
  // });
}

function getRandomLocation(){
  var locationIndex = Math.floor(Math.random() * locations.length);
  return locations[locationIndex];
}

function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

function assignRoles(players, location){
  var default_role = location.roles[location.roles.length - 1];
  var roles = location.roles.slice();
  var shuffled_roles = shuffleArray(roles);
  var role = null;

  // players.forEach(function(player){
  //   if (!player.isSpy){
  //     role = shuffled_roles.pop();
  //
  //     if (role === undefined){
  //       role = default_role;
  //     }
  //
  //     Players.update(player._id, {$set: {role: role}});
  //   }
  // });
}

Meteor.startup(function () {
  // Delete all games and players at startup
  Games.remove({});
  Players.remove({});
});

var MyCron = new Cron(60000);

MyCron.addJob(5, cleanUpGamesAndPlayers);

Meteor.publish('games', function(accessCode) {
  return Games.find({"accessCode": accessCode});
});

Meteor.publish('players', function(gameID) {
  return Players.find({"gameID": gameID});
});

Games.find({"state": 'settingUp'}).observeChanges({
  added: function (id, game) {
    var location = getRandomLocation();
    var players = Players.find({gameID: id});
    var gameEndTime = moment().add(game.lengthInMinutes, 'minutes').valueOf();

    var spyIndex = false;// Math.floor(Math.random() * players.count());
    var firstPlayerIndex = 0//Math.floor(Math.random() * players.count());

    var playerIDList = [];

    players.forEach(function(player, index){
      Players.update(player._id, {$set: {
        isSpy: index === spyIndex,
        isFirstPlayer: index === firstPlayerIndex
      }});
      playerIDList.push(player._id);
    });

    var bossID = playerIDList[0];
    Players.update(bossID, {$set: {
      isActive:true,
      role:'boss',
    }});

    assignRoles(players, location);

    var jokerN = 0;
    var loyalN = 1;
    var ciaN = 1;
    var driverN = 1;
    switch (playerIDList.length) {
      case 7:loyalN=2;break;
      case 8:loyalN=3;jokerN=1;break;
      case 9:loyalN=4;jokerN=1;break;
      case 10:loyalN=4;ciaN=2;jokerN=1;break;
      case 11:loyalN=4;ciaN=2;driverN=2;jokerN=2;break;
      case 12:loyalN=5;ciaN=2;driverN=2;jokerN=2;break;

      default:

    }

    Games.update(id, {$set: {
      loyal:loyalN,
      cia:ciaN,
      driver:driverN,
      joker:jokerN,
      gem:15,
      state: 'inProgress', location: location, endTime: gameEndTime, paused: false, pausedTime: null, playerOrder:playerIDList}});
    }
  });
