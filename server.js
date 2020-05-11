'use strict';

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
  console.log('Server Started On Port : ' + this.app.get('port'));
  this.realTimeRoutes();
};

Server.prototype.generateRoomId = function () {
  var roomId = Math.floor(10000 + Math.random() * 90000);
  if (roomId in this.rooms) {
    roomId = generateRoomId();
  }
  return roomId;
};

Server.prototype.realTimeRoutes = function () {
  var self = this;
  this.io.on('connection', function (socket) {
    console.log('connected :- ', socket.id);
    // var t1 = setInterval(() => {
    //   console.log(
    //     'Socket ID ' + socket.id + ' PING AT ' + new Date().toTimeString()
    //   );
    //   socket.emit('pingpong', {});
    // }, 45000);

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

    socket.on('remove_game', function () {
      let args = Array.prototype.slice.call(arguments);
      let data = JSON.parse(args.pop());
      self.removeGame(data);
    });

    socket.on('move', function () {
      let args = Array.prototype.slice.call(arguments);
      let data = JSON.parse(args.pop());
      self.move(socket, data);
    });

    socket.on('disconnect', function () {
      console.log('disconnect :- ', socket.id);
      // if (t1) {
      //   clearInterval(t1);
      // }
    });
  });
};

Server.prototype.createGame = function (socket, data, ackCallback) {
  try {
    var roomId = this.generateRoomId();
    this.rooms[roomId] = {};
    this.rooms[roomId]['playersCount'] = data.playersCount;
    this.rooms[roomId]['pTurnIndex'] = 0;
    this.rooms[roomId]['players'] = Array();
    this.rooms[roomId]['players'].push(data.player);
    socket.join(roomId);
    ackCallback({
      status: 'created',
      playersCount: data.playersCount,
      players: this.rooms[roomId]['players'],
      roomId: roomId,
    });
  } catch (e) {
    ackCallback({
      status: 'exception',
      message: 'Something went wrong, please try to create again.',
    });
  }
  console.log(this.rooms);
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
            payload = {
              status: 'joined',
              roomId: roomId,
              playersCount: this.rooms[roomId]['playersCount'],
              players: this.rooms[roomId]['players'],
            };
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
      console.log('joined :- ', socket.id);
      socket.broadcast.to(roomId).emit('joined', {
        roomId: roomId,
        playersCount: this.rooms[roomId]['playersCount'],
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
  console.log(this.rooms);
};

Server.prototype.removeGame = function (data) {
  var roomId = data.roomId;
  if (this.isRoomExist(roomId)) {
    delete this.rooms[roomId];
  }
  console.log('REMOVE GAME ', this.rooms);
};

Server.prototype.isRoomExist = function (roomId) {
  var room = this.rooms[roomId];
  return !room ? false : true;
};

Server.prototype.isRoomFull = function (roomId) {
  var room = this.rooms[roomId];
  var playersCount = room['playersCount'];
  var totalPlayers = room['players'].length;
  return playersCount === totalPlayers ? true : false;
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

Server.prototype.move = function (socket, data) {
  var roomId = data.roomId;
  console.log(data);
  console.log(roomId);
  if (this.isRoomExist(roomId)) {
    socket.broadcast.to(roomId).emit('on_played_move', {
      roomId: roomId,
      pos: data.pos,
      player: data.player,
    });
  }
};

const server = new Server();
server.setConfiguration();
server.start();
