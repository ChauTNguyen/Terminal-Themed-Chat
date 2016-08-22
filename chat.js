'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var clients = [];
var users = {};

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.use(express.static(__dirname));

io.on('connection', function (socket) {
  clients.push(socket);
  io.emit('event message', "Anon has joined the room.");

  socket.on('event message', function (msg) {
    io.emit('event message', msg);
  });

  socket.on('chat message', function (msg) {
    var nickname = users[socket.id];
    if (nickname === undefined) {
      socket.broadcast.emit('chat message', "anon@" + socket.id.substring(2, socket.id.length) + ": " + msg);
    } else {
      socket.broadcast.emit('chat message', nickname + ": " + msg);
    }
  });

  socket.on('disconnect', function () {
    var index = clients.indexOf(socket);
    if (index !== -1) {
      clients.splice(index, 1);
      var nickname = users[socket.id];
      if (nickname === undefined) {
        io.emit('chat message', "anon@" + socket.id.substring(2, socket.id.length) + " has disconnected.");
      } else {
        io.emit('event message', users[socket.id] + " has disconnected.");
      }
      delete users[socket.id];
    }
  });

  socket.on('join', function (name) {
    var found = false;
    // check if name exists already.
    for (var prop in users) {
      if (users.hasOwnProperty(prop)) {
        if (users[prop] == name) {
          found = true;
        }
      }
    }

    if (!found) {
      users[socket.id] = name;
      io.emit('event message', "anon@" + socket.id.substring(2, socket.id.length) + " has become " + name + ".");
    } else {
      socket.emit('event message', "Nickname [" + name + "] already exists!");
    }
  });

  socket.on('ls', function () {
    var keys = [];
    for (var key in users) {
      if (users.hasOwnProperty(key)) {
        keys.push(key);
      }
    }

    var index = clients.indexOf(socket);
    clients[index].emit('event message', "There are " + keys.length + " users" +
      " & " + clients.length + " clients."
    );

    for (var i = 0; i < keys.length; ++i) {
      clients[index].emit('event message', users[keys[i]]);
    }
  });

  socket.on('pm', function (pm_target, pm_message) {
    if (users[socket.id] === undefined) {
      socket.emit('event message', "You must have a nickname in order to use /pm.");
    } else {
      var targetUserID;

      for (var prop in users) {
        if (users.hasOwnProperty(prop)) {
          if (users[prop] == pm_target) {
            targetUserID = prop;
          }
        }
      }

      if (targetUserID !== undefined) {
        var indexOfSender = clients.indexOf(socket);

        var indexOfRecipient;

        for (var i = 0; i < clients.length; ++i) {
          if (clients[i].id == targetUserID) {
            indexOfRecipient = i;
            break;
          }
        }

        if (clients[indexOfRecipient] !== socket) {
          socket.emit('chat message', "To [" + users[clients[indexOfRecipient].id] + "] - " + pm_message);
          clients[indexOfRecipient].emit(
            'chat message',
            "From [" + users[clients[indexOfSender].id] + "] - " + pm_message);
        } else {
          socket.emit('event message', "You cannot message yourself.");
        }
      } else {
        socket.emit('event message', "Nickname not found.");
      }
    }
  });
});

http.listen(3000, function () {
  console.log('listening on *:3000');
});