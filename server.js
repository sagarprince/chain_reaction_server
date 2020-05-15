'use strict';

var ip = require('ip');
var _ = require('lodash');

function Server() {
  this.rooms = {};
  this.express = require('express');
  this.app = this.express();
  this.httpServer = require('http').Server(this.app);
  this.io = require('socket.io')(this.httpServer);
}

Server.prototype.setConfiguration = function () {
  this.app.set('port', process.env.PORT || 4545);
};

Server.prototype.start = function () {
  this.httpServer.listen(this.app.get('port'));

  console.log(
    'Server Running with IP Address ' +
      ip.address() +
      ' and Port ' +
      this.app.get('port')
  );
  this.realTimeRoutes();
};

Server.prototype.realTimeRoutes = function () {
  var self = this;
  this.io.on('connection', function (socket) {
    console.log('connected :- ', socket.id);

    socket.on('create_game', function () {
      let args = Array.prototype.slice.call(arguments);
      let data = JSON.parse(args[0]);
      let ackCallback = args.pop();
      self.createGame(socket, data, ackCallback);
    });

    socket.on('join_game', function () {
      let args = Array.prototype.slice.call(arguments);
      let data = JSON.parse(args[0]);
      let ackCallback = args.pop();
      self.joinGame(socket, data, ackCallback);
    });

    socket.on('rejoin_game', function () {
      let args = Array.prototype.slice.call(arguments);
      let data = JSON.parse(args.pop());
      self.reJoinGame(socket, data);
    });

    socket.on('move', function () {
      let args = Array.prototype.slice.call(arguments);
      let data = JSON.parse(args.pop());
      self.move(socket, data);
    });

    socket.on('copy_matrix_board', function () {
      let args = Array.prototype.slice.call(arguments);
      let data = JSON.parse(args.pop());
      self.copyMatrixBoard(data);
    });

    socket.on('remove_player_from_game', function () {
      let args = Array.prototype.slice.call(arguments);
      let data = JSON.parse(args.pop());
      self.removePlayerFromGame(socket, data);
    });

    socket.on('remove_game', function () {
      let args = Array.prototype.slice.call(arguments);
      let data = JSON.parse(args.pop());
      self.removeGame(socket, data);
    });

    socket.on('disconnect', function () {
      console.log('disconnect :- ', socket.id);
    });
  });
};

Server.prototype.generateRoomId = function () {
  var roomId = Math.floor(10000 + Math.random() * 90000);
  if (roomId in this.rooms) {
    roomId = generateRoomId();
  }
  return roomId;
};

Server.prototype.isRoomExist = function (roomId) {
  var room = this.rooms[roomId];
  return !room ? false : true;
};

Server.prototype.isRoomFull = function (roomId) {
  var room = this.rooms[roomId];
  var playersLimit = room['playersLimit'];
  var totalPlayers = room['players'].length;
  return playersLimit === totalPlayers ? true : false;
};

Server.prototype.isPlayerNameExist = function (roomId, name) {
  var players = this.rooms[roomId]['players'];
  var index = players.findIndex((p) => {
    return (
      p.name.toLowerCase().replace(/\s/g, '') ===
      name.toLowerCase().replace(/\s/g, '')
    );
  });
  return index > -1;
};

Server.prototype.isPlayerColorExist = function (roomId, color) {
  var players = this.rooms[roomId]['players'];
  var index = players.findIndex((p) => p.color === color);
  return index > -1;
};

Server.prototype.createGame = function (socket, data, ackCallback) {
  try {
    var roomId = this.generateRoomId();
    this.rooms[roomId] = {};
    this.rooms[roomId]['playersLimit'] = data.playersLimit;
    this.rooms[roomId]['matrix'] = [];
    this.rooms[roomId]['players'] = Array();
    this.rooms[roomId]['players'].push(data.player);
    socket.join(roomId);
    ackCallback({
      status: 'created',
      playersLimit: data.playersLimit,
      players: this.rooms[roomId]['players'],
      roomId: roomId,
    });
    console.log(
      'Room Created :- ',
      roomId,
      'No Of Players :- ',
      data.playersLimit,
      'With Player Name :- ',
      data.player.name
    );
  } catch (e) {
    ackCallback({
      status: 'exception',
      message: 'Something went wrong, please try to create again.',
    });
  }
};

Server.prototype.joinGame = function (socket, data, ackCallback) {
  try {
    var roomId = data.roomId;
    var payload = {};
    if (this.isRoomExist(roomId)) {
      if (!this.isRoomFull(roomId)) {
        if (!this.isPlayerNameExist(roomId, data.player.name)) {
          if (!this.isPlayerColorExist(roomId, data.player.color)) {
            this.rooms[roomId]['players'].push(data.player);
            socket.join(roomId);

            let playersLimit = this.rooms[roomId]['playersLimit'];
            let players = this.rooms[roomId]['players'];

            // Shuffle Players List Cause Each Player Randomly Gets First Chance When Game Started.
            if (players.length === playersLimit) {
              players = _.shuffle(players);
              this.rooms[roomId]['players'] = players;
            }

            payload = {
              status: 'joined',
              roomId: roomId,
              playersLimit: playersLimit,
              players: players,
            };

            console.log(
              'Room Joined :- ',
              roomId,
              'Name :- ',
              data.player.name
            );
          } else {
            payload = {
              status: 'error',
              code: 'color_exist',
              message: 'This color is already taken.',
            };
          }
        } else {
          payload = {
            status: 'error',
            code: 'name_exist',
            message: 'This name is already taken.',
          };
        }
      } else {
        payload = {
          status: 'error',
          code: 'room_full',
          message: 'This game room is already full.',
        };
      }
    } else {
      payload = {
        status: 'error',
        code: 'invalid_room_id',
        message: 'Please enter a valid room code.',
      };
    }
    if (payload['status'] == 'joined') {
      socket.broadcast.to(roomId).emit('joined', {
        roomId: roomId,
        playersLimit: this.rooms[roomId]['playersLimit'],
        players: this.rooms[roomId]['players'],
      });
    }
    ackCallback(payload);
  } catch (e) {
    ackCallback({
      status: 'exception',
      message: 'Something went wrong, please try to join again.',
    });
  }
};

Server.prototype.reJoinGame = function (socket, data) {
  var roomId = data.roomId;
  if (this.isRoomExist(roomId)) {
    socket.join(roomId);
    console.log('Reconnected Game ', roomId, socket.id);
  }
};

Server.prototype.move = function (socket, data) {
  var roomId = data.roomId;
  if (this.isRoomExist(roomId)) {
    socket.broadcast.to(roomId).emit('on_played_move', {
      roomId: roomId,
      pos: data.pos,
      player: data.player,
    });
  }
};

Server.prototype.copyMatrixBoard = function (data) {
  var roomId = data.roomId;
  if (this.isRoomExist(roomId)) {
    // console.log('COPY MATRIX BOARD..');
    this.rooms[roomId]['matrix'] = data.matrix;
    // console.table(this.rooms[roomId]['matrix']);
  }
};

Server.prototype.removePlayerFromGame = function (socket, data) {
  var roomId = data.roomId;
  if (this.isRoomExist(roomId)) {
    var player = data.player;
    var players = this.rooms[roomId]['players'];
    var isGameStarted = data.isGameStarted;
    var index = players.findIndex((p) => p['color'] == player);
    if (index > -1) {
      var removedPlayer = players.splice(index, 1).pop();
      var playersLimit = this.rooms[roomId]['playersLimit'];
      if (isGameStarted) {
        playersLimit = playersLimit - 1;
        this.rooms[roomId]['playersLimit'] = playersLimit;
      }
      console.log('Removed Player ', removedPlayer, 'Players Limt ', playersLimit);
      var payload = {
        roomId: roomId,
        players: players,
        playersLimit: playersLimit,
        removedPlayer: removedPlayer,
      };
      console.log(payload);
      socket.broadcast.to(roomId).emit('on_player_removed', payload);
    }
  }
};

Server.prototype.removeGame = function (socket, data) {
  var roomId = data.roomId;
  if (this.isRoomExist(roomId)) {
    delete this.rooms[roomId];
    socket.broadcast.to(roomId).emit('on_game_removed', {
      status: 'success',
    });
  }
  console.log('REMOVE GAME ', this.rooms);
};

const server = new Server();
server.setConfiguration();
server.start();
