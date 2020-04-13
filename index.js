"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv_1 = require("dotenv");
dotenv_1.config();
var winston_1 = __importDefault(require("winston"));
var express_1 = __importDefault(require("express"));
var http_1 = require("http");
var socket_io_1 = __importDefault(require("socket.io"));
var app = express_1.default();
var server = http_1.createServer(app);
var io = socket_io_1.default(server);
var silenceLog = process.env.LOGGING_SILENT === 'true';
var logger = winston_1.default.createLogger({
    silent: silenceLog,
    transports: [
        new winston_1.default.transports.Console(),
    ]
});
var port = process.env.PORT || 3003;
server.listen(port, function () {
    console.log('listening to port:', port);
});
var appState = {
    rooms: [
        {
            name: 'general',
            key: null,
            members: []
        }
    ]
};
function addMember(rooms, roomName, member) {
    var _a;
    var room = (_a = rooms.find(function (_) { return _.name === roomName; })) !== null && _a !== void 0 ? _a : { name: roomName, key: "", members: [] };
    room.members = __spreadArrays(room.members, [
        member
    ]);
    return { rooms: rooms, roomChanged: room };
}
function removeMember(rooms, roomName, memberId) {
    var _a;
    var room = (_a = rooms.find(function (_) { return _.name === roomName; })) !== null && _a !== void 0 ? _a : { name: roomName, key: "", members: [] };
    room.members = room.members.filter(function (_) { return _.id !== memberId; });
    return { rooms: rooms, roomChanged: room };
}
io
    .of('/signal')
    .on('connection', function (socket) {
    socket.on('command:join-room', function (payload) {
        var room = payload.room;
        var name = payload.name;
        var metadata = payload.metadata;
        socket.join(room);
        logger.info(name + " joined room " + room);
        socket.emit('self:joined-room', {
            room: room
        });
        var _a = addMember(appState.rooms, room, { id: socket.id, name: name, metadata: metadata }), rooms = _a.rooms, roomChanged = _a.roomChanged;
        appState.rooms = rooms;
        var joinedRoomEvent = {
            memberId: socket.id,
            name: name,
            members: roomChanged.members
        };
        socket.broadcast.to(room).emit('member:joined-room', joinedRoomEvent);
    });
    socket.on('disconnecting', function (reason) {
        logger.info(reason);
        var rooms = Object.keys(socket.rooms);
        rooms.forEach(function (room) {
            var _a = removeMember(appState.rooms, room, socket.id), rooms = _a.rooms, roomChanged = _a.roomChanged;
            appState.rooms = rooms;
            var event = {
                memberId: socket.id,
                members: roomChanged.members
            };
            socket.broadcast.to(room).emit('member:left-room', event);
        });
    });
    socket.on('send:to-room', function (msg) {
        var room = msg.room;
        var subject = msg.subject;
        var payload = msg.payload;
        socket.broadcast.to(room).emit(subject, payload);
    });
    socket.on('send:to-members', function (msg) {
        var socketIds = msg.memberIds;
        socketIds.forEach(function (socketId) {
            logger.info("sending private message to " + socketId + " from " + socket.id);
            socket.to(socketId).emit(msg.subject, msg.payload);
        });
    });
});
